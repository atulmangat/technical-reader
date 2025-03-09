from typing import List, Dict, Any
import re
import fitz  # PyMuPDF
import logging
from sqlalchemy.orm import Session
from ....app.utils.models import PDF
from ...index.worker import pdf_pipeline


class SearchTool:
    """Tool for keyword-based search over PDF content"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def extract_text_with_pages(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extract text from PDF with page numbers

        Args:
            pdf_path: Path to the PDF file

        Returns:
            List of dictionaries with page number and text
        """
        try:
            doc = fitz.open(pdf_path)
            pages = []

            for page_num, page in enumerate(doc):
                text = page.get_text()
                if text.strip():  # Only add non-empty pages
                    pages.append(
                        {
                            "page_num": page_num + 1,  # 1-based page numbering
                            "text": text,
                        }
                    )

            doc.close()
            return pages

        except Exception as e:
            self.logger.error(f"Error extracting text from PDF: {str(e)}")
            raise

    def search_keywords(
        self,
        pdf_id: int,
        keywords: List[str],
        user_id: int,
        db: Session,
        match_all: bool = False,
        case_sensitive: bool = False,
        context_size: int = 100,  # Characters of context around match
    ) -> Dict[str, Any]:
        """
        Search for keywords in a PDF

        Args:
            pdf_id: ID of the PDF to search
            keywords: List of keywords to search for
            user_id: ID of the user making the request
            db: Database session
            match_all: If True, only return chunks that contain all keywords
            case_sensitive: If True, perform case-sensitive search
            context_size: Number of characters to include around each match

        Returns:
            Dictionary with search results
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        if not keywords:
            return {"status": "error", "message": "No keywords provided"}

        try:
            # Check if we have an index for this PDF
            index_data = pdf_pipeline.get_index(pdf_id)

            # If we have an index, use it; otherwise extract text on the fly
            if index_data:
                pages = index_data["pages"]
                self.logger.info(f"Using existing index for PDF {pdf_id}")
            else:
                # Extract text from PDF with page numbers
                pages = self.extract_text_with_pages(pdf.file_path)
                self.logger.info(f"Extracting text on the fly for PDF {pdf_id}")

            # Prepare keywords for search
            if not case_sensitive:
                search_keywords = [k.lower() for k in keywords]
            else:
                search_keywords = keywords

            # Search for keyword matches
            matches = []

            for page in pages:
                page_num = page["page_num"]
                text = page["text"]
                search_text = text if case_sensitive else text.lower()

                # Track matches for this page
                page_matches = []

                # Find all occurrences of each keyword
                for keyword_idx, keyword in enumerate(search_keywords):
                    # Use word boundary regex for whole word matching
                    pattern = r"\b" + re.escape(keyword) + r"\b"

                    for match in re.finditer(pattern, search_text):
                        start_idx = match.start()
                        end_idx = match.end()

                        # Get context around match
                        context_start = max(0, start_idx - context_size)
                        context_end = min(len(text), end_idx + context_size)

                        # Get the actual matched text from the original text
                        matched_text = text[start_idx:end_idx]

                        # Get context text
                        context_before = text[context_start:start_idx]
                        context_after = text[end_idx:context_end]

                        page_matches.append(
                            {
                                "keyword": keywords[
                                    keyword_idx
                                ],  # Use original keyword
                                "matched_text": matched_text,
                                "context_before": context_before,
                                "context_after": context_after,
                                "position": {"start": start_idx, "end": end_idx},
                            }
                        )

                # If we have matches for this page and they satisfy our criteria
                if page_matches:
                    # Check if we found all required keywords (if match_all is True)
                    if match_all:
                        found_keywords = set(
                            match["keyword"].lower()
                            if not case_sensitive
                            else match["keyword"]
                            for match in page_matches
                        )
                        if len(found_keywords) < len(search_keywords):
                            continue  # Skip this page if not all keywords found

                    # Add page matches to overall results
                    matches.append(
                        {
                            "page": page_num,
                            "matches": page_matches,
                            "match_count": len(page_matches),
                        }
                    )

            # Sort matches by number of occurrences (most matches first)
            matches.sort(key=lambda x: x["match_count"], reverse=True)

            return {
                "status": "success",
                "keywords": keywords,
                "pdf_id": pdf_id,
                "match_all": match_all,
                "case_sensitive": case_sensitive,
                "total_matches": sum(page["match_count"] for page in matches),
                "pages_with_matches": len(matches),
                "results": matches,
            }

        except Exception as e:
            self.logger.error(f"Keyword search error: {str(e)}")
            return {"status": "error", "message": f"Keyword search error: {str(e)}"}

    def search_phrase(
        self,
        pdf_id: int,
        phrase: str,
        user_id: int,
        db: Session,
        case_sensitive: bool = False,
        context_size: int = 100,
    ) -> Dict[str, Any]:
        """
        Search for an exact phrase in a PDF

        Args:
            pdf_id: ID of the PDF to search
            phrase: Exact phrase to search for
            user_id: ID of the user making the request
            db: Database session
            case_sensitive: If True, perform case-sensitive search
            context_size: Number of characters to include around each match

        Returns:
            Dictionary with search results
        """
        # Verify PDF exists and belongs to user
        pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.user_id == user_id).first()
        if not pdf:
            return {"status": "error", "message": "PDF not found or access denied"}

        if not phrase or not phrase.strip():
            return {"status": "error", "message": "No phrase provided"}

        try:
            # Check if we have an index for this PDF
            index_data = pdf_pipeline.get_index(pdf_id)

            # If we have an index, use it; otherwise extract text on the fly
            if index_data:
                pages = index_data["pages"]
                self.logger.info(f"Using existing index for PDF {pdf_id}")
            else:
                # Extract text from PDF with page numbers
                pages = self.extract_text_with_pages(pdf.file_path)
                self.logger.info(f"Extracting text on the fly for PDF {pdf_id}")

            # Prepare phrase for search
            search_phrase = phrase if case_sensitive else phrase.lower()

            # Search for phrase matches
            matches = []

            for page in pages:
                page_num = page["page_num"]
                text = page["text"]
                search_text = text if case_sensitive else text.lower()

                # Find all occurrences of the phrase
                page_matches = []
                start_idx = 0

                while True:
                    start_idx = search_text.find(search_phrase, start_idx)
                    if start_idx == -1:
                        break

                    end_idx = start_idx + len(search_phrase)

                    # Get context around match
                    context_start = max(0, start_idx - context_size)
                    context_end = min(len(text), end_idx + context_size)

                    # Get the actual matched text from the original text
                    matched_text = text[start_idx:end_idx]

                    # Get context text
                    context_before = text[context_start:start_idx]
                    context_after = text[end_idx:context_end]

                    page_matches.append(
                        {
                            "matched_text": matched_text,
                            "context_before": context_before,
                            "context_after": context_after,
                            "position": {"start": start_idx, "end": end_idx},
                        }
                    )

                    # Move past this match
                    start_idx = end_idx

                # If we have matches for this page
                if page_matches:
                    matches.append(
                        {
                            "page": page_num,
                            "matches": page_matches,
                            "match_count": len(page_matches),
                        }
                    )

            # Sort matches by number of occurrences (most matches first)
            matches.sort(key=lambda x: x["match_count"], reverse=True)

            return {
                "status": "success",
                "phrase": phrase,
                "pdf_id": pdf_id,
                "case_sensitive": case_sensitive,
                "total_matches": sum(page["match_count"] for page in matches),
                "pages_with_matches": len(matches),
                "results": matches,
            }

        except Exception as e:
            self.logger.error(f"Phrase search error: {str(e)}")
            return {"status": "error", "message": f"Phrase search error: {str(e)}"}


# Create a singleton instance
search_tool = SearchTool()
