import os
from typing import AsyncGenerator

import httpx
import json
from dotenv import load_dotenv
from .llm import LLM

load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com")


class DeepseekLLM(LLM):
    def __init__(self, model: str = "deepseek-chat", api_key: str = None):
        """
        Initialize the DeepseekLLM with model and API key.

        Args:
            model: DeepSeek model to use
            api_key: API key for DeepSeek (defaults to environment variable)
        """
        api_key = api_key or DEEPSEEK_API_KEY
        super().__init__(model=model, api_key=api_key)
        self.api_base = DEEPSEEK_API_BASE

    def complete(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> str:
        """
        Send a completion request to DeepSeek API and return the response.

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0-1)

        Returns:
            The text response from the model
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": 1.0,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0,
        }

        with httpx.Client(base_url=self.api_base) as client:
            response = client.post(
                "/v1/chat/completions", json=payload, headers=headers
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    async def stream(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """
        Send a streaming completion request to DeepSeek API and yield responses.

        Args:
            prompt: The prompt to send to the model
            max_tokens: Maximum number of tokens to generate
            temperature: Controls randomness (0-1)

        Yields:
            Text chunks from the streaming response
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": 1.0,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0,
            "stream": True,
        }

        async with httpx.AsyncClient(base_url=self.api_base, timeout=60.0) as client:
            async with client.stream(
                "POST", "/v1/chat/completions", json=payload, headers=headers
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break

                        try:
                            content = json.loads(data)["choices"][0]["delta"].get(
                                "content", ""
                            )
                            if content:
                                yield content
                        except Exception:
                            continue
