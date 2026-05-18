from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..schema import DeviationSurveyModel
from .common import (
    _apply_column_map,
    _coerce_float,
    _group_rows_by_well_name,
    _has_multi_well_rows,
    _read_csv_rows,
    _resolve_or_create_well_from_rows,
    _resolve_well,
    _sha256,
    _validate_strictly_increasing_depth,
    apply_imported_well_metadata,
    extend_well_td_for_import,
)

_DEVIATION_MODE_COLUMNS = {
    'INCL_AZIM': ('incl_deg', 'azim_deg'),
    'X_Y': ('x', 'y'),
    'DX_DY': ('dx', 'dy'),
}
_DEVIATION_KNOWN_COLUMNS = {
    'well_name',
    'well',
    'wellname',
    'well_id',
    'uwi',
    'md',
    'tvd',
    'tvdss',
    'incl_deg',
    'incl',
    'inclination',
    'dip',
    'inc',
    'angle',
    'azim_deg',
    'azim',
    'azimuth',
    'az',
    'azi',
    'bearing',
    'x',
    'x_offset',
    'easting',
    'east',
    'ns',
    'y',
    'y_offset',
    'northing',
    'north',
    'ew',
    'dx',
    'delta_x',
    'delta_easting',
    'deast',
    'dy',
    'delta_y',
    'delta_northing',
    'dnorth',
}


def _detect_deviation_reference(fieldnames: list[str]) -> tuple[str, str]:
    normalized = {name.strip().casefold(): name for name in fieldnames}
    if 'md' in normalized:
        return 'MD', normalized['md']
    if 'tvdss' in normalized:
        return 'TVDSS', normalized['tvdss']
    if 'tvd' in normalized:
        return 'TVD', normalized['tvd']
    raise ValueError('Deviation CSV must contain one depth column: md, tvd, or tvdss')


def _detect_deviation_mode(fieldnames: list[str]) -> tuple[str, tuple[str, str]]:
    normalized = {name.strip().casefold() for name in fieldnames}
    if {'incl_deg', 'azim_deg'} <= normalized:
        return 'INCL_AZIM', ('incl_deg', 'azim_deg')
    if {'x', 'y'} <= normalized:
        return 'X_Y', ('x', 'y')
    if {'dx', 'dy'} <= normalized:
        return 'DX_DY', ('dx', 'dy')
    raise ValueError('Deviation CSV must contain incl_deg/azim_deg, x/y, or dx/dy columns')


def _import_deviation_rows(
    session: Session,
    project_path: Path | str,
    well_id: str | None,
    path: Path,
    fieldnames: list[str],
    rows: list[dict[str, str]],
    *,
    create_new_well: bool = False,
) -> tuple[DeviationSurveyModel, list[str]]:
    bundle_path = Path(project_path)
    deviation_dir = bundle_path / 'deviation'
    deviation_dir.mkdir(parents=True, exist_ok=True)

    if not rows:
        raise ValueError(f'{path}: deviation CSV is empty')

    reference, depth_column = _detect_deviation_reference(fieldnames)
    mode, value_columns = _detect_deviation_mode(fieldnames)
    depths = _validate_strictly_increasing_depth(rows, depth_column, path)
    well = _resolve_or_create_well_from_rows(session, rows, well_id=well_id, create_new_well=create_new_well)
    td_before_import = well.td_md
    if depths:
        apply_imported_well_metadata(well, td=depths[-1])
    td_warning = extend_well_td_for_import(
        well,
        depths[-1] if depths else None,
        previous_td=td_before_import,
    )

    frame_data: dict[str, list[float]] = {depth_column: depths}
    for column in value_columns:
        values: list[float] = []
        for row_index, row in enumerate(rows, start=2):
            raw_value = row.get(column)
            value = _coerce_float(raw_value)
            if value is None:
                raise ValueError(f'{path}: invalid {column} value at row {row_index}: {raw_value!r}')
            values.append(value)
        frame_data[column] = values

    for column in fieldnames:
        if column in frame_data or column.strip().casefold() in _DEVIATION_KNOWN_COLUMNS:
            continue
        values = []
        has_value = False
        for row_index, row in enumerate(rows, start=2):
            raw_value = row.get(column)
            if raw_value in (None, ''):
                values.append(float('nan'))
                continue
            value = _coerce_float(raw_value)
            if value is None:
                raise ValueError(f'{path}: invalid numeric extra deviation column {column!r} at row {row_index}: {raw_value!r}')
            values.append(value)
            has_value = True
        if has_value:
            frame_data[column] = values

    frame = pd.DataFrame(frame_data)
    for column in frame.columns:
        frame[column] = frame[column].astype('float32')

    relative_path = f'deviation/{well.id}__deviation.parquet'
    parquet_path = bundle_path / relative_path
    table = pa.Table.from_pandas(frame, preserve_index=False)
    pq.write_table(table, parquet_path, compression='snappy')
    source_hash = _sha256(path)

    survey = session.scalar(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == well.id))
    if survey is None:
        survey = DeviationSurveyModel(
            well_id=well.id,
            reference=reference,
            mode=mode,
            data_uri=relative_path,
            source_hash=source_hash,
        )
        session.add(survey)
    else:
        survey.reference = reference
        survey.mode = mode
        survey.data_uri = relative_path
        survey.source_hash = source_hash

    session.flush()
    qc_warnings = [td_warning] if td_warning is not None else []
    return survey, qc_warnings


def import_deviation_csv(
    session: Session,
    project_path: Path | str,
    well_id: str | None,
    csv_path: Path | str,
    *,
    column_map: dict[str, str] | None = None,
    create_new_well: bool = False,
) -> tuple[DeviationSurveyModel, list[str]]:
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    if column_map:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map)
    return _import_deviation_rows(
        session,
        project_path,
        well_id,
        path,
        fieldnames,
        rows,
        create_new_well=create_new_well,
    )


def import_deviation_csv_multi(
    session: Session,
    project_path: Path | str,
    csv_path: Path | str,
    *,
    column_map: dict[str, str] | None = None,
    create_new_well: bool = False,
) -> tuple[list[DeviationSurveyModel], list[str], int]:
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    if column_map:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map)
    if not _has_multi_well_rows(rows):
        survey, warnings = _import_deviation_rows(
            session,
            project_path,
            None,
            path,
            fieldnames,
            rows,
            create_new_well=create_new_well,
        )
        return [survey], warnings, len(rows)

    surveys: list[DeviationSurveyModel] = []
    qc_warnings: list[str] = []
    for _name, group_rows in _group_rows_by_well_name(rows):
        survey, warnings = _import_deviation_rows(
            session,
            project_path,
            None,
            path,
            fieldnames,
            group_rows,
            create_new_well=create_new_well,
        )
        surveys.append(survey)
        qc_warnings.extend(warnings)
    return surveys, qc_warnings, len(rows)
