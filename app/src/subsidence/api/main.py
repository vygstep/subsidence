from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .wells import router as wells_router

app = FastAPI(
    title="SUBSIDENCE API",
    description="Backend for well log visualization and subsidence curve calculation",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wells_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
