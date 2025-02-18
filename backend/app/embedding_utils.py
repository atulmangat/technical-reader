from langchain.text_splitter import RecursiveCharacterTextSplitter
# from langchain_community.embeddings import HuggingFaceEmbeddings
from chromadb.config import Settings
import os
import fitz
from queue import Queue
import threading
from typing import Optional
import time
import logging
from .models import PDF

class PDFEmbeddingPipeline:
    def __init__(self, persist_directory="db/chroma"):
        self.persist_directory = persist_directory
        # self.embeddings = HuggingFaceEmbeddings(
        #     model_name="sentence-transformers/all-MiniLM-L6-v2"
        # )
        
        # # Initialize ChromaDB
        # self.client = chromadb.Client(Settings(
        #     persist_directory=persist_directory,
        #     anonymized_telemetry=False
        # ))

    def extract_text_from_pdf(self, pdf_path):
        """Extract text from PDF using PyMuPDF (fitz)"""
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text

    def create_text_chunks(self, text):
        """Split text into chunks"""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        return text_splitter.split_text(text)

    def process_pdf(self, pdf_path, pdf_id):
        """Process PDF and store embeddings"""
        # Extract text from PDF
        text = self.extract_text_from_pdf(pdf_path)
        
        # Split text into chunks
        chunks = self.create_text_chunks(text)
        
        # Create or get collection
        collection = self.client.get_or_create_collection(
            name="pdf_embeddings",
            embedding_function=self.embeddings
        )
        
        # Add chunks to collection with PDF ID as metadata
        collection.add(
            documents=chunks,
            metadatas=[{"pdf_id": str(pdf_id)} for _ in chunks],
            ids=[f"{pdf_id}-{i}" for i in range(len(chunks))]
        )

    def get_relevant_chunks(self, query, pdf_id, n_results=3):
        """Get relevant chunks for a query from a specific PDF"""
        collection = self.client.get_collection(
            name="pdf_embeddings",
            embedding_function=self.embeddings
        )
        
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where={"pdf_id": str(pdf_id)}
        )
        
        return results['documents'][0] 

class PDFProcessingQueue:
    def __init__(self):
        self.queue = Queue()
        self.is_processing = False
        self.current_pdf: Optional[dict] = None
        self.thread: Optional[threading.Thread] = None
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def add_to_queue(self, pdf_id: int, pdf_path: str, db_instance) -> None:
        """Add a PDF to the processing queue"""
        self.queue.put({
            'pdf_id': pdf_id,
            'pdf_path': pdf_path,
            'db_instance': db_instance
        })
        self.logger.info(f"Added PDF {pdf_id} to processing queue")
        
        # Start processing if not already running
        if not self.is_processing:
            self.start_processing()

    def start_processing(self) -> None:
        """Start the processing thread"""
        if not self.is_processing:
            self.is_processing = True
            self.thread = threading.Thread(target=self._process_queue)
            self.thread.daemon = True
            self.thread.start()
            self.logger.info("Started PDF processing thread")

    def _process_queue(self) -> None:
        """Process PDFs in the queue"""
        embedding_pipeline = PDFEmbeddingPipeline()

        while True:
            try:
                # Get the next PDF from the queue
                self.current_pdf = self.queue.get(block=True, timeout=60)
                pdf_id = self.current_pdf['pdf_id']
                pdf_path = self.current_pdf['pdf_path']
                db_instance = self.current_pdf['db_instance']

                self.logger.info(f"Processing PDF {pdf_id}")

                try:
                    # Process the PDF
                    embedding_pipeline.process_pdf(pdf_path, pdf_id)
                    
                    # Update database status
                    with db_instance.app.app_context():
                        pdf = db_instance.session.query(PDF).get(pdf_id)
                        if pdf:
                            pdf.has_embeddings = True
                            db_instance.session.commit()
                            self.logger.info(f"Successfully processed PDF {pdf_id}")
                        else:
                            self.logger.error(f"PDF {pdf_id} not found in database")

                except Exception as e:
                    self.logger.error(f"Error processing PDF {pdf_id}: {str(e)}")
                    # Update database with error status if needed
                    with db_instance.app.app_context():
                        pdf = db_instance.session.query(PDF).get(pdf_id)
                        if pdf:
                            pdf.has_embeddings = False
                            pdf.processing_error = str(e)
                            db_instance.session.commit()

                finally:
                    self.queue.task_done()
                    self.current_pdf = None

            except Exception as e:
                self.logger.error(f"Queue processing error: {str(e)}")
                time.sleep(1)  # Prevent tight loop in case of errors

            if self.queue.empty():
                self.is_processing = False
                break

    def get_queue_status(self) -> dict:
        """Get the current status of the processing queue"""
        return {
            'queue_size': self.queue.qsize(),
            'is_processing': self.is_processing,
            'current_pdf': self.current_pdf
        } 