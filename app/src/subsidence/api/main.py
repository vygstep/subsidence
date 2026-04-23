import os
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from subsidence.data import ProjectManager
from subsidence.observability import configure_logging, log_event, reset_request_id, set_request_id

from .compaction import router as compaction_router
from .formations import router as formations_router
from .projects import router as projects_router
from .strat_chart import router as strat_chart_router
from .subsidence import router as subsidence_router
from .wells import router as wells_router

configure_logging()

app = FastAPI(
    title="SUBSIDENCE API",
    description="Backend for well log visualization and subsidence curve calculation",
    version="0.1.0",
)

app.state.project_manager = ProjectManager()


@app.middleware("http")
async def request_logging_middleware(request, call_next):
    request_id = request.headers.get('x-request-id') or str(uuid4())
    token = set_request_id(request_id)
    start = perf_counter()
    log_event(
        'info',
        'http.request',
        'start',
        method=request.method,
        path=request.url.path,
    )
    try:
        response = await call_next(request)
    except Exception as exc:
        log_event(
            'error',
            'http.request',
            'failure',
            method=request.method,
            path=request.url.path,
            duration_ms=round((perf_counter() - start) * 1000, 2),
            error_type=type(exc).__name__,
            error_message=str(exc),
        )
        raise
    finally:
        reset_request_id(token)

    response.headers['x-request-id'] = request_id
    token = set_request_id(request_id)
    try:
        log_event(
            'info',
            'http.request',
            'success',
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round((perf_counter() - start) * 1000, 2),
        )
    finally:
        reset_request_id(token)
    return response

cors_origins = [
    origin.strip()
    for origin in os.getenv('SUBSIDENCE_CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wells_router, prefix="/api")
app.include_router(formations_router, prefix="/api")
app.include_router(strat_chart_router, prefix="/api")
app.include_router(compaction_router, prefix="/api")
app.include_router(subsidence_router, prefix="/api")
app.include_router(projects_router, prefix="/api/projects")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
