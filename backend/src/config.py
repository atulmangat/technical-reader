from pydantic import BaseModel
import os


class PDFChunkConfig(BaseModel):
    max_chunk_size: int = 2048
    chunk_overlap: int = 200


class EmbeddingConfig(BaseModel):
    batch_size: int = 100
    cache_capacity: int = 10000
    vector_size: int = 768
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection_name: str = "document_embeddings"
    embedding_provider: str = "gemini"


class LLMConfig(BaseModel):
    model: str = "deepseek-chat"
    temperature: float = 0.7
    max_tokens: int = 5000
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    default_llm: str = "gemini"


class Config(BaseModel):
    pdf_chunk_config: PDFChunkConfig = PDFChunkConfig()
    embedding_config: EmbeddingConfig = EmbeddingConfig()
    llm_config: LLMConfig = LLMConfig()
    mistral_api_key: str = os.environ.get("MISTRAL_API_KEY", "")


config = Config()
