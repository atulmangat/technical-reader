import fitz
from langchain.text_splitter import RecursiveCharacterTextSplitter
import time
import logging
from .queue import PDFQueue
from .utils.batcher import EmbeddingBatcher
from .store.embeddings import VectorDB
from ...models.pdf import PDF
from typing import Dict, Any
from ...config import config
from ...utils.database import get_db
from .utils.toc import parse_table_of_contents
import threading
import concurrent.futures


class PDFWorker:
    def __init__(
        self,
        queue: PDFQueue,
        embedding_batcher: EmbeddingBatcher,
        vector_db: VectorDB,
    ):
        self.queue = queue
        self.embedding_batcher = embedding_batcher
        self.vector_db = vector_db
        self.logger = logging.getLogger(__name__)
        self.is_running = False
        self.worker_thread = None
        # Add progress tracking variables
        self.current_pdf_id = None
        self.total_chunks = 0
        self.processed_chunks = 0
        # Thread pool for parallel processing
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF using PyMuPDF (fitz)"""
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text

    def create_text_chunks(self, text: str) -> list:
        """Split text into chunks"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.pdf_chunk_config.max_chunk_size,
            chunk_overlap=config.pdf_chunk_config.chunk_overlap,
            length_function=len,
        )
        return text_splitter.split_text(text)

    def word_count(self, text: str) -> int:
        """Count the number of words in the text"""
        return len(text.split())

    def chunk_and_store_pdf(self, pdf_text: str, pdf_id: str) -> Dict[str, Any]:
        """
        Chunk PDF text and store in the database

        Args:
            pdf_text: Full text of the PDF
            pdf_id: PDF identifier

        Returns:
            Dict with operation status
        """
        try:
            chunks = []
            # Split by double newlines which typically indicate paragraphs
            paragraphs = [p.strip() for p in pdf_text.split("\n\n") if p.strip()]

            current_chunk = ""
            for para in paragraphs:
                # If adding this paragraph would exceed max_chunk_size, save current
                # chunk and start new one
                if (
                    self.word_count(current_chunk) + self.word_count(para)
                    > config.pdf_chunk_config.max_chunk_size
                ):
                    chunks.append(current_chunk)
                    current_chunk = para
                else:
                    if current_chunk:
                        current_chunk += "\n\n" + para
                    else:
                        current_chunk = para

            # Add the last chunk if it's not empty
            if (
                current_chunk
                and self.word_count(current_chunk)
                <= config.pdf_chunk_config.max_chunk_size
            ):
                chunks.append(current_chunk)

            # Handle case where chunking produced no valid chunks
            if not chunks:
                # Fall back to simple chunking by max_chunk_size
                self.logger.info(
                    "No chunks created, falling back to size-based chunking"
                )
                i = 0
                while i < len(pdf_text):
                    chunk = pdf_text[i : i + config.pdf_chunk_config.max_chunk_size]
                    if self.word_count(chunk) <= config.pdf_chunk_config.max_chunk_size:
                        chunks.append(chunk)
                    i += config.pdf_chunk_config.max_chunk_size

        except Exception as e:
            self.logger.error(f"Error chunking and storing PDF {pdf_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def process_toc_in_parallel(self, pdf_id: str):
        """Process table of contents in a separate thread"""
        try:
            parse_table_of_contents(pdf_id)
        except Exception as e:
            self.logger.error(f"Error processing table of contents for PDF {pdf_id}: {str(e)}")

    def process_pdf(self, pdf_path: str, pdf_id: str) -> None:
        """Process PDF and generate embeddings index"""
        # Extract text from PDF
        text = self.extract_text_from_pdf(pdf_path)

        # Split text into chunks for embeddings
        chunks = self.create_text_chunks(text)
        
        # Reset progress tracking for new PDF
        self.current_pdf_id = pdf_id
        self.total_chunks = len(chunks)
        self.processed_chunks = 0
        self.logger.info(f"Starting to process {self.total_chunks} chunks for PDF {pdf_id}")

        # Start table of contents extraction in parallel
        toc_future = self.executor.submit(self.process_toc_in_parallel, pdf_id)
        
        # Process each chunk
        for chunk in chunks:
            self.embedding_batcher.process_chunk(chunk, pdf_id)
            # Update and log progress
            self.processed_chunks += 1
        
        # Wait for TOC processing to complete if it's still running
        if not toc_future.done():
            self.logger.info(f"Waiting for table of contents extraction to complete for PDF {pdf_id}")
            toc_future.result()  # This will wait for the future to complete

    def _process_queue(self) -> None:
        """Process PDFs in the queue"""
        self.logger.info("Starting PDF processing worker")
        self.is_running = True
        db = next(get_db())
        while self.is_running:
            try:
                # Get the next PDF from the queue
                pdf_data = self.queue.get_next_item(db)
                
                if not pdf_data:
                    time.sleep(5)
                    continue

                pdf_id = pdf_data["pdf_id"]
                pdf_path = pdf_data["pdf_path"]
                try:
                    # Process the PDF
                    self.process_pdf(pdf_path, pdf_id)

                    try:
                        pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
                        if pdf: 
                            pdf.has_embeddings = True
                            pdf.processing_status = "completed"
                            db.commit()
                            self.logger.info(f"Successfully processed PDF {pdf_id}")
                        else:
                            self.logger.error(f"PDF {pdf_id} not found in database")
                    finally:
                        db.close()

                except Exception as e:
                    self.logger.error(f"Error processing PDF {pdf_id}: {str(e)}")
                    
                    try:
                        pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
                        if pdf:
                            pdf.has_embeddings = False
                            pdf.processing_status = "failed"
                            pdf.processing_error = str(e)
                            db.commit()
                    finally:
                        db.close()

                finally:
                    # Remove the item from the queue
                    self.queue.pop_from_queue()
                    self.logger.info(f"Removed PDF {pdf_id} from queue")
                    
                    # Reset progress tracking variables after processing is complete
                    self.current_pdf_id = None
                    self.total_chunks = 0
                    self.processed_chunks = 0
                    self.logger.info("Reset progress tracking variables")

            except Exception as e:
                self.logger.error(f"Queue processing error: {str(e)}")
                time.sleep(1)

    def start(self):
        """Start the worker in a separate thread"""
        if not self.is_running:
            self.worker_thread = threading.Thread(target=self._process_queue)
            self.worker_thread.daemon = True
            self.worker_thread.start()
            self.logger.info("PDF worker started")
            return True
        return False

    def stop(self):
        """Stop the worker"""
        if self.is_running:
            self.is_running = False
            if self.worker_thread:
                self.worker_thread.join(timeout=5)
            # Shutdown the thread pool executor
            self.executor.shutdown(wait=False)
            self.logger.info("PDF worker stopped")
            return True
        return False

class PDFEmbeddingPipeline:
    """
    A wrapper class that initializes and manages the PDF embedding pipeline components.
    This class is used as the main entry point for the PDF embedding process.
    """
    def __init__(self, enable_monitor=True, monitor_interval=10):
        self.queue = PDFQueue()
        self.embedding_batcher = EmbeddingBatcher()
        self.vector_db = VectorDB()
        self.worker = PDFWorker(self.queue, self.embedding_batcher, self.vector_db)
        self.logger = logging.getLogger(__name__)
        self.monitor = None
        self.enable_monitor = enable_monitor
        self.monitor_interval = monitor_interval
        
    def start(self):
        """Start the PDF embedding pipeline"""
        worker_started = self.worker.start()
        
        # Start the monitor if enabled
        if worker_started and self.enable_monitor:
            try:
                # Import here to avoid circular imports
                from .monitor import PDFProcessingMonitor
                self.monitor = PDFProcessingMonitor(self, interval_seconds=self.monitor_interval, log_to_file=True)
                self.monitor.start()
            except Exception as e:
                self.logger.error(f"Failed to start monitor: {str(e)}")
                
        return worker_started
        
    def stop(self):
        """Stop the PDF embedding pipeline"""
        # Stop the monitor if it's running
        if self.monitor:
            try:
                self.monitor.stop()
                self.logger.info("Stopped progress monitor")
            except Exception as e:
                self.logger.error(f"Error stopping monitor: {str(e)}")
                
        # Stop the worker
        return self.worker.stop()
        
    def get_queue_status(self):
        """Get the status of the PDF processing queue"""
        return self.queue.get_queue_status()
        
    def get_detailed_progress(self):
        """Get detailed progress information about the PDF processing pipeline"""
        queue_status = self.queue.get_queue_status()
        
        # Get current processing progress if available
        current_progress = {
            "current_pdf_id": self.worker.current_pdf_id,
            "total_chunks": self.worker.total_chunks,
            "processed_chunks": self.worker.processed_chunks,
            "progress_percentage": 0
        }
        
        if self.worker.total_chunks > 0:
            current_progress["progress_percentage"] = (self.worker.processed_chunks / self.worker.total_chunks) * 100
            
        # Combine all information
        detailed_progress = {
            "queue_status": queue_status,
            "current_progress": current_progress,
            "worker_running": self.worker.is_running
        }
        
        return detailed_progress
