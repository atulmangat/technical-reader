import os
import pickle
from typing import List, Dict, Any, Optional
import logging
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from ...config import config


class KeywordDB:
    def __init__(self):
        """
        Initialize KeywordDB with TF-IDF for keyword-based retrieval
        """
        self.persist_directory = config.keyword_config.persist_directory
        self.logger = logging.getLogger(__name__)
        self.vectorizer = TfidfVectorizer(lowercase=True, stop_words="english")
        self.documents = {}  # {id: text}
        self.metadata = {}  # {id: metadata}
        self.tfidf_matrix = None

        # Create directory if it doesn't exist
        os.makedirs(self.persist_directory, exist_ok=True)

        # Load existing data if available
        self._load_data()

    def _save_data(self):
        """Save the current state to disk"""
        try:
            with open(os.path.join(self.persist_directory, "documents.pkl"), "wb") as f:
                pickle.dump(self.documents, f)
            with open(os.path.join(self.persist_directory, "metadata.pkl"), "wb") as f:
                pickle.dump(self.metadata, f)
            with open(
                os.path.join(self.persist_directory, "vectorizer.pkl"), "wb"
            ) as f:
                pickle.dump(self.vectorizer, f)
            if self.tfidf_matrix is not None:
                with open(
                    os.path.join(self.persist_directory, "tfidf_matrix.pkl"), "wb"
                ) as f:
                    pickle.dump(self.tfidf_matrix, f)
            self.logger.info("Successfully saved keyword database")
        except Exception as e:
            self.logger.error(f"Error saving keyword database: {str(e)}")
            raise

    def _load_data(self):
        """Load the saved state from disk if it exists"""
        try:
            if os.path.exists(os.path.join(self.persist_directory, "documents.pkl")):
                with open(
                    os.path.join(self.persist_directory, "documents.pkl"), "rb"
                ) as f:
                    self.documents = pickle.load(f)
                with open(
                    os.path.join(self.persist_directory, "metadata.pkl"), "rb"
                ) as f:
                    self.metadata = pickle.load(f)
                with open(
                    os.path.join(self.persist_directory, "vectorizer.pkl"), "rb"
                ) as f:
                    self.vectorizer = pickle.load(f)
                if os.path.exists(
                    os.path.join(self.persist_directory, "tfidf_matrix.pkl")
                ):
                    with open(
                        os.path.join(self.persist_directory, "tfidf_matrix.pkl"), "rb"
                    ) as f:
                        self.tfidf_matrix = pickle.load(f)
                self.logger.info("Successfully loaded keyword database")
        except Exception as e:
            self.logger.error(f"Error loading keyword database: {str(e)}")
            # Initialize with empty data if loading fails
            self.documents = {}
            self.metadata = {}
            self.tfidf_matrix = None

    def _rebuild_index(self):
        """Rebuild the TF-IDF index with current documents"""
        if not self.documents:
            self.tfidf_matrix = None
            return

        docs = list(self.documents.values())
        self.tfidf_matrix = self.vectorizer.fit_transform(docs)
        self._save_data()

    def store_chunks(self, chunks: List[str], pdf_id: str):
        """
        Store text chunks with keyword indexing

        Args:
            chunks: List of text chunks to store
            pdf_id: PDF identifier for filtering
        """
        try:
            # Delete existing chunks for this PDF if any
            self.delete_chunks(pdf_id)

            # Add new chunks
            for i, chunk in enumerate(chunks):
                chunk_id = f"{pdf_id}-{i}"
                self.documents[chunk_id] = chunk
                self.metadata[chunk_id] = {"pdf_id": str(pdf_id)}

            # Rebuild the TF-IDF index
            self._rebuild_index()

            self.logger.info(
                f"Successfully stored {len(chunks)} chunks for PDF {pdf_id}"
            )
            return {
                "status": "success",
                "message": f"Stored {len(chunks)} chunks for PDF {pdf_id}",
            }
        except Exception as e:
            self.logger.error(f"Error storing chunks for PDF {pdf_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def delete_chunks(self, pdf_id: str) -> Dict[str, Any]:
        """
        Delete chunks for a specific PDF

        Args:
            pdf_id: PDF identifier to delete chunks for

        Returns:
            Dict with operation status
        """
        try:
            # Find all chunk IDs for this PDF
            to_delete = [
                chunk_id
                for chunk_id, meta in self.metadata.items()
                if meta.get("pdf_id") == str(pdf_id)
            ]

            # Delete the chunks
            for chunk_id in to_delete:
                if chunk_id in self.documents:
                    del self.documents[chunk_id]
                if chunk_id in self.metadata:
                    del self.metadata[chunk_id]

            # Rebuild the index if we deleted anything
            if to_delete:
                self._rebuild_index()

            self.logger.info(
                f"Successfully deleted {len(to_delete)} chunks for PDF {pdf_id}"
            )
            return {
                "status": "success",
                "message": f"Deleted {len(to_delete)} chunks for PDF {pdf_id}",
            }
        except Exception as e:
            self.logger.error(f"Error deleting chunks for PDF {pdf_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def search_chunks(
        self, query: str, pdf_id: Optional[str] = None, top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Search for chunks matching the query keywords

        Args:
            query: Text query to search with
            pdf_id: Optional PDF ID to filter search results
            top_k: Number of results to return

        Returns:
            Dict containing search results with metadata
        """
        try:
            if not self.documents or self.tfidf_matrix is None:
                return {"status": "success", "results": []}

            # Transform query to TF-IDF space
            query_vector = self.vectorizer.transform([query])

            # Calculate similarity scores
            similarity_scores = cosine_similarity(
                query_vector, self.tfidf_matrix
            ).flatten()

            # Get document IDs
            doc_ids = list(self.documents.keys())

            # Create (doc_id, score) pairs and sort by score
            results_with_scores = [
                (doc_id, score) for doc_id, score in zip(doc_ids, similarity_scores)
            ]

            # Filter by PDF ID if provided
            if pdf_id:
                results_with_scores = [
                    (doc_id, score)
                    for doc_id, score in results_with_scores
                    if self.metadata.get(doc_id, {}).get("pdf_id") == str(pdf_id)
                ]

            # Sort by score (descending) and take top_k
            results_with_scores.sort(key=lambda x: x[1], reverse=True)
            top_results = results_with_scores[:top_k]

            # Format results
            formatted_results = []
            for doc_id, score in top_results:
                formatted_results.append(
                    {
                        "text": self.documents[doc_id],
                        "metadata": self.metadata[doc_id],
                        "similarity": float(
                            score
                        ),  # Convert numpy float to Python float
                    }
                )

            return {"status": "success", "results": formatted_results}
        except Exception as e:
            self.logger.error(f"Search error: {str(e)}")
            return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    # Initialize KeywordDB
    keyword_db = KeywordDB()

    # Example PDF text
    sample_pdf_text = """# Introduction

    This is a sample PDF document for testing the chunking functionality.

    ## Background

    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
    incididunt ut labore et dolore magna aliqua.

    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
    ex ea commodo consequat.

    # Methods

    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
    nulla pariatur. Excepteur sint occaecat cupidatat non proident.

    ## Data Analysis

    Sunt in culpa qui officia deserunt mollit anim id est laborum.
    """

    # Chunk and store PDF by heading
    keyword_db.chunk_and_store_pdf(
        pdf_text=sample_pdf_text, pdf_id="sample123", chunk_by="heading"
    )

    # Search chunks
    search_results = keyword_db.search_chunks(
        query="data analysis", pdf_id="sample123", top_k=3
    )

    print(search_results)
