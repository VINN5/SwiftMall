# backend/app/routes/seller.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import bcrypt
import base64

seller_bp = Blueprint('seller', __name__)

# Max image size: 2 MB base64 (~1.5 MB raw)
MAX_IMAGE_BYTES = 2 * 1024 * 1024

ALLOWED_MIME = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}


def require_seller(fn):
    from functools import wraps
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        if user.get('role') != 'seller':
            return jsonify({'error': 'Seller access only'}), 403
        if user.get('status') == 'suspended':
            return jsonify({'error': 'Your seller account has been suspended'}), 403
        return fn(user, *args, **kwargs)
    return wrapper


def check_password(plain: str, stored) -> bool:
    if isinstance(stored, str):
        stored = stored.encode('utf-8')
    return bcrypt.checkpw(plain.encode('utf-8'), stored)


def _validate_image(data_url: str):
    """
    Validate a base64 data URL.
    Returns (clean_data_url, error_message).
    """
    if not data_url.startswith('data:'):
        return None, 'Image must be a base64 data URL'
    try:
        header, b64 = data_url.split(',', 1)
        mime = header.split(';')[0].replace('data:', '')
        if mime not in ALLOWED_MIME:
            return None, f'Image type {mime} not allowed. Use JPEG, PNG, or WebP.'
        raw = base64.b64decode(b64)
        if len(raw) > MAX_IMAGE_BYTES:
            return None, 'Image must be under 2 MB'
        return data_url, None
    except Exception:
        return None, 'Invalid image data'


# ── Profile ───────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/me', methods=['GET'])
@require_seller
def get_me(current_user):
    return jsonify({
        'id':         str(current_user['_id']),
        'username':   current_user.get('username', ''),
        'email':      current_user.get('email', ''),
        'phone':      current_user.get('phone', ''),
        'store_name': current_user.get('store_name', current_user.get('username', '')),
        'role':       current_user.get('role', 'seller'),
        'status':     current_user.get('status', 'active'),
        'created_at': current_user['created_at'].isoformat() if current_user.get('created_at') else '',
    })


@seller_bp.route('/seller/profile', methods=['PATCH'])
@require_seller
def update_profile(current_user):
    data    = request.get_json() or {}
    updates = {}
    if 'username' in data:
        username = data['username'].strip()
        if len(username) < 3 or len(username) > 30:
            return jsonify({'error': 'Username must be 3–30 characters'}), 400
        updates['username'] = username
    if 'store_name' in data:
        updates['store_name'] = data['store_name'].strip()[:80]
    if 'phone' in data:
        updates['phone'] = data['phone'].strip()
    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400
    updates['updated_at'] = datetime.now(timezone.utc)
    db.users.update_one({'_id': current_user['_id']}, {'$set': updates})
    return jsonify({'message': 'Profile updated'})


@seller_bp.route('/seller/password', methods=['PATCH'])
@require_seller
def change_password(current_user):
    data = request.get_json() or {}
    cur  = data.get('current_password', '')
    new_ = data.get('new_password', '')
    if not cur or not new_:
        return jsonify({'error': 'current_password and new_password required'}), 400
    if not check_password(cur, current_user['password']):
        return jsonify({'error': 'Current password is incorrect'}), 401
    if len(new_) < 8:
        return jsonify({'error': 'New password must be at least 8 characters'}), 400
    hashed = bcrypt.hashpw(new_.encode('utf-8'), bcrypt.gensalt())
    db.users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'password': hashed, 'updated_at': datetime.now(timezone.utc)}}
    )
    return jsonify({'message': 'Password changed'})


# ── Stats ─────────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/stats', methods=['GET'])
@require_seller
def get_stats(current_user):
    sid            = current_user['_id']
    total_products = db.products.count_documents({'seller_id': sid, 'is_active': True})
    total_orders   = db.orders.count_documents({'seller_id': sid})
    pending_orders = db.orders.count_documents({'seller_id': sid, 'status': 'processing'})

    rev_pipeline = [
        {'$match': {'seller_id': sid, 'status': {'$nin': ['cancelled']}}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}},
    ]
    rev_result    = list(db.orders.aggregate(rev_pipeline))
    total_revenue = rev_result[0]['total'] if rev_result else 0

    rating_pipeline = [
        {'$match': {'seller_id': sid}},
        {'$group': {'_id': None, 'avg': {'$avg': '$rating'}, 'count': {'$sum': 1}}},
    ]
    rating_result = list(db.reviews.aggregate(rating_pipeline))
    avg_rating    = round(rating_result[0]['avg'], 1) if rating_result else 0.0
    total_reviews = rating_result[0]['count']          if rating_result else 0

    return jsonify({
        'totalProducts': total_products,
        'totalOrders':   total_orders,
        'totalRevenue':  total_revenue,
        'pendingOrders': pending_orders,
        'avgRating':     avg_rating,
        'totalReviews':  total_reviews,
    })


# ── Products ──────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/products', methods=['GET'])
@require_seller
def get_products(current_user):
    products = list(db.products.find({'seller_id': current_user['_id']}).sort('created_at', -1))
    return jsonify([_format_product(p) for p in products])


@seller_bp.route('/seller/products', methods=['POST'])
@require_seller
def create_product(current_user):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    price = data.get('price')
    if price is None or float(price) <= 0:
        return jsonify({'error': 'price must be positive'}), 400

    # Handle image
    image_data = None
    if data.get('image'):
        image_data, err = _validate_image(data['image'])
        if err:
            return jsonify({'error': err}), 400

    product = {
        'seller_id':      current_user['_id'],
        'seller_name':    current_user.get('store_name', current_user.get('username', '')),
        'name':           name,
        'description':    (data.get('description') or '').strip(),
        'price':          float(price),
        'original_price': float(data.get('original_price') or price),
        'category':       (data.get('category') or 'General').strip(),
        'emoji':          (data.get('emoji') or '🛍')[:4],
        'image':          image_data,   # base64 data URL or None
        'stock':          max(0, int(data.get('stock') or 0)),
        'is_active':      True,
        'sold_count':     0,
        'rating':         0.0,
        'created_at':     datetime.now(timezone.utc),
        'updated_at':     datetime.now(timezone.utc),
    }
    result = db.products.insert_one(product)
    _audit(current_user, 'product.create', str(result.inserted_id))
    return jsonify({'message': 'Product created', 'id': str(result.inserted_id)}), 201


@seller_bp.route('/seller/products/<product_id>', methods=['PATCH'])
@require_seller
def update_product(current_user, product_id):
    try:
        pid = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product ID'}), 400

    product = db.products.find_one({'_id': pid, 'seller_id': current_user['_id']})
    if not product:
        return jsonify({'error': 'Product not found'}), 404

    data    = request.get_json() or {}
    updates = {}
    for field in ('name', 'description', 'category', 'emoji'):
        if field in data:
            updates[field] = str(data[field]).strip()
    for field in ('price', 'original_price'):
        if field in data:
            updates[field] = float(data[field])
    if 'stock' in data:
        updates['stock'] = max(0, int(data['stock']))
    if 'is_active' in data:
        updates['is_active'] = bool(data['is_active'])

    # Handle image update
    if 'image' in data:
        if data['image']:
            img, err = _validate_image(data['image'])
            if err:
                return jsonify({'error': err}), 400
            updates['image'] = img
        else:
            # Seller explicitly cleared the image
            updates['image'] = None

    if not updates:
        return jsonify({'error': 'No valid fields'}), 400
    updates['updated_at'] = datetime.now(timezone.utc)
    db.products.update_one({'_id': pid}, {'$set': updates})
    _audit(current_user, 'product.update', product_id)
    return jsonify({'message': 'Product updated'})


@seller_bp.route('/seller/products/<product_id>', methods=['DELETE'])
@require_seller
def delete_product(current_user, product_id):
    try:
        pid = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product ID'}), 400
    result = db.products.delete_one({'_id': pid, 'seller_id': current_user['_id']})
    if result.deleted_count == 0:
        return jsonify({'error': 'Product not found'}), 404
    db.wishlists.delete_many({'product_id': pid})
    _audit(current_user, 'product.delete', product_id)
    return jsonify({'message': 'Product deleted'})


# ── Orders ────────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/orders', methods=['GET'])
@require_seller
def get_orders(current_user):
    status_filter = request.args.get('status', 'all')
    query         = {'seller_id': current_user['_id']}
    if status_filter != 'all':
        query['status'] = status_filter.lower()
    orders = list(db.orders.find(query).sort('created_at', -1))
    return jsonify([{
        'id':      str(o['_id']),
        'product': o.get('product_name', ''),
        'buyer':   o.get('buyer_name', ''),
        'date':    o['created_at'].strftime('%b %d, %Y') if o.get('created_at') else '',
        'status':  o.get('status', 'processing'),
        'amount':  o.get('amount', 0),
        'emoji':   o.get('emoji', '📦'),
        'qty':     o.get('quantity', 1),
    } for o in orders])


@seller_bp.route('/seller/orders/<order_id>/status', methods=['PATCH'])
@require_seller
def update_order_status(current_user, order_id):
    try:
        oid = ObjectId(order_id)
    except Exception:
        return jsonify({'error': 'Invalid order ID'}), 400

    data   = request.get_json() or {}
    status = data.get('status', '')
    valid  = ('processing', 'shipped', 'delivered', 'cancelled')
    if status not in valid:
        return jsonify({'error': f'status must be one of {valid}'}), 400

    order = db.orders.find_one({'_id': oid, 'seller_id': current_user['_id']})
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    if order.get('status') in ('delivered', 'cancelled'):
        return jsonify({'error': 'Cannot modify a completed/cancelled order'}), 400

    db.orders.update_one(
        {'_id': oid},
        {'$set': {'status': status, 'updated_at': datetime.now(timezone.utc)}}
    )
    db.notifications.insert_one({
        'user_id':    order.get('buyer_id'),
        'message':    f'Your order for "{order.get("product_name", "an item")}" is now {status}.',
        'type':       'order',
        'read':       False,
        'created_at': datetime.now(timezone.utc),
    })
    _audit(current_user, f'order.status.{status}', order_id)
    return jsonify({'message': 'Order status updated'})


# ── Reviews ───────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/reviews', methods=['GET'])
@require_seller
def get_reviews(current_user):
    reviews = list(db.reviews.find({'seller_id': current_user['_id']}).sort('created_at', -1))
    return jsonify([{
        'id':      str(r['_id']),
        'product': r.get('product_name', ''),
        'buyer':   r.get('buyer_name', ''),
        'rating':  r.get('rating', 0),
        'comment': r.get('comment', ''),
        'date':    r['created_at'].strftime('%b %d, %Y') if r.get('created_at') else '',
    } for r in reviews])


# ── Payouts ───────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/payouts', methods=['GET'])
@require_seller
def get_payouts(current_user):
    payouts = list(db.payouts.find({'seller_id': current_user['_id']}).sort('created_at', -1))
    return jsonify([{
        'id':     str(p['_id']),
        'amount': p.get('amount', 0),
        'status': p.get('status', 'pending'),
        'date':   p['created_at'].strftime('%b %d, %Y') if p.get('created_at') else '',
        'method': p.get('method', 'M-Pesa'),
    } for p in payouts])


# ── Analytics ─────────────────────────────────────────────────────────────────

@seller_bp.route('/seller/analytics', methods=['GET'])
@require_seller
def get_analytics(current_user):
    period     = request.args.get('period', '7d')
    period_map = {'7d': 7, '30d': 30, '90d': 90, '365d': 365}
    days       = period_map.get(period, 7)
    sid        = current_user['_id']
    now        = datetime.now(timezone.utc)
    labels, revenues, order_counts = [], [], []

    for i in range(days - 1, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        pipeline  = [
            {'$match': {
                'seller_id':  sid,
                'status':     {'$nin': ['cancelled']},
                'created_at': {'$gte': day_start, '$lt': day_end},
            }},
            {'$group': {'_id': None, 'total': {'$sum': '$amount'}, 'count': {'$sum': 1}}},
        ]
        result = list(db.orders.aggregate(pipeline))
        revenues.append(result[0]['total'] if result else 0)
        order_counts.append(result[0]['count'] if result else 0)
        labels.append(day_start.strftime('%b %d'))

    return jsonify({'labels': labels, 'revenue': revenues, 'orders': order_counts})


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_product(p: dict) -> dict:
    return {
        'id':            str(p['_id']),
        'name':          p.get('name', ''),
        'description':   p.get('description', ''),
        'price':         p.get('price', 0),
        'originalPrice': p.get('original_price', p.get('price', 0)),
        'category':      p.get('category', ''),
        'emoji':         p.get('emoji', '🛍'),
        'image':         p.get('image'),        # base64 data URL or None
        'stock':         p.get('stock', 0),
        'isActive':      p.get('is_active', True),
        'soldCount':     p.get('sold_count', 0),
        'rating':        p.get('rating', 0),
        'createdAt':     p['created_at'].strftime('%b %d, %Y') if p.get('created_at') else '',
    }


def _audit(user, action: str, target: str, level: str = 'info'):
    db.audit_logs.insert_one({
        'user_id':    user['_id'],
        'user_name':  user.get('username', ''),
        'action':     action,
        'target':     target,
        'level':      level,
        'created_at': datetime.now(timezone.utc),
    })