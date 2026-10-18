import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = BASE_DIR / "data"
FIXTURE_PATH = DATA_DIR / "fixture.json"
STARTER_DATA_PATH = BASE_DIR / "starter-data" / "c19" / "fixture.json"

# Load environment variables if .env exists
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "StockSense"
    PROJECT_TAGLINE: str = "Know Your Stock. Plan Ahead."
    CASE_ID: str = "C19"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1")
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    
    # Firebase
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "")
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Data paths
    FIXTURE_FILE: Path = FIXTURE_PATH if FIXTURE_PATH.exists() else STARTER_DATA_PATH

settings = Settings()
