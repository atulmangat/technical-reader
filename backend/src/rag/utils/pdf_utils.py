import logging

logger = logging.getLogger(__name__)

def get_page_content(pdf_id, page_number, vector_db):
    """
    Get the content of a specific page from a PDF document.
    
    Args:
        pdf_id (int): The ID of the PDF document
        page_number (int): The page number to retrieve
        vector_db (VectorDB): Vector database instance
        
    Returns:
        str: The content of the page, or empty string if not found
    """
    try:
        # Build page filter
        page_filter = {"metadata.page": page_number, "metadata.pdf_id": pdf_id}
        
        # Query the vector database for chunks from this page
        results = vector_db.get_relevant_documents(
            "", 
            search_type="mmr", 
            filter=page_filter,
            fetch_k=10,  # Get several chunks from each page
            k=5,  # Return top 5 chunks
            lambda_mult=0.5  # Balance between relevance and diversity
        )
        
        if results:
            # Combine all chunks from the page
            page_text = "\n".join([doc.page_content for doc in results])
            return page_text
        else:
            logger.warning(f"No content found for PDF {pdf_id} page {page_number}")
            return ""
    except Exception as e:
        logger.error(f"Error retrieving page content for PDF {pdf_id} page {page_number}: {str(e)}")
        return "" 