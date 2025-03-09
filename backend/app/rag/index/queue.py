from typing import Dict, Any, List
import logging
import threading
from datetime import datetime
from sqlalchemy.orm import Session
from ...models import PDF


class PDFQueue:
    def __init__(self):
        self.queue: List[Dict[str, Any]] = []
        logging.basicConfig(level=logging.INFO)
        self.lock = threading.Lock()
        self.logger = logging.getLogger(__name__)

    def add_to_queue(self, pdf_id: int, pdf_path: str, db: Session = None) -> None:
        """Add a PDF to the processing queue"""
        with self.lock:
            queue_item = {
                "pdf_id": pdf_id,
                "pdf_path": pdf_path,
                "status": "pending",
                "added_at": datetime.utcnow().isoformat(),
                "db": db,
            }
            # Add to the in-memory queue
            self.queue.append(queue_item)
            self.logger.info(f"Added PDF {pdf_id} to processing queue")

            # Update status in database if db session is provided
            if db:
                try:
                    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
                    if pdf:
                        pdf.processing_status = "pending"
                        db.commit()
                        self.logger.info(
                            f"Updated PDF {pdf_id} status to 'pending' in database"
                        )
                except Exception as e:
                    self.logger.error(
                        f"Error updating PDF {pdf_id} status in database: {str(e)}"
                    )

    def get_queue_status(self) -> dict:
        """Get the current status of the processing queue"""
        # Count items by status
        status_counts = {}
        for item in self.queue:
            status = item.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1

        return {"queue_size": len(self.queue), "status_counts": status_counts}

    def get_next_item(self) -> Dict[str, Any]:
        """Get the next item from the processing queue"""
        if len(self.queue) == 0:
            return None

        # Update status to 'processing' in memory
        with self.lock:
            if len(self.queue) > 0:
                self.queue[0]["status"] = "processing"

                # Update status in database if db session is provided
                pdf_id = self.queue[0].get("pdf_id")
                db = self.queue[0].get("db")
                if db and pdf_id:
                    try:
                        pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
                        if pdf:
                            pdf.processing_status = "processing"
                            db.commit()
                            self.logger.info(
                                f"Updated PDF {pdf_id} status to 'processing' in database"
                            )
                    except Exception as e:
                        self.logger.error(
                            f"Error updating PDF {pdf_id} status in database: {str(e)}"
                        )

        return self.queue[0]

    def pop_from_queue(self) -> Dict[str, Any]:
        """Pop a PDF from the processing queue"""
        with self.lock:
            if len(self.queue) == 0:
                return None

            return self.queue.pop(0)
