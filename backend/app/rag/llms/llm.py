# Define the LLM class with completion and stream methods
from typing import AsyncGenerator


class LLM:
    def __init__(self, model: str, api_key: str):
        self.model = model
        self.api_key = api_key

    def complete(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> str:
        pass

    def stream(
        self, prompt: str, max_tokens: int = 1024, temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        pass
