import re
import nltk
from nltk.tokenize import sent_tokenize
from nltk.corpus import stopwords
import networkx as nx
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import fitz  # PyMuPDF
import ssl
from typing import List, Optional
from sqlalchemy.orm import Session
from .tool_interface import ToolInterface
from ...models.pdf import PDF
from ...utils.database import get_db


def _ensure_nltk_resources():
    """
    Ensure NLTK resources are available, handling SSL certificate issues
    """
    try:
        nltk.data.find("tokenizers/punkt")
        nltk.data.find("corpora/stopwords")
    except LookupError:
        try:
            # Try with SSL verification disabled
            try:
                _create_unverified_https_context = ssl._create_unverified_context
            except AttributeError:
                pass
            else:
                ssl._create_default_https_context = _create_unverified_https_context

            nltk.download("punkt")
            nltk.download("stopwords")
        except Exception as e:
            print(f"Warning: Failed to download NLTK resources: {e}")
            print("Falling back to basic tokenization")


def _basic_tokenize(text):
    """
    Basic sentence tokenization fallback if NLTK fails
    """
    # Simple but reasonably effective sentence splitting
    text = re.sub(r"\.([A-Z])", r".\n\1", text)  # Split on period followed by capital
    text = re.sub(r"\?\s", "?\n", text)  # Split on question mark
    text = re.sub(r"!\s", "!\n", text)  # Split on exclamation mark
    return [s.strip() for s in text.split("\n") if s.strip()]


def _extract_key_sentences_textrank(
    pdf_path: str,
    pages: Optional[List[int]] = None,
    max_sentences: int = 10,
    min_sentence_length: int = 10,
    max_sentence_length: int = 500,
) -> List[str]:
    """
    Extract key sentences from specified pages of a PDF using TextRank algorithm

    Args:
        pdf_path: Path to the PDF file
        pages: List of page numbers to analyze (1-based indexing)
              If None, analyze all pages
        max_sentences: Maximum number of key sentences to return
        min_sentence_length: Minimum character length for a valid sentence
        max_sentence_length: Maximum character length for a valid sentence

    Returns:
        List of extracted key sentences
    """
    # Try to ensure NLTK resources are available
    _ensure_nltk_resources()

    # Extract text from PDF
    doc = fitz.open(pdf_path)

    # If no specific pages requested, extract all
    if pages is None:
        pages = list(range(1, len(doc) + 1))

    # Validate page numbers
    valid_pages = [p for p in pages if 1 <= p <= len(doc)]

    # Extract text from valid pages
    page_texts = []
    for page_num in valid_pages:
        # Convert to 0-based indexing for PyMuPDF
        page = doc[page_num - 1]
        page_texts.append(page.get_text())

    # Combine all text
    full_text = " ".join(page_texts)

    # Split into sentences - try NLTK, fall back to basic method
    try:
        sentences = sent_tokenize(full_text)
    except:
        sentences = _basic_tokenize(full_text)

    # Filter out too short or too long sentences
    filtered_sentences = [
        s.strip()
        for s in sentences
        if min_sentence_length <= len(s) <= max_sentence_length
    ]

    # Store original sentences for return
    original_sentences = filtered_sentences.copy()

    if len(filtered_sentences) <= 1:
        return original_sentences  # Return all we have if only 1 or 0 sentences

    # Clean sentences for similarity calculation
    cleaned_sentences = []
    for s in filtered_sentences:
        # Remove special characters and numbers
        cleaned = re.sub(r"[^\w\s]", "", s)
        cleaned = re.sub(r"\d+", "", cleaned)
        # Convert to lowercase
        cleaned = cleaned.lower()
        cleaned_sentences.append(cleaned)

    # Create sentence vectors using TF-IDF
    try:
        stop_words = set(stopwords.words("english"))
    except:
        # Fallback stopwords if NLTK fails
        stop_words = {
            "a",
            "an",
            "the",
            "and",
            "but",
            "if",
            "or",
            "because",
            "as",
            "until",
            "while",
            "of",
            "at",
            "by",
            "for",
            "with",
            "about",
            "against",
            "between",
            "into",
            "through",
            "during",
            "before",
            "after",
            "above",
            "below",
            "to",
            "from",
            "up",
            "down",
            "in",
            "out",
            "on",
            "off",
            "over",
            "under",
            "again",
            "further",
            "then",
            "once",
            "here",
            "there",
            "when",
            "where",
            "why",
            "how",
            "all",
            "any",
            "both",
            "each",
            "few",
            "more",
            "most",
            "other",
            "some",
            "such",
            "no",
            "nor",
            "not",
            "only",
            "own",
            "same",
            "so",
            "than",
            "too",
            "very",
            "is",
            "am",
            "are",
            "was",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "having",
            "do",
            "does",
            "did",
            "doing",
            "would",
            "should",
            "could",
            "ought",
            "i",
            "me",
            "my",
            "myself",
            "we",
            "our",
            "ours",
            "ourselves",
            "you",
            "your",
            "yours",
            "yourself",
            "yourselves",
            "he",
            "him",
            "his",
            "himself",
            "she",
            "her",
            "hers",
            "herself",
            "it",
            "its",
            "itself",
            "they",
            "them",
            "their",
            "theirs",
            "themselves",
            "what",
            "which",
            "who",
            "whom",
            "this",
            "that",
            "these",
            "those",
            "that",
            "which",
            "who",
            "whom",
            "this",
            "that",
            "these",
            "those",
        }

    vectorizer = TfidfVectorizer(stop_words=stop_words)
    try:
        sentence_vectors = vectorizer.fit_transform(cleaned_sentences)
    except ValueError as e:
        # If TF-IDF fails (e.g., empty input), return top sentences by position
        if len(filtered_sentences) <= max_sentences:
            return filtered_sentences
        else:
            return filtered_sentences[:max_sentences]

    # Compute similarity matrix
    similarity_matrix = cosine_similarity(sentence_vectors, sentence_vectors)

    # Apply a threshold to the similarity matrix to make the graph sparse
    threshold = 0.2
    for i in range(len(similarity_matrix)):
        for j in range(len(similarity_matrix)):
            if i == j:
                similarity_matrix[i][j] = 0  # Set diagonal to 0
            elif similarity_matrix[i][j] < threshold:
                similarity_matrix[i][j] = 0

    # Create networkx graph from similarity matrix
    nx_graph = nx.from_numpy_array(similarity_matrix)

    # Apply PageRank algorithm (TextRank)
    scores = nx.pagerank(nx_graph, alpha=0.85)  # 0.85 is the damping factor

    # Get top ranked sentences
    ranked_sentences = sorted(
        [(scores[i], i) for i in range(len(filtered_sentences))], reverse=True
    )

    # Select top sentences (up to max_sentences)
    top_indices = [
        ranked_sentences[i][1] for i in range(min(max_sentences, len(ranked_sentences)))
    ]

    # Sort indices by original order to maintain narrative flow
    top_indices = sorted(top_indices)

    # Return top sentences in their original order
    return [original_sentences[i] for i in top_indices]


def get_key_sentences_for_summary(
    pdf_id: int,
    pages: Optional[List[int]] = [],
    max_sentences: int = 15,
    db: Session = None
) -> str:
    """
    Wrapper function to extract key sentences and format them for use in LLM summarization

    Args:
        pdf_path: Path to the PDF file
        pages: List of page numbers to analyze (1-based indexing)
        max_sentences: Maximum number of key sentences to return
        use_textrank: If True, use TextRank algorithm, otherwise use hybrid approach

    Returns:
        String containing key sentences formatted for summarization
    """
    if db is None:
        db = next(get_db())
    print(f"Pages: {pages}")
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if pdf is None:
        raise ValueError(f"PDF with id {pdf_id} not found")
    pdf_path = pdf.file_path
    sentences = _extract_key_sentences_textrank(pdf_path, pages, max_sentences)
    if not sentences:
        return "No significant content could be extracted from the provided pages."

    # Format the sentences with bullet points for better LLM processing
    formatted_text = "Key points from the document:\n\n"
    for sentence in sentences:
        formatted_text += f"• {sentence}\n\n"

    print(f"Formatted text: {formatted_text}")
    
    return formatted_text


# Create a summary tool interface
summary_tool = ToolInterface(
    name="summary",
    description="""
    The summary tool extracts and summarizes key information from PDF documents. 
    
    How to use this tool:
    - When a user asks for a summary of the entire document: "Can you summarize this document for me?" or "Give me a summary of chapter two?" 
    - Use atleast 200 sentences to summarize the document and 100 sentences to summarize a chapter.
    - When a user wants a summary of specific pages: "Summarize pages 5-10" or "What are the key points on page 15?"
    - When a user requests a summary of a specific chapter: "Give me a summary of chapter 2" or "What's chapter 3 about?"
    - When a user wants the main ideas or key points: "What are the main ideas in this document?" or "Extract the key points"
    - When user asks for list of topics or chapter prefer using table of contents to answer the user's query.
    
    The tool uses TextRank algorithm to identify the most important sentences in the document and presents them as bullet points.
    """
)

# Set the injectable parameters for this tool
summary_tool.set_injectable_params({"db"})

@summary_tool.register_function
def get_summary(pdf_id: int, pages: Optional[List[int]] = [], max_sentences: int = 15, db: Session = None) -> str:
    """
    Extract key sentences from a PDF and format them for summarization
    
    Args:
        pdf_id: ID of the PDF document
        pages: List of page numbers to analyze (1-based indexing)
        max_sentences: Maximum number of key sentences to return
        
    Returns:
        Formatted string containing key sentences for summarization
    """
    print("Getting summary called")
    if db is None:
        raise ValueError("Database session is required but not provided")
    # Handle the case where pages is an empty list
    if not pages:
        pages = None
    return get_key_sentences_for_summary(pdf_id, pages, max_sentences, db)
