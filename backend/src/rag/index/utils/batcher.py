import logging
from ..store.embeddings import VectorDB
from .cache import LRUCache
from .embed import generate_embeddings_batch
from ....config import config



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
        self.logger = logging.getLogger(__name__)
        self.total_processed = 0
        self.cache_hits = 0
        
    def _process_current_batch(self):
        """
        Process all chunks in the current batch, generate embeddings,
        cache them, and store in vector DB.
        """
        if not self.current_batch:
            return

        batch_size = len(self.current_batch)
        
        try:
            embeddings = generate_embeddings_batch(self.current_batch)
            
            # Check if we got valid embeddings
            if not embeddings or len(embeddings) == 0:
                self.logger.error(f"Failed to generate embeddings for batch of {batch_size} chunks")
                self.current_batch = []
                return
                
            # Check if any embedding is empty
            valid_chunks = []
            valid_embeddings = []
            for i, (chunk, emb) in enumerate(zip(self.current_batch, embeddings)):
                if emb and len(emb) > 0:
                    valid_chunks.append(chunk)
                    valid_embeddings.append(emb)
                    self.chunk_embedding_cache.put(chunk, emb)
                else:
                    self.logger.warning(f"Empty embedding for chunk {i} in batch")
            
            # Only store valid embeddings
            if valid_chunks:
                self.vec_db.store_embeddings(
                    valid_chunks, valid_embeddings, self.current_pdf_id
                )
                self.total_processed += len(valid_chunks)
            else:
                self.logger.error(f"No valid embeddings in batch of {batch_size} chunks")
                
        except Exception as e:
            self.logger.error(f"Error processing batch: {str(e)}")
        finally:
            # Always clear the batch to avoid getting stuck
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
            self.logger.info(f"Switching from PDF {self.current_pdf_id} to {pdf_id}, processing remaining chunks")
            self._process_current_batch()
            self.current_batch = []

        self.current_pdf_id = pdf_id

        # Check if embedding already exists in cache
        cached_embedding = self.chunk_embedding_cache.get(chunk)
        if cached_embedding is not None:
            # Store the cached embedding directly into the vector DB
            self.vec_db.store_embeddings([chunk], [cached_embedding], pdf_id)
            self.cache_hits += 1
            self.total_processed += 1
            
            # Log cache hit rate periodically
            if self.total_processed % 50 == 0:
                cache_hit_rate = (self.cache_hits / self.total_processed) * 100
                self.logger.info(f"Cache hit rate: {cache_hit_rate:.1f}% ({self.cache_hits}/{self.total_processed})")
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
            self.logger.info(f"Flushing remaining {len(self.current_batch)} chunks for PDF {self.current_pdf_id}")
            self._process_current_batch()
            self.logger.info(f"Final processing stats - Total chunks: {self.total_processed}, Cache hits: {self.cache_hits}")

    def process_pdf_chunks(self, pdf_id: str, chunks: list):
        """
        Process all chunks from a PDF document.
        
        Args:
            pdf_id (str): Identifier for the PDF/document
            chunks (list): List of text chunks to process
        """
        self.logger.info(f"Processing {len(chunks)} chunks for PDF {pdf_id}")
        # Reset counters for new PDF
        self.total_processed = 0
        self.cache_hits = 0
        
        for chunk in chunks:
            self.process_chunk(chunk, pdf_id)
        self.flush()  # Don't forget to flush at the end!
        
        self.logger.info(f"Completed processing PDF {pdf_id}")


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

    # Using the EmbeddingBatcher class
    batcher = EmbeddingBatcher()
    batcher.process_pdf_chunks(pdf_identifier, example_chunks)

    # Alternatively, process chunks one by one
    # batcher = EmbeddingBatcher()
    # for chunk in example_chunks:
    #     batcher.process_chunk(chunk, pdf_identifier)
    # batcher.flush()  # Don't forget to flush at the end!
