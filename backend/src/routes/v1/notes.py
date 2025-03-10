from fastapi import APIRouter, Depends
from ...models.models import NotesUpdate
from ...core.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()


class SaveNotesRequest(BaseModel):
    pdf_id: int
    notes_data: NotesUpdate
    page_number: int
    text: str


class UpdateNotesRequest(BaseModel):
    pdf_id: int
    note_id: int
    notes_data: NotesUpdate
    page_number: int
    text: str


class DeleteNotesRequest(BaseModel):
    pdf_id: int
    note_id: int


class FetchNotesRequest(BaseModel):
    pdf_id: int


@router.post("/api/notes/{pdf_id}")
def save_notes(
    pdf_id: int,
    notes_data: NotesUpdate,
    current_user=Depends(get_current_user),
):
    return {"message": "Notes saved successfully"}


@router.get("/api/notes/{pdf_id}")
def get_notes(
    pdf_id: int,
    current_user=Depends(get_current_user),
):
    return {"message": "Notes retrieved successfully"}


@router.delete("/api/notes/{pdf_id}/{note_id}")
def delete_notes(
    pdf_id: int,
    note_id: int,
    current_user=Depends(get_current_user),
):
    return {"message": "Notes deleted successfully"}


@router.put("/api/notes/{pdf_id}/{note_id}")
def update_notes(
    pdf_id: int,
    note_id: int,
    notes_data: NotesUpdate,
):
    return {"message": "Notes updated successfully"}
