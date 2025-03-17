from fastapi import APIRouter, Depends, HTTPException, status, Path, Body
from sqlalchemy.orm import Session
from ...utils.database import get_db
from ...models.pdf import PDF
from ...models.highlight import Highlight
from ...utils.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class HighlightRequest(BaseModel):
    page_number: int
    x_start: float
    y_start: float
    x_end: float
    y_end: float
    color: str
    content: str
    note: Optional[str] = ""


class HighlightResponse(BaseModel):
    highlight_id: int
    content: Optional[str] = ""
    page_number: int
    x_start: float
    y_start: float
    x_end: float
    y_end: float
    color: str
    pdf_id: int
    timestamp: str


@router.get("/{pdf_id}/highlights", response_model=list[HighlightResponse])
def get_highlights(
    pdf_id: int = Path(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify PDF exists and belongs to user
    pdf = (
        db.query(PDF)
        .filter(
            PDF.id == pdf_id, PDF.user_id == current_user.id
        )
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    # Query highlights from the Highlight model
    highlights = (
        db.query(Highlight)
        .filter(
            Highlight.pdf_id == pdf_id,
            Highlight.user_id == current_user.id
        )
        .all()
    )

    # Convert to response format
    result = []
    for highlight in highlights:
        result.append({
            "highlight_id": highlight.id,
            "content": highlight.content,
            "page_number": highlight.page_number,
            "x_start": highlight.x_start,
            "y_start": highlight.y_start,
            "x_end": highlight.x_end,
            "y_end": highlight.y_end,
            "color": highlight.color,
            "note": highlight.note if hasattr(highlight, "note") else "",
            "pdf_id": pdf_id,
            "timestamp": highlight.created_at.isoformat()
        })

    return result


@router.post("/{pdf_id}/highlights", response_model=HighlightResponse)
def add_highlight(
    pdf_id: int = Path(...),
    highlight_request: HighlightRequest = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify PDF exists and belongs to user
    pdf = (
        db.query(PDF)
        .filter(
            PDF.id == pdf_id, PDF.user_id == current_user.id
        )
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    # Create new highlight in the database
    new_highlight = Highlight(
        content=highlight_request.content,
        page_number=highlight_request.page_number,
        x_start=highlight_request.x_start,
        y_start=highlight_request.y_start,
        x_end=highlight_request.x_end,
        y_end=highlight_request.y_end,
        note=highlight_request.note,
        color=highlight_request.color,
        pdf_id=pdf_id,
        user_id=current_user.id
    )
    
    db.add(new_highlight)
    db.commit()
    db.refresh(new_highlight)
    
    # Return the created highlight in the response format
    return {
        "highlight_id": new_highlight.id,
        "content": new_highlight.content,
        "page_number": new_highlight.page_number,
        "x_start": new_highlight.x_start,
        "y_start": new_highlight.y_start,
        "x_end": new_highlight.x_end,
        "y_end": new_highlight.y_end,
        "color": new_highlight.color,
        "note": new_highlight.note,
        "pdf_id": pdf_id,
        "timestamp": new_highlight.created_at.isoformat()
    }


@router.delete("/{pdf_id}/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_highlight(
    pdf_id: int = Path(...),
    highlight_id: int = Path(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify PDF exists and belongs to user
    pdf = (
        db.query(PDF)
        .filter(
            PDF.id == pdf_id, PDF.user_id == current_user.id
        )
        .first()
    )
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    # Find the highlight to delete
    highlight = (
        db.query(Highlight)
        .filter(
            Highlight.id == highlight_id,
            Highlight.pdf_id == pdf_id,
            Highlight.user_id == current_user.id
        )
        .first()
    )
    
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight not found")
    
    # Delete the highlight
    db.delete(highlight)
    db.commit()

