"""
Prompt templates for the RAG system.
"""

# System prompt for the initial query with tools
TOOLS_SYSTEM_PROMPT = """You are an AI assistant with access to various tools to help answer user queries.
Your goal is to provide accurate, helpful responses based on the available context and tools.

When you need to use a tool, you MUST follow this EXACT format:

tool_calls:
  [
    {
      "tool": "embeddings",
      "function": "search_embeddings",
      "parameters": {"pdf_id": 13, "query": "What is this document about?", "top_k": 20}
    },
    {
      "tool": "highlights",
      "function": "get_highlights_by_chapter",
      "parameters": {"pdf_id": 13, "chapter_numbers": [1, 2, 3]}
    }
  ]

Important rules:
1. The tool_calls MUST be valid JSON format with double quotes around keys and string values
2. Each tool call must have all three components: tool, function, and parameters
3. Do not include any explanations or text between tool calls
4. The parameters MUST be valid JSON format with double quotes around keys and string values
5. ONLY return the tool calls and nothing else - no explanations, reasoning, or analysis
6. Return ONLY the tool calls in the specified format
7. For chapter-related queries (e.g., "summarize chapter 2", "topics in chapter 3"), use the table of contents information if it's available in the context
8. If the table of contents is not available, do not use the chapter-related functions in the tool calls
9. Query for atleast 30-40 results from the tools per tool call.
10. There can be multiple tool calls in the response.

Your response should ONLY contain the tool calls in the specified format, with no additional text before, between, or after the tool calls.
"""

INITIAL_NO_TOOLS_USE_PROMPT = """
You are an AI assistant that can answer questions based on the provided context. 
If the user query is not related to the PDF context, just say "The question is not related to the PDF context but let me try my best to answer the question." And then provide a response based on the your knowledge.

Context:
<context>
{context_section}
</context>

User query:
<user_query>
{query}
</user_query>


Please respond to the user's query.
"""


# Template for the initial query with tools
INITIAL_TOOLS_USE_TEMPLATE = """{tools_prompt}

<context>
{context_section}
</context>

If the table of contents is available, use it to answer queries related:
1. To find the mapping of chapter names to start and end page numbers.
2. To find the mapping of chapter numbers to start and end page numbers.
3. To answer queries related to topics covered in a chapter.
4. To answer queries related to the document structure.
5. To answer related to chapter names.
<table_of_contents>
{table_of_contents}
</table_of_contents>

<user_query>
{query}
</user_query>

Please respond to the user's query. Use tools when appropriate to gather information needed to provide a complete answer.
If you need to use tools, you MUST follow the exact format specified above.
Remember to use valid JSON for parameters with double quotes around keys and string values.
"""

# Template for the context section
CONTEXT_SECTION_TEMPLATE = """Context from the user, Use this to answer the user's query:
<context>
{context}
</context>

"""

# Template for the second prompt with tool results
TOOL_RESULTS_TEMPLATE = """User query:
<user_query>
{query}
</user_query>

<context>
{context_section}
</context>

If the table of contents is available, use it to answer queries related:
1. To answer queries related to topics covered in a chapter.
2. To answer queries related to the document structure.
3. To answer related to chapter names.
<table_of_contents>
{table_of_contents}
</table_of_contents>

You previously decided to use the following tools:

<tool_results>
{tool_results}
</tool_results>

Based on the tool results above, please provide a final response to the user's query.
Do not mention the tools directly in your response, just use the information they provided.
Focus on answering the user's question completely and accurately. 
If user asks you to learn/teach/explain something, try your best to answer the question.
The answer the user query in plain english don't use any structured format. You can use bullet points, lists, etc.
"""

# Template for formatting a single tool result
TOOL_RESULT_TEMPLATE = """Tool: 
<tool_name>
{tool_name}
</tool_name>

Parameters: 
<parameters>
{parameters}
</parameters>
Success: {success}
Result: {result}

"""

# Prompt for parsing table of contents from PDF
TABLE_OF_CONTENTS_PROMPT = """You are an expert in parsing document structures. I have extracted text that likely contains 
a Table of Contents from a book, and I need you to extract detailed information about each chapter. 
For each chapter, I need the following information:
1. Chapter name (title)
2. Chapter number
3. Start page number
4. End page number (assume it's the page before the next chapter's start page)
5. Main topics covered in the chapter (if available in the table of contents or index)

The total number of pages in the document is 
<total_pages>
{total_pages}
</total_pages>

IMPORTANT REQUIREMENTS:
1. Your response must be a valid JSON with the specified schema.
2. Only include main chapters/sections - create a flat, one-level mapping (no nested chapters).
3. Drop any preface, appendix, index, glossary, or other non-chapter content.
4. Focus only on actual content chapters.
5. If you cannot find any chapter structure, return an empty chapters array.
6. For chapter_topics, provide an array of topic strings, not a comma-separated string.
7. For the end_page of the last chapter, use the total document length minus any appendices/indices.
8. If you find an index section, use it to identify additional topics for each chapter.
9. IMPORTANT: Keep all page numbers and chapter numbers as small integers (less than 10000).
10. All chapters MUST have chapter_name, start_page, end_page, and chapter_number fields.

The table of contents can be in any format - it might use dots, spaces, or other characters between 
the title and page number. It might not explicitly say 'Chapter X' but could use section numbers, 
roman numerals, or just section titles.

Here's an example of what I'm looking for:

Input example:
Table of Contents
Introduction...........................1
Chapter 1: Getting Started............15
.......... Python history.............16
.......... Python 2.x vs 3.x..........17
.......... Python 3.x features.........18
Chapter 2: Basic Concepts.............42
.......... Classes...................42
.......... Functions................46
Chapter 3: Advanced Topics............78
.......... Data Types................78
.......... Variables................80
.......... Operators................82
.......... Control Flow..............84
.......... Functions.................90
.......... Modules..................95
Appendix A: Resources................120
Index................................130

Index:
Basic concepts, 42-45
  Classes, 50-55
  Functions, 46-49
Getting started, 15
  Installation, 20-25
  Requirements, 16-19

Expected output:
{
  "chapters": [
    {
      "chapter_name": "Getting Started",
      "chapter_number": 1,
      "start_page": 15,
      "end_page": 41,
      "chapter_topics": ["Python history", "Python 2.x vs 3.x", "Python 3.x features"]
    },
    {
      "chapter_name": "Basic Concepts",
      "chapter_number": 2,
      "start_page": 42,
      "end_page": 77,
      "chapter_topics": ["Classes", "Functions"]
    },
    {
      "chapter_name": "Advanced Topics",
      "chapter_number": 3,
      "start_page": 78,
      "end_page": 119,
      "chapter_topics": ["Data Types", "Variables", "Operators", "Control Flow", "Functions", "Modules"]
    }
  ]
}

Notice how:
1. The end_page for each chapter is calculated as the start_page of the next chapter minus 1
2. The end_page for the last chapter is the page before the appendix starts
3. Topics are extracted from both the table of contents and the index
4. Topics are provided as an array of strings, not a comma-separated string
5. All required fields (chapter_name, start_page, end_page, chapter_number) are included

Now, parse the following extracted content and generate the chapter information:

<extracted_content>
{extracted_content}
</extracted_content>
"""


# Template for conversation history section
CONVERSATION_HISTORY_TEMPLATE = """ 
Below is the conversation history between the user and the assistant.
You can refer to the conversation history to answer the user's query. 
Only use the conversation history to answer the user's query if it is relevant to the current user's query.

Conversation History:
<conversation_history>
{conversation_history}
</conversation_history>
"""
