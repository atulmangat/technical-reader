# Parse the PDF structure for a given chapter and return the summary

from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF
import logging
from sqlalchemy.orm import Session
from ....app.utils.models import PDF
import os
import requests


class SummaryTool:
    """Tool for generating summaries of PDF content"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        # Get API key from environment
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("DEEPSEEK_API_KEY")
        self.api_url = os.getenv(
            "LLM_API_URL", "https://api.openai.com/v1/chat/completions"
        )
        self.model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")

    def extract_text_from_pages(
        self, pdf_path: str, pages: Optional[List[int]] = None
    ) -> str:
        """
        Extract text from specific pages of a PDF

        Args:
            pdf_path: Path to the PDF file
            pages: List of page numbers to extract (1-based indexing)
                  If None, extract all pages

        Returns:
            Extracted text
        """
        try:
            doc = fitz.open(pdf_path)
            text = ""

            # If no specific pages requested, extract all
            if pages is None:
                pages = list(range(1, len(doc) + 1))

            # Validate page numbers
            valid_pages = [p for p in pages if 1 <= p <= len(doc)]

            # Extract text from valid pages
            for page_num in valid_pages:
                # Convert to 0-based indexing for PyMuPDF
                page = doc[page_num - 1]
                text += f"--- Page {page_num} ---\n{page.get_text()}\n\n"

            doc.close()
            return text

        except Exception as e:
            self.logger.error(f"Error extracting text from PDF: {str(e)}")
            raise

    async def generate_summary(
        self,
        pdf_id: int,
        user_id: int,
        db: Session,
        pages: Optional[List[int]] = None,
        max_length: int = 1000,  # Maximum length of text to summarize
    ) -> Dict[str, Any]:
        """
        Generate a summary of PDF content

        Args:
            pdf_id: ID of the PDF
            user_id: ID of the user making the request
            db: Database session
            pages: List of page numbers to summarize (if None, summarize all)
            max_length: Maximum length of text to summarize

        Returns:
            Dictionary with summary results
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        try:
            # Extract text from specified pages
            text = self.extract_text_from_pages(pdf.file_path, pages)

            # Truncate if too long
            if len(text) > max_length:
                text = text[:max_length] + "..."

            # If no API key, return a placeholder
            if not self.api_key:
                return {"status": "error", "message": "LLM API key not configured"}

            # Prepare prompt for summarization
            prompt = f"""Please provide a concise summary of the following text from a PDF document.
            Focus on the main points and key information.

            TEXT:
            {text}

            SUMMARY:"""

            # Call LLM API for summarization
            response = requests.post(
                self.api_url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful assistant that summarizes PDF content.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                },
            )

            if response.status_code != 200:
                return {"status": "error", "message": f"LLM API error: {response.text}"}

            # Extract summary from response
            summary = response.json()["choices"][0]["message"]["content"].strip()

            return {
                "status": "success",
                "pdf_id": pdf_id,
                "pages": pages if pages else "all",
                "summary": summary,
            }

        except Exception as e:
            self.logger.error(f"Summary generation error: {str(e)}")
            return {"status": "error", "message": f"Summary generation error: {str(e)}"}


# Create a singleton instance
summary_tool = SummaryTool()
