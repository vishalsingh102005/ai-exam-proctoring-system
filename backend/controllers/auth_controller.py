from flask import request, jsonify
from backend.models.models import User, AuditLog
from backend.utils.security import hash_password, check_password, generate_token

def register():
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'student')  # 'student' or 'admin'

    if not name or not email or not password:
        return jsonify({'message': 'Missing fields: name, email, and password are required.'}), 400

    existing_user = User.get_by_email(email)
    if existing_user:
        return jsonify({'message': 'User with this email already exists.'}), 400

    hashed = hash_password(password)
    try:
        user_id = User.create(name, email, hashed, role)
        AuditLog.log(user_id, 'USER_REGISTERED', f"Registered as {role}")
        return jsonify({'message': 'User registered successfully!', 'user_id': user_id}), 201
    except Exception as e:
        return jsonify({'message': f'Failed to create user: {str(e)}'}), 500

def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password are required.'}), 400

    user = User.get_by_email(email)
    if not user or not check_password(password, user['password_hash']):
        return jsonify({'message': 'Invalid email or password.'}), 401

    if user['status'] != 'active':
        return jsonify({'message': 'This account has been suspended.'}), 403

    token = generate_token(user['id'], user['role'], user['name'])
    AuditLog.log(user['id'], 'USER_LOGIN', "Logged in successfully")

    return jsonify({
        'message': 'Login successful!',
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'face_registered': bool(user['face_registered'])
        }
    }), 200

def otp_login():
    data = request.get_json() or {}
    email = data.get('email')
    otp = data.get('otp')
    
    if not email:
        return jsonify({'message': 'Email is required.'}), 400

    user = User.get_by_email(email)
    if not user:
        return jsonify({'message': 'User not found.'}), 404

    # Simulation: accept '123456' as OTP for development/testing
    if otp != '123456':
        return jsonify({'message': 'Invalid OTP code. Use 123456 for testing.'}), 400

    token = generate_token(user['id'], user['role'], user['name'])
    AuditLog.log(user['id'], 'USER_LOGIN_OTP', "Logged in via OTP")

    return jsonify({
        'message': 'OTP Login successful!',
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'face_registered': bool(user['face_registered'])
        }
    }), 200

def forgot_password():
    data = request.get_json() or {}
    email = data.get('email')
    
    if not email:
        return jsonify({'message': 'Email is required.'}), 400

    user = User.get_by_email(email)
    if not user:
        return jsonify({'message': 'User not found.'}), 404

    # Simulated email sending
    AuditLog.log(user['id'], 'PASSWORD_RESET_REQUESTED', "Password reset OTP simulated")
    return jsonify({
        'message': 'A password reset OTP has been sent to your email. (Use 123456 to verify)',
        'success': True
    }), 200

def get_profile():
    # request.user is injected by @token_required decorator
    user_id = request.user['id']
    user = User.get_by_id(user_id)
    if not user:
        return jsonify({'message': 'User not found.'}), 404

    return jsonify({
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user['role'],
            'face_registered': bool(user['face_registered']),
            'created_at': user['created_at']
        }
    }), 200
