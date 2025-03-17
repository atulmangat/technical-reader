from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
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
from pydantic import BaseModel
import fitz
router = APIRouter()

# Initialize the embedding pipeline
pdf_pipeline = PDFEmbeddingPipeline()

# Use the queue from the pipeline instead of creating a new one
pdf_queue = pdf_pipeline.queue


class PDFResponse(BaseModel):
    id: int
    title: str
    filename: str
    file_path: str
    thumbnail_path: str
    file_size: int


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
    thumbnail_path = generate_pdf_thumbnail(file_path)
    
    # Get total pages
    total_pages = get_total_pages(file_path)

    # Create PDF record
    pdf = PDF(
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
    pdf_id: int, 
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
