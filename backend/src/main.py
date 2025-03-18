from .routes.v1 import auth, highlights, notes, pdf, rag
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .utils.database import engine
from .models.base import Base
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
# Set httpx logger to WARNING level to suppress HTTP request logs
logging.getLogger("httpx").setLevel(logging.WARNING)

# Check for required environment variables
required_env_vars = ["DEEPSEEK_API_KEY", "MISTRAL_API_KEY"]
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise RuntimeError(
        f"Missing required environment variables: {', '.join(missing_vars)}"
    )

# Create database tables
Base.metadata.create_all(bind=engine)

# Get the absolute path to the application root directory
app_root = os.path.dirname(os.path.abspath(__file__))
instance_path = os.path.join(os.path.dirname(app_root), "instance")
uploads_path = os.path.join(os.path.dirname(app_root), "uploads")
# Use the src/thumbnails directory where thumbnails are actually stored
thumbnails_path = os.path.join(os.path.dirname(app_root), "thumbnails")

# Ensure directories exist
os.makedirs(instance_path, exist_ok=True)
os.makedirs(uploads_path, exist_ok=True)
os.makedirs(thumbnails_path, exist_ok=True)

app = FastAPI(title="PDF Manager API")

# Configure CORS for development
# TODO:In production, replace with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for thumbnails
app.mount("/thumbnails", StaticFiles(directory=thumbnails_path), name="thumbnails")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(pdf.router, prefix="/api/pdfs", tags=["PDF Management"])
app.include_router(notes.router, prefix="/api/pdfs", tags=["Notes"])
app.include_router(
    highlights.router, prefix="/api/pdfs", tags=["Highlights"]
)
app.include_router(rag.router, prefix="/api/pdfs", tags=["RAG"])

# Setup logging
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Start the PDF embedding pipeline when the application starts"""
    from .routes.v1.pdf import pdf_pipeline
    
    logger.info("Starting PDF embedding pipeline...")
    started = pdf_pipeline.start()
    if started:
        logger.info("PDF embedding pipeline started successfully")
    else:
        logger.warning("PDF embedding pipeline was already running or failed to start")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop the PDF embedding pipeline when the application shuts down"""
    from .routes.v1.pdf import pdf_pipeline
    
    logger.info("Stopping PDF embedding pipeline...")
    stopped = pdf_pipeline.stop()
    if stopped:
        logger.info("PDF embedding pipeline stopped successfully")
    else:
        logger.warning("PDF embedding pipeline was not running or failed to stop")

