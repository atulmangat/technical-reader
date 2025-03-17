from fastapi import APIRouter, Depends, HTTPException, Path, Body
from ...models.note import Note
from ...models.pdf import PDF
from ...utils.auth import get_current_user
from ...utils.database import get_db
from sqlalchemy.orm import Session
from pydantic import BaseModel

router = APIRouter()


class SaveNotesRequest(BaseModel):
    note: str
    page_number: int
    x_position: float
    y_position: float

class NoteResponse(BaseModel):
    id: int
    note: str
    page_number: int
    x_position: float
    y_position: float
    pdf_id: int
    text: str
    timestamp: str
    

@router.post("/{pdf_id}/notes")
def save_notes(
    pdf_id: int = Path(...),
    request: SaveNotesRequest = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):  
    # Verify PDF exists and belongs to user
    pdf = db.query(PDF).filter(
        PDF.id == pdf_id, 
        PDF.user_id == current_user.id
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")
    
    # Create a new note
    new_note = Note(
        note=request.note,
        page_number=request.page_number,
        x_position=request.x_position,
        y_position=request.y_position,
        pdf_id=pdf_id,
        user_id=current_user.id
    )
    
    # Add to database and commit
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    
    return {
        "message": "Notes saved successfully",
        "note_id": new_note.id
    }


@router.get("/{pdf_id}/notes", response_model=list[NoteResponse])
def get_notes(
    pdf_id: int = Path(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    
):
    # Verify PDF exists and belongs to user
    pdf = db.query(PDF).filter(
        PDF.id == pdf_id, 
        PDF.user_id == current_user.id
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")
    
    # Query notes for the specific PDF and user
    notes = db.query(Note).filter(
        Note.pdf_id == pdf_id,
        Note.user_id == current_user.id
    ).all()
    
    # Return the notes directly as a list to match the response_model
    result = []
    for note in notes:
        result.append({
            "id": note.id,
            "note": note.note,
            "page_number": note.page_number,
            "x_position": note.x_position,
            "y_position": note.y_position,
            "pdf_id": note.pdf_id,
            "text": note.note,  # Using note content as text
            "timestamp": str(note.created_at)
        })
    
    return result


@router.delete("/{pdf_id}/notes/{note_id}")
def delete_notes(
    pdf_id: int = Path(...),
    note_id: int = Path(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify PDF exists and belongs to user
    pdf = db.query(PDF).filter(
        PDF.id == pdf_id, 
        PDF.user_id == current_user.id
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")
    
    # Find the note
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.pdf_id == pdf_id,
        Note.user_id == current_user.id
    ).first()
    
    # Check if note exists
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Delete the note
    db.delete(note)
    db.commit()
    
    return {"message": "Notes deleted successfully"}


@router.put("/{pdf_id}/notes/{note_id}", response_model=NoteResponse)
def update_notes(
    pdf_id: int = Path(...),
    note_id: int = Path(...),
    request: SaveNotesRequest  = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify PDF exists and belongs to user
    pdf = db.query(PDF).filter(
        PDF.id == pdf_id, 
        PDF.user_id == current_user.id
    ).first()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found or you don't have access to it")
    
    # Find the note
    note = db.query(Note).filter(
        Note.id == note_id,
        Note.pdf_id == pdf_id,
        Note.user_id == current_user.id
    ).first()
    
    # Check if note exists
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Update note fields
    note.note = request.note
    note.page_number = request.page_number
    note.x_position = request.x_position
    note.y_position = request.y_position
    
    # Commit changes
    db.commit()
    db.refresh(note)
    
    return {
        "message": "Notes updated successfully",
        "note": {
            "id": note.id,
            "note": note.note,
            "page_number": note.page_number,
            "x_position": note.x_position,
            "y_position": note.y_position,
            "pdf_id": note.pdf_id,
            "timestamp": str(note.created_at)
        }
    }
