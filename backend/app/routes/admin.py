# backend/app/routes/admin.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
from bson import ObjectId
from datetime import datetime, timezone
import bcrypt
import re

admin_bp = Blueprint('admin', __name__)


def require_admin(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access only'}), 403
        return fn(user, *args, **kwargs)
    return wrapper


def _audit(user, action: str, target: str, level: str = 'info'):
    db.audit_logs.insert_one({
        'user_id':    user['_id'],
        'user_name':  user.get('username', ''),
        'action':     action,
        'target':     target,
        'level':      level,
        'created_at': datetime.now(timezone.utc),
    })


# ── Admin Profile ─────────────────────────────────────────────────────────────

@admin_bp.route('/admin/me', methods=['GET'])
@require_admin
def get_me(current_user):
    return jsonify({
        'id':       str(current_user['_id']),
        'username': current_user.get('username', ''),
        'email':    current_user.get('email', ''),
        'role':     'admin',
    })


# ── Platform Stats ────────────────────────────────────────────────────────────

@admin_bp.route('/admin/stats', methods=['GET'])
@require_admin
def get_stats(current_user):
    total_users     = db.users.count_documents({})
    total_sellers   = db.users.count_documents({'role': 'seller'})
    total_buyers    = db.users.count_documents({'role': {'$in': ['buyer', 'user']}})
    total_products  = db.products.count_documents({})
    active_products = db.products.count_documents({'is_active': True})
    total_orders    = db.orders.count_documents({})
    pending_orders  = db.orders.count_documents({'status': 'processing'})

    rev_pipeline = [
        {'$match': {'status': {'$nin': ['cancelled']}}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}},
    ]
    rev       = list(db.orders.aggregate(rev_pipeline))
    total_rev = rev[0]['total'] if rev else 0

    return jsonify({
        'totalUsers':     total_users,
        'totalSellers':   total_sellers,
        'totalBuyers':    total_buyers,
        'totalProducts':  total_products,
        'activeProducts': active_products,
        'totalOrders':    total_orders,
        'pendingOrders':  pending_orders,
        'totalRevenue':   total_rev,
    })


# ── Seller Management ─────────────────────────────────────────────────────────

@admin_bp.route('/admin/sellers', methods=['GET'])
@require_admin
def list_sellers(current_user):
    q     = request.args.get('q', '').strip()
    query = {'role': 'seller'}
    if q:
        query['$or'] = [
            {'username':   {'$regex': q, '$options': 'i'}},
            {'email':      {'$regex': q, '$options': 'i'}},
            {'store_name': {'$regex': q, '$options': 'i'}},
        ]
    sellers = list(db.users.find(query).sort('created_at', -1))
    result  = []
    for s in sellers:
        sid            = s['_id']
        total_products = db.products.count_documents({'seller_id': sid})
        rev_pipeline   = [
            {'$match': {'seller_id': sid, 'status': {'$nin': ['cancelled']}}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}},
        ]
        rev_result    = list(db.orders.aggregate(rev_pipeline))
        total_revenue = rev_result[0]['total'] if rev_result else 0
        result.append({
            'id':            str(sid),
            'username':      s.get('username', ''),
            'email':         s.get('email', ''),
            'phone':         s.get('phone', ''),
            'storeName':     s.get('store_name', s.get('username', '')),
            'status':        s.get('status', 'active'),
            'joinedAt':      s['created_at'].strftime('%b %d, %Y') if s.get('created_at') else '',
            'totalProducts': total_products,
            'totalRevenue':  total_revenue,
        })
    return jsonify(result)


@admin_bp.route('/admin/sellers', methods=['POST'])
@require_admin
def create_seller(current_user):
    """Only admins can create seller accounts."""
    data = request.get_json() or {}

    username   = (data.get('username')   or '').strip()
    email      = (data.get('email')      or '').strip().lower()
    password   =  data.get('password')   or ''
    phone      = (data.get('phone')      or '').strip()
    store_name = (data.get('store_name') or username).strip()

    if not username or len(username) < 3:
        return jsonify({'error': 'username must be at least 3 characters'}), 400
    if not email or not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
        return jsonify({'error': 'A valid email is required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if db.users.find_one({'email': email}):
        return jsonify({'error': 'An account with this email already exists'}), 409

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    seller = {
        'username':   username,
        'email':      email,
        'password':   hashed,
        'phone':      phone,
        'store_name': store_name,
        'role':       'seller',
        'status':     'active',
        'created_by': current_user['_id'],
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    }
    result = db.users.insert_one(seller)
    _audit(current_user, 'seller.create', str(result.inserted_id))
    return jsonify({'message': 'Seller account created', 'id': str(result.inserted_id)}), 201


@admin_bp.route('/admin/sellers/<seller_id>/status', methods=['PATCH'])
@require_admin
def update_seller_status(current_user, seller_id):
    try:
        sid = ObjectId(seller_id)
    except Exception:
        return jsonify({'error': 'Invalid seller ID'}), 400

    data   = request.get_json() or {}
    status = data.get('status', '')
    if status not in ('active', 'suspended'):
        return jsonify({'error': "status must be 'active' or 'suspended'"}), 400

    result = db.users.update_one(
        {'_id': sid, 'role': 'seller'},
        {'$set': {'status': status, 'updated_at': datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Seller not found'}), 404
    _audit(current_user, f'seller.{status}', seller_id, level='warn' if status == 'suspended' else 'info')
    return jsonify({'message': f'Seller {status}'})


@admin_bp.route('/admin/sellers/<seller_id>', methods=['DELETE'])
@require_admin
def delete_seller(current_user, seller_id):
    try:
        sid = ObjectId(seller_id)
    except Exception:
        return jsonify({'error': 'Invalid seller ID'}), 400

    seller = db.users.find_one({'_id': sid, 'role': 'seller'})
    if not seller:
        return jsonify({'error': 'Seller not found'}), 404

    db.products.update_many({'seller_id': sid}, {'$set': {'is_active': False}})
    db.users.delete_one({'_id': sid})
    _audit(current_user, 'seller.delete', seller_id, level='warn')
    return jsonify({'message': 'Seller deleted and their products deactivated'})


# ── Buyer Management ──────────────────────────────────────────────────────────

@admin_bp.route('/admin/buyers', methods=['GET'])
@require_admin
def list_buyers(current_user):
    q     = request.args.get('q', '').strip()
    query = {'role': {'$in': ['buyer', 'user']}}
    if q:
        query['$or'] = [
            {'username': {'$regex': q, '$options': 'i'}},
            {'email':    {'$regex': q, '$options': 'i'}},
        ]
    buyers = list(db.users.find(query).sort('created_at', -1))
    result = []
    for b in buyers:
        bid          = b['_id']
        total_orders = db.orders.count_documents({'buyer_id': bid})
        rev_pipeline = [
            {'$match': {'buyer_id': bid, 'status': {'$nin': ['cancelled']}}},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}},
        ]
        rev_result  = list(db.orders.aggregate(rev_pipeline))
        total_spent = rev_result[0]['total'] if rev_result else 0
        result.append({
            'id':          str(bid),
            'username':    b.get('username', ''),
            'email':       b.get('email', ''),
            'phone':       b.get('phone', ''),
            'status':      b.get('status', 'active'),
            'joinedAt':    b['created_at'].strftime('%b %d, %Y') if b.get('created_at') else '',
            'totalOrders': total_orders,
            'totalSpent':  total_spent,
        })
    return jsonify(result)


@admin_bp.route('/admin/buyers/<buyer_id>/status', methods=['PATCH'])
@require_admin
def update_buyer_status(current_user, buyer_id):
    try:
        bid = ObjectId(buyer_id)
    except Exception:
        return jsonify({'error': 'Invalid buyer ID'}), 400

    data   = request.get_json() or {}
    status = data.get('status', '')
    if status not in ('active', 'suspended'):
        return jsonify({'error': "status must be 'active' or 'suspended'"}), 400

    result = db.users.update_one(
        {'_id': bid, 'role': {'$in': ['buyer', 'user']}},
        {'$set': {'status': status, 'updated_at': datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Buyer not found'}), 404
    _audit(current_user, f'buyer.{status}', buyer_id, level='warn' if status == 'suspended' else 'info')
    return jsonify({'message': f'Buyer {status}'})


# ── Orders (platform-wide) ────────────────────────────────────────────────────

@admin_bp.route('/admin/orders', methods=['GET'])
@require_admin
def list_orders(current_user):
    status_filter = request.args.get('status', 'all')
    query         = {}
    if status_filter != 'all':
        query['status'] = status_filter.lower()
    orders = list(db.orders.find(query).sort('created_at', -1).limit(500))
    return jsonify([{
        'id':      str(o['_id']),
        'product': o.get('product_name', ''),
        'buyer':   o.get('buyer_name', ''),
        'seller':  o.get('seller_name', ''),
        'date':    o['created_at'].strftime('%b %d, %Y') if o.get('created_at') else '',
        'status':  o.get('status', 'processing'),
        'amount':  o.get('amount', 0),
        'emoji':   o.get('emoji', '📦'),
    } for o in orders])


# ── Products (platform-wide) ──────────────────────────────────────────────────

@admin_bp.route('/admin/products', methods=['GET'])
@require_admin
def list_products(current_user):
    q     = request.args.get('q', '').strip()
    query = {}
    if q:
        query['$or'] = [
            {'name':        {'$regex': q, '$options': 'i'}},
            {'seller_name': {'$regex': q, '$options': 'i'}},
            {'category':    {'$regex': q, '$options': 'i'}},
        ]
    products = list(db.products.find(query).sort('created_at', -1).limit(500))
    return jsonify([{
        'id':        str(p['_id']),
        'name':      p.get('name', ''),
        'seller':    p.get('seller_name', ''),
        'category':  p.get('category', ''),
        'emoji':     p.get('emoji', '🛍'),
        'price':     p.get('price', 0),
        'stock':     p.get('stock', 0),
        'isActive':  p.get('is_active', True),
        'soldCount': p.get('sold_count', 0),
        'rating':    p.get('rating', 0),
    } for p in products])


@admin_bp.route('/admin/products/<product_id>/status', methods=['PATCH'])
@require_admin
def toggle_product_status(current_user, product_id):
    try:
        pid = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product ID'}), 400

    data      = request.get_json() or {}
    is_active = bool(data.get('is_active', True))
    result    = db.products.update_one(
        {'_id': pid},
        {'$set': {'is_active': is_active, 'updated_at': datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        return jsonify({'error': 'Product not found'}), 404
    _audit(current_user, 'product.hide' if not is_active else 'product.show', product_id)
    return jsonify({'message': 'Product status updated'})


@admin_bp.route('/admin/products/<product_id>', methods=['DELETE'])
@require_admin
def delete_product(current_user, product_id):
    try:
        pid = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product ID'}), 400

    result = db.products.delete_one({'_id': pid})
    if result.deleted_count == 0:
        return jsonify({'error': 'Product not found'}), 404
    db.wishlists.delete_many({'product_id': pid})
    _audit(current_user, 'product.delete', product_id, level='warn')
    return jsonify({'message': 'Product deleted'})


# ── Audit Log ─────────────────────────────────────────────────────────────────

@admin_bp.route('/admin/audit-log', methods=['GET'])
@require_admin
def get_audit_log(current_user):
    logs = list(db.audit_logs.find({}).sort('created_at', -1).limit(200))
    return jsonify([{
        'id':     str(l['_id']),
        'user':   l.get('user_name', ''),
        'action': l.get('action', ''),
        'target': l.get('target', ''),
        'level':  l.get('level', 'info'),
        'time':   l['created_at'].strftime('%b %d, %Y %H:%M') if l.get('created_at') else '',
    } for l in logs])