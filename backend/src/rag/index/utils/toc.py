# Step 3: Main function to generate chapter mapping

from sqlalchemy.orm import Session
from ....utils.database import get_db
from ....models.pdf import PDF
import fitz
import json
import sys
from pydantic import BaseModel
from typing import List, Dict, Any
from ...llms.gemini import GeminiLLM
from ...llms.prompts import TABLE_OF_CONTENTS_PROMPT, format_prompt_template
from ...llms.schema import TOC_RESPONSE_SCHEMA
from loguru import logger

# Increase the limit for integer string conversion
# This addresses the "Exceeds the limit for integer string conversion" error
sys.set_int_max_str_digits(10000)  # Increase to a higher value than the default

class TableOfContent(BaseModel):
    chapter_number: int
    chapter_name: str
    start_page: int
    end_page: int
    chapter_topics: List[str]


# Helper function to extract table of contents using PyMuPDF directly
def extract_toc_using_pymupdf(doc, total_pages):
    """
    Extract table of contents from PDF using PyMuPDF's get_toc() method as a fallback.
    
    Args:
        doc: The fitz.Document object
        total_pages: Total number of pages in the document
        
    Returns:
        List[TableOfContent]: List of chapters with their details
    """
    toc_entries = doc.get_toc()
    if not toc_entries:
        return []
        
    chapters = []
    for i, entry in enumerate(toc_entries):
        # PyMuPDF ToC entries are in the format: [level, title, page, ...]
        level, title, page = entry[:3]
        
        # Only include top-level entries (usually chapters)
        if level > 1:
            continue
            
        # Calculate end page (either the start of the next chapter or the document end)
        end_page = total_pages
        for next_entry in toc_entries[i+1:]:
            if next_entry[0] <= level:  # Same or higher level (lower number)
                end_page = next_entry[2] - 1
                break
                
        chapters.append(TableOfContent(
            chapter_number=i+1,  # Use the index+1 as chapter number
            chapter_name=title,
            start_page=page,
            end_page=end_page,
            chapter_topics=[]  # No topics available from PyMuPDF ToC
        ))
        
    return chapters

# Step 1: Function to extract pages after finding a term
def extract_pages_after_term(doc, terms, num_pages=20):
    """
    Extracts text from the page where the first occurrence of any term in 'terms' is found
    and the next 'num_pages - 1' pages.

    Args:
        doc: The PDF document object.
        terms (list): List of terms to search for.
        num_pages (int): Number of pages to extract (default is 20).

    Returns:
        str: Extracted text or a message if no term is found.
    """
    total_pages = len(doc)
    print(f"Total pages: {total_pages}")
    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text()
        for term in terms:
            if term in text:
                start_page = page_num
                end_page = min(start_page + num_pages, total_pages)
                extracted_text = []
                for i in range(start_page, end_page):
                    extracted_text.append(doc[i].get_text())
                return "\n".join(extracted_text)
    return None


def extract_first_n_pages(doc, n=20):
    """
    Extract the text from the first n pages of a document.
    
    Args:
        doc: The PDF document object.
        n (int): Number of pages to extract.
        
    Returns:
        str: Combined text from the first n pages.
    """
    n = min(n, len(doc) - 1)
    # Combine the text of the first n pages
    return "\n".join([doc[i].get_text() for i in range(n)])


def parse_table_of_contents(pdf_id: str, db: Session = None) -> List[TableOfContent]:
    """Parse the table of contents from a PDF file using Google's Generative AI.
    
    Args:
        pdf_id (str): ID of the PDF in the database
        db (Session, optional): Database session. Defaults to None.
        
    Returns:
        List[TableOfContent]: List of chapters with their details
    """
    if db is None:
        db = next(get_db())
        
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if pdf is None:
        raise ValueError(f"PDF with id {pdf_id} not found")
    
    if pdf.table_of_contents is not None:
        return [TableOfContent(**chapter) for chapter in json.loads(pdf.table_of_contents)]
    
    pdf_path = pdf.file_path
    
    # List of terms for ToC-like sections
    doc = fitz.open(pdf_path)
    terms = [
        "Table of Contents",
        "Contents",
        "List of Chapters",
        "Index",
        "Outline",
        "Structure",
        "List of Sections",
        "Section Overview",
        "Features",
        "Articles",
        "Navigation",
        "Menu",
        "Site Map",
    ]

    # Extract the content
    extracted_content = extract_pages_after_term(doc, terms)
    if extracted_content is None:
        extracted_content = extract_first_n_pages(doc)

    # Construct the prompt using the template from prompts.py
    # We don't need to escape curly braces anymore since we're using the format_prompt_template function
    prompt = format_prompt_template(
        TABLE_OF_CONTENTS_PROMPT,
        total_pages=pdf.total_pages,
        extracted_content=extracted_content
    )
        
    try:
        # Call the LLM
        llm = GeminiLLM()
        response = llm.complete(prompt, max_tokens=10000, temperature=0.2, response_schema=TOC_RESPONSE_SCHEMA)
        # Extract chapters from the response
        
        # save the response to the pdf table of contents
        pdf.table_of_contents = response
        db.commit()
        db.refresh(pdf)
        chapters_data = json.loads(response).get("chapters", [])
        # Validate the structure matches our expected format
        validated_chapters = []
        for chapter in chapters_data:
            try:
                # Convert to our expected format
                validated_chapter = TableOfContent(
                    **chapter
                )
                validated_chapters.append(validated_chapter)
            except (ValueError, TypeError) as e:
                print(f"Error processing chapter: {e}")
                continue
                
        # If validated_chapters is empty, try to extract the ToC using PyMuPDF's get_toc method
        if not validated_chapters:
            logger.info(f"LLM-based ToC extraction failed for PDF {pdf_id}, trying PyMuPDF fallback")
            validated_chapters = extract_toc_using_pymupdf(doc, pdf.total_pages)
            
            if validated_chapters:
                # Convert to the expected format and save to the database
                chapters_data = [chapter.dict() for chapter in validated_chapters]
                toc_data = json.dumps({"chapters": chapters_data})
                pdf.table_of_contents = toc_data
                db.commit()
                db.refresh(pdf)
                logger.info(f"Successfully extracted ToC using PyMuPDF for PDF {pdf_id}")
            else:
                logger.warning(f"Failed to extract ToC using PyMuPDF for PDF {pdf_id}")
                
        doc.close()
        return validated_chapters
        
    except Exception as e:
        logger.error(f"Error parsing chapter information: {e}")
        
        # Try the fallback method when an exception occurs
        try:
            logger.info(f"Attempting PyMuPDF fallback due to error: {e}")
            doc = fitz.open(pdf_path)
            validated_chapters = extract_toc_using_pymupdf(doc, pdf.total_pages)
            
            if validated_chapters:
                # Convert to the expected format and save to the database
                chapters_data = [chapter.dict() for chapter in validated_chapters]
                toc_data = json.dumps({"chapters": chapters_data})
                pdf.table_of_contents = toc_data
                db.commit()
                db.refresh(pdf)
                logger.info(f"Successfully extracted ToC using PyMuPDF fallback for PDF {pdf_id}")
            
            doc.close()
            return validated_chapters
        except Exception as fallback_error:
            logger.error(f"Fallback ToC extraction also failed: {fallback_error}")
            return []


