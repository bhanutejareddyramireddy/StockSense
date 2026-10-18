#!/usr/bin/env python3
"""
StockSense root main entry point.
Run `python main.py` to start the project.
Also safely exposes `app` for ASGI / serverless deployment environments.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from backend.app.main import app
except Exception:
    app = None

if __name__ == "__main__":
    from run import main
    main()

