"""
Client module for interacting with LLMs.
Provides a simple interface to call the LLM using the existing implementation.
"""
import os
import logging
from typing import Dict, Any, Optional, List
from .llm import LLM
from .mistral import MistralLLM
from .deepseek import DeepseekLLM
from .gemini import GeminiLLM
from ...config import config
from google import genai

# Configure logging
logger = logging.getLogger(__name__)

# Default LLM to use
DEFAULT_LLM_TYPE = config.llm_config.default_llm

# Cache for LLM instances
_llm_instances = {}

def get_llm(llm_type: str = DEFAULT_LLM_TYPE) -> LLM:
    """
    Get an LLM instance of the specified type.
    
    Args:
        llm_type: Type of LLM to use (mistral, deepseek, or gemini)
        
    Returns:
        An instance of the specified LLM
    """
    global _llm_instances
    
    # Return cached instance if available
    if llm_type in _llm_instances:
        return _llm_instances[llm_type]
    
    # Create a new instance
    if llm_type.lower() == "mistral":
        model = os.environ.get("MISTRAL_MODEL", "mistral-large-latest")
        llm = MistralLLM(model=model)
    elif llm_type.lower() == "deepseek":
        model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
        llm = DeepseekLLM(model=model)
    elif llm_type.lower() == "gemini":
        model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        llm = GeminiLLM(model=model)
    else:
        raise ValueError(f"Unsupported LLM type: {llm_type}")
    
    # Cache the instance
    _llm_instances[llm_type] = llm
    
    return llm

def call_llm(
    prompt: str, 
    max_tokens: int = 1024, 
    temperature: float = 0.7,
    llm_type: str = DEFAULT_LLM_TYPE,
    response_schema: Optional[genai.types.Schema] = None
) -> str:
    """
    Call the LLM with a prompt and return the response.
    
    Args:
        prompt: The prompt to send to the LLM
        max_tokens: Maximum number of tokens to generate
        temperature: Controls randomness (0-1)
        llm_type: Type of LLM to use (mistral, deepseek, or gemini)
        
    Returns:
        The text response from the LLM
    """
    try:
        llm = get_llm(llm_type)
        response = llm.complete(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            response_schema=response_schema
        )
        return response
    except Exception as e:
        logger.error(f"Error calling LLM: {e}")
        return f"Error: {str(e)}"

async def stream_llm(
    prompt: str, 
    max_tokens: int = 1024, 
    temperature: float = 0.7,
    llm_type: str = DEFAULT_LLM_TYPE
):
    """
    Stream responses from the LLM.
    
    Args:
        prompt: The prompt to send to the LLM
        max_tokens: Maximum number of tokens to generate
        temperature: Controls randomness (0-1)
        llm_type: Type of LLM to use (mistral, deepseek, or gemini)
        
    Yields:
        Text chunks from the streaming response
    """
    try:
        llm = get_llm(llm_type)
        # Get the stream generator directly - no await needed here
        stream_generator = llm.stream(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        # Iterate over the async generator
        async for chunk in stream_generator:
            yield chunk
    except Exception as e:
        logger.error(f"Error streaming from LLM: {e}")
        yield f"Error: {str(e)}"

def get_embeddings(texts: List[str], llm_type: str = DEFAULT_LLM_TYPE) -> List[List[float]]:
    """
    Generate embeddings for a list of texts.
    
    Args:
        texts: List of texts to generate embeddings for
        llm_type: Type of LLM to use for embeddings (currently only gemini supported)
        
    Returns:
        List of embedding vectors
    """
    try:
        if llm_type.lower() != "gemini":
            logger.warning(f"Embedding generation is currently only supported with Gemini. Using Gemini instead of {llm_type}.")
            llm_type = "gemini"
            
        llm = get_llm(llm_type)
        
        # Check if the LLM has the get_embeddings method
        if not hasattr(llm, 'get_embeddings'):
            raise ValueError(f"The LLM type {llm_type} does not support embedding generation.")
            
        return llm.get_embeddings(texts)
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        return [] 