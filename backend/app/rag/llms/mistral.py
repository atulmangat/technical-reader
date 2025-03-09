import os
from typing import AsyncGenerator
from mistralai import Mistral
from fastapi import HTTPException
from .llm import LLM


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

            stream_response = self.client.chat.stream_async(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                safe_prompt=True,
            )

            async for chunk in stream_response:
                if chunk.data.choices[0].delta.content is not None:
                    yield chunk.data.choices[0].delta.content
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Mistral API error: {str(e)}")
