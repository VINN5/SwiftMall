# backend/app/routes/buyer.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
from bson import ObjectId
from datetime import datetime, timezone
import bcrypt

buyer_bp = Blueprint('buyer', __name__)


def require_buyer(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if user.get('role') not in ('buyer', 'user'):
            return jsonify({'error': 'Buyer access only'}), 403
        return fn(user, *args, **kwargs)
    return wrapper


def check_password(plain: str, stored) -> bool:
    if isinstance(stored, str):
        stored = stored.encode('utf-8')
    return bcrypt.checkpw(plain.encode('utf-8'), stored)


# ── Profile ───────────────────────────────────────────────────────────────────

@buyer_bp.route('/buyer/me', methods=['GET'])
@require_buyer
def get_me(current_user):
    return jsonify({
        'id':         str(current_user['_id']),
        'username':   current_user.get('username', ''),
        'email':      current_user.get('email', ''),
        'phone':      current_user.get('phone', ''),
        'role':       current_user.get('role', 'buyer'),
        'created_at': current_user['created_at'].isoformat() if current_user.get('created_at') else '',
    })


@buyer_bp.route('/buyer/profile', methods=['PATCH'])
@require_buyer
def update_profile(current_user):
    data    = request.get_json() or {}
    updates = {}
    if 'username' in data:
        username = data['username'].strip()
        if len(username) < 3 or len(username) > 30:
            return jsonify({'error': 'Username must be between 3 and 30 characters'}), 400
        updates['username'] = username
    if 'phone' in data:
        updates['phone'] = data['phone'].strip()
    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400
    updates['updated_at'] = datetime.now(timezone.utc)
    db.users.update_one({'_id': current_user['_id']}, {'$set': updates})
    return jsonify({'message': 'Profile updated successfully'})


@buyer_bp.route('/buyer/password', methods=['PATCH'])
@require_buyer
def change_password(current_user):
    data             = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password     = data.get('new_password', '')
    if not current_password or not new_password:
        return jsonify({'error': 'current_password and new_password are required'}), 400
    if not check_password(current_password, current_user['password']):
        return jsonify({'error': 'Current password is incorrect'}), 401
    if len(new_password) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'password': hashed, 'updated_at': datetime.now(timezone.utc)}}
    )
    return jsonify({'message': 'Password changed successfully'})


# ── Stats ─────────────────────────────────────────────────────────────────────

@buyer_bp.route('/buyer/stats', methods=['GET'])
@require_buyer
def get_stats(current_user):
    uid          = current_user['_id']
    total_orders = db.orders.count_documents({'buyer_id': uid})

    # FIX 3: Only sum orders where payment has been confirmed (payment_status = 'paid')
    pipeline = [
        {'$match': {
            'buyer_id':       uid,
            'payment_status': 'paid',
            'status':         {'$ne': 'cancelled'},
        }},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}},
    ]
    result      = list(db.orders.aggregate(pipeline))
    total_spent = result[0]['total'] if result else 0

    return jsonify({
        'totalOrders':   total_orders,
        'totalSpent':    total_spent,
        'wishlistCount': db.wishlists.count_documents({'buyer_id': uid}),
        'reviewsGiven':  db.reviews.count_documents({'buyer_id': uid}),
    })


# ── Orders ────────────────────────────────────────────────────────────────────

@buyer_bp.route('/buyer/orders', methods=['GET'])
@require_buyer
def get_orders(current_user):
    status_filter = request.args.get('status', 'all')
    query         = {'buyer_id': current_user['_id']}
    if status_filter != 'all':
        query['status'] = status_filter.lower()
    orders = list(db.orders.find(query).sort('created_at', -1))
    return jsonify([{
        'id':      str(o['_id']),
        'product': o.get('product_name', ''),
        'seller':  o.get('seller_name', ''),
        'date':    o['created_at'].strftime('%b %d, %Y') if o.get('created_at') else '',
        'status':  o.get('status', 'processing'),
        'amount':  o.get('amount', 0),
        'emoji':   o.get('emoji', '📦'),
    } for o in orders])


# ── Wishlist ──────────────────────────────────────────────────────────────────

@buyer_bp.route('/buyer/wishlist', methods=['GET'])
@require_buyer
def get_wishlist(current_user):
    items = list(db.wishlists.find({'buyer_id': current_user['_id']}))
    return jsonify([{
        'id':            str(i['_id']),
        'name':          i.get('product_name', ''),
        'price':         i.get('price', 0),
        'originalPrice': i.get('original_price', i.get('price', 0)),
        'emoji':         i.get('emoji', '🛍'),
        'inStock':       i.get('in_stock', True),
    } for i in items])


@buyer_bp.route('/buyer/wishlist', methods=['POST'])
@require_buyer
def add_to_wishlist(current_user):
    data       = request.get_json() or {}
    product_id = data.get('product_id')
    if not product_id:
        return jsonify({'error': 'product_id is required'}), 400
    try:
        pid = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product_id'}), 400
    product = db.products.find_one({'_id': pid, 'is_active': True})
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    if db.wishlists.find_one({'buyer_id': current_user['_id'], 'product_id': pid}):
        return jsonify({'error': 'Product already in wishlist'}), 409
    db.wishlists.insert_one({
        'buyer_id':       current_user['_id'],
        'product_id':     pid,
        'product_name':   product.get('name', ''),
        'price':          product.get('price', 0),
        'original_price': product.get('original_price', product.get('price', 0)),
        'emoji':          product.get('emoji', '🛍'),
        'in_stock':       product.get('stock', 0) > 0,
        'added_at':       datetime.now(timezone.utc),
    })
    return jsonify({'message': 'Added to wishlist'}), 201


@buyer_bp.route('/buyer/wishlist/<item_id>', methods=['DELETE'])
@require_buyer
def remove_wishlist_item(current_user, item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({'error': 'Invalid item ID'}), 400
    result = db.wishlists.delete_one({'_id': oid, 'buyer_id': current_user['_id']})
    if result.deleted_count == 0:
        return jsonify({'error': 'Item not found'}), 404
    return jsonify({'message': 'Item removed from wishlist'})


# ── Notifications ─────────────────────────────────────────────────────────────

@buyer_bp.route('/buyer/notifications', methods=['GET'])
@require_buyer
def get_notifications(current_user):
    notifs = list(
        db.notifications.find({'user_id': current_user['_id']})
        .sort('created_at', -1).limit(50)
    )
    return jsonify([{
        'id':      str(n['_id']),
        'message': n.get('message', ''),
        'time':    _time_ago(n.get('created_at')),
        'read':    n.get('read', False),
        'type':    n.get('type', 'system'),
    } for n in notifs])


@buyer_bp.route('/buyer/notifications/read-all', methods=['PATCH'])
@require_buyer
def mark_notifications_read(current_user):
    db.notifications.update_many(
        {'user_id': current_user['_id'], 'read': False},
        {'$set': {'read': True}}
    )
    return jsonify({'message': 'All notifications marked as read'})


# ── Helper ────────────────────────────────────────────────────────────────────

def _time_ago(dt) -> str:
    if not dt:
        return ''
    now  = datetime.now(timezone.utc)
    diff = now - (dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt)
    s    = int(diff.total_seconds())
    if s < 60:     return 'just now'
    if s < 3600:   return f'{s // 60}m ago'
    if s < 86400:  return f'{s // 3600}h ago'
    if s < 604800: return f'{s // 86400}d ago'
    return dt.strftime('%b %d, %Y')
