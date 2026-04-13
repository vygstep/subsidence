from fastapi import FastAPI

app = FastAPI(
    title="SUBSIDENCE API",
    description="Backend for well log visualization and subsidence curve calculation",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
