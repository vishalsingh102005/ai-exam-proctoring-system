import os
from pathlib import Path

# Base Directory
BASE_DIR = Path(__file__).resolve().parent

class Config:
    # Secret keys
    SECRET_KEY = os.environ.get('SECRET_KEY', 'super-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-super-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours

    # Database Configuration
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', 'rootpassword')
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = os.environ.get('DB_PORT', '3306')
    DB_NAME = os.environ.get('DB_NAME', 'proctoring_system')

    # Uploads Directories
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    FACES_FOLDER = os.path.join(UPLOAD_FOLDER, 'faces')
    SCREENSHOTS_FOLDER = os.path.join(UPLOAD_FOLDER, 'screenshots')
    RECORDINGS_FOLDER = os.path.join(UPLOAD_FOLDER, 'recordings')

    # Allowed extensions
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webm'}

    # SQLite Fallback Configuration (if MySQL is unavailable)
    SQLITE_DB_PATH = os.path.join(BASE_DIR, 'database', 'proctoring.db')

    @classmethod
    def init_app(cls):
        # Create directories if they do not exist
        os.makedirs(cls.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(cls.FACES_FOLDER, exist_ok=True)
        os.makedirs(cls.SCREENSHOTS_FOLDER, exist_ok=True)
        os.makedirs(cls.RECORDINGS_FOLDER, exist_ok=True)
        os.makedirs(os.path.join(cls.BASE_DIR, 'database'), exist_ok=True)
