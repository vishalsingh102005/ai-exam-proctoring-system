import jwt
import datetime
import bcrypt
from functools import wraps
from flask import request, jsonify
from backend.config import Config

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def check_password(password: str, hashed_password: str) -> bool:
    """Verify password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def generate_token(user_id: int, role: str, name: str) -> str:
    """Generate JWT Token."""
    payload = {
        'sub': user_id,
        'role': role,
        'name': name,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES)
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')

def decode_token(token: str) -> dict:
    """Decode JWT Token."""
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'Token has expired'}
    except jwt.InvalidTokenError:
        return {'error': 'Invalid token'}

def token_required(f):
    """Decorator to require a valid JWT token on endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        # Check query parameters for token (useful for socket handshakes or report viewing)
        if not token and 'token' in request.args:
            token = request.args.get('token')

        if not token:
            return jsonify({'message': 'Authorization token is missing!'}), 401

        data = decode_token(token)
        if 'error' in data:
            return jsonify({'message': data['error']}), 401

        # Pass user info to the route
        request.user = {
            'id': data['sub'],
            'role': data['role'],
            'name': data['name']
        }
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to require user to be an admin."""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if request.user['role'] != 'admin':
            return jsonify({'message': 'Admin privilege required!'}), 403
        return f(*args, **kwargs)
    return decorated
