from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from .common import (
    DEFAULT_WELL_KB,
    _coerce_float,
    _extract_text,
    _find_existing_well_by_identity,
    _read_csv_rows,
    apply_imported_well_metadata,
    create_empty_well,
)
from ..schema import WellModel


def import_wells_rows(
    session: Session,
    source_path: Path | str,
    fieldnames: list[str],
    rows: list[dict[str, str]],
) -> tuple[list[WellModel], list[str], int]:
    path = Path(source_path)
    if not rows:
        raise ValueError(f'{path}: wells CSV is empty')

    if 'well_name' not in fieldnames:
        raise ValueError(f'{path}: missing required column: well_name')

    imported: list[WellModel] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()

    for row_index, row in enumerate(rows, start=2):
        name = _extract_text(row, 'well_name')
        if not name:
            raise ValueError(f'{path}: well_name is required at row {row_index}')

        uwi = _extract_text(row, 'uwi')
        x = _coerce_float(_extract_text(row, 'x', 'lon', 'longitude'))
        y = _coerce_float(_extract_text(row, 'y', 'lat', 'latitude'))
        kb = _coerce_float(_extract_text(row, 'kb', 'kb_elev', 'kb_elevation'))
        td = _coerce_float(_extract_text(row, 'td', 'td_md', 'total_depth'))
        crs = _extract_text(row, 'crs')

        well = _find_existing_well_by_identity(session, name=name, uwi=uwi)
        if well is None:
            well = create_empty_well(
                session,
                name=name,
                uwi=uwi,
                x=x,
                y=y,
                kb=kb if kb is not None else DEFAULT_WELL_KB,
                td=td,
                crs=crs,
            )
        else:
            apply_imported_well_metadata(
                well,
                name=name,
                uwi=uwi,
                x=x,
                y=y,
                kb=kb,
                td=td,
                crs=crs,
            )

        if well.id in seen_ids:
            warnings.append(f'Duplicate row for well "{well.name}" was merged into the same well.')
            continue
        seen_ids.add(well.id)
        imported.append(well)

    session.flush()
    return imported, warnings, len(rows)


def import_wells_csv(
    session: Session,
    csv_path: Path | str,
) -> tuple[list[WellModel], list[str], int]:
    path = Path(csv_path)
    fieldnames, rows = _read_csv_rows(path)
    return import_wells_rows(session, path, fieldnames, rows)
