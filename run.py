#!/usr/bin/env python3
"""
StockSense — Entrypoint Runner
Launches the FastAPI backend and static web dashboard on http://127.0.0.1:8000
and automatically opens the default web browser.
"""
import sys
import time
import socket
import webbrowser
import threading
import urllib.request
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

HOST = "0.0.0.0"
PORT = 8000
URL = f"http://127.0.0.1:{PORT}/"

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def is_server_healthy(url: str = f"http://127.0.0.1:8000/api/health") -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False

def open_browser_delayed(max_wait: float = 15.0):
    start_time = time.time()
    # Wait until the FastAPI server is actually running and healthy
    while time.time() - start_time < max_wait:
        if is_server_healthy():
            break
        time.sleep(0.4)
    print(f"\n[StockSense] Server is ready! Opening application in browser: {URL}")
    webbrowser.open(URL)

def main():
    print("=" * 65)
    print("   StockSense — Smart Inventory Forecasting & Replenishment")
    print("   Fynd x NMIMS Hyderabad Case C19 System")
    print("=" * 65)
    print(f"Target URL: {URL}")
    print("Demo Account: admin@stocksense.ai | Password: StockSense2026!")
    print("-" * 65)

    if is_server_healthy():
        print("[StockSense] Server is ALREADY running and healthy on port 8000!")
        webbrowser.open(URL)
        print("[StockSense] Browser opened. Press Ctrl+C in server terminal to stop.")
        return

    # Check if port is bound by a non-responsive process
    if is_port_in_use(PORT, HOST):
        print(f"[StockSense] Port {PORT} is bound. Waiting 1s to verify...")
        time.sleep(1.0)
        if is_server_healthy():
            print("[StockSense] Server is healthy!")
            webbrowser.open(URL)
            return

    # Start browser launch thread
    threading.Thread(target=open_browser_delayed, daemon=True).start()

    # Launch uvicorn
    import uvicorn
    from backend.app.core.config import settings
    uvicorn.run("backend.app.main:app", host=HOST, port=PORT, reload=False)

if __name__ == "__main__":
    main()
