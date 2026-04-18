from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from subsidence.data import ProjectManager

from .formations import router as formations_router
from .projects import router as projects_router
from .wells import router as wells_router

app = FastAPI(
    title="SUBSIDENCE API",
    description="Backend for well log visualization and subsidence curve calculation",
    version="0.1.0",
)

app.state.project_manager = ProjectManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wells_router, prefix="/api")
app.include_router(formations_router, prefix="/api")
app.include_router(projects_router, prefix="/api/projects")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
