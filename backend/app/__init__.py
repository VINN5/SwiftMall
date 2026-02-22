# backend/app/__init__.py
from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import certifi

load_dotenv()

db = None

def _connect_mongo(uri: str):
    strategies = [
        dict(tls=True, tlsCAFile=certifi.where()),
        dict(tls=True, tlsCAFile=certifi.where(), tlsAllowInvalidHostnames=True),
        dict(tls=True, tlsAllowInvalidCertificates=True),
    ]
    last_error = None
    for i, kwargs in enumerate(strategies, 1):
        try:
            print(f"   Trying SSL strategy {i}...")
            client = MongoClient(uri, **kwargs)
            client.admin.command('ping')
            print(f"   SSL strategy {i} succeeded.")
            return client
        except Exception as e:
            print(f"   Strategy {i} failed: {type(e).__name__}")
            last_error = e
    raise last_error


def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY']                       = os.getenv('SECRET_KEY')
    app.config['MONGO_URI']                        = os.getenv('MONGO_URI')
    app.config['JWT_ACCESS_TOKEN_EXPIRES_MINUTES'] = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_MINUTES', 1440))

    if not app.config['SECRET_KEY']:
        raise ValueError("SECRET_KEY is missing from .env file")
    if not app.config['MONGO_URI']:
        raise ValueError("MONGO_URI is missing from .env file")

    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
            ],
            "supports_credentials": False,
        }
    })

    global db
    try:
        client = _connect_mongo(app.config['MONGO_URI'])
        db = client.get_default_database()
        print("Connected to MongoDB ✓")
    except Exception as e:
        print("MongoDB connection failed:", str(e))
        raise

    from .routes.auth   import auth_bp
    from .routes.buyer  import buyer_bp
    from .routes.search import search_bp
    from .routes.seller import seller_bp
    from .routes.admin  import admin_bp
    from .routes.cart   import cart_bp
    from .routes.mpesa  import mpesa_bp

    app.register_blueprint(auth_bp,   url_prefix='/api')
    app.register_blueprint(buyer_bp,  url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(seller_bp, url_prefix='/api')
    app.register_blueprint(admin_bp,  url_prefix='/api')
    app.register_blueprint(cart_bp,   url_prefix='/api')
    app.register_blueprint(mpesa_bp,  url_prefix='/api')

    @app.route('/health')
    def health():
        return jsonify({"status": "healthy", "database": "connected"}), 200

    print("SwiftMall backend initialized ✓")
    return app