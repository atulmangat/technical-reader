import os
from typing import AsyncGenerator, List
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from .llm import LLM

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


class GeminiLLM(LLM):
    def __init__(self, model: str = "gemini-2.0-flash", api_key: str = None):
        """
        Initialize the GeminiLLM with model and API key.

        Args:
            model: Gemini model to use
            api_key: API key for Gemini (defaults to environment variable)
        """
        api_key = api_key or GEMINI_API_KEY
        super().__init__(model=model, api_key=api_key)
        
        # Initialize the Gemini client
        self.client = genai.Client(api_key=api_key)
        
        # Default embedding model
        self.embedding_model = "text-embedding-004"

    def complete(
        self, prompt: str, response_schema = None, max_tokens: int = 1024, temperature: float = 0.7
    ) -> str:
        """
        Send a completion request to Gemini API and return the response.

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0-1)

        Returns:
            The text response from the model
        """
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,  # Lower temperature for more deterministic outputs
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=max_tokens,  
                    response_mime_type="application/json",
                    response_schema=response_schema,
                )
            )
            return response.text
        except Exception as e:
            print(f"Error calling Gemini API: {str(e)}")
            return f"Error: {str(e)}"

    async def stream(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """
        Send a streaming completion request to Gemini API and yield responses.

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0-1)

        Yields:
            Text chunks from the streaming response
        """
        try:
            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,  # Lower temperature for more deterministic outputs
                    top_p=0.95,
                    top_k=40,
                    max_output_tokens=max_tokens,  
                    response_mime_type="application/json",
                )
            ):
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            print(f"Error streaming from Gemini API: {str(e)}")
            yield f"Error: {str(e)}"
    
    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts using Gemini's embedding model.
        
        Args:
            texts: List of texts to generate embeddings for
            
        Returns:
            List of embedding vectors
        """
        try:
            response = self.client.models.embed_content(model=self.embedding_model, contents=texts)
            return [embedding.values for embedding in response.embeddings]
           
        except Exception as e:
            print(f"Error generating embeddings with Gemini: {str(e)}")
            return [] 