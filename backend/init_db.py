from app import create_app, db
import os

def init_db():
    app = create_app()
    
    # Create ChromaDB directory
    os.makedirs('db/chroma', exist_ok=True)
    
    with app.app_context():
        # Drop all tables
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        print("Database initialized successfully!")

if __name__ == "__main__":
    # Remove the existing database file if it exists
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'pdfs.db')
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed existing database: {db_path}")
    
    init_db() 