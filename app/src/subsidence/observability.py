from __future__ import annotations

import contextvars
import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from time import perf_counter
from typing import Any, Iterator

_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar('request_id', default=None)

_LOG_DIR = Path(__file__).resolve().parent.parent.parent.parent / 'logs'


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            'timestamp': datetime.now(tz=timezone.utc).isoformat(),
            'level': record.levelname.lower(),
            'logger': record.name,
            'message': record.getMessage(),
        }
        event = getattr(record, 'event', None)
        if isinstance(event, dict):
            payload.update(event)
        if record.exc_info:
            payload['exception'] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def _file_handler(filename: str) -> RotatingFileHandler:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        _LOG_DIR / filename,
        maxBytes=5_000_000,
        backupCount=3,
        encoding='utf-8',
    )
    handler.setFormatter(JsonFormatter())
    return handler


def configure_logging() -> None:
    root = logging.getLogger('subsidence')
    if root.handlers:
        return

    level_name = os.getenv('SUBSIDENCE_LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, level_name, logging.INFO)
    formatter = JsonFormatter()

    # stderr — все события
    stream = logging.StreamHandler()
    stream.setFormatter(formatter)
    root.addHandler(stream)
    root.setLevel(level)
    root.propagate = False

    # per-module file handlers
    _add_module_handler('subsidence.import.tops', 'import_tops.log', level)
    _add_module_handler('subsidence.zone_service', 'zone_service.log', level)
    _add_module_handler('subsidence.api', 'api.log', level)
    _add_module_handler('subsidence.api.formations', 'formations.log', level)
    _add_module_handler('subsidence.api.subsidence', 'subsidence.log', level)


def _add_module_handler(logger_name: str, filename: str, level: int) -> None:
    logger = logging.getLogger(logger_name)
    if any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
        return
    handler = _file_handler(filename)
    logger.addHandler(handler)
    logger.setLevel(level)
    # propagate=True so events also reach the root 'subsidence' stderr handler


def set_request_id(request_id: str | None) -> contextvars.Token[str | None]:
    return _request_id.set(request_id)


def reset_request_id(token: contextvars.Token[str | None]) -> None:
    _request_id.reset(token)


def get_request_id() -> str | None:
    return _request_id.get()


def log_event(level: str, operation: str, phase: str, **fields: Any) -> None:
    logger = logging.getLogger('subsidence')
    event = {
        'request_id': get_request_id(),
        'operation': operation,
        'phase': phase,
        **{key: value for key, value in fields.items() if value is not None},
    }
    logger.log(getattr(logging, level.upper(), logging.INFO), f'{operation}.{phase}', extra={'event': event})


@contextmanager
def operation_log(operation: str, **fields: Any) -> Iterator[None]:
    start = perf_counter()
    log_event('info', operation, 'start', **fields)
    try:
        yield
    except Exception as exc:
        log_event(
            'error',
            operation,
            'failure',
            duration_ms=round((perf_counter() - start) * 1000, 2),
            error_type=type(exc).__name__,
            error_message=str(exc),
            **fields,
        )
        raise
    else:
        log_event(
            'info',
            operation,
            'success',
            duration_ms=round((perf_counter() - start) * 1000, 2),
            **fields,
        )
