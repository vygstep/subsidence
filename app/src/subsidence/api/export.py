from __future__ import annotations

import csv
import io
import re
import zipfile
from pathlib import Path
from typing import Iterable

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(tags=['export'])

_UNSAFE_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


class ExportedFile(BaseModel):
    filename: str
    path: str
    byte_size: int


class ExportWriteResult(BaseModel):
    status: str = 'ok'
    files: list[ExportedFile]
    file_count: int


class ExportCapabilities(BaseModel):
    table_packaging: list[str]
    las_packaging: list[str]
    supports_output_dir: bool
    supports_zip: bool


@router.get('/capabilities', response_model=ExportCapabilities)
def export_capabilities() -> ExportCapabilities:
    return ExportCapabilities(
        table_packaging=['one_file_per_well', 'one_file_for_all_wells'],
        las_packaging=['one_file_per_well'],
        supports_output_dir=True,
        supports_zip=True,
    )


def sanitize_filename(raw: str, fallback: str = 'export') -> str:
    cleaned = _UNSAFE_FILENAME_CHARS.sub('_', raw.strip())
    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' .')
    if not cleaned:
        cleaned = fallback
    return cleaned[:180]


def csv_bytes(fieldnames: list[str], rows: Iterable[dict[str, object | None]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction='ignore', lineterminator='\n')
    writer.writeheader()
    for row in rows:
        writer.writerow({field: '' if row.get(field) is None else row.get(field) for field in fieldnames})
    return buffer.getvalue().encode('utf-8-sig')


def download_response(content: bytes, filename: str, media_type: str) -> Response:
    safe_name = sanitize_filename(filename)
    return Response(
        content=content,
        media_type=media_type,
        headers={
            'Content-Disposition': f'attachment; filename="{safe_name}"',
            'Content-Length': str(len(content)),
        },
    )


def csv_download_response(filename: str, fieldnames: list[str], rows: Iterable[dict[str, object | None]]) -> Response:
    return download_response(csv_bytes(fieldnames, rows), filename, 'text/csv; charset=utf-8')


def zip_bytes(files: Iterable[tuple[str, bytes]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as archive:
        for filename, content in files:
            archive.writestr(sanitize_filename(filename), content)
    return buffer.getvalue()


def zip_download_response(filename: str, files: Iterable[tuple[str, bytes]]) -> Response:
    return download_response(zip_bytes(files), filename, 'application/zip')


def validate_output_dir(output_dir: str | None) -> Path | None:
    if output_dir is None or not output_dir.strip():
        return None
    path = Path(output_dir).expanduser()
    if not path.exists():
        raise HTTPException(status_code=400, detail=f'Export folder does not exist: {output_dir}')
    if not path.is_dir():
        raise HTTPException(status_code=400, detail=f'Export path is not a folder: {output_dir}')
    return path.resolve()


def write_export_files(output_dir: Path, files: Iterable[tuple[str, bytes]]) -> ExportWriteResult:
    written: list[ExportedFile] = []
    for filename, content in files:
        safe_name = sanitize_filename(filename)
        target = output_dir / safe_name
        target.write_bytes(content)
        written.append(ExportedFile(filename=safe_name, path=str(target), byte_size=len(content)))
    return ExportWriteResult(files=written, file_count=len(written))
