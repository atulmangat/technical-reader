import os
from typing import AsyncGenerator
from mistralai import Mistral
from fastapi import HTTPException
from .llm import LLM
from dotenv import load_dotenv
from ...config import config

load_dotenv()


class MistralLLM(LLM):
    def __init__(self, model: str = "mistral-large-latest", api_key: str = None):
        """
        Initialize the MistralLLM with model and API key.

        Args:
            model: Mistral model to use
            api_key: API key for Mistral (defaults to environment variable)
        """
        api_key = api_key or os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY environment variable not set")

        super().__init__(model=model, api_key=api_key)
        self.client = Mistral(api_key=api_key)
        self.embedding_model = "mistral-embed"

    def complete(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> str:
        """
        Generate a completion using Mistral API

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0-1)

        Returns:
            The text response from the model
        """
        try:
            messages = [{"role": "user", "content": prompt}]

            response = self.client.chat.complete(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                safe_prompt=True,
            )

            return response.choices[0].message.content
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Mistral API error: {str(e)}")

    async def stream(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion using Mistral API

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0-1)

        Yields:
            Text chunks from the streaming response
        """
        try:
            messages = [{"role": "user", "content": prompt}]

            # Get the stream response as an async generator
            stream = self.client.chat.stream(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                safe_prompt=True,
            )
            
            # Iterate through the async generator
            for chunk in stream:
                if chunk.data.choices[0].delta.content is not None:
                    yield chunk.data.choices[0].delta.content
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Mistral API error: {str(e)}")

    
    def get_embeddings(self, chunks: list[str]) -> list[list[float]]:
        """
        Uses the Mistral Embed model to generate embeddings in batch.
        Each input chunk is embedded into a vector of size 1024.
        Rate limited to MAX_CALLS_PER_MINUTE API calls per minute.

        Args:
            chunks (List[str]): A list of text chunks to embed.

        Returns:
            List[List[float]]: A list of embedding vectors, one per input chunk.
        """
        import time
        import logging
        logger = logging.getLogger(__name__)
        
        all_embeddings = []
        max_retries = 3
        
        # If no chunks, return empty list
        if not chunks:
            return []

        for i in range(0, len(chunks), config.embedding_config.batch_size):
            batch = chunks[i : i + config.embedding_config.batch_size]
            
            # Skip empty chunks
            batch = [chunk for chunk in batch if chunk and len(chunk.strip()) > 0]
            if not batch:
                continue
                
            # Try with retries and exponential backoff
            for retry in range(max_retries):
                try:
                    logger.info(f"Generating embeddings for batch {i//config.embedding_config.batch_size + 1} (size: {len(batch)})")
                    response = self.client.embeddings.create(model=self.embedding_model, inputs=batch)
                    batch_embeddings = [data.embedding for data in response.data]
                    all_embeddings.extend(batch_embeddings)
                    break  # Success, exit retry loop
                except Exception as e:
                    logger.error(f"Error generating embeddings (attempt {retry+1}/{max_retries}): {str(e)}")
                    if "Too many tokens in batch" in str(e) and config.embedding_config.batch_size > 1:
                        # If token limit error, process one by one
                        logger.info("Token limit exceeded, processing chunks individually")
                        for single_chunk in batch:
                            try:
                                single_response = self.client.embeddings.create(
                                    model=self.embedding_model, 
                                    inputs=[single_chunk]
                                )
                                all_embeddings.append(single_response.data[0].embedding)
                                # Small delay to avoid rate limits
                                time.sleep(0.1)
                            except Exception as single_e:
                                logger.error(f"Error with single chunk: {str(single_e)}")
                                # Add empty embedding to maintain alignment
                                all_embeddings.append([])
                        break  # Exit retry loop after individual processing
                    elif retry < max_retries - 1:
                        # Wait before retrying (exponential backoff)
                        wait_time = 2 ** retry
                        logger.info(f"Retrying in {wait_time} seconds...")
                        time.sleep(wait_time)
                    else:
                        # Last retry failed, add empty embeddings to maintain alignment
                        logger.error(f"Failed to generate embeddings after {max_retries} retries")
                        all_embeddings.extend([[] for _ in batch])

        return all_embeddings