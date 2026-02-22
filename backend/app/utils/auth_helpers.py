# backend/app/utils/auth_helpers.py
from flask import request, jsonify
import jwt
import os
from bson import ObjectId
from .. import db


def get_current_user():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None

    token = auth_header.split(' ')[1]

    try:
        payload = jwt.decode(token, os.getenv('SECRET_KEY'), algorithms=['HS256'])
        user = db.users.find_one({'_id': ObjectId(payload['sub'])})
        return user
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None