from google import genai


# Define the schema for table of contents

TOC_RESPONSE_SCHEMA = genai.types.Schema(
    type=genai.types.Type.OBJECT,
    properties={
        "chapters": genai.types.Schema(
            type=genai.types.Type.ARRAY,
            items=genai.types.Schema(
                type=genai.types.Type.OBJECT,
                required=["chapter_name", "start_page", "end_page", "chapter_number"],
                properties={
                    "chapter_name": genai.types.Schema(
                        type=genai.types.Type.STRING,
                    ),
                    "chapter_topics": genai.types.Schema(
                        type=genai.types.Type.ARRAY,
                        items=genai.types.Schema(
                            type=genai.types.Type.STRING,
                        ),
                    ),
                    "start_page": genai.types.Schema(
                        type=genai.types.Type.INTEGER,
                    ),
                    "end_page": genai.types.Schema(
                        type=genai.types.Type.INTEGER,
                    ),
                    "chapter_number": genai.types.Schema(
                        type=genai.types.Type.INTEGER,
                    ),
                },
            ),
        ),
    },
)


TOOL_RESPONSE_SCHEMA = genai.types.Schema(
            type = genai.types.Type.OBJECT,
            properties = {
                "tool_calls": genai.types.Schema(
                    type = genai.types.Type.ARRAY,
                    items = genai.types.Schema(
                        type = genai.types.Type.OBJECT,
                        properties = {
                            "function": genai.types.Schema(
                                type = genai.types.Type.STRING,
                            ),
                            "parameters": genai.types.Schema(
                                type = genai.types.Type.ARRAY,
                                items = genai.types.Schema(
                                    type = genai.types.Type.STRING,
                                ),
                            ),
                            "tool": genai.types.Schema(
                                type = genai.types.Type.STRING,
                            ),
                        },
                    ),
                ),
            },
        )