# backend/app/routes/cart.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
from bson import ObjectId
from datetime import datetime, timezone

cart_bp = Blueprint('cart', __name__)


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


# ── Cart ──────────────────────────────────────────────────────────────────────

@cart_bp.route('/buyer/cart', methods=['GET'])
@require_buyer
def get_cart(current_user):
    items = list(db.cart.find({'buyer_id': current_user['_id']}))
    result = []
    for item in items:
        # Refresh live price and stock from product
        product = db.products.find_one({'_id': item['product_id']})
        if not product:
            # Product was deleted — remove from cart silently
            db.cart.delete_one({'_id': item['_id']})
            continue
        result.append({
            'id':          str(item['_id']),
            'productId':   str(product['_id']),
            'name':        product.get('name', ''),
            'emoji':       product.get('emoji', '🛍'),
            'price':       product.get('price', 0),
            'originalPrice': product.get('original_price', product.get('price', 0)),
            'sellerName':  product.get('seller_name', ''),
            'sellerId':    str(product.get('seller_id', '')),
            'stock':       product.get('stock', 0),
            'quantity':    item.get('quantity', 1),
            'inStock':     product.get('stock', 0) > 0,
        })
    return jsonify(result)


@cart_bp.route('/buyer/cart', methods=['POST'])
@require_buyer
def add_to_cart(current_user):
    data       = request.get_json() or {}
    product_id = data.get('product_id')
    quantity   = int(data.get('quantity', 1))

    if not product_id:
        return jsonify({'error': 'product_id is required'}), 400
    if quantity < 1:
        return jsonify({'error': 'quantity must be at least 1'}), 400

    try:
        pid = ObjectId(product_id)
    except Exception:
        return jsonify({'error': 'Invalid product_id'}), 400

    product = db.products.find_one({'_id': pid, 'is_active': True})
    if not product:
        return jsonify({'error': 'Product not found or unavailable'}), 404
    if product.get('stock', 0) < quantity:
        return jsonify({'error': f'Only {product.get("stock", 0)} items in stock'}), 400

    # Buyers cannot buy from themselves if they are also sellers
    existing = db.cart.find_one({'buyer_id': current_user['_id'], 'product_id': pid})
    if existing:
        new_qty = existing['quantity'] + quantity
        if new_qty > product.get('stock', 0):
            return jsonify({'error': f'Cannot exceed stock limit of {product.get("stock", 0)}'}), 400
        db.cart.update_one(
            {'_id': existing['_id']},
            {'$set': {'quantity': new_qty, 'updated_at': datetime.now(timezone.utc)}}
        )
        return jsonify({'message': 'Cart updated', 'id': str(existing['_id'])})

    result = db.cart.insert_one({
        'buyer_id':   current_user['_id'],
        'product_id': pid,
        'quantity':   quantity,
        'added_at':   datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
    })
    return jsonify({'message': 'Added to cart', 'id': str(result.inserted_id)}), 201


@cart_bp.route('/buyer/cart/<item_id>', methods=['PATCH'])
@require_buyer
def update_cart_item(current_user, item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({'error': 'Invalid item ID'}), 400

    data     = request.get_json() or {}
    quantity = int(data.get('quantity', 1))
    if quantity < 1:
        return jsonify({'error': 'quantity must be at least 1'}), 400

    item = db.cart.find_one({'_id': oid, 'buyer_id': current_user['_id']})
    if not item:
        return jsonify({'error': 'Cart item not found'}), 404

    product = db.products.find_one({'_id': item['product_id']})
    if not product:
        return jsonify({'error': 'Product no longer available'}), 404
    if quantity > product.get('stock', 0):
        return jsonify({'error': f'Only {product.get("stock", 0)} items in stock'}), 400

    db.cart.update_one(
        {'_id': oid},
        {'$set': {'quantity': quantity, 'updated_at': datetime.now(timezone.utc)}}
    )
    return jsonify({'message': 'Cart item updated'})


@cart_bp.route('/buyer/cart/<item_id>', methods=['DELETE'])
@require_buyer
def remove_cart_item(current_user, item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({'error': 'Invalid item ID'}), 400

    result = db.cart.delete_one({'_id': oid, 'buyer_id': current_user['_id']})
    if result.deleted_count == 0:
        return jsonify({'error': 'Cart item not found'}), 404
    return jsonify({'message': 'Item removed from cart'})


@cart_bp.route('/buyer/cart/clear', methods=['DELETE'])
@require_buyer
def clear_cart(current_user):
    db.cart.delete_many({'buyer_id': current_user['_id']})
    return jsonify({'message': 'Cart cleared'})


# ── Order Placement ───────────────────────────────────────────────────────────

@cart_bp.route('/buyer/orders', methods=['POST'])
@require_buyer
def place_order(current_user):
    """
    Place orders for all items currently in the buyer's cart.
    Each cart item becomes a separate order document (one per product/seller).
    This allows sellers to manage their orders independently.
    """
    data             = request.get_json() or {}
    delivery_address = (data.get('delivery_address') or '').strip()
    phone            = (data.get('phone') or '').strip()

    if not delivery_address:
        return jsonify({'error': 'delivery_address is required'}), 400
    if not phone:
        return jsonify({'error': 'phone is required'}), 400

    cart_items = list(db.cart.find({'buyer_id': current_user['_id']}))
    if not cart_items:
        return jsonify({'error': 'Your cart is empty'}), 400

    created_orders = []
    errors         = []

    for item in cart_items:
        product = db.products.find_one({'_id': item['product_id'], 'is_active': True})

        # Validate product still exists and has enough stock
        if not product:
            errors.append(f'A product in your cart is no longer available.')
            continue
        qty = item.get('quantity', 1)
        if product.get('stock', 0) < qty:
            errors.append(
                f'"{product.get("name", "Item")}" only has {product.get("stock", 0)} left in stock.'
            )
            continue

        amount = product['price'] * qty

        # Create the order — stamped with both buyer and seller
        order = {
            'buyer_id':        current_user['_id'],
            'buyer_name':      current_user.get('username', ''),
            'seller_id':       product['seller_id'],
            'seller_name':     product.get('seller_name', ''),
            'product_id':      product['_id'],
            'product_name':    product.get('name', ''),
            'emoji':           product.get('emoji', '📦'),
            'quantity':        qty,
            'amount':          amount,
            'unit_price':      product['price'],
            'delivery_address': delivery_address,
            'phone':           phone,
            'status':          'processing',
            'created_at':      datetime.now(timezone.utc),
            'updated_at':      datetime.now(timezone.utc),
        }
        result = db.orders.insert_one(order)
        created_orders.append(str(result.inserted_id))

        # Decrement stock
        db.products.update_one(
            {'_id': product['_id']},
            {
                '$inc': {'stock': -qty, 'sold_count': qty},
                '$set': {'updated_at': datetime.now(timezone.utc)},
            }
        )

        # Notify the seller
        db.notifications.insert_one({
            'user_id':    product['seller_id'],
            'message':    f'New order for "{product.get("name", "your product")}" from {current_user.get("username", "a buyer")}.',
            'type':       'order',
            'read':       False,
            'created_at': datetime.now(timezone.utc),
        })

    if not created_orders:
        return jsonify({'error': 'No orders could be placed.', 'details': errors}), 400

    # Clear only the successfully ordered items from the cart
    successful_product_ids = []
    for item in cart_items:
        product = db.products.find_one({'_id': item['product_id']})
        if product:
            successful_product_ids.append(item['product_id'])

    db.cart.delete_many({
        'buyer_id':   current_user['_id'],
        'product_id': {'$in': successful_product_ids},
    })

    response = {
        'message':      f'{len(created_orders)} order(s) placed successfully!',
        'order_ids':    created_orders,
    }
    if errors:
        response['warnings'] = errors

    return jsonify(response), 201