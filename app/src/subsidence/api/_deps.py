from __future__ import annotations

from fastapi import HTTPException, Request

from subsidence.data.project_manager import ProjectManager


def get_manager(request: Request) -> ProjectManager:
    return request.app.state.project_manager


def require_open_project(
    request: Request,
    detail: str = 'No project is currently open',
) -> ProjectManager:
    manager = get_manager(request)
    if not manager.is_open:
        raise HTTPException(status_code=400, detail=detail)
    return manager


def manager_project_path(manager: ProjectManager) -> str | None:
    return str(manager.project_path) if manager.project_path else None
