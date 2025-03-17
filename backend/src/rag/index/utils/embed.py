from typing import List
import logging
from ....config import config
from ....rag.llms.client import get_llm

# Set up logging
logger = logging.getLogger(__name__)

def generate_embeddings_batch(chunks: List[str]) -> List[List[float]]:
    """
    Generate embeddings for a batch of text chunks using the configured embedding provider.
    
    Args:
        chunks (List[str]): A list of text chunks to embed.
        
    Returns:
        List[List[float]]: A list of embedding vectors, one per input chunk.
    """
    try:
        # Get the configured embedding provider
        llm = get_llm(config.embedding_config.embedding_provider)
        embeddings = llm.get_embeddings(chunks)
        return embeddings
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        # Return empty embeddings to avoid breaking the pipeline
        # This will allow processing to continue but will result in empty vectors
        return [[] for _ in chunks]
    