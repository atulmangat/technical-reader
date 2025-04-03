import logging
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor
from typing import List, Tuple
from ..store.embeddings import VectorDB
from .cache import LRUCache
from .embed import generate_embeddings_batch
from ....config import config


class EmbeddingBatcher:
    def __init__(self):
        """
        Initialize the EmbedBatcher with a specified batch size, cache capacity, and thread pool.
        
        The batcher uses a thread pool to process multiple batches in parallel, significantly
        improving embedding generation performance. The number of threads is controlled by
        the config.embedding_config.num_threads parameter.
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
        self.num_threads = config.embedding_config.num_threads
        self.thread_pool = ThreadPoolExecutor(max_workers=self.num_threads)
        
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

    def _process_batch(self, batch: List[str], pdf_id: str) -> Tuple[int, int]:
        """
        Process a batch of chunks in a separate thread.
        
        Args:
            batch (List[str]): List of text chunks to process
            pdf_id (str): Identifier for the PDF/document
            
        Returns:
            Tuple[int, int]: (number of processed chunks, number of cache hits)
        """
        if not batch:
            return 0, 0
            
        processed = 0
        cache_hits = 0
        
        try:
            # First check cache for each chunk
            valid_chunks = []
            valid_embeddings = []
            cached_chunks = []
            cached_embeddings = []
            
            # Check cache first
            for chunk in batch:
                cached_embedding = self.chunk_embedding_cache.get(chunk)
                if cached_embedding is not None:
                    cached_chunks.append(chunk)
                    cached_embeddings.append(cached_embedding)
                    cache_hits += 1
                else:
                    valid_chunks.append(chunk)
            
            # Store cached embeddings if any
            if cached_chunks:
                self.vec_db.store_embeddings(cached_chunks, cached_embeddings, pdf_id)
                processed += len(cached_chunks)
            
            # Process remaining chunks that weren't in cache
            if valid_chunks:
                embeddings = generate_embeddings_batch(valid_chunks)
                
                # Check if we got valid embeddings
                if embeddings and len(embeddings) > 0:
                    # Check if any embedding is empty
                    for i, (chunk, emb) in enumerate(zip(valid_chunks, embeddings)):
                        if emb and len(emb) > 0:
                            # Cache the embedding
                            self.chunk_embedding_cache.put(chunk, emb)
                            valid_embeddings.append(emb)
                        else:
                            # Remove invalid chunks
                            self.logger.warning(f"Empty embedding for chunk {i} in batch")
                            valid_chunks[i] = None
                    
                    # Filter out None values
                    filtered_chunks = [c for c in valid_chunks if c is not None]
                    
                    # Only store valid embeddings
                    if filtered_chunks:
                        self.vec_db.store_embeddings(
                            filtered_chunks, valid_embeddings, pdf_id
                        )
                        processed += len(filtered_chunks)
                    else:
                        self.logger.error(f"No valid embeddings in batch of {len(valid_chunks)} chunks")
                else:
                    self.logger.error(f"Failed to generate embeddings for batch of {len(valid_chunks)} chunks")
        except Exception as e:
            self.logger.error(f"Error processing batch in thread: {str(e)}")
            
        return processed, cache_hits

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
        
        # Shutdown the thread pool
        self.thread_pool.shutdown(wait=True)
        
    def set_num_threads(self, num_threads: int):
        """
        Set the number of threads to use for parallel processing.
        
        Args:
            num_threads (int): Number of threads to use
        """
        if num_threads < 1:
            self.logger.warning(f"Invalid number of threads: {num_threads}, using 1 instead")
            num_threads = 1
            
        if self.num_threads != num_threads:
            self.logger.info(f"Changing number of threads from {self.num_threads} to {num_threads}")
            # Shutdown existing thread pool
            self.thread_pool.shutdown(wait=True)
            # Create new thread pool with updated number of threads
            self.num_threads = num_threads
            self.thread_pool = ThreadPoolExecutor(max_workers=self.num_threads)

    def process_pdf_chunks(self, pdf_id: str, chunks: list):
        """
        Process all chunks from a PDF document using multiple threads.
        
        Args:
            pdf_id (str): Identifier for the PDF/document
            chunks (list): List of text chunks to process
        """
        self.logger.info(f"Processing {len(chunks)} chunks for PDF {pdf_id} using {self.num_threads} threads")
        # Reset counters for new PDF
        self.total_processed = 0
        self.cache_hits = 0
        
        # Create batches of chunks
        batches = []
        for i in range(0, len(chunks), self.batch_size):
            batch = chunks[i:i + self.batch_size]
            batches.append(batch)
            
        self.logger.info(f"Created {len(batches)} batches of size {self.batch_size}")
        
        # Process batches in parallel using thread pool
        futures = []
        for batch in batches:
            future = self.thread_pool.submit(self._process_batch, batch, pdf_id)
            futures.append(future)
            
        # Wait for all futures to complete and collect results
        for future in concurrent.futures.as_completed(futures):
            processed, hits = future.result()
            self.total_processed += processed
            self.cache_hits += hits
            
        # Log final stats
        cache_hit_rate = (self.cache_hits / self.total_processed) * 100 if self.total_processed > 0 else 0
        self.logger.info(f"Completed processing PDF {pdf_id}: {self.total_processed}/{len(chunks)} chunks, Cache hit rate: {cache_hit_rate:.1f}%")


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

    # Using the EmbeddingBatcher class with default number of threads
    batcher = EmbeddingBatcher()
    
    # Optionally set a custom number of threads (e.g., based on CPU cores)
    # import multiprocessing
    # num_cores = multiprocessing.cpu_count()
    # batcher.set_num_threads(num_cores)  # Use all available CPU cores
    
    # Process all chunks in parallel
    batcher.process_pdf_chunks(pdf_identifier, example_chunks)

    # Alternatively, process chunks one by one (not using multi-threading)
    # batcher = EmbeddingBatcher()
    # for chunk in example_chunks:
    #     batcher.process_chunk(chunk, pdf_identifier)
    # batcher.flush()  # Don't forget to flush at the end!
