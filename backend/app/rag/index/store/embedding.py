import chromadb
from chromadb.config import Settings
from typing import List, Optional, Dict, Any
import logging
from ...config import config


class VectorDB:
    def __init__(self):
        self.client = chromadb.Client(
            Settings(
                persist_directory=config.embedding_config.persist_directory,
                anonymized_telemetry=False,
            )
        )
        self.logger = logging.getLogger(__name__)
        self.collection_name = "document_embeddings"

    def _get_collection(self):
        """Get or create collection"""
        return self.client.get_or_create_collection(name=self.collection_name)

    def store_embeddings(
        self, chunks: List[str], embeddings: List[List[float]], pdf_id: str
    ):
        """
        Store embeddings in ChromaDB

        Args:
            chunks: List of text chunks
            embeddings: List of embedding vectors
            pdf_id: PDF identifier for filtering
        """
        try:
            collection = self._get_collection()

            collection.add(
                documents=chunks,
                embeddings=embeddings,
                metadatas=[{"pdf_id": str(pdf_id)} for _ in chunks],
                ids=[f"{pdf_id}-{i}" for i in range(len(chunks))],
            )
            self.logger.info(
                f"Successfully stored {len(chunks)} embeddings for PDF {pdf_id}"
            )
        except Exception as e:
            self.logger.error(f"Error storing embeddings for PDF {pdf_id}: {str(e)}")
            raise

    def delete_embeddings(self, pdf_id: str) -> Dict[str, Any]:
        """
        Delete embeddings for a specific PDF

        Args:
            pdf_id: PDF identifier to delete embeddings for

        Returns:
            Dict with operation status
        """
        try:
            collection = self._get_collection()

            # Delete all entries with matching pdf_id
            collection.delete(where={"pdf_id": str(pdf_id)})

            self.logger.info(f"Successfully deleted embeddings for PDF {pdf_id}")
            return {
                "status": "success",
                "message": f"Deleted embeddings for PDF {pdf_id}",
            }

        except Exception as e:
            self.logger.error(f"Error deleting embeddings for PDF {pdf_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def search_embeddings(
        self, query_embedding: List[float], pdf_id: Optional[str] = None, top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Search for similar embeddings

        Args:
            query_embedding: Query vector to search with
            pdf_id: Optional PDF ID to filter search results
            top_k: Number of results to return

        Returns:
            Dict containing search results with metadata
        """
        try:
            collection = self._get_collection()

            # Prepare filter if pdf_id is provided
            where_filter = {"pdf_id": str(pdf_id)} if pdf_id else None

            # Perform search
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )

            # Format results
            formatted_results = []
            for i in range(len(results["documents"][0])):
                formatted_results.append(
                    {
                        "text": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i],
                        "similarity": 1
                        - results["distances"][0][i],  # Convert distance to similarity
                    }
                )

            return {"status": "success", "results": formatted_results}

        except Exception as e:
            self.logger.error(f"Search error: {str(e)}")
            return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    # Initialize VectorDB
    vec_db = VectorDB()

    # Store embeddings
    vec_db.store_embeddings(
        chunks=["text chunk 1", "text chunk 2"],
        embeddings=[[0.1, 0.2, ...], [0.3, 0.4, ...]],
        pdf_id="pdf123",
    )

    # Search embeddings (optionally filtered by PDF)
    search_results = vec_db.search_embeddings(
        query_embedding=[0.2, 0.2, ...], pdf_id="pdf123", top_k=5  # Optional
    )

    print(search_results)
