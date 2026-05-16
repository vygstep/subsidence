from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from pathlib import Path
from typing import Iterable

import lasio
import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from subsidence.api._deps import require_open_project as _require_open_project
from subsidence.data.loaders import load_curves_from_parquet
from subsidence.data.schema import CurveMetadata, DeviationSurveyModel, FormationTopModel, FormationZone, SeaLevelCurve, SeaLevelPoint, StratChart, StratUnit, TopSetHorizon, WellActiveTopSet, WellModel, ZoneWellData

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


class WellLogsExportRequest(BaseModel):
    scope: str = 'current'
    well_id: str | None = None
    export_to_zip: bool = False
    output_dir: str | None = None
    las_step_m: float = 0.2
    las_null_value: float = -999.25


class WellTopsExportRequest(BaseModel):
    scope: str = 'current'
    well_id: str | None = None
    packaging: str = 'one_file_for_all_wells'
    export_to_zip: bool = False
    output_dir: str | None = None


class WellDeviationExportRequest(BaseModel):
    scope: str = 'current'
    well_id: str | None = None
    packaging: str = 'one_file_for_all_wells'
    export_to_zip: bool = False
    output_dir: str | None = None


class StratChartExportRequest(BaseModel):
    scope: str = 'active'
    chart_id: int | None = None
    export_to_zip: bool = False
    output_dir: str | None = None


class SeaLevelCurveExportRequest(BaseModel):
    scope: str = 'selected'
    curve_id: int | None = None
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

TOPS_FIELDNAMES = [
    'well_name',
    'topset_name',
    'top_name',
    'depth_md',
    'depth_tvd',
    'depth_tvdss',
    'age_ma',
    'age_base_ma',
    'boundary_type',
    'hiatus_duration_ma',
    'eroded_thickness_m',
    'water_depth_m',
    'sea_level_m_override',
    'lithology',
    'lithology_fractions',
    'lithology_source',
    'color',
    'note',
    'lower_top_name',
    'zone_thickness_md',
    'zone_thickness_tvd',
]

REQUIRED_TOPS_FIELDNAMES = [
    'well_name',
    'topset_name',
    'top_name',
    'depth_md',
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


def _format_curve_column(row: CurveMetadata) -> str:
    unit = (row.unit or '').strip()
    return f'{row.mnemonic} [{unit}]' if unit else row.mnemonic


def _curve_frame(project_path: Path, curve_rows: list[CurveMetadata]) -> pd.DataFrame:
    if not curve_rows:
        raise HTTPException(status_code=404, detail='No curves available for export')

    frame_by_depth = pd.DataFrame(columns=['DEPT']).set_index('DEPT')
    curve_maps: dict[str, dict[str, tuple[np.ndarray, np.ndarray]]] = {}
    for row in curve_rows:
        if row.data_uri not in curve_maps:
            curve_maps[row.data_uri] = load_curves_from_parquet(project_path, row.data_uri)
        pair = curve_maps[row.data_uri].get(row.mnemonic)
        if pair is None:
            continue
        depths, values = pair
        frame_by_depth[row.mnemonic] = pd.Series(
            values.astype('float64'),
            index=pd.Index(depths.astype('float64'), name='DEPT'),
            dtype='float64',
        )

    if frame_by_depth.empty or not frame_by_depth.columns.tolist():
        raise HTTPException(status_code=404, detail='No curve samples available for export')

    return frame_by_depth.sort_index().reset_index()


def _curve_payloads(project_path: Path, curve_rows: list[CurveMetadata]) -> dict[str, tuple[CurveMetadata, np.ndarray, np.ndarray]]:
    curve_maps: dict[str, dict[str, tuple[np.ndarray, np.ndarray]]] = {}
    payloads: dict[str, tuple[CurveMetadata, np.ndarray, np.ndarray]] = {}
    for row in curve_rows:
        if row.data_uri not in curve_maps:
            curve_maps[row.data_uri] = load_curves_from_parquet(project_path, row.data_uri)
        pair = curve_maps[row.data_uri].get(row.mnemonic)
        if pair is None:
            continue
        depths, values = pair
        order = np.argsort(depths.astype('float64'))
        clean_depths = depths.astype('float64')[order]
        clean_values = values.astype('float64')[order]
        finite_mask = np.isfinite(clean_depths) & np.isfinite(clean_values)
        if int(finite_mask.sum()) < 2:
            continue
        payloads[row.mnemonic] = (row, clean_depths[finite_mask], clean_values[finite_mask])
    return payloads


def _regular_depth_grid(min_depth: float, max_depth: float, step_m: float) -> np.ndarray:
    if not np.isfinite(min_depth) or not np.isfinite(max_depth):
        raise HTTPException(status_code=404, detail='No curve samples available for LAS export')
    if step_m <= 0 or not np.isfinite(step_m):
        raise HTTPException(status_code=400, detail='LAS export step must be a positive number')
    if max_depth < min_depth:
        min_depth, max_depth = max_depth, min_depth
    decimals = max(0, int(np.ceil(-np.log10(step_m))) + 3) if step_m < 1 else 6
    count = int(np.floor((max_depth - min_depth) / step_m + 1e-9)) + 1
    grid = min_depth + np.arange(count + 1, dtype='float64') * step_m
    grid = grid[grid <= max_depth + step_m * 1e-6]
    if grid.size == 0 or grid[-1] < max_depth - step_m * 1e-6:
        grid = np.append(grid, max_depth)
    return np.round(grid, decimals=decimals)


def _native_gap_limit(depths: np.ndarray, row: CurveMetadata) -> float | None:
    diffs = np.diff(depths)
    diffs = diffs[np.isfinite(diffs) & (diffs > 0)]
    if diffs.size == 0:
        return None
    reference_step = row.nominal_step_m if row.nominal_step_m is not None and row.nominal_step_m > 0 else float(np.median(diffs))
    if not np.isfinite(reference_step) or reference_step <= 0:
        return None
    return reference_step * 1.5


def _mask_large_native_gaps(grid: np.ndarray, depths: np.ndarray, row: CurveMetadata) -> np.ndarray:
    mask = np.zeros(grid.shape, dtype=bool)
    gap_limit = _native_gap_limit(depths, row)
    if gap_limit is None:
        return mask
    diffs = np.diff(depths)
    for idx, gap in enumerate(diffs):
        if gap > gap_limit:
            mask |= (grid > depths[idx]) & (grid < depths[idx + 1])
    return mask


def _resample_continuous_curve(grid: np.ndarray, depths: np.ndarray, values: np.ndarray, row: CurveMetadata) -> np.ndarray:
    result = np.interp(grid, depths, values, left=np.nan, right=np.nan)
    result[(grid < depths[0]) | (grid > depths[-1])] = np.nan
    result[_mask_large_native_gaps(grid, depths, row)] = np.nan
    return result


def _resample_discrete_curve(grid: np.ndarray, depths: np.ndarray, values: np.ndarray, row: CurveMetadata) -> np.ndarray:
    result = np.full(grid.shape, np.nan, dtype='float64')
    interval_indices = np.searchsorted(depths, grid, side='right') - 1
    valid = (interval_indices >= 0) & (grid <= depths[-1])
    if valid.any():
        result[valid] = values[interval_indices[valid]]
    result[_mask_large_native_gaps(grid, depths, row)] = np.nan
    return result


def _las_resampled_frame(project_path: Path, curve_rows: list[CurveMetadata], step_m: float) -> pd.DataFrame:
    payloads = _curve_payloads(project_path, curve_rows)
    if not payloads:
        raise HTTPException(status_code=404, detail='No curve samples available for LAS export')
    min_depth = min(float(depths[0]) for _, depths, _ in payloads.values())
    max_depth = max(float(depths[-1]) for _, depths, _ in payloads.values())
    grid = _regular_depth_grid(min_depth, max_depth, step_m)
    frame = pd.DataFrame({'DEPT': grid})
    for mnemonic, (row, depths, values) in payloads.items():
        if row.curve_type == 'discrete':
            frame[mnemonic] = _resample_discrete_curve(grid, depths, values, row)
        else:
            frame[mnemonic] = _resample_continuous_curve(grid, depths, values, row)
    return frame


def _logs_csv_bytes(project_path: Path, well: WellModel, curve_rows: list[CurveMetadata]) -> bytes:
    frame = _curve_frame(project_path, curve_rows)
    frame.insert(0, 'well_name', well.name)
    columns = {'DEPT': 'DEPT [m]'}
    columns.update({row.mnemonic: _format_curve_column(row) for row in curve_rows if row.mnemonic in frame.columns})
    frame = frame.rename(columns=columns)

    buffer = io.StringIO()
    frame.to_csv(buffer, index=False, lineterminator='\n', na_rep='')
    return buffer.getvalue().encode('utf-8-sig')


def _first_non_empty_extra(row: WellModel, key: str) -> str:
    value = _well_extra(row).get(key)
    return str(value).strip() if value not in (None, '') else ''


def _logs_las_bytes(project_path: Path, well: WellModel, curve_rows: list[CurveMetadata], step_m: float, null_value: float) -> bytes:
    if not np.isfinite(step_m) or step_m <= 0:
        raise HTTPException(status_code=400, detail='LAS export step must be a positive number')
    if not np.isfinite(null_value):
        raise HTTPException(status_code=400, detail='LAS null value must be a finite number')
    frame = _las_resampled_frame(project_path, curve_rows, step_m)

    las = lasio.LASFile()
    las.well['NULL'] = float(null_value)
    las.well['WELL'] = well.name
    las.well['UWI'] = well.uwi or ''
    las.well['COMP'] = _first_non_empty_extra(well, 'company')
    las.well['FLD'] = _first_non_empty_extra(well, 'field')
    las.well['LOC'] = _first_non_empty_extra(well, 'location')
    las.well['API'] = _first_non_empty_extra(well, 'api')
    las.well['CTRY'] = _first_non_empty_extra(well, 'country')
    las.well.append(lasio.HeaderItem('EREF', 'm', well.kb_elev, 'Project KB elevation'))
    las.well.append(lasio.HeaderItem('TD', 'm', well.td_md if well.td_md is not None else float(frame['DEPT'].max()), 'Project total depth'))
    las.well.append(lasio.HeaderItem('SLON', '', well.lon if well.lon is not None else '', 'Project X coordinate'))
    las.well.append(lasio.HeaderItem('SLAT', '', well.lat if well.lat is not None else '', 'Project Y coordinate'))
    las.well.append(lasio.HeaderItem('HZCS', '', well.crs or '', 'Project coordinate reference system'))
    las.well.append(lasio.HeaderItem('COORDSEM', '', 'project_xy', 'SUBSIDENCE coordinate semantics'))

    las.append_curve('DEPT', frame['DEPT'].to_numpy(dtype='float64'), unit='m', descr='Measured depth')
    for row in curve_rows:
        if row.mnemonic not in frame.columns:
            continue
        values = frame[row.mnemonic].to_numpy(dtype='float64')
        values = np.where(np.isnan(values), float(null_value), values)
        description_parts = []
        if row.canonical_mnemonic:
            description_parts.append(f'canonical={row.canonical_mnemonic}')
        if row.family_code:
            description_parts.append(f'family={row.family_code}')
        if row.curve_type:
            description_parts.append(f'type={row.curve_type}')
        las.append_curve(
            row.mnemonic,
            values,
            unit=row.unit or '',
            descr='; '.join(description_parts),
        )

    buffer = io.StringIO()
    las.write(buffer, version=2.0)
    return buffer.getvalue().encode('utf-8')


def _logs_filename(well: WellModel, extension: str) -> str:
    return f'{sanitize_filename(well.name, well.id)}_logs.{extension}'


def _log_export_files(
    project_path: Path,
    wells: list[WellModel],
    curve_rows_by_well: dict[str, list[CurveMetadata]],
    export_format: str,
    *,
    las_step_m: float = 0.2,
    las_null_value: float = -999.25,
) -> list[tuple[str, bytes]]:
    files: list[tuple[str, bytes]] = []
    for well in wells:
        curve_rows = curve_rows_by_well.get(well.id, [])
        if not curve_rows:
            continue
        if export_format == 'csv':
            files.append((_logs_filename(well, 'csv'), _logs_csv_bytes(project_path, well, curve_rows)))
        elif export_format == 'las':
            files.append((_logs_filename(well, 'las'), _logs_las_bytes(project_path, well, curve_rows, las_step_m, las_null_value)))
        else:
            raise HTTPException(status_code=400, detail="export_format must be 'csv' or 'las'")
    if not files:
        raise HTTPException(status_code=404, detail='No well logs available for export')
    return files


def _tops_filename(well: WellModel) -> str:
    return f'{sanitize_filename(well.name, well.id)}_tops.csv'


def _top_boundary_type(pick: FormationTopModel, horizon: TopSetHorizon | None) -> str:
    kind = (pick.kind or (horizon.kind if horizon is not None else '') or 'strat').strip().lower()
    return 'unconformity' if kind == 'unconformity' else 'conformable'


def _tops_rows_for_well(session, well: WellModel) -> list[dict[str, object | None]]:
    active = session.scalar(
        select(WellActiveTopSet)
        .where(WellActiveTopSet.well_id == well.id)
        .options(selectinload(WellActiveTopSet.top_set))
    )
    if active is None:
        return []

    horizons = session.scalars(
        select(TopSetHorizon)
        .where(TopSetHorizon.top_set_id == active.top_set_id)
        .order_by(TopSetHorizon.sort_order.asc(), TopSetHorizon.id.asc())
    ).all()
    horizon_by_id = {horizon.id: horizon for horizon in horizons}
    horizon_ids = list(horizon_by_id.keys())
    if not horizon_ids:
        return []

    picks = session.scalars(
        select(FormationTopModel)
        .where(
            FormationTopModel.well_id == well.id,
            FormationTopModel.horizon_id.in_(horizon_ids),
            FormationTopModel.depth_md.is_not(None),
        )
    ).all()
    pick_by_horizon_id = {
        pick.horizon_id: pick
        for pick in picks
        if pick.horizon_id is not None
    }

    zones = session.scalars(
        select(FormationZone)
        .where(FormationZone.top_set_id == active.top_set_id)
        .options(selectinload(FormationZone.lower_horizon))
    ).all()
    zone_by_upper_horizon_id = {zone.upper_horizon_id: zone for zone in zones}
    zone_ids = [zone.id for zone in zones]
    zwd_by_zone_id: dict[int, ZoneWellData] = {}
    if zone_ids:
        zwd_by_zone_id = {
            row.zone_id: row
            for row in session.scalars(
                select(ZoneWellData).where(
                    ZoneWellData.zone_id.in_(zone_ids),
                    ZoneWellData.well_id == well.id,
                )
            ).all()
        }

    rows: list[dict[str, object | None]] = []
    for horizon in horizons:
        pick = pick_by_horizon_id.get(horizon.id)
        if pick is None:
            continue
        zone = zone_by_upper_horizon_id.get(horizon.id)
        zwd = zwd_by_zone_id.get(zone.id) if zone is not None else None
        rows.append({
            'well_name': well.name,
            'topset_name': active.top_set.name,
            'top_name': pick.name or horizon.name,
            'depth_md': pick.depth_md,
            'depth_tvd': pick.depth_tvd,
            'depth_tvdss': pick.depth_tvdss,
            'age_ma': pick.age_top_ma if pick.age_top_ma is not None else horizon.age_ma,
            'age_base_ma': pick.age_base_ma,
            'boundary_type': _top_boundary_type(pick, horizon),
            'hiatus_duration_ma': pick.hiatus_duration_ma,
            'eroded_thickness_m': pick.eroded_thickness_m,
            'water_depth_m': pick.water_depth_m,
            'sea_level_m_override': pick.sea_level_m_override,
            'lithology': pick.lithology,
            'lithology_fractions': zwd.lithology_fractions if zwd is not None else None,
            'lithology_source': zwd.lithology_source if zwd is not None else None,
            'color': pick.color or horizon.color,
            'note': pick.note,
            'lower_top_name': zone.lower_horizon.name if zone is not None and zone.lower_horizon is not None else None,
            'zone_thickness_md': zwd.thickness_md if zwd is not None else None,
            'zone_thickness_tvd': zwd.thickness_tvd if zwd is not None else None,
        })
    return rows


def _tops_csv(rows: list[dict[str, object | None]]) -> bytes:
    fieldnames = [
        field
        for field in TOPS_FIELDNAMES
        if field in REQUIRED_TOPS_FIELDNAMES
        or any(row.get(field) not in (None, '') for row in rows)
    ]
    return csv_bytes(fieldnames, rows)


def _tops_export_files(session, wells: list[WellModel], packaging: str) -> list[tuple[str, bytes]]:
    rows_by_well: list[tuple[WellModel, list[dict[str, object | None]]]] = [
        (well, _tops_rows_for_well(session, well))
        for well in wells
    ]
    rows_by_well = [(well, rows) for well, rows in rows_by_well if rows]
    if not rows_by_well:
        raise HTTPException(status_code=404, detail='No active TopSet picks available for export')
    if packaging == 'one_file_for_all_wells':
        rows = [row for _well, well_rows in rows_by_well for row in well_rows]
        return [('tops.csv', _tops_csv(rows))]
    if packaging == 'one_file_per_well':
        return [(_tops_filename(well), _tops_csv(rows)) for well, rows in rows_by_well]
    raise HTTPException(status_code=400, detail="packaging must be 'one_file_for_all_wells' or 'one_file_per_well'")


def _deviation_filename(well: WellModel) -> str:
    return f'{sanitize_filename(well.name, well.id)}_deviation.csv'


def _deviation_frame(project_path: Path, well: WellModel, survey: DeviationSurveyModel) -> pd.DataFrame:
    parquet_path = project_path / survey.data_uri
    if not parquet_path.exists():
        raise HTTPException(status_code=404, detail=f'Deviation payload is missing for well "{well.name}"')
    frame = pd.read_parquet(parquet_path)
    if frame.empty:
        raise HTTPException(status_code=404, detail=f'Deviation survey is empty for well "{well.name}"')
    frame = frame.copy()
    frame.insert(0, 'well_name', well.name)
    return frame


def _deviation_csv_bytes(frames: list[pd.DataFrame]) -> bytes:
    if not frames:
        raise HTTPException(status_code=404, detail='No deviation surveys available for export')
    all_columns: list[str] = []
    for frame in frames:
        for column in frame.columns:
            if column not in all_columns:
                all_columns.append(str(column))
    normalized = [frame.reindex(columns=all_columns) for frame in frames]
    output = pd.concat(normalized, ignore_index=True)
    buffer = io.StringIO()
    output.to_csv(buffer, index=False, lineterminator='\n', na_rep='')
    return buffer.getvalue().encode('utf-8-sig')


def _deviation_export_files(project_path: Path, session, wells: list[WellModel], packaging: str) -> list[tuple[str, bytes]]:
    well_ids = [well.id for well in wells]
    survey_by_well_id: dict[str, DeviationSurveyModel] = {}
    if well_ids:
        survey_by_well_id = {
            row.well_id: row
            for row in session.scalars(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id.in_(well_ids))).all()
        }
    frames_by_well: list[tuple[WellModel, pd.DataFrame]] = []
    for well in wells:
        survey = survey_by_well_id.get(well.id)
        if survey is None:
            continue
        frames_by_well.append((well, _deviation_frame(project_path, well, survey)))
    if not frames_by_well:
        raise HTTPException(status_code=404, detail='No deviation surveys available for export')
    if packaging == 'one_file_for_all_wells':
        return [('deviation.csv', _deviation_csv_bytes([frame for _well, frame in frames_by_well]))]
    if packaging == 'one_file_per_well':
        return [(_deviation_filename(well), _deviation_csv_bytes([frame])) for well, frame in frames_by_well]
    raise HTTPException(status_code=400, detail="packaging must be 'one_file_for_all_wells' or 'one_file_per_well'")


STRAT_CHART_FIELDNAMES = [
    'unit_id',
    'parent_unit_id',
    'unit_name',
    'rank_name',
    'start_age_ma',
    'end_age_ma',
    'color',
]


def _strat_chart_filename(chart: StratChart) -> str:
    return f'{sanitize_filename(chart.name, f"strat_chart_{chart.id}")}.csv'


def _strat_chart_csv(chart: StratChart, units: list[StratUnit]) -> bytes:
    unit_id_by_db_id = {unit.id: index for index, unit in enumerate(units, start=1)}
    rows: list[dict[str, object | None]] = []
    for unit in units:
        rows.append({
            'unit_id': unit_id_by_db_id[unit.id],
            'parent_unit_id': unit_id_by_db_id.get(unit.parent_id) if unit.parent_id is not None else None,
            'unit_name': unit.name,
            'rank_name': unit.rank,
            'start_age_ma': unit.age_base_ma,
            'end_age_ma': unit.age_top_ma,
            'color': unit.color_hex,
        })
    if not rows:
        raise HTTPException(status_code=404, detail=f'StratChart "{chart.name}" has no units to export')
    return csv_bytes(STRAT_CHART_FIELDNAMES, rows)


def _strat_chart_export_files(session, charts: list[StratChart]) -> list[tuple[str, bytes]]:
    files: list[tuple[str, bytes]] = []
    for chart in charts:
        units = session.scalars(
            select(StratUnit)
            .where(StratUnit.chart_id == chart.id)
            .order_by(StratUnit.parent_id.asc().nulls_first(), StratUnit.age_top_ma.asc().nulls_last(), StratUnit.age_base_ma.asc().nulls_last(), StratUnit.id.asc())
        ).all()
        files.append((_strat_chart_filename(chart), _strat_chart_csv(chart, units)))
    if not files:
        raise HTTPException(status_code=404, detail='No stratigraphic charts available for export')
    return files


SEA_LEVEL_FIELDNAMES = ['age_ma', 'sea_level_m']


def _sea_level_filename(curve: SeaLevelCurve) -> str:
    return f'{sanitize_filename(curve.name, f"sea_level_curve_{curve.id}")}.csv'


def _sea_level_csv(curve: SeaLevelCurve, points: list[SeaLevelPoint]) -> bytes:
    if not points:
        raise HTTPException(status_code=404, detail=f'Sea level curve "{curve.name}" has no points to export')
    rows = [
        {
            'age_ma': point.age_ma,
            'sea_level_m': point.sea_level_m,
        }
        for point in points
    ]
    return csv_bytes(SEA_LEVEL_FIELDNAMES, rows)


def _sea_level_export_files(session, curves: list[SeaLevelCurve]) -> list[tuple[str, bytes]]:
    files: list[tuple[str, bytes]] = []
    for curve in curves:
        points = session.scalars(
            select(SeaLevelPoint)
            .where(SeaLevelPoint.curve_id == curve.id)
            .order_by(SeaLevelPoint.age_ma.desc(), SeaLevelPoint.id.asc())
        ).all()
        files.append((_sea_level_filename(curve), _sea_level_csv(curve, points)))
    if not files:
        raise HTTPException(status_code=404, detail='No sea level curves available for export')
    return files


def _handle_files_response(
    files: list[tuple[str, bytes]],
    *,
    output_dir: Path | None,
    export_to_zip: bool,
    zip_filename: str,
    media_type: str,
):
    if export_to_zip:
        zip_file = (zip_filename, zip_bytes(files))
        if output_dir is not None:
            return write_export_files(output_dir, [zip_file])
        return download_response(zip_file[1], zip_file[0], 'application/zip')

    if output_dir is not None:
        return write_export_files(output_dir, files)

    if len(files) > 1:
        raise HTTPException(status_code=400, detail='Choose an export folder or enable ZIP for multiple browser downloads')
    filename, content = files[0]
    return download_response(content, filename, media_type)


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

    return _handle_files_response(
        files,
        output_dir=output_dir,
        export_to_zip=body.export_to_zip,
        zip_filename='well_info.zip',
        media_type='text/csv; charset=utf-8',
    )


@router.post('/wells/logs/{export_format}')
def export_well_logs(export_format: str, body: WellLogsExportRequest, request: Request):
    manager = _require_open_project(request)
    output_dir = validate_output_dir(body.output_dir)
    scope = body.scope.strip().lower()
    export_format = export_format.strip().lower()
    if scope not in {'current', 'all'}:
        raise HTTPException(status_code=400, detail="scope must be 'current' or 'all'")
    if export_format not in {'csv', 'las'}:
        raise HTTPException(status_code=400, detail="export_format must be 'csv' or 'las'")

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

        well_ids = [well.id for well in wells]
        curve_rows_by_well: dict[str, list[CurveMetadata]] = {well_id: [] for well_id in well_ids}
        if well_ids:
            curve_rows = session.scalars(
                select(CurveMetadata)
                .where(CurveMetadata.well_id.in_(well_ids))
                .order_by(CurveMetadata.well_id.asc(), CurveMetadata.id.asc())
            ).all()
            for row in curve_rows:
                curve_rows_by_well.setdefault(row.well_id, []).append(row)

        files = _log_export_files(
            manager.project_path,
            wells,
            curve_rows_by_well,
            export_format,
            las_step_m=body.las_step_m,
            las_null_value=body.las_null_value,
        )

    return _handle_files_response(
        files,
        output_dir=output_dir,
        export_to_zip=body.export_to_zip,
        zip_filename=f'well_logs_{export_format}.zip',
        media_type='text/csv; charset=utf-8' if export_format == 'csv' else 'application/octet-stream',
    )


@router.post('/wells/tops')
def export_well_tops(body: WellTopsExportRequest, request: Request):
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
            files = _tops_export_files(session, [well], 'one_file_per_well')
        else:
            wells = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
            files = _tops_export_files(session, wells, packaging)

    return _handle_files_response(
        files,
        output_dir=output_dir,
        export_to_zip=body.export_to_zip,
        zip_filename='tops.zip',
        media_type='text/csv; charset=utf-8',
    )


@router.post('/wells/deviation')
def export_well_deviation(body: WellDeviationExportRequest, request: Request):
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
            files = _deviation_export_files(manager.project_path, session, [well], 'one_file_per_well')
        else:
            wells = session.scalars(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc())).all()
            files = _deviation_export_files(manager.project_path, session, wells, packaging)

    return _handle_files_response(
        files,
        output_dir=output_dir,
        export_to_zip=body.export_to_zip,
        zip_filename='deviation.zip',
        media_type='text/csv; charset=utf-8',
    )


@router.post('/strat-charts')
def export_strat_charts(body: StratChartExportRequest, request: Request):
    manager = _require_open_project(request)
    output_dir = validate_output_dir(body.output_dir)
    scope = body.scope.strip().lower()
    if scope not in {'active', 'selected', 'all'}:
        raise HTTPException(status_code=400, detail="scope must be 'active', 'selected', or 'all'")

    with manager.get_session() as session:
        if scope == 'all':
            charts = session.scalars(select(StratChart).order_by(StratChart.name.asc(), StratChart.id.asc())).all()
        elif scope == 'selected':
            if body.chart_id is None:
                raise HTTPException(status_code=400, detail='chart_id is required for selected chart export')
            chart = session.get(StratChart, body.chart_id)
            if chart is None:
                raise HTTPException(status_code=404, detail=f'StratChart not found: {body.chart_id}')
            charts = [chart]
        else:
            chart = session.scalar(select(StratChart).where(StratChart.is_active.is_(True)))
            if chart is None:
                raise HTTPException(status_code=404, detail='No active StratChart available for export')
            charts = [chart]
        files = _strat_chart_export_files(session, charts)

    return _handle_files_response(
        files,
        output_dir=output_dir,
        export_to_zip=body.export_to_zip,
        zip_filename='strat_charts.zip',
        media_type='text/csv; charset=utf-8',
    )


@router.post('/sea-level-curves')
def export_sea_level_curves(body: SeaLevelCurveExportRequest, request: Request):
    manager = _require_open_project(request)
    output_dir = validate_output_dir(body.output_dir)
    scope = body.scope.strip().lower()
    if scope not in {'selected', 'all'}:
        raise HTTPException(status_code=400, detail="scope must be 'selected' or 'all'")

    with manager.get_session() as session:
        if scope == 'all':
            curves = session.scalars(select(SeaLevelCurve).order_by(SeaLevelCurve.name.asc(), SeaLevelCurve.id.asc())).all()
        else:
            if body.curve_id is None:
                raise HTTPException(status_code=400, detail='curve_id is required for selected sea level curve export')
            curve = session.get(SeaLevelCurve, body.curve_id)
            if curve is None:
                raise HTTPException(status_code=404, detail=f'Sea level curve not found: {body.curve_id}')
            curves = [curve]
        files = _sea_level_export_files(session, curves)

    return _handle_files_response(
        files,
        output_dir=output_dir,
        export_to_zip=body.export_to_zip,
        zip_filename='sea_level_curves.zip',
        media_type='text/csv; charset=utf-8',
    )
