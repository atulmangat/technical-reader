from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ...models.highlight import Highlight
from .tool_interface import ToolInterface


# Create a highlights tool interface
highlights_tool = ToolInterface(
    name="highlights",
    description="""
    The highlights tool retrieves user-created highlights from PDF documents.
    
    How to use this tool:
    - When a user asks about their highlights: "Show me my highlights of chapter 2" or "What parts did I highlight in chapter two?"
    - When a user wants to find highlights containing specific keywords: "Find my highlights about methodology" or "Show highlights mentioning 'climate change'"
    - When a user wants to review important sections they marked: "What were the key points I highlighted?" or "Summarize my highlighted sections"
    
    The tool can retrieve all highlights, filter by page numbers, or search for specific keywords within highlights.
    """
)

# Set the injectable parameters for this tool
highlights_tool.set_injectable_params({"db"})
highlights_tool.set_injectable_params({"pdf_id"})

def _get_highlights(pdf_id: int, db: Session) -> List[Dict[str, Any]]:
    """
    Internal function to get highlights for a PDF
    
    Args:
        pdf_id: ID of the PDF
        db: Database session
        
    Returns:
        List of highlights with page number, text, and color
    """
    highlights = db.query(Highlight).filter(Highlight.pdf_id == pdf_id).all()
    
    result = []
    for highlight in highlights:
        result.append({
            "id": highlight.id,
            "page_number": highlight.page_number,
            "content": highlight.content,
            "note": highlight.note,
        })
    
    return result

@highlights_tool.register_function
def get_all_highlights(pdf_id: int, db: Session = None) -> List[Dict[str, Any]]:
    """
    Get highlights for a PDF
    
    Args:
        pdf_id: ID of the PDF (injected)
        
    Returns:
        List of highlights with page number, text, and color
    """
    if db is None:
        raise ValueError("Database session is required but not provided")
    return _get_highlights(pdf_id, db)

@highlights_tool.register_function
def get_highlights_by_page(pdf_id: int, page_numbers: List[int], db: Session = None, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get highlights for specific pages in a PDF
    
    Args:
        pdf_id: ID of the PDF (injected)
        page_numbers: List of page numbers to get highlights for
        limit: Maximum number of highlights to return
        
    Returns:
        List of highlights with page number, text, and color
    """
    if db is None:
        raise ValueError("Database session is required but not provided")
    
    # Query highlights for the specified pages
    highlights = (
        db.query(Highlight)
        .filter(Highlight.pdf_id == pdf_id)
        .filter(Highlight.page_number.in_(page_numbers))
        .limit(limit)
        .all()
    )
    
    result = []
    for highlight in highlights:
        result.append({
            "id": highlight.id,
            "page_number": highlight.page_number,
            "content": highlight.content,
            "note": highlight.note,
        })
    
    return result

@highlights_tool.register_function
def get_highlights_by_keyword(pdf_id: int, keywords: List[str], db: Session = None, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Get highlights containing specific keywords in a PDF
    
    Args:
        pdf_id: ID of the PDF (injected)
        keywords: List of keywords to search for
        limit: Maximum number of highlights to return
        
    Returns:
        List of highlights with page number, text, and color
    """
    if db is None:
        raise ValueError("Database session is required but not provided")
    
    # Build query with OR conditions for each keyword
    from sqlalchemy import or_
    
    # Start with the base query
    query = db.query(Highlight).filter(Highlight.pdf_id == pdf_id)
    
    # Add OR conditions for each keyword
    keyword_conditions = []
    for keyword in keywords:
        keyword_conditions.append(Highlight.content.ilike(f"%{keyword}%"))
    
    if keyword_conditions:
        query = query.filter(or_(*keyword_conditions))
    
    # Apply limit and execute
    highlights = query.limit(limit).all()
    
    result = []
    for highlight in highlights:
        result.append({
            "id": highlight.id,
            "page_number": highlight.page_number,
            "content": highlight.content,
            "note": highlight.note,
        })
    
    return result

   