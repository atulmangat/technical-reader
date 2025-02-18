from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_login import LoginManager
import os
from dotenv import load_dotenv

# Initialize extensions
db = SQLAlchemy()
login_manager = LoginManager()

# Load environment variables
load_dotenv()

# Check for required environment variables
required_env_vars = ['DEEPSEEK_API_KEY']
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}")

@login_manager.user_loader
def load_user(user_id):
    from .models import User
    return User.query.get(int(user_id))

def create_app():
    app = Flask(__name__)
    
    # Get the absolute path to the application root directory
    app_root = os.path.dirname(os.path.abspath(__file__))
    instance_path = os.path.join(os.path.dirname(app_root), 'instance')
    uploads_path = os.path.join(os.path.dirname(app_root), 'uploads')
    thumbnails_path = os.path.join(os.path.dirname(app_root), 'thumbnails')
    
    # Add route to serve thumbnails
    @app.route('/thumbnails/<path:filename>')
    def serve_thumbnail(filename):
        return send_from_directory(thumbnails_path, filename)
    
    # Update CORS settings to handle cookies properly
    CORS(app, 
         supports_credentials=True,
         resources={
             r"/*": {
                 "origins": ["http://localhost:3000"],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "allow_headers": ["Content-Type", "Authorization"],
                 "expose_headers": ["Content-Range", "X-Content-Range"],
                 "supports_credentials": True
             }
         })
    
    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['REMEMBER_COOKIE_HTTPONLY'] = True
    app.config['REMEMBER_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
    app.config['REMEMBER_COOKIE_DURATION'] = 2592000  # 30 days
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', f'sqlite:///{os.path.join(instance_path, "pdfs.db")}')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', uploads_path)
    app.config['THUMBNAILS_FOLDER'] = thumbnails_path
    
    # Ensure directories exist
    os.makedirs(instance_path, exist_ok=True)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['THUMBNAILS_FOLDER'], exist_ok=True)
    
    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    
    # Register blueprints
    from .routes import api
    from .auth import auth
    app.register_blueprint(api, url_prefix='/api')
    app.register_blueprint(auth, url_prefix='/auth')
    
    return app 