from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from . import db

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    pdfs = db.relationship('PDF', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class PDF(db.Model):
    __tablename__ = 'pdfs'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    filename = db.Column(db.String(100), nullable=False)
    file_path = db.Column(db.String(200), nullable=False)
    file_size = db.Column(db.Integer)
    thumbnail_path = db.Column(db.String(200))
    description = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.JSON)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    highlights = db.Column(db.JSON, default=list)  # Store highlights as JSON
    has_embeddings = db.Column(db.Boolean, default=False)
    processing_error = db.Column(db.String, nullable=True)

class Highlight:
    def __init__(self, text, page_number, position, color, note=""):
        self.text = text
        self.page_number = page_number
        self.position = position  # {x1, y1, x2, y2}
        self.color = color
        self.note = note
        self.timestamp = datetime.utcnow().isoformat() 