# implement the tool class for the embeddings
from typing import List, Dict, Any
import logging
from .tool_interface import ToolInterface
from ..index.store.embeddings import VectorDB
from ..index.utils.embed import generate_embeddings_batch

# Set up logging
logger = logging.getLogger(__name__)

# Create an embeddings tool interface
embeddings_tool = ToolInterface(
    name="embeddings",
    description="""
    The embeddings tool performs semantic search on PDF documents using vector embeddings.
    
    How to use this tool:
    - When a user asks a specific question about the document content: "What does this paper say about neural networks?" or "Find information about climate change in this document"
    - When a user wants to find specific concepts or topics: "Where does the document discuss methodology?" or "Find sections about data analysis"
    - When a user needs to locate semantically similar content: "Find parts similar to this paragraph" or "Where else does the author discuss this concept?"
    - For question answering that requires semantic understanding: "According to the document, what are the limitations of this approach?"
    - Use atleast 50 results to answer the user's query.
    - When user asks for a specific topic or a general question, You should use this tool to answer the user's query.
    - When user asks for document/pdf in general, Use summary or table of contents to answer the user's query.
    
    The tool converts queries into vector embeddings and finds the most semantically relevant sections in the document.
    """
)

# Set the injectable parameters for this tool
embeddings_tool.set_injectable_params({"vector_db"})

@embeddings_tool.register_function
def search_embeddings(pdf_id: int, query: str, top_k: int = 5, vector_db: VectorDB = None) -> Dict[str, Any]:
    """
    Search for similar content using vector embeddings
    
    Args:
        pdf_id: ID of the PDF document
        query: Search query text
        top_k: Number of results to return (default: 5)
        
    Returns:
        Dictionary with search results
    """
    try:
        if vector_db is None:
            raise ValueError("Vector database is required but not provided")
        
        # Log the incoming query for debugging
        logger.debug(f"Embedding search query: pdf_id={pdf_id}, query='{query}', top_k={top_k}")
        
        # First, convert the query string to an embedding vector
        query_embedding = generate_embeddings_batch([query])[0]
        
        # Log successful embedding generation
        logger.debug(f"Successfully generated embedding vector of length {len(query_embedding)}")
        
        # Now search using the embedding vector
        results = vector_db.search_embeddings(pdf_id, query_embedding, top_k)
        
        # Log the search results
        logger.debug(f"Search results: {results}")
        
        return results
    except Exception as e:
        logger.error(f"Error in search_embeddings: {str(e)}")
        return {"status": "error", "message": str(e)}
