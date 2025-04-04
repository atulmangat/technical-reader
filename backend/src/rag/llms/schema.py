TOC_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "chapters": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["chapter_name", "start_page", "end_page", "chapter_number"],
                "properties": {
                    "chapter_name": {"type": "string"},
                    "chapter_topics": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "start_page": {"type": "integer"},
                    "end_page": {"type": "integer"},
                    "chapter_number": {"type": "integer"},
                }
            }
        }
    }
}


TOOL_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "tool_calls": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "function": {"type": "string"},
                    "parameters": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "tool": {"type": "string"},
                }
            }
        }
    }
}
