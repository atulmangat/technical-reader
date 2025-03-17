import PyPDF2
import tiktoken
import argparse

def count_tokens_in_pdf(pdf_path, model="gpt-3.5-turbo"):
    """
    Count the number of tokens in a PDF file using a specified tokenizer model.
    
    Args:
        pdf_path (str): Path to the PDF file
        model (str): The name of the tokenizer model to use
    
    Returns:
        int: The total number of tokens in the PDF
    """
    # Extract text from PDF
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return 0
    
    # Count tokens using the specified model
    try:
        encoding = tiktoken.encoding_for_model(model)
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        print(f"Error counting tokens: {e}")
        return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Count tokens in a PDF file")
    parser.add_argument("pdf_path", help="Path to the PDF file")
    parser.add_argument("--model", default="gpt-3.5-turbo", 
                        help="Model name for tokenization (default: gpt-3.5-turbo)")
    
    args = parser.parse_args()
    
    token_count = count_tokens_in_pdf(args.pdf_path, args.model)
    print(f"The PDF contains approximately {token_count} tokens using the {args.model} tokenizer.")