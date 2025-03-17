from typing import Dict, Any, List
import logging
from sqlalchemy.orm import Session
from ...models.note import Note
from .tool_interface import ToolInterface


# Create a notes tool interface
notes_tool = ToolInterface(
    name="notes",
    description="""
    The notes tool retrieves user-created notes from PDF documents.
    
    How to use this tool:
    - When a user asks about their notes: "Show me my notes about chapter two ?" or "What notes did I take about the methodology?"
    - When a user wants to find notes containing specific keywords: "Find my notes about the methodology" or "Show notes mentioning 'results'"
    - When a user wants to review their annotations: "What comments did I make?" or "Summarize my notes on this document"
    
    The tool can retrieve all notes, filter by page numbers, or search for specific keywords within notes.
    """
)

# Set the injectable parameters for this tool
notes_tool.set_injectable_params({"db"})

def _get_notes(pdf_id: int, db: Session) -> List[Dict[str, Any]]:
    """
    Internal function to get notes for a PDF
    
    Args:
        pdf_id: ID of the PDF
        db: Database session
        
    Returns:
        List of notes with page number and text
    """
    notes = db.query(Note).filter(Note.pdf_id == pdf_id).all()
    
    result = []
    for note in notes:
        result.append({
            "id": notes.id,
            "page_number": note.page_number,
            "note": note.note,
        })
    
    return result

@notes_tool.register_function
def get_all_notes(pdf_id: int, db: Session = None) -> List[Dict[str, Any]]:
    """
    Get notes for a PDF
    
    Args:
        pdf_id: ID of the PDF
        
    Returns:
        List of notes with page number and text
    """
    if db is None:
        raise ValueError("Database session is required but not provided")
    return _get_notes(pdf_id, db)

@notes_tool.register_function
def get_notes_by_page(pdf_id: int, page_numbers: List[int], db: Session = None, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get notes for specific pages in a PDF
    
    Args:
        pdf_id: ID of the PDF
        page_numbers: List of page numbers to get notes for
        limit: Maximum number of notes to return
        
    Returns:
        List of notes with page number and text
    """
    if db is None:
        raise ValueError("Database session is required but not provided")
    
    # Query notes for the specified pages
    notes = (
        db.query(Note)
        .filter(Note.pdf_id == pdf_id)
        .filter(Note.page_number.in_(page_numbers))
        .limit(limit)
        .all()
    )
    
    result = []
    for note in notes:
        result.append({
            "id": note.id,
            "page_number": note.page_number,
            "text": note.text,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        })
    
    return result

@notes_tool.register_function
def get_notes_by_keyword(pdf_id: int, keywords: List[str], db: Session = None, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get notes containing specific keywords in a PDF
    
    Args:
        pdf_id: ID of the PDF
        keywords: List of keywords to search for
        limit: Maximum number of notes to return
        
    Returns:
        List of notes with page number and text
    """
    if db is None:
        raise ValueError("Database session is required but not provided")
    
    # Build query with OR conditions for each keyword
    from sqlalchemy import or_
    
    # Start with the base query
    query = db.query(Note).filter(Note.pdf_id == pdf_id)
    
    # Add OR conditions for each keyword
    keyword_conditions = []
    for keyword in keywords:
        keyword_conditions.append(Note.text.ilike(f"%{keyword}%"))
    
    if keyword_conditions:
        query = query.filter(or_(*keyword_conditions))
    
    # Apply limit and execute
    notes = query.limit(limit).all()
    
    result = []
    for note in notes:
        result.append({
            "id": note.id,
            "page_number": note.page_number,
            "note": note.note,
        })
    
    return result
