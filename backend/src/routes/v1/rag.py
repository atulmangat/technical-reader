from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, List, AsyncGenerator
from pydantic import BaseModel
from ...utils.database import get_db
from ...models.pdf import PDF
from ...rag.utils.tools import run_with_tools, generate_no_tools_prompt
from ...rag.llms.client import stream_llm
from ...rag.index.store.embeddings import get_vector_db, VectorDB
from ...rag.tools.content import get_page_content
from ...utils.auth import get_current_user
from ...models.user import User
import logging
import json

router = APIRouter()

logger = logging.getLogger(__name__)

class ChatRequest(BaseModel):
    """Chat request model"""
    query: str
    model: str = "mistral"  # Default to mistral
    use_tools: bool = True  # Flag to determine whether to use tools
    detailed_response: bool = False  # Flag to determine whether to provide detailed responses
    context: list[str] = []
    conversation_history: List[Dict[str, str]] = []
    current_page: int = None  # Current page number in the PDF



@router.post("/{pdf_id}/chat")
async def chat(
    request: ChatRequest,
    pdf_id: str = Path(..., description="The ID of the PDF to chat with"), 
    db: Session = Depends(get_db), 
    vector_db: VectorDB = Depends(get_vector_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a chat conversation with a PDF using the RAG system, optionally with tools.
    
    This endpoint streams the response back to the client.
    
    This endpoint:
    1. Takes conversation history and PDF ID
    2. Retrieves context from the PDF
    3. If use_tools is True, processes the query with tools
    4. Otherwise, generates a direct response using the conversation history
    5. Streams the response back to the client
    """
    try:
        # Verify the PDF exists and belongs to the current user
        pdf = db.query(PDF).filter(
            PDF.id == pdf_id,
            PDF.user_id == current_user.id
        ).first()
        
        if not pdf:
            raise HTTPException(status_code=404, detail=f"PDF with ID {pdf_id} not found or you don't have access to it")
        
        # Get context from the PDF
        context = f"PDF: {pdf.title}\nFilename: {pdf.filename}\nID: {pdf.id}" + "\n\n" + "\n\n".join(request.context)
        
        # Add surrounding page context if current_page is provided
        if request.current_page is not None:
            # Get content from current, previous, and next pages
            try:        
                # Use get_page_content to retrieve the page content
                page_content = get_page_content(pdf_id, [request.current_page], surrounding_pages=2, db=db)
                if page_content:
                    context += "\n\n" + "\n\n".join(page_content)
            except Exception as e:
                # Log the error but continue without the page context
                logger.error(f"Error retrieving page context: {str(e)}")
        
        async def stream_response() -> AsyncGenerator[bytes, None]:
            if request.use_tools:                
                # Call run_with_tools with conversation history
                generator = run_with_tools(
                    pdf_id=pdf_id,
                    user_query=request.query,
                    context=context,
                    conversation_history=request.conversation_history,
                    db=db,
                    vector_db=vector_db,
                    detailed_response=request.detailed_response
                )
                
                # Stream the response
                async for chunk in generator:
                    if chunk.startswith("data:"):
                        # If the chunk is already formatted as SSE data, just encode it
                        yield chunk.encode()
                    else:
                        # Otherwise, format it as SSE data
                        yield f"data: {json.dumps({'response': chunk})}\n\n".encode()
            else:
                # Direct LLM call without tools (streaming version)
                # Convert messages to conversation history format
                prompt = generate_no_tools_prompt(
                    user_query=request.query,
                    context=context,
                    conversation_history=request.conversation_history,
                    detailed_response=request.detailed_response
                )                
                async for chunk in stream_llm(prompt=prompt, llm_type=request.model):
                    if chunk.startswith("data:"):
                        # If the chunk is already formatted as SSE data, just encode it
                        yield chunk.encode()
                    else:
                        # Otherwise, format it as SSE data
                        yield f"data: {json.dumps({'response': chunk})}\n\n".encode()
            
            # Signal the end of the stream
            yield "data: [DONE]\n\n".encode()
        
        return StreamingResponse(
            stream_response(),
            media_type="text/event-stream"
        )
    
    except Exception as e:
        logger.exception(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

