import fitz
from langchain.text_splitter import RecursiveCharacterTextSplitter
import time
import logging
from .queue import PDFQueue
from .utils.batcher import EmbeddingBatcher
from .store.embedding import VectorDB
from .store.keyword import KeywordDB
from ...app.utils.models import PDF
from typing import Dict, Any
from ..config import config
import threading


class PDFWorker:
    def __init__(
        self,
        queue: PDFQueue,
        embedding_batcher: EmbeddingBatcher,
        vector_db: VectorDB,
        keyword_db: KeywordDB,
    ):
        self.queue = queue
        self.embedding_batcher = embedding_batcher
        self.vector_db = vector_db
        self.keyword_db = keyword_db
        self.logger = logging.getLogger(__name__)
        self.is_running = False
        self.worker_thread = None

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
                # If adding this paragraph would exceed max_chunk_size, save current chunk and start new one
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

            # Store the chunks in keyword database
            return self.keyword_db.store_chunks(chunks, pdf_id)

        except Exception as e:
            self.logger.error(f"Error chunking and storing PDF {pdf_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def process_pdf(self, pdf_path: str, pdf_id: str) -> None:
        """Process PDF and generate embeddings and keyword index"""
        # Extract text from PDF
        self.logger.info(f"Extracting text from PDF {pdf_id}")
        text = self.extract_text_from_pdf(pdf_path)

        # Generate keyword index
        self.logger.info(f"Generating keyword index for PDF {pdf_id}")
        keyword_result = self.chunk_and_store_pdf(text, pdf_id)
        if keyword_result.get("status") == "error":
            raise Exception(
                f"Failed to generate keyword index: {keyword_result.get('message')}"
            )

        # Split text into chunks for embeddings
        self.logger.info(f"Creating text chunks for embeddings for PDF {pdf_id}")
        chunks = self.create_text_chunks(text)

        # Process each chunk
        for chunk in chunks:
            self.embedding_batcher.process_chunk(chunk, pdf_id)

    def _process_queue(self) -> None:
        """Process PDFs in the queue"""
        self.logger.info("Starting PDF processing worker")
        self.is_running = True

        while self.is_running:
            try:
                # Get the next PDF from the queue
                pdf_data = self.queue.get_next_item()

                if not pdf_data:
                    # Queue is empty, sleep for a bit before checking again
                    time.sleep(5)
                    continue

                pdf_id = pdf_data["pdf_id"]
                pdf_path = pdf_data["pdf_path"]
                db_instance = pdf_data.get("db")

                self.logger.info(f"Processing PDF {pdf_id}")

                try:
                    # Process the PDF
                    self.process_pdf(pdf_path, pdf_id)

                    # Update database status
                    if db_instance:
                        with db_instance.app.app_context():
                            pdf = db_instance.session.query(PDF).get(pdf_id)
                            if pdf:
                                pdf.has_embeddings = True
                                pdf.processing_status = "completed"
                                db_instance.session.commit()
                                self.logger.info(f"Successfully processed PDF {pdf_id}")
                            else:
                                self.logger.error(f"PDF {pdf_id} not found in database")

                except Exception as e:
                    self.logger.error(f"Error processing PDF {pdf_id}: {str(e)}")
                    if db_instance:
                        with db_instance.app.app_context():
                            pdf = db_instance.session.query(PDF).get(pdf_id)
                            if pdf:
                                pdf.has_embeddings = False
                                pdf.processing_status = "failed"
                                pdf.processing_error = str(e)
                                db_instance.session.commit()

                finally:
                    # Remove the item from the queue
                    self.queue.pop_from_queue()

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
            self.logger.info("PDF worker stopped")
            return True
        return False
