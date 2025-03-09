from typing import Dict, Any, Optional
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from ....app.utils.models import PDF


class HighlightsTool:
    """Tool for managing PDF highlights"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def add_highlight(
        self,
        pdf_id: int,
        user_id: int,
        text: str,
        page_number: int,
        position: Dict[str, float],
        color: str,
        note: Optional[str] = "",
        db: Session = None,
    ) -> Dict[str, Any]:
        """
        Add a highlight to a PDF

        Args:
            pdf_id: ID of the PDF
            user_id: ID of the user making the request
            text: Highlighted text
            page_number: Page number where the highlight is located
            position: Position coordinates {x1, y1, x2, y2}
            color: Highlight color
            note: Optional note for the highlight
            db: Database session

        Returns:
            Dictionary with operation status and highlight data
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        try:
            # Create highlight object
            highlight = {
                "text": text,
                "page_number": page_number,
                "position": position,
                "color": color,
                "note": note,
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Initialize highlights list if needed
            if not pdf.highlights:
                pdf.highlights = []

            # Add highlight to PDF
            pdf.highlights.append(highlight)
            db.commit()

            return {
                "status": "success",
                "message": "Highlight added successfully",
                "highlight": highlight,
            }

        except Exception as e:
            self.logger.error(f"Error adding highlight: {str(e)}")
            return {"status": "error", "message": f"Error adding highlight: {str(e)}"}

    async def get_highlights(
        self, pdf_id: int, user_id: int, db: Session
    ) -> Dict[str, Any]:
        """
        Get all highlights for a PDF

        Args:
            pdf_id: ID of the PDF
            user_id: ID of the user making the request
            db: Database session

        Returns:
            Dictionary with highlights data
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        try:
            # Return highlights (or empty list if none)
            highlights = pdf.highlights or []

            return {
                "status": "success",
                "pdf_id": pdf_id,
                "highlights_count": len(highlights),
                "highlights": highlights,
            }

        except Exception as e:
            self.logger.error(f"Error retrieving highlights: {str(e)}")
            return {
                "status": "error",
                "message": f"Error retrieving highlights: {str(e)}",
            }

    async def delete_highlight(
        self, pdf_id: int, user_id: int, highlight_index: int, db: Session
    ) -> Dict[str, Any]:
        """
        Delete a highlight from a PDF

        Args:
            pdf_id: ID of the PDF
            user_id: ID of the user making the request
            highlight_index: Index of the highlight to delete
            db: Database session

        Returns:
            Dictionary with operation status
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        try:
            # Check if highlight exists
            if not pdf.highlights or highlight_index >= len(pdf.highlights):
                return {"status": "error", "message": "Highlight not found"}

            # Remove highlight
            pdf.highlights.pop(highlight_index)
            db.commit()

            return {"status": "success", "message": "Highlight deleted successfully"}

        except Exception as e:
            self.logger.error(f"Error deleting highlight: {str(e)}")
            return {"status": "error", "message": f"Error deleting highlight: {str(e)}"}


# Create a singleton instance
highlights_tool = HighlightsTool()

# implement the tool class for the highlights


class HighlightsTool(Tool):
    def __init__(self):
        super().__init__(
            name="highlights",
            description="Use this tool to add, get, and delete highlights from a PDF",
            function=self.add_highlight,
        )

    def get_highlights(self, pdf_id: int, user_id: int) -> Dict[str, Any]:
        return highlights_tool.get_highlights(pdf_id, user_id)
