import os
import sys
from pathlib import Path

# Ensure project root is in Python sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.core.config import settings
from backend.app.api import (
    health, dataset, forecast, evaluation, replenishment, scenarios, reports, business_plan
)

app = FastAPI(
    title=f"{settings.PROJECT_NAME} — Inventory Forecasting & Replenishment API",
    description="Fynd × NMIMS Hyderabad Case C19: Defensible short-horizon replenishment with uncertainty.",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def no_cache_static_middleware(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Mount API Routers FIRST so they take priority
api_routers = [
    health.router, dataset.router, forecast.router, evaluation.router,
    replenishment.router, scenarios.router, reports.router, business_plan.router
]
for r in api_routers:
    app.include_router(r, prefix=settings.API_PREFIX)
    # Also mount directly without prefix so both /api/path and /path resolve seamlessly
    app.include_router(r)

# Static frontend directory
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"

class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

if FRONTEND_DIR.exists():
    css_dir = FRONTEND_DIR / "css"
    if css_dir.exists():
        app.mount("/css", NoCacheStaticFiles(directory=str(css_dir)), name="css")

    js_dir = FRONTEND_DIR / "js"
    if js_dir.exists():
        app.mount("/js", NoCacheStaticFiles(directory=str(js_dir)), name="js")

    app.mount("/static", NoCacheStaticFiles(directory=str(FRONTEND_DIR)), name="static")

    # Mount entire frontend directory at root with html=True
    app.mount("/", NoCacheStaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
