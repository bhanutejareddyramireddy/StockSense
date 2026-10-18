import os
import sys
from pathlib import Path

# Add project root to sys.path so that 'backend' is discoverable
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure serverless detection
os.environ.setdefault("VERCEL", "1")

from backend.app.main import app

# Vercel looks for 'app' by default in ASGI applications
