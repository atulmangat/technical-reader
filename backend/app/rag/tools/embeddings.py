# implement the tool class for the embeddings
from typing import List
from tool import Tool
from ..store.embeddings import VectorDB


class EmbeddingsTool(Tool):
    def __init__(self):
        super().__init__(
            name="embeddings",
            description="Use this tool to get the top k results from the embeddings",
            function=self.search_embeddings,
        )

    def search_embeddings(self, query: str, top_k: int = 5) -> List[str]:
        vec_db = VectorDB()
        return vec_db.search_embeddings(query, top_k)
