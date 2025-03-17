from typing import Dict, Any, List, Optional
import logging
import fitz  # PyMuPDF
from sqlalchemy.orm import Session
from ...models.pdf import PDF
from .tool_interface import ToolInterface


# Create a content tool interface
content_tool = ToolInterface(
    name="content",
    description="""
    The content tool retrieves the content of specified pages from PDF documents, including surrounding pages.
    
    How to use this tool:
    - When a user wants to know about a specific topic in the book which is present in the table of contents.
    - Use table of contents to find the page numbers of the topic.
    - Use the get_page_range_content function to get the content of the topic.
    - Only use this tool when the user wants to know about a specific topic in the book which is present in the table of contents.
    
    """
)

# Set the injectable parameters for this tool
content_tool.set_injectable_params({"db"})

@content_tool.register_function
def get_page_content(
    pdf_id: int, 
    page_numbers: List[int],
    surrounding_pages: int = 4,
    db: Session = None
) -> List[Dict[str, Any]]:
    """
    Get the content of specified pages directly from the PDF file using PyMuPDF.
    
    Args:
        pdf_id: ID of the PDF document
        page_numbers: List of page numbers to retrieve
        surrounding_pages: Number of pages to include before and after each requested page (default: 0)
        db: Database session (injected)
        
    Returns:
        List of page objects with page number and content
    """
    if not page_numbers:
        return []
    
    # Get the PDF to check total pages and file path
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        logging.warning(f"PDF with ID {pdf_id} not found")
        return []
    
    # Calculate all pages to retrieve including surrounding pages
    all_pages_to_retrieve = set()
    for page_num in page_numbers:
        # Add the requested page
        all_pages_to_retrieve.add(page_num)
        
        # Add surrounding pages
        for offset in range(1, surrounding_pages + 1):
            all_pages_to_retrieve.add(page_num - offset)  # Pages before
            all_pages_to_retrieve.add(page_num + offset)  # Pages after
    
    # Ensure we don't exceed the document boundaries
    valid_page_numbers = [
        page_num for page_num in all_pages_to_retrieve 
        if 1 <= page_num <= pdf.total_pages
    ]
    
    if not valid_page_numbers:
        return []
    
    result = []
    try:
        # Open the PDF file using PyMuPDF
        doc = fitz.open(pdf.file_path)
        
        # Extract content from each requested page
        for page_num in valid_page_numbers:
            # PyMuPDF uses 0-based indexing, so subtract 1
            page = doc[page_num - 1]
            content = page.get_text()
            
            result.append({
                "page_number": page_num,
                "content": content,
            })
        
        doc.close()
    except Exception as e:
        logging.error(f"Error extracting content from PDF {pdf_id}: {str(e)}")
    
    # Sort by page number
    result.sort(key=lambda x: x["page_number"])
    
    return result
