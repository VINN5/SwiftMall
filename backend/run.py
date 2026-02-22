# backend/run.py
import os
import sys

print("1. Starting SwiftMall backend...")

try:
    from app import create_app
    print("2. Imported create_app successfully")
except ImportError as e:
    print(f"IMPORT ERROR: {e}")
    print("   → Make sure you are in the 'backend' folder")
    print("   → Check that 'app/__init__.py' exists")
    sys.exit(1)

try:
    print("3. Initializing app...")
    app = create_app()
    print("4. App created successfully")
except Exception as e:
    print(f"CREATE_APP FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    print(f"\n SwiftMall API running at http://localhost:{port}/api")
    print(f" Health check:           http://localhost:{port}/health\n")
    app.run(debug=True, host='0.0.0.0', port=port, use_reloader=True)