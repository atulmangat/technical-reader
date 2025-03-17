import os
import sys
import shutil
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the parent directory to the Python path so we can import from src
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, parent_dir)

# Import all models to ensure they're registered with the Base metadata
from src.models.base import Base
from src.utils.database import engine
# Import all models to ensure they're registered with SQLAlchemy
import src.models.highlight
import src.models.pdf
import src.models.user
# Import any other models you have

def init_db():
    """Initialize the database by dropping all tables and recreating them."""
    try:
        logger.info("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        
        logger.info("Creating all tables...")
        Base.metadata.create_all(bind=engine)
        
        logger.info("Database initialized successfully!")
        return True
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        return False

def backup_db():
    """Backup the existing database file if it exists."""
    db_path = os.path.join(parent_dir, "app.db")
    if os.path.exists(db_path):
        backup_path = f"{db_path}.backup"
        try:
            shutil.copy2(db_path, backup_path)
            logger.info(f"Backed up existing database to: {backup_path}")
            return True
        except Exception as e:
            logger.error(f"Error backing up database: {str(e)}")
            return False
    return True  # No backup needed

if __name__ == "__main__":
    # Ask for confirmation
    response = input("This will reset the database and delete all data. Continue? (y/n): ")
    if response.lower() != 'y':
        logger.info("Operation cancelled.")
        sys.exit(0)
    
    # Backup the existing database
    if not backup_db():
        logger.error("Database backup failed. Aborting.")
        sys.exit(1)
    
    # Initialize the database
    if not init_db():
        logger.error("Database initialization failed.")
        sys.exit(1)
    
    logger.info("Database reset completed successfully.")
