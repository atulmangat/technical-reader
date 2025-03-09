from typing import Dict, Any
import logging
from sqlalchemy.orm import Session
from ....app.utils.models import PDF


class NotesTool:
    """Tool for managing PDF notes"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def save_notes(
        self, pdf_id: int, user_id: int, notes: Dict[str, Any], db: Session
    ) -> Dict[str, Any]:
        """
        Save notes for a PDF

        Args:
            pdf_id: ID of the PDF
            user_id: ID of the user making the request
            notes: Notes data to save
            db: Database session

        Returns:
            Dictionary with operation status
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        try:
            # Save notes to PDF
            pdf.notes = notes
            db.commit()

            return {"status": "success", "message": "Notes saved successfully"}

        except Exception as e:
            self.logger.error(f"Error saving notes: {str(e)}")
            return {"status": "error", "message": f"Error saving notes: {str(e)}"}

    async def get_notes(self, pdf_id: int, user_id: int, db: Session) -> Dict[str, Any]:
        """
        Get notes for a PDF

        Args:
            pdf_id: ID of the PDF
            user_id: ID of the user making the request
            db: Database session

        Returns:
            Dictionary with notes data
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        try:
            # Return notes (or empty dict if none)
            notes = pdf.notes or {}

            return {"status": "success", "pdf_id": pdf_id, "notes": notes}

        except Exception as e:
            self.logger.error(f"Error retrieving notes: {str(e)}")
            return {"status": "error", "message": f"Error retrieving notes: {str(e)}"}


# Create a singleton instance
notes_tool = NotesTool()
