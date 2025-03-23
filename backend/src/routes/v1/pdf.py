from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
    Path,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
from ...utils.database import get_db
from ...models.pdf import PDF
from ...utils.auth import get_current_user
from ...utils.common import generate_pdf_thumbnail
from ...rag.index.worker import PDFEmbeddingPipeline
from ...rag.index.queue import PDFQueue
from ...rag.index.store.embeddings import VectorDB
from pydantic import BaseModel
import fitz
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize the embedding pipeline
pdf_pipeline = PDFEmbeddingPipeline()

# Use the queue from the pipeline instead of creating a new one
pdf_queue = pdf_pipeline.queue

# Initialize vector database connection
vector_db = VectorDB()

thumbnail_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "thumbnails")


class PDFResponse(BaseModel):
    id: str
    title: str
    filename: str
    file_path: str
    thumbnail_path: Optional[str] = None
    file_size: int
    total_pages: int = None


class PDFUpdateRequest(BaseModel):
    title: str


def get_total_pages(file_path: str) -> int:
    with open(file_path, "rb") as file:
        reader = fitz.open(file)
        return reader.page_count

@router.get("/", response_model=List[PDFResponse])
def get_pdfs(
    current_user=Depends(get_current_user), 
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    pdfs = db.query(PDF).filter(PDF.user_id == current_user.id).offset(skip).limit(limit).all()
    
    for pdf in pdfs:
        # Ensure total_pages is populated
        if pdf.total_pages is None and os.path.exists(pdf.file_path):
            try:
                pdf.total_pages = get_total_pages(pdf.file_path)
                db.commit()
            except Exception as e:
                logger.error(f"Error getting page count for PDF {pdf.id}: {e}")
    
    return pdfs


@router.post(
    "/", response_model=PDFResponse, status_code=status.HTTP_201_CREATED
)
def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type")

    filename = file.filename

    # Create upload directory if it doesn't exist
    upload_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    # Save the file
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Get file size
    file_size = os.path.getsize(file_path)

    # Generate thumbnail
    thumbnail_path = generate_pdf_thumbnail(thumbnail_dir, file_path)
    
    # Get total pages
    total_pages = get_total_pages(file_path)

    # Generate unique ID at user level
    pdf_id = PDF.generate_unique_id(db, current_user.id)

    # Create PDF record
    pdf = PDF(
        id=pdf_id,
        title=title,
        filename=filename,
        file_path=file_path,
        thumbnail_path=thumbnail_path,
        file_size=file_size,
        description=description,
        user_id=current_user.id,
        has_embeddings=False,
        total_pages=total_pages
    )

    db.add(pdf)
    db.commit()
    db.refresh(pdf)

    pdf_queue.add_to_queue(pdf.id, file_path, db)

    return pdf


@router.get("/{pdf_id}")
def get_pdf(
    pdf_id: str, 
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pdf = db.query(PDF).filter(
        PDF.id == pdf_id,
        PDF.user_id == current_user.id
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")

    if not os.path.exists(pdf.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(
        pdf.file_path, media_type="application/pdf", filename=pdf.filename
    )


@router.get("/{pdf_id}/thumbnail")
def get_thumbnail(
    pdf_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == current_user.id).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")
    
    # Check if the PDF file exists
    if not os.path.exists(pdf.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
        
 
    thumbnail_path = os.path.join(thumbnail_dir, pdf.thumbnail_path)
    if not os.path.exists(thumbnail_path):
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
    
    return FileResponse(thumbnail_path, media_type="image/jpeg")
        
    
   


@router.delete("/{pdf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdf(
    pdf_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Find the PDF by ID and user ID (to ensure users can only delete their own PDFs)
    pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == current_user.id).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")
    
    logger.info(f"Deleting PDF {pdf_id}: {pdf.title}")
    
    # Delete the actual PDF file if it exists
    if pdf.file_path and os.path.exists(pdf.file_path):
        logger.info(f"Deleting PDF file: {pdf.file_path}")
        os.remove(pdf.file_path)
    else:
        logger.warning(f"PDF file not found for deletion: {pdf.file_path}")
    
    # Delete the thumbnail if it exists
    if pdf.thumbnail_path:
        thumbnail_path = os.path.join(thumbnail_dir, pdf.thumbnail_path)
        
        if os.path.exists(thumbnail_path):
            logger.info(f"Deleting thumbnail: {thumbnail_path}")
            os.remove(thumbnail_path)
        else:
            logger.warning(f"Thumbnail not found for deletion at path: {thumbnail_path}")
    else:
        logger.warning("No thumbnail path found in database for this PDF")
    
    # Delete embeddings from vector database
    try:
        vector_db.delete_embeddings(pdf_id)
        logger.info(f"Deleted embeddings for PDF {pdf_id}")
    except Exception as e:
        logger.error(f"Error deleting embeddings for PDF {pdf_id}: {str(e)}")
    
    # Delete the PDF record from the database
    # The cascade will automatically delete associated notes and highlights
    db.delete(pdf)
    db.commit()
    logger.info(f"Successfully deleted PDF {pdf_id} and all associated resources")
    
    return None


@router.patch("/{pdf_id}", response_model=PDFResponse)
def update_pdf(
    pdf_id: str,
    update_data: PDFUpdateRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a PDF's metadata (currently just the title)"""
    pdf = db.query(PDF).filter(
        PDF.id == pdf_id,
        PDF.user_id == current_user.id
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")

    # Update title
    pdf.title = update_data.title
    
    db.commit()
    db.refresh(pdf)
    
    return pdf
