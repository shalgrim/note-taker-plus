"""
Note Taker Plus - Backend API

A spaced repetition learning system with multiple input sources.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import (
    sources_router,
    cards_router,
    tags_router,
    sync_router,
    health_router,
    export_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Note Taker Plus",
    description="A spaced repetition learning system with multiple input sources",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local React dev
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(sources_router)
app.include_router(cards_router)
app.include_router(tags_router)
app.include_router(sync_router)
app.include_router(export_router)


@app.get("/")
async def root():
    return {
        "name": "Note Taker Plus API",
        "version": "0.1.0",
        "docs": "/docs",
    }
