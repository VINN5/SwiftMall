# backend/app/routes/search.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
import re

search_bp = Blueprint('search', __name__)


@search_bp.route('/search/products', methods=['GET'])
def search_products():
    q        = (request.args.get('q') or '').strip()
    category = (request.args.get('category') or '').strip()
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    sort_by   = request.args.get('sort', 'relevance')   # relevance | price_asc | price_desc | newest
    page      = max(1, request.args.get('page', 1, type=int))
    per_page  = min(40, request.args.get('per_page', 20, type=int))

    if not q and not category:
        return jsonify({'error': 'Provide a search query or category'}), 400

    # ── Build filter ──────────────────────────────────────────────────────────
    query: dict = {'is_active': True}

    if q:
        escaped = re.escape(q)
        query['$or'] = [
            {'name':        {'$regex': escaped, '$options': 'i'}},
            {'description': {'$regex': escaped, '$options': 'i'}},
            {'tags':        {'$regex': escaped, '$options': 'i'}},
            {'seller_name': {'$regex': escaped, '$options': 'i'}},
        ]

    if category:
        query['category'] = {'$regex': re.escape(category), '$options': 'i'}

    if min_price is not None:
        query.setdefault('price', {})['$gte'] = min_price
    if max_price is not None:
        query.setdefault('price', {})['$lte'] = max_price

    # ── Sort ─────────────────────────────────────────────────────────────────
    sort_map = {
        'price_asc':  [('price',      1)],
        'price_desc': [('price',     -1)],
        'newest':     [('created_at',-1)],
        'relevance':  [('sold_count',-1)],   # fallback: bestsellers first
    }
    sort = sort_map.get(sort_by, sort_map['relevance'])

    # ── Paginate ─────────────────────────────────────────────────────────────
    total   = db.products.count_documents(query)
    skip    = (page - 1) * per_page
    products = list(db.products.find(query).sort(sort).skip(skip).limit(per_page))

    return jsonify({
        'query':    q,
        'total':    total,
        'page':     page,
        'per_page': per_page,
        'pages':    max(1, -(-total // per_page)),   # ceiling division
        'results':  [_fmt(p) for p in products],
    })


@search_bp.route('/search/suggestions', methods=['GET'])
def search_suggestions():
    """Returns up to 8 quick-search name suggestions as the user types."""
    q = (request.args.get('q') or '').strip()
    if len(q) < 2:
        return jsonify([])

    products = list(
        db.products.find(
            {'name': {'$regex': re.escape(q), '$options': 'i'}, 'is_active': True},
            {'name': 1, 'category': 1, 'price': 1}
        ).limit(8)
    )
    return jsonify([{'name': p['name'], 'category': p.get('category', ''), 'price': p.get('price', 0)} for p in products])


@search_bp.route('/search/categories', methods=['GET'])
def list_categories():
    """Returns all distinct product categories for the filter dropdown."""
    categories = db.products.distinct('category', {'is_active': True})
    return jsonify(sorted([c for c in categories if c]))


def _fmt(p: dict) -> dict:
    return {
        'id':            str(p['_id']),
        'name':          p.get('name', ''),
        'description':   p.get('description', ''),
        'price':         p.get('price', 0),
        'originalPrice': p.get('original_price', p.get('price', 0)),
        'category':      p.get('category', ''),
        'seller':        p.get('seller_name', ''),
        'emoji':         p.get('emoji', '🛍'),
        'inStock':       p.get('stock', 0) > 0,
        'rating':        round(p.get('rating', 0), 1),
        'soldCount':     p.get('sold_count', 0),
    }