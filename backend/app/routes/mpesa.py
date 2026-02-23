# backend/app/routes/mpesa.py
from flask import Blueprint, request, jsonify
from .. import db
from ..utils.auth_helpers import get_current_user
from bson import ObjectId
from datetime import datetime, timezone
import requests
import base64
import os

mpesa_bp = Blueprint('mpesa', __name__)


def _get_access_token() -> str:
    consumer_key    = os.getenv('MPESA_CONSUMER_KEY')
    consumer_secret = os.getenv('MPESA_CONSUMER_SECRET')
    env             = os.getenv('MPESA_ENV', 'sandbox')
    url = (
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        if env == 'sandbox' else
        'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    )
    credentials = base64.b64encode(f'{consumer_key}:{consumer_secret}'.encode()).decode()
    response    = requests.get(url, headers={'Authorization': f'Basic {credentials}'}, timeout=10)
    response.raise_for_status()
    return response.json()['access_token']


def _generate_password(shortcode: str, passkey: str, timestamp: str) -> str:
    return base64.b64encode(f'{shortcode}{passkey}{timestamp}'.encode()).decode()


def _format_phone(phone: str) -> str:
    phone = phone.strip().replace(' ', '').replace('-', '')
    if phone.startswith('0'):
        phone = '254' + phone[1:]
    elif phone.startswith('+'):
        phone = phone[1:]
    return phone


def _base_url() -> str:
    return (
        'https://sandbox.safaricom.co.ke'
        if os.getenv('MPESA_ENV', 'sandbox') == 'sandbox'
        else 'https://api.safaricom.co.ke'
    )


# ── STK Push ──────────────────────────────────────────────────────────────────

@mpesa_bp.route('/mpesa/stk-push', methods=['POST'])
def stk_push():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401

    data        = request.get_json() or {}
    phone       = data.get('phone', '')
    amount      = data.get('amount', 0)
    order_ids   = data.get('order_ids', [])
    description = data.get('description', 'SwiftMall Order')

    if not phone:
        return jsonify({'error': 'phone is required'}), 400
    if not amount or int(amount) < 1:
        return jsonify({'error': 'amount must be at least 1'}), 400
    if not order_ids:
        return jsonify({'error': 'order_ids is required'}), 400

    phone     = _format_phone(phone)
    shortcode = os.getenv('MPESA_SHORTCODE', '174379')
    passkey   = os.getenv('MPESA_PASSKEY', '')
    callback  = os.getenv('MPESA_CALLBACK_URL', '')
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password  = _generate_password(shortcode, passkey, timestamp)

    try:
        token = _get_access_token()
    except Exception as e:
        print(f'M-Pesa token error: {e}')
        return jsonify({'error': 'Could not connect to M-Pesa. Try again.'}), 502

    payload = {
        'BusinessShortCode': shortcode,
        'Password':          password,
        'Timestamp':         timestamp,
        'TransactionType':   'CustomerPayBillOnline',
        'Amount':            int(amount),
        'PartyA':            phone,
        'PartyB':            shortcode,
        'PhoneNumber':       phone,
        'CallBackURL':       callback,
        'AccountReference':  'SwiftMall',
        'TransactionDesc':   description,
    }

    try:
        response = requests.post(
            f'{_base_url()}/mpesa/stkpush/v1/processrequest',
            json=payload,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            timeout=15,
        )
        result = response.json()
    except Exception as e:
        print(f'M-Pesa STK push error: {e}')
        return jsonify({'error': 'M-Pesa request failed. Try again.'}), 502

    if result.get('ResponseCode') != '0':
        error_msg = result.get('errorMessage') or result.get('ResponseDescription', 'STK push failed')
        return jsonify({'error': error_msg}), 400

    checkout_request_id = result.get('CheckoutRequestID')

    db.payments.insert_one({
        'checkout_request_id': checkout_request_id,
        'merchant_request_id': result.get('MerchantRequestID'),
        'buyer_id':            user['_id'],
        'buyer_name':          user.get('username', ''),
        'phone':               phone,
        'amount':              int(amount),
        'order_ids':           [ObjectId(oid) for oid in order_ids],
        'status':              'pending',
        'created_at':          datetime.now(timezone.utc),
        'updated_at':          datetime.now(timezone.utc),
    })

    return jsonify({
        'message':             'STK Push sent. Check your phone.',
        'checkout_request_id': checkout_request_id,
    })


# ── Callback ──────────────────────────────────────────────────────────────────

@mpesa_bp.route('/mpesa/callback', methods=['POST'])
def mpesa_callback():
    """Safaricom calls this directly — no auth required."""
    data     = request.get_json(silent=True) or {}
    stk_data = data.get('Body', {}).get('stkCallback', {})

    checkout_request_id = stk_data.get('CheckoutRequestID')
    result_code         = stk_data.get('ResultCode')
    result_desc         = stk_data.get('ResultDesc', '')

    if not checkout_request_id:
        return jsonify({'ResultCode': 0, 'ResultDesc': 'Accepted'}), 200

    payment = db.payments.find_one({'checkout_request_id': checkout_request_id})
    if not payment:
        return jsonify({'ResultCode': 0, 'ResultDesc': 'Accepted'}), 200

    now = datetime.now(timezone.utc)

    if result_code == 0:
        items       = stk_data.get('CallbackMetadata', {}).get('Item', [])
        meta        = {item['Name']: item.get('Value') for item in items}
        mpesa_code  = meta.get('MpesaReceiptNumber', '')
        paid_amount = meta.get('Amount', payment['amount'])
        phone_used  = str(meta.get('PhoneNumber', payment['phone']))

        db.payments.update_one(
            {'checkout_request_id': checkout_request_id},
            {'$set': {
                'status':      'success',
                'mpesa_code':  mpesa_code,
                'paid_amount': paid_amount,
                'phone_used':  phone_used,
                'result_desc': result_desc,
                'updated_at':  now,
            }}
        )

        # ── Update orders to paid ─────────────────────────────────────────────
        db.orders.update_many(
            {'_id': {'$in': payment['order_ids']}},
            {'$set': {
                'payment_status': 'paid',
                'mpesa_code':     mpesa_code,
                'paid_at':        now,
                'updated_at':     now,
            }}
        )

        # ── FIX 1: Decrement stock for each paid order ────────────────────────
        paid_orders = list(db.orders.find({'_id': {'$in': payment['order_ids']}}))
        for order in paid_orders:
            product_id = order.get('product_id')
            quantity   = order.get('quantity', 1)
            if product_id:
                db.products.update_one(
                    {'_id': product_id},
                    {
                        '$inc': {'stock': -quantity, 'sold_count': quantity},
                    }
                )

        db.notifications.insert_one({
            'user_id':    payment['buyer_id'],
            'message':    f'Payment of KES {paid_amount:,} confirmed! M-Pesa code: {mpesa_code}.',
            'type':       'order',
            'read':       False,
            'created_at': now,
        })
    else:
        db.payments.update_one(
            {'checkout_request_id': checkout_request_id},
            {'$set': {
                'status':      'failed',
                'result_code': result_code,
                'result_desc': result_desc,
                'updated_at':  now,
            }}
        )

    return jsonify({'ResultCode': 0, 'ResultDesc': 'Accepted'}), 200


# ── Status Polling ────────────────────────────────────────────────────────────

@mpesa_bp.route('/mpesa/status/<checkout_request_id>', methods=['GET'])
def payment_status(checkout_request_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': 'Authentication required'}), 401

    payment = db.payments.find_one({
        'checkout_request_id': checkout_request_id,
        'buyer_id':            user['_id'],
    })
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404

    return jsonify({
        'status':      payment.get('status', 'pending'),
        'amount':      payment.get('amount', 0),
        'mpesa_code':  payment.get('mpesa_code', ''),
        'result_desc': payment.get('result_desc', ''),
    })