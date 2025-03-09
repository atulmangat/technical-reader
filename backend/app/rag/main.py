# Main expose 2 endpoints
# Index a PDF
# Search for a PDF index

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from ..app.utils.database import get_db
from ..app.utils.auth import get_current_user
from ..app.utils.models import PDF, User
from .index.worker import PDFEmbeddingPipeline
from .index.queue import PDFQueue
from .index.utils.batcher import EmbeddingBatcher
from .index.store.embedding import VectorDB
from .index.store.keyword import KeywordDB
from .index.worker import PDFWorker

router = APIRouter()
pdf_pipeline = PDFEmbeddingPipeline()

# Initialize PDF worker components
pdf_queue = PDFQueue()
vector_db = VectorDB()
keyword_db = KeywordDB()
embedding_batcher = EmbeddingBatcher(vector_db)
pdf_worker = PDFWorker(pdf_queue, embedding_batcher, vector_db, keyword_db)

# Start the PDF worker thread
pdf_worker.start()


class SearchQuery(BaseModel):
    query: str
    pdf_id: int
    top_k: int = 5


class SearchResult(BaseModel):
    chunks: List[str]
    scores: List[float]
    metadata: List[Dict[str, Any]]


@router.post("/index/{pdf_id}")
def index_pdf(
    pdf_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Index a PDF document for RAG"""
    pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == current_user.id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    try:
        result = pdf_pipeline.process_pdf(pdf_id, pdf.file_path, db)
        return {"message": "PDF indexed successfully", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error indexing PDF: {str(e)}")


@router.post("/search", response_model=SearchResult)
def search_pdf(
    search_query: SearchQuery,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for content in an indexed PDF"""
    pdf = (
        db.query(PDF)
        .filter(PDF.id == search_query.pdf_id, PDF.user_id == current_user.id)
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    if not pdf.has_embeddings:
        raise HTTPException(status_code=400, detail="PDF has not been indexed yet")

    try:
        results = pdf_pipeline.get_relevant_chunks(
            search_query.query, search_query.pdf_id, top_k=search_query.top_k
        )

        # Format results
        chunks = [r.page_content for r in results]
        scores = [r.metadata.get("score", 0.0) for r in results]
        metadata = [r.metadata for r in results]

        return SearchResult(chunks=chunks, scores=scores, metadata=metadata)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching PDF: {str(e)}")
