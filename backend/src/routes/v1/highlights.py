from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ...core.database import get_db
from ...models.models import PDF
from ...core.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class CreateHighlightRequest(BaseModel):
    text: str
    page_number: int
    start_position: int
    end_position: int
    color: str
    note: Optional[str] = ""
    pdf_id: int


class DeleteHighlightRequest(BaseModel):
    highlight_id: int
    pdf_id: int


class FetchHighlightRequest(BaseModel):
    pdf_id: int


class UpdateHighlightRequest(BaseModel):
    highlight_id: int
    pdf_id: int
    text: str
    page_number: int
    start_position: int
    end_position: int
    color: str
    note: Optional[str] = ""


@router.get("/api/highlights", response_model=List[dict])
def get_highlights(
    fetch_highlight_request: FetchHighlightRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pdf = (
        db.query(PDF)
        .filter(
            PDF.id == fetch_highlight_request.pdf_id, PDF.user_id == current_user.id
        )
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    return pdf.highlights or []


@router.post("/api/highlights", response_model=dict)
def add_highlight(
    create_highlight_request: CreateHighlightRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pdf = (
        db.query(PDF)
        .filter(
            PDF.id == create_highlight_request.pdf_id, PDF.user_id == current_user.id
        )
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    highlight_dict = create_highlight_request.dict()
    highlight_dict["timestamp"] = datetime.utcnow().isoformat()

    if not pdf.highlights:
        pdf.highlights = []

    pdf.highlights.append(highlight_dict)
    db.commit()

    return highlight_dict


@router.put("/api/highlights", status_code=status.HTTP_204_NO_CONTENT)
def update_highlight(
    update_highlight_request: UpdateHighlightRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pdf = (
        db.query(PDF)
        .filter(
            PDF.id == update_highlight_request.pdf_id, PDF.user_id == current_user.id
        )
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    highlight_dict = update_highlight_request.dict()
    highlight_dict["timestamp"] = datetime.utcnow().isoformat()
