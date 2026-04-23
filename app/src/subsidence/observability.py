from __future__ import annotations

import contextvars
import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from time import perf_counter
from typing import Any, Iterator

_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar('request_id', default=None)


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


def configure_logging() -> None:
    logger = logging.getLogger('subsidence')
    if logger.handlers:
        return

    level_name = os.getenv('SUBSIDENCE_LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, level_name, logging.INFO)
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False


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
