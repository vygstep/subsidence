from __future__ import annotations

from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..schema import DeviationSurveyModel
from .common import (
    DEFAULT_WELL_KB,
    DEFAULT_WELL_NAME,
    _apply_column_map,
    _coerce_float,
    _extract_text,
    _find_existing_well_by_identity,
    _read_csv_rows,
    _resolve_well,
    _sha256,
    _validate_strictly_increasing_depth,
    apply_imported_well_metadata,
    create_empty_well,
)

_DEVIATION_MODE_COLUMNS = {
    'INCL_AZIM': ('incl_deg', 'azim_deg'),
    'X_Y': ('x', 'y'),
    'DX_DY': ('dx', 'dy'),
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


def _resolve_or_create_well_for_deviation(
    session: Session,
    rows: list[dict[str, str]],
    depth_column: str,
    well_id: str | None,
    *,
    create_new_well: bool = False,
) -> object:
    if well_id:
        return _resolve_well(session, well_id)

    first_name = _extract_text(rows[0], 'well_name', 'well', 'well_name_header') if rows else None
    if not create_new_well:
        existing = _find_existing_well_by_identity(session, name=first_name)
        if existing is not None:
            return existing
    td = _coerce_float(rows[-1].get(depth_column)) if rows else None
    return create_empty_well(session, name=first_name or DEFAULT_WELL_NAME, td=td, kb=DEFAULT_WELL_KB)


def import_deviation_csv(
    session: Session,
    project_path: Path | str,
    well_id: str | None,
    csv_path: Path | str,
    *,
    column_map: dict[str, str] | None = None,
    create_new_well: bool = False,
) -> DeviationSurveyModel:
    bundle_path = Path(project_path)
    path = Path(csv_path)
    deviation_dir = bundle_path / 'deviation'
    deviation_dir.mkdir(parents=True, exist_ok=True)

    fieldnames, rows = _read_csv_rows(path)
    if column_map:
        fieldnames, rows = _apply_column_map(fieldnames, rows, column_map)
    if not rows:
        raise ValueError(f'{path}: deviation CSV is empty')

    reference, depth_column = _detect_deviation_reference(fieldnames)
    mode, value_columns = _detect_deviation_mode(fieldnames)
    depths = _validate_strictly_increasing_depth(rows, depth_column, path)
    well = _resolve_or_create_well_for_deviation(session, rows, depth_column, well_id, create_new_well=create_new_well)
    if depths:
        apply_imported_well_metadata(well, td=depths[-1])

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
    return survey
