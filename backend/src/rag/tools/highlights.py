from typing import Dict, Any, Optional
import logging
from sqlalchemy.orm import Session
from datetime import datetime
from ....app.utils.models import PDF
from ...agents.base import Tool


class HighlightsTool(Tool):
    def __init__(self):
        super().__init__(
            name="highlights",
            description="Use this tool to add, get, and delete highlights from a PDF",
            function=self.add_highlight,
        )

    def get_highlights(self, pdf_id: int, user_id: int) -> Dict[str, Any]:
        return highlights_tool.get_highlights(pdf_id, user_id)
