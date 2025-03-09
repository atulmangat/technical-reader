import logging
from ..store.embedding import VectorDB
from .cache import LRUCache
from .embed import generate_embeddings_batch
from ...config import config


class EmbeddingBatcher:
    def __init__(self):
        """
        Initialize the EmbedBatcher with a specified batch size and cache capacity.
        """
        self.batch_size = config.embedding_config.batch_size
        self.vec_db = VectorDB()
        self.chunk_embedding_cache = LRUCache(
            capacity=config.embedding_config.cache_capacity
        )
        self.current_batch = []
        self.current_pdf_id = None

    def _process_current_batch(self):
        """
        Process all chunks in the current batch, generate embeddings,
        cache them, and store in vector DB.
        """
        if not self.current_batch:
            return

        embeddings = generate_embeddings_batch(self.current_batch)
        # Cache each embedding and store in vector DB
        for c, emb in zip(self.current_batch, embeddings):
            self.chunk_embedding_cache.put(c, emb)
        self.vec_db.store_embeddings(
            self.current_batch, embeddings, self.current_pdf_id
        )
        self.current_batch = []

    def process_chunk(self, chunk: str, pdf_id: str):
        """
        Process a single chunk, either using cached embedding or adding to batch.
        When batch size is reached, process the entire batch.

        Args:
            chunk (str): Text chunk to process
            pdf_id (str): Identifier for the PDF/document
        """
        # If this is a new PDF ID, process any remaining chunks from previous PDF
        if (
            self.current_pdf_id is not None
            and self.current_pdf_id != pdf_id
            and self.current_batch
        ):
            self._process_current_batch()
            self.current_batch = []

        self.current_pdf_id = pdf_id

        # Check if embedding already exists in cache
        cached_embedding = self.chunk_embedding_cache.get(chunk)
        if cached_embedding is not None:
            # Store the cached embedding directly into the vector DB
            self.vec_db.store_embeddings([chunk], [cached_embedding], pdf_id)
        else:
            # Add chunk to current batch
            self.current_batch.append(chunk)
            # If we have accumulated batch_size chunks, process the batch
            if len(self.current_batch) >= self.batch_size:
                self._process_current_batch()

    def flush(self):
        """
        Process any remaining chunks in the current batch.
        Call this method when all chunks have been added.
        """
        if self.current_batch:
            self._process_current_batch()


# --- Example Usage ---
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Example list of text chunks (e.g., from a PDF)
    example_chunks = [
        "Chunk 1 text...",
        "Chunk 2 text...",
        "Chunk 3 text...",
        "Chunk 4 text...",
        "Chunk 5 text...",
        "Chunk 6 text...",
        "Chunk 7 text...",
        "Chunk 8 text...",
        "Chunk 9 text...",
        "Chunk 10 text...",
        "Chunk 11 text...",
        "Chunk 12 text...",
        "Chunk 13 text...",
    ]

    pdf_identifier = "pdf123"

    # Using the new EmbedBatcher class
    batcher = EmbeddingBatcher()
    batcher.process_pdf_chunks(pdf_identifier, example_chunks)

    # Alternatively, process chunks one by one
    # batcher = EmbeddingBatcher()
    # for chunk in example_chunks:
    #     batcher.process_chunk(chunk, pdf_identifier)
    # batcher.flush()  # Don't forget to flush at the end!
