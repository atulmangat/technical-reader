from pydantic import BaseModel


class PDFChunkConfig(BaseModel):
    max_chunk_size: int = 5000
    chunk_overlap: int = 200


class EmbeddingConfig(BaseModel):
    batch_size: int = 50
    max_calls_per_minute: int = 60
    cache_capacity: int = 10000
    token_limit: int = 8192
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection_name: str = "document_embeddings"



class LLMConfig(BaseModel):
    model: str = "deepseek-chat"
    temperature: float = 0.7
    max_tokens: int = 1024
    top_p: float = 1.0
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0


class Config(BaseModel):
    pdf_chunk_config: PDFChunkConfig = PDFChunkConfig()
    embedding_config: EmbeddingConfig = EmbeddingConfig()
    llm_config: LLMConfig = LLMConfig()


config = Config()
