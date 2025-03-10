import fitz  # PyMuPDF
from ..llms.deepseek import DeepseekLLM


# Step 1: Function to extract pages after finding a term
def extract_pages_after_term(doc, terms, num_pages=20):
    """
    Extracts text from the page where the first occurrence of any term in 'terms' is found
    and the next 'num_pages - 1' pages.

    Args:
        pdf_path (str): Path to the PDF file.
        terms (list): List of terms to search for.
        num_pages (int): Number of pages to extract (default is 20).

    Returns:
        str: Extracted text or a message if no term is found.
    """
    total_pages = len(doc)
    print(f"Total pages: {total_pages}")
    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text()
        for term in terms:
            if term in text:
                start_page = page_num
                end_page = min(start_page + num_pages, total_pages)
                extracted_text = []
                for i in range(start_page, end_page):
                    extracted_text.append(doc[i].get_text())
                return "\n".join(extracted_text)
    return None


def extract_first_n_pages(doc, n=20):
    n = min(n, len(doc) - 1)
    # Combine the text of the first n pages
    return "\n".join([doc[i].get_text() for i in range(n)])


# Step 3: Main function to generate chapter mapping
def generate_chapter_mapping(pdf_path):
    # List of terms for ToC-like sections
    doc = fitz.open(pdf_path)
    terms = [
        "Table of Contents",
        "Contents",
        "List of Chapters",
        "Index",
        "Outline",
        "Structure",
        "List of Sections",
        "Section Overview",
        "Features",
        "Articles",
        "Navigation",
        "Menu",
        "Site Map",
    ]

    # Extract the content
    extracted_content = extract_pages_after_term(doc, terms)
    if extracted_content is None:
        extracted_content = extract_first_n_pages(doc)

    # Construct the LLM prompt
    prompt = (
        "You are an expert in parsing document structures. I have extracted text that likely contains "
        "a Table of Contents from a book, and I need you to generate a JSON mapping of each chapter to its start "
        "and end page numbers. The input may contain chapter titles with their starting page numbers in various formats. "
        "For each chapter, assume the end page is the page before the next chapter's start page. "
        f"The total number of pages in the document is {len(doc)}.\n\n"
        "IMPORTANT REQUIREMENTS:\n"
        "1. Your response must contain ONLY the JSON mapping with no additional text.\n"
        "2. Only include main chapters/sections - create a flat, one-level mapping (no nested chapters).\n"
        "3. Drop any preface, appendix, index, glossary, or other non-chapter content.\n"
        "4. Focus only on actual content chapters.\n"
        "5. If you cannot find any chapter structure, return an empty JSON object: {}\n\n"
        "The table of contents can be in any format - it might use dots, spaces, or other characters between "
        "the title and page number. It might not explicitly say 'Chapter X' but could use section numbers, "
        "roman numerals, or just section titles.\n\n"
        "Here's an example:\n\n"
        "Input:\n"
        "Table of Contents\n"
        "Preface ...................................... i\n"
        "Chapter 1: Introduction ....................... 1\n"
        "Chapter 2: Getting Started .................... 15\n"
        "Chapter 3: Advanced Topics .................... 30\n"
        "Appendix A: Resources ......................... 45\n\n"
        "Output:\n"
        "{\n"
        '  "Chapter 1: Introduction": {"start": 1, "end": 14},\n'
        '  "Chapter 2: Getting Started": {"start": 15, "end": 29},\n'
        '  "Chapter 3: Advanced Topics": {"start": 30, "end": 44}\n'
        "}\n\n"
        "Another example with a different format:\n\n"
        "Input:\n"
        "CONTENTS\n"
        "Foreword                                      i\n"
        "I. Preface                                    5\n"
        "II. Methodology                              17\n"
        "III. Results and Discussion                  42\n"
        "Bibliography                                 60\n\n"
        "Output:\n"
        "{\n"
        '  "I. Preface": {"start": 5, "end": 16},\n'
        '  "II. Methodology": {"start": 17, "end": 41},\n'
        '  "III. Results and Discussion": {"start": 42, "end": 59}\n'
        "}\n\n"
        "Remember: Return ONLY the JSON mapping with no additional text.\n\n"
        "Now, parse the following extracted content and generate the same JSON mapping:\n\n"
        f"{extracted_content}"
    )
    print(f"Number of words in the prompt: {len(prompt.split())}")
    llm = DeepseekLLM()
    # Call the LLM
    json_mapping = llm.complete(prompt)
    return json_mapping


# Example usage
if __name__ == "__main__":
    pdf_path = "/Users/akumarmangat/Desktop/Resume.pdf"  # Replace with your PDF path
    result = generate_chapter_mapping(pdf_path)
    print("Generated Chapter Mapping:")
    print(result)
