# PDF Viewer with AI Chat

An interactive PDF viewer with AI-powered chat, highlighting, and note-taking capabilities.

## Features

- 📚 PDF Library Management
- 📖 Interactive PDF Viewing
- 🤖 AI-powered Chat Assistant
- ✨ Text Highlighting
- 📝 Note Taking
- 📑 Table of Contents Navigation
- 🔍 Zoom Controls
- 📱 Responsive Layout

## Prerequisites

- Python 3.8+
- Node.js 14+
- pip (Python package manager)
- npm (Node.js package manager)

## Setup Instructions

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pdf-viewer.git
   cd pdf-viewer
   ```

2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows
   .\venv\Scripts\Activate
   # On Unix-like systems (Linux and macOS)
   source venv/bin/activate 
   ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Initialize Database (Only Required for First-Time Setup or Schema Changes)
   ```bash
   python -m app.initialize_db
   ```
   Note: You only need to run this when setting up the project for the first time or if you manually delete the database or change models.

5. Run the Flask application:
   ```bash
   python run.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```      

3. Start the development server:
   ```bash
   npm start
   ```


