import logging
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models
from ....config import config
import uuid


class VectorDB:
    def __init__(self):
        self.client = QdrantClient(
            host=config.embedding_config.qdrant_host,
            port=config.embedding_config.qdrant_port,
        )
        self.logger = logging.getLogger(__name__)
        self.collection_name = config.embedding_config.qdrant_collection_name
        self._ensure_collection_exists()

    def _ensure_collection_exists(self):
        """Ensure the collection exists, create it if it doesn't"""
        collections = self.client.get_collections().collections
        collection_names = [collection.name for collection in collections]

        if self.collection_name not in collection_names:
            # Create the collection with appropriate vector size
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=config.embedding_config.vector_size,  # Adjust based on your embedding model
                    distance=models.Distance.COSINE,
                ),
            )
            self.logger.info(f"Created collection: {self.collection_name}")

    def store_embeddings(
        self, chunks: List[str], embeddings: List[List[float]], pdf_id: str
    ):
        """
        Store embeddings in Qdrant

        Args:
            chunks: List of text chunks
            embeddings: List of embedding vectors
            pdf_id: PDF identifier for filtering
        """
        try:
            # Prepare points for batch upload
            points = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                # Generate a unique ID for the point
                point_id = str(uuid.uuid4())
                points.append(
                    models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload={"text": chunk, "pdf_id": pdf_id},
                    )
                )

            # Upload points in batch
            self.client.upsert(
                collection_name=self.collection_name,
                points=points,
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
            # Delete all entries with matching pdf_id
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="pdf_id",
                                match=models.MatchValue(value=pdf_id),
                            )
                        ]
                    )
                ),
            )

            self.logger.info(f"Successfully deleted embeddings for PDF {pdf_id}")
            return {
                "status": "success",
                "message": f"Deleted embeddings for PDF {pdf_id}",
            }

        except Exception as e:
            self.logger.error(f"Error deleting embeddings for PDF {pdf_id}: {str(e)}")
            return {"status": "error", "message": str(e)}

    def search_embeddings(
        self, pdf_id: str, query_embedding: List[float], top_k: int = 40
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
            # Prepare filter if pdf_id is provided
            filter_condition = None
            if pdf_id:
                filter_condition = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="pdf_id",
                            match=models.MatchValue(value=pdf_id),
                        )
                    ]
                )

            # Perform search
            search_results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=top_k,
                query_filter=filter_condition,
            )

            # Format results
            formatted_results = []
            for result in search_results:
                formatted_results.append(
                    {
                        "text": result.payload["text"],
                        "similarity": result.score,
                    }
                )
            return {"status": "success", "results": formatted_results}

        except Exception as e:
            self.logger.error(f"Search error: {str(e)}")
            return {"status": "error", "message": str(e)}


def get_vector_db() -> VectorDB:
    return VectorDB()