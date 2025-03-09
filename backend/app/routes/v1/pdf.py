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
from ...core.database import get_db
from ...models.models import PDF, PDFResponse
from ...core.auth import get_current_user
from ...utils.common import generate_pdf_thumbnail
from ...rag.index.worker import PDFEmbeddingPipeline
from ...rag.index.queue import PDFQueue

router = APIRouter()

# Initialize the embedding pipeline
pdf_pipeline = PDFEmbeddingPipeline()

# Initialize the PDF processing queue
pdf_queue = PDFQueue()


@router.get("/api/pdfs", response_model=List[PDFResponse])
def get_pdfs(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    pdfs = db.query(PDF).filter(PDF.user_id == current_user.id).all()
    return pdfs


@router.post(
    "/api/pdf", response_model=PDFResponse, status_code=status.HTTP_201_CREATED
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
    )

    db.add(pdf)
    db.commit()
    db.refresh(pdf)

    # Add PDF to processing queue as a background task
    background_tasks.add_task(pdf_queue.add_to_queue, pdf.id, file_path, db)

    return pdf


@router.get("/api/pdf/{pdf_id}")
def get_pdf(pdf_id: int, db: Session = Depends(get_db)):
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    if not os.path.exists(pdf.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(
        pdf.file_path, media_type="application/pdf", filename=pdf.filename
    )
