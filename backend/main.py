# Wrapper for Railpack auto-detection
# Railpack looks for main:app, so we re-export from app.main
from app.main import app

__all__ = ["app"]
