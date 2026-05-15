from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from pathlib import Path
from typing import Iterable

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select

from subsidence.api._deps import require_open_project as _require_open_project
from subsidence.data.schema import WellModel

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


class WellInfoExportRequest(BaseModel):
    scope: str = 'current'
    well_id: str | None = None
    packaging: str = 'one_file_for_all_wells'
    export_to_zip: bool = False
    output_dir: str | None = None


@router.get('/capabilities', response_model=ExportCapabilities)
def export_capabilities() -> ExportCapabilities:
    return ExportCapabilities(
        table_packaging=['one_file_per_well', 'one_file_for_all_wells'],
        las_packaging=['one_file_per_well'],
        supports_output_dir=True,
        supports_zip=True,
    )


WELL_INFO_FIELDNAMES = [
    'well_name',
    'uwi',
    'kb_elev',
    'gl_elev',
    'td_md',
    'x',
    'y',
    'crs',
    'coordinate_semantics',
    'depth_unit',
    'color_hex',
    'source_las_path',
    'extra_company',
    'extra_field',
    'extra_location',
    'extra_api',
    'extra_country',
    'extra_original_well_name',
]

REQUIRED_WELL_INFO_FIELDNAMES = [
    'well_name',
    'kb_elev',
    'gl_elev',
    'td_md',
    'x',
    'y',
    'crs',
    'coordinate_semantics',
    'depth_unit',
    'color_hex',
]


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


def _well_extra(row: WellModel) -> dict[str, object]:
    if not row.extra:
        return {}
    try:
        parsed = json.loads(row.extra)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _well_info_row(row: WellModel) -> dict[str, object | None]:
    extra = _well_extra(row)
    return {
        'well_name': row.name,
        'uwi': row.uwi,
        'kb_elev': row.kb_elev,
        'gl_elev': row.gl_elev,
        'td_md': row.td_md,
        'x': row.lon,
        'y': row.lat,
        'crs': row.crs,
        'coordinate_semantics': 'project_xy',
        'depth_unit': row.depth_unit,
        'color_hex': row.color_hex,
        'source_las_path': row.source_las_path,
        'extra_company': extra.get('company'),
        'extra_field': extra.get('field'),
        'extra_location': extra.get('location'),
        'extra_api': extra.get('api'),
        'extra_country': extra.get('country'),
        'extra_original_well_name': extra.get('original_well_name'),
    }


def _well_info_csv(rows: list[dict[str, object | None]]) -> bytes:
    fieldnames = [
        field
        for field in WELL_INFO_FIELDNAMES
        if field in REQUIRED_WELL_INFO_FIELDNAMES
        or any(row.get(field) not in (None, '') for row in rows)
    ]
    return csv_bytes(fieldnames, rows)


def _well_info_filename(row: WellModel) -> str:
    return f'{sanitize_filename(row.name, row.id)}_well_info.csv'


@router.post('/wells/info')
def export_well_info(body: WellInfoExportRequest, request: Request):
    manager = _require_open_project(request)
    output_dir = validate_output_dir(body.output_dir)
    scope = body.scope.strip().lower()
    packaging = body.packaging.strip().lower()
    if scope not in {'current', 'all'}:
        raise HTTPException(status_code=400, detail="scope must be 'current' or 'all'")
    if packaging not in {'one_file_for_all_wells', 'one_file_per_well'}:
        raise HTTPException(status_code=400, detail="packaging must be 'one_file_for_all_wells' or 'one_file_per_well'")
    if body.export_to_zip and packaging != 'one_file_per_well':
        raise HTTPException(status_code=400, detail='Export to ZIP is only available for one file per well')

    with manager.get_session() as session:
        if scope == 'current':
            if not body.well_id:
                raise HTTPException(status_code=400, detail='well_id is required for current well export')
            well = session.get(WellModel, body.well_id)
            if well is None:
                raise HTTPException(status_code=404, detail=f'Well not found: {body.well_id}')
            wells = [well]
        else:
            wells = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()

        if not wells:
            raise HTTPException(status_code=404, detail='No wells available for export')

        if scope == 'current':
            rows = [_well_info_row(wells[0])]
            files = [(_well_info_filename(wells[0]), _well_info_csv(rows))]
        elif packaging == 'one_file_for_all_wells':
            rows = [_well_info_row(well) for well in wells]
            files = [('well_info.csv', _well_info_csv(rows))]
        else:
            files = [
                (_well_info_filename(well), _well_info_csv([_well_info_row(well)]))
                for well in wells
            ]

    if body.export_to_zip:
        zip_file = ('well_info.zip', zip_bytes(files))
        if output_dir is not None:
            return write_export_files(output_dir, [zip_file])
        return download_response(zip_file[1], zip_file[0], 'application/zip')

    if output_dir is not None:
        return write_export_files(output_dir, files)

    if len(files) > 1:
        raise HTTPException(status_code=400, detail='Choose an export folder or enable ZIP for multiple browser downloads')
    filename, content = files[0]
    return download_response(content, filename, 'text/csv; charset=utf-8')
