# backend/app/routes/auth.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
import bcrypt
import jwt
import re
from datetime import datetime, timedelta, timezone
import os

auth_bp = Blueprint('auth', __name__)


def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def check_password(plain: str, stored) -> bool:
    """Safely compare password regardless of whether stored hash is str or bytes."""
    if isinstance(stored, str):
        stored = stored.encode('utf-8')
    return bcrypt.checkpw(plain.encode('utf-8'), stored)


@auth_bp.route('/auth/register', methods=['POST'])
def register():
    """Public registration — creates buyer accounts only.
    Seller accounts are created exclusively by admins via POST /api/admin/sellers.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        username = (data.get('username') or '').strip()
        email    = (data.get('email')    or '').strip().lower()
        password =  data.get('password') or ''

        if not all([username, email, password]):
            return jsonify({'error': 'Username, email, and password are required'}), 400

        errors = {}
        if len(username) < 3 or len(username) > 30:
            errors['username'] = 'Username must be between 3 and 30 characters'
        if not validate_email(email):
            errors['email'] = 'Please provide a valid email address'
        if len(password) < 8:
            errors['password'] = 'Password must be at least 8 characters long'
        if errors:
            return jsonify({'error': 'Validation failed', 'details': errors}), 400

        if db.users.find_one({'email': email}):
            return jsonify({'error': 'Email already registered'}), 409

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        user = {
            'username':   username,
            'email':      email,
            'password':   hashed,
            'role':       'buyer',
            'status':     'active',
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }

        try:
            result = db.users.insert_one(user)
        except Exception as db_err:
            print(f"Database insert error: {db_err}")
            return jsonify({'error': 'Failed to create account. Please try again later.'}), 500

        return jsonify({
            'message': 'Account created successfully',
            'user': {
                'id':       str(result.inserted_id),
                'username': username,
                'email':    email,
                'role':     'buyer',
            }
        }), 201

    except Exception as e:
        print(f"Unexpected error in register: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """Universal login for buyers, sellers, and admins."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        email    = (data.get('email')    or '').strip().lower()
        password =  data.get('password') or ''

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        user = db.users.find_one({'email': email})
        if not user:
            return jsonify({'error': 'Invalid email or password'}), 401

        if not check_password(password, user['password']):
            return jsonify({'error': 'Invalid email or password'}), 401

        if user.get('status') == 'suspended' or user.get('is_suspended'):
            return jsonify({'error': 'Your account has been suspended. Contact support.'}), 403

        expires_minutes = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_MINUTES', 1440))

        payload = {
            'sub':   str(user['_id']),
            'email': user['email'],
            'role':  user.get('role', 'buyer'),
            'iat':   datetime.now(timezone.utc),
            'exp':   datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
        }
        token = jwt.encode(payload, os.getenv('SECRET_KEY'), algorithm='HS256')

        return jsonify({
            'message': 'Login successful',
            'token':   token,
            'user': {
                'id':         str(user['_id']),
                'username':   user['username'],
                'email':      user['email'],
                'role':       user.get('role', 'buyer'),
                'store_name': user.get('store_name', ''),
            }
        })

    except Exception as e:
        print(f"Unexpected error in login: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500


@auth_bp.route('/auth/me', methods=['GET'])
def me():
    """Return current user info from token."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'Authentication required'}), 401

        return jsonify({
            'id':         str(current_user['_id']),
            'username':   current_user.get('username', ''),
            'email':      current_user.get('email', ''),
            'role':       current_user.get('role', 'buyer'),
            'store_name': current_user.get('store_name', ''),
            'status':     current_user.get('status', 'active'),
        })

    except Exception as e:
        print(f"Unexpected error in me: {e}")
        return jsonify({'error': 'An unexpected error occurred'}), 500