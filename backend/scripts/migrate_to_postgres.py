#!/usr/bin/env python3
"""
Migration script to transfer data from SQLite to PostgreSQL.
Usage:
    python migrate_to_postgres.py

Environment variables:
    SQLITE_URL: SQLite database URL (default: sqlite:///./app.db)
    POSTGRES_URL: PostgreSQL database URL (required)
"""

import os
import sys
from sqlalchemy import create_engine, MetaData, Table, select, inspect
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URLs
SQLITE_URL = os.getenv("SQLITE_URL", "sqlite:///./app.db")
POSTGRES_URL = os.getenv("POSTGRES_URL")

if not POSTGRES_URL:
    print("Error: POSTGRES_URL environment variable is required.")
    print("Example: postgresql://username:password@localhost:5432/dbname")
    sys.exit(1)

# Create engines for both databases
sqlite_engine = create_engine(SQLITE_URL)
postgres_engine = create_engine(POSTGRES_URL)

# Create sessions
SQLiteSession = sessionmaker(bind=sqlite_engine)
PostgresSession = sessionmaker(bind=postgres_engine)

# Get metadata from SQLite
sqlite_metadata = MetaData()
sqlite_metadata.reflect(bind=sqlite_engine)

# Create tables in PostgreSQL if they don't exist
# This assumes your models are properly defined and imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.models.base import Base

def migrate_data():
    print("Creating tables in PostgreSQL...")
    Base.metadata.create_all(postgres_engine)
    
    # Get all tables from SQLite
    inspector = inspect(sqlite_engine)
    table_names = inspector.get_table_names()
    
    sqlite_session = SQLiteSession()
    postgres_session = PostgresSession()
    
    try:
        # Migrate data for each table
        for table_name in table_names:
            print(f"Migrating table: {table_name}")
            
            # Get table objects
            sqlite_table = Table(table_name, sqlite_metadata, autoload_with=sqlite_engine)
            postgres_metadata = MetaData()
            postgres_table = Table(table_name, postgres_metadata, autoload_with=postgres_engine)
            
            # Get all data from SQLite
            query = select(sqlite_table)
            rows = sqlite_engine.execute(query).fetchall()
            
            # Insert data into PostgreSQL
            if rows:
                print(f"  - Inserting {len(rows)} rows")
                for row in rows:
                    # Convert row to dict
                    row_dict = {column.name: value for column, value in zip(sqlite_table.columns, row)}
                    postgres_engine.execute(postgres_table.insert().values(**row_dict))
            else:
                print(f"  - No data to migrate")
        
        postgres_session.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        postgres_session.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        sqlite_session.close()
        postgres_session.close()

if __name__ == "__main__":
    print(f"Migrating from {SQLITE_URL} to {POSTGRES_URL}")
    
    # Confirm before proceeding
    confirm = input("This will create tables in PostgreSQL and migrate data. Continue? (y/n): ")
    if confirm.lower() != 'y':
        print("Migration cancelled.")
        sys.exit(0)
    
    migrate_data() 