from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.persistence.store import store

router = APIRouter(prefix="", tags=["Health"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "tagline": settings.PROJECT_TAGLINE,
        "case_id": settings.CASE_ID,
        "version": settings.VERSION,
        "persistence_mode": "Cloud Firestore" if not store.is_demo_mode else "Local Demo Mode",
        "is_demo_mode": store.is_demo_mode,
        "fixture_loaded": settings.FIXTURE_FILE.exists()
    }
