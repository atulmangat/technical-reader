import os
from typing import AsyncGenerator, List
from dotenv import load_dotenv
import google.generativeai as genai
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

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)
        self.embedding_model = "models/embedding-004"

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
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": temperature,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": max_tokens,
                }
            )
            return response.text
        except Exception as e:
            print(f"Error calling Gemini API: {str(e)}")
            return f"Error: {str(e)}"

    async def stream(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion response from Gemini API.
        """
        try:
            stream = self.model.generate_content(
                prompt,
                stream=True,
                generation_config={
                    "temperature": temperature,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": max_tokens,
                }
            )

            async for chunk in stream:
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
            response = genai.embed_content(
                model=self.embedding_model,
                content=texts,
                task_type="retrieval_document"
            )
            return response["embedding"]
        except Exception as e:
            print(f"Error generating embeddings with Gemini: {str(e)}")
            return []
