#!/usr/bin/env python3
import requests
import json
import os
import time
import sys
from pprint import pprint

# Configuration
BASE_URL = "http://localhost:8080"
PDF_PATH = "/Users/akumarmangat/Desktop/book.pdf"
TEST_USER = {
    "email": "test@example.com",
    "username": "testuser",
    "password": "Password123!"
}

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

def print_step(message):
    print(f"\n{Colors.BLUE}=== {message} ==={Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}! {message}{Colors.ENDC}")

def print_json(data):
    print(json.dumps(data, indent=2))

# Check if the PDF file exists
if not os.path.exists(PDF_PATH):
    print_error(f"PDF file not found at {PDF_PATH}")
    sys.exit(1)

# Session to maintain cookies
session = requests.Session()

def register_user():
    print_step("Registering a new user")
    
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/register",
            json=TEST_USER
        )
        
        if response.status_code == 201:
            print_success("User registered successfully")
            return response.json()
        elif response.status_code == 400 and "already registered" in response.json().get("detail", ""):
            print_warning("User already exists, proceeding to login")
            return None
        else:
            print_error(f"Failed to register user: {response.status_code}")
            print_json(response.json())
            return None
    except Exception as e:
        print_error(f"Exception during registration: {str(e)}")
        return None

def login_user():
    print_step("Logging in")
    
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_USER["email"],
                "password": TEST_USER["password"]
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success("Login successful")
            print(f"Access token: {data['access_token'][:20]}...")
            
            # Set the authorization header for future requests
            session.headers.update({
                "Authorization": f"Bearer {data['access_token']}"
            })
            
            return data
        else:
            print_error(f"Login failed: {response.status_code}")
            print_json(response.json())
            return None
    except Exception as e:
        print_error(f"Exception during login: {str(e)}")
        return None

def upload_pdf():
    print_step("Uploading PDF")
    
    try:
        with open(PDF_PATH, "rb") as pdf_file:
            filename = os.path.basename(PDF_PATH)
            files = {"file": (filename, pdf_file, "application/pdf")}
            data = {"title": filename, "description": "Test PDF upload"}
            
            response = session.post(
                f"{BASE_URL}/api/pdfs/",
                files=files,
                data=data
            )
            
            if response.status_code == 201:
                data = response.json()
                print_success(f"PDF uploaded successfully with ID: {data['id']}")
                return data
            else:
                print_error(f"Failed to upload PDF: {response.status_code}")
                print_json(response.json())
                return None
    except Exception as e:
        print_error(f"Exception during PDF upload: {str(e)}")
        return None

def add_note(pdf_id):
    print_step("Adding a note to the PDF")
    
    try:
        note_data = {
            "note": "This is a test note for the PDF",
            "page_number": 1,
            "x_position": 100.0,
            "y_position": 100.0
        }
        
        response = session.post(
            f"{BASE_URL}/api/pdfs/{pdf_id}/notes",
            json=note_data
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Note added successfully with ID: {data['note_id']}")
            return data
        else:
            print_error(f"Failed to add note: {response.status_code}")
            print_json(response.json())
            return None
    except Exception as e:
        print_error(f"Exception while adding note: {str(e)}")
        return None

def get_notes(pdf_id):
    print_step("Getting notes from the PDF")
    
    try:
        response = session.get(
            f"{BASE_URL}/api/pdfs/{pdf_id}/notes"
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} notes")
            return data
        else:
            print_error(f"Failed to get notes: {response.status_code}")
            print_json(response.json())
            return None
    except Exception as e:
        print_error(f"Exception while getting notes: {str(e)}")
        return None

def add_highlight(pdf_id):
    print_step("Adding a highlight to the PDF")
    
    try:
        highlight_data = {
            "page_number": 1,
            "x_start": 100.0,
            "y_start": 100.0,
            "x_end": 200.0,
            "y_end": 200.0,
            "color": "#FFFF00",
            "content": "This is a test highlight"
        }
        
        response = session.post(
            f"{BASE_URL}/api/pdfs/{pdf_id}/highlights",
            json=highlight_data
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Highlight added successfully with ID: {data['highlight_id']}")
            return data
        else:
            print_error(f"Failed to add highlight: {response.status_code}")
            print_json(response.json())
            return None
    except Exception as e:
        print_error(f"Exception while adding highlight: {str(e)}")
        return None

def get_highlights(pdf_id):
    print_step("Getting highlights from the PDF")
    
    try:
        response = session.get(
            f"{BASE_URL}/api/pdfs/{pdf_id}/highlights"
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} highlights")
            return data
        else:
            print_error(f"Failed to get highlights: {response.status_code}")
            print_json(response.json())
            return None
    except Exception as e:
        print_error(f"Exception while getting highlights: {str(e)}")
        return None

def ask_question(pdf_id):
    print_step("Starting interactive chat session")
    
    try:
        print("Chat session started. Type your questions and press Enter.")
        print("Type 'exit' or 'quit' to end the session.")
        print("Type '/tools on' or '/tools off' to toggle the use of tools.")
        
        # Initialize conversation history and settings
        conversation_history = []
        use_tools = True
        
        while True:
            # Get user input
            user_question = input("\n> ")
            
            # Check if user wants to exit
            if user_question.lower() in ['exit', 'quit']:
                print("Ending chat session.")
                break
            
            # Check for commands
            if user_question.lower() == '/tools on':
                use_tools = True
                print_success("Tools enabled")
                continue
            elif user_question.lower() == '/tools off':
                use_tools = False
                print_success("Tools disabled")
                continue
            
            if not user_question.strip():
                continue
                            
            query_data = {
                "query": user_question,
                "model": "mistral",
                "use_tools": use_tools,
                "max_tokens": 500,
                "temperature": 0.7,
                "conversation_history": conversation_history
            }
            
            print_warning(f"Using tools: {use_tools}")
            
            # Use stream=True to get the response as it comes
            response = session.post(
                f"{BASE_URL}/api/pdfs/{pdf_id}/chat",
                json=query_data,
                stream=True
            )
            
            if response.status_code == 200:
                print("\nAI: ", end="", flush=True)
                
                # Process the stream in real-time
                full_response = ""
                
                for line in response.iter_lines():
                    if not line:
                        continue
                    
                    line = line.decode('utf-8')
                    if not line.startswith('data: '):
                        continue
                    
                    data = line[6:]  # Remove 'data: ' prefix
                    
                    if data == '[DONE]':
                        break
                    
                    try:
                        chunk = json.loads(data)
                        chunk_text = chunk.get('response', '')
                        full_response += chunk_text
                        print(chunk_text, end="", flush=True)
                        
                    except json.JSONDecodeError:
                        print_warning(f"Could not parse chunk: {data}")
                
                print()  # Add a newline after the response
                
                # Add assistant's response to conversation history
                if "We are still processing the PDF" in full_response:
                    continue
                conversation_history.append({"user": user_question})
                conversation_history.append({"assistant": full_response})
            else:
                print_error(f"Failed to ask question: {response.status_code}")
                try:
                    print_json(response.json())
                except:
                    print_error("Could not parse response")
        
        return True
    except Exception as e:
        print_error(f"Exception while asking question: {str(e)}")
        return None

def main():
    print_step("Starting backend test")
    
    # Register user (or skip if already exists)
    register_user()
    
    # Login
    login_result = login_user()
    if not login_result:
        print_error("Login failed, aborting test")
        return
    
    # Upload PDF
    pdf_data = upload_pdf()
    if not pdf_data:
        print_error("PDF upload failed, aborting test")
        return
    
    pdf_id = pdf_data["id"]
    
    # Add note
    note_result = add_note(pdf_id)
    
    # Get notes
    notes = get_notes(pdf_id)
    
    # Add highlight
    highlight_result = add_highlight(pdf_id)
    
    # Get highlights
    highlights = get_highlights(pdf_id)
    
    # Ask question
    question_result = ask_question(pdf_id)
    
    print_step("Test completed")
    
    # Summary
    print("\nTest Summary:")
    print(f"- User login: {'✓' if login_result else '✗'}")
    print(f"- PDF upload: {'✓' if pdf_data else '✗'}")
    print(f"- Add note: {'✓' if note_result else '✗'}")
    print(f"- Get notes: {'✓' if notes else '✗'}")
    print(f"- Add highlight: {'✓' if highlight_result else '✗'}")
    print(f"- Get highlights: {'✓' if highlights else '✗'}")
    print(f"- Ask question: {'✓' if question_result else '✗'}")

if __name__ == "__main__":
    main() 