"""
Prompt templates for LLM interactions.

This module provides a collection of prompt templates for various tasks
that can be used with the LLM interface.
"""

from typing import List, Optional


class PromptTemplate:
    """Base class for prompt templates."""

    def __init__(self, template: str):
        self.template = template

    def format(self, **kwargs) -> str:
        """Format the template with the provided variables."""
        return self.template.format(**kwargs)


# RAG-specific prompt templates
class RAGPromptTemplates:
    """Prompt templates for Retrieval-Augmented Generation (RAG)."""

    @staticmethod
    def query_generation(query: str) -> str:
        """Generate a search query from a user question."""
        template = """
        Given the following user question, generate a concise search query that would help retrieve relevant information:

        User question: {query}

        Search query:
        """
        return template.format(query=query)

    @staticmethod
    def context_qa(query: str, context: List[str]) -> str:
        """Answer a question based on the provided context."""
        context_str = "\n\n".join(
            [f"Document {i+1}:\n{doc}" for i, doc in enumerate(context)]
        )
        template = """
        Answer the following question based ONLY on the provided context. If the answer cannot be determined from the context, say "I don't have enough information to answer this question."

        Context:
        {context}

        Question: {query}

        Answer:
        """
        return template.format(query=query, context=context_str)

    @staticmethod
    def summarization(text: str, max_length: Optional[int] = None) -> str:
        """Summarize the provided text."""
        length_instruction = f"in no more than {max_length} words" if max_length else ""
        template = """
        Summarize the following text {length_instruction}:

        {text}

        Summary:
        """
        return template.format(text=text, length_instruction=length_instruction)


# Code-related prompt templates
class CodePromptTemplates:
    """Prompt templates for code-related tasks."""

    @staticmethod
    def code_explanation(code: str) -> str:
        """Explain what the provided code does."""
        template = """
        Explain what the following code does in simple terms:

        ```
        {code}
        ```

        Explanation:
        """
        return template.format(code=code)

    @staticmethod
    def code_review(code: str) -> str:
        """Review the provided code for issues and improvements."""
        template = """
        Review the following code for potential issues, bugs, and improvements:

        ```
        {code}
        ```

        Review:
        """
        return template.format(code=code)

    @staticmethod
    def code_completion(code: str) -> str:
        """Complete the provided code snippet."""
        template = """
        Complete the following code snippet:

        ```
        {code}
        ```

        Completed code:
        """
        return template.format(code=code)


# General-purpose prompt templates
class GeneralPromptTemplates:
    """General-purpose prompt templates."""

    @staticmethod
    def classification(text: str, categories: List[str]) -> str:
        """Classify the provided text into one of the given categories."""
        categories_str = ", ".join(categories)
        template = """
        Classify the following text into one of these categories: {categories}

        Text: {text}

        Category:
        """
        return template.format(text=text, categories=categories_str)

    @staticmethod
    def sentiment_analysis(text: str) -> str:
        """Analyze the sentiment of the provided text."""
        template = """
        Analyze the sentiment of the following text as positive, negative, or neutral:

        Text: {text}

        Sentiment:
        """
        return template.format(text=text)

    @staticmethod
    def entity_extraction(text: str, entity_types: Optional[List[str]] = None) -> str:
        """Extract entities from the provided text."""
        entity_instruction = (
            f"Extract the following entity types: {', '.join(entity_types)}"
            if entity_types
            else "Extract all relevant entities"
        )
        template = """
        {entity_instruction} from the following text:

        Text: {text}

        Entities:
        """
        return template.format(text=text, entity_instruction=entity_instruction)
