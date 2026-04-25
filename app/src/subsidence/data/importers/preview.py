from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from pathlib import Path

import lasio


@dataclass
class TabularParserSettings:
    delimiter: str = 'auto'
    header_row: int = 0


@dataclass
class TabularPreviewResult:
    columns: list[str]
    rows: list[list[str]]
    detected_delimiter: str
    header_row: int
    total_rows: int | None
    warnings: list[str] = field(default_factory=list)


@dataclass
class LasPreviewCurve:
    mnemonic: str
    unit: str
    description: str | None


@dataclass
class LasPreviewResult:
    well_name: str | None
    well_id: str | None
    depth_unit: str | None
    curves: list[LasPreviewCurve]
    start_depth: float | None
    stop_depth: float | None
    step: float | None
    null_value: float | None
    warnings: list[str] = field(default_factory=list)


def _detect_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
        return dialect.delimiter
    except csv.Error:
        return ','


def preview_tabular(path: Path, settings: TabularParserSettings, max_rows: int = 50) -> TabularPreviewResult:
    warnings: list[str] = []

    if not path.exists():
        return TabularPreviewResult(columns=[], rows=[], detected_delimiter=',', header_row=settings.header_row, total_rows=0, warnings=['File not found.'])

    try:
        content = path.read_text(encoding='utf-8-sig')
    except UnicodeDecodeError:
        try:
            content = path.read_text(encoding='latin-1')
            warnings.append('File is not UTF-8 — read as latin-1.')
        except Exception:
            return TabularPreviewResult(columns=[], rows=[], detected_delimiter=',', header_row=settings.header_row, total_rows=0, warnings=['Could not read file.'])

    if not content.strip():
        return TabularPreviewResult(columns=[], rows=[], detected_delimiter=',', header_row=settings.header_row, total_rows=0, warnings=['File is empty.'])

    if settings.delimiter == 'auto':
        detected = _detect_delimiter(content[:4096])
    else:
        detected = settings.delimiter

    lines = content.splitlines()
    header_index = min(settings.header_row, len(lines) - 1)
    relevant_lines = lines[header_index:]

    if not relevant_lines:
        return TabularPreviewResult(columns=[], rows=[], detected_delimiter=detected, header_row=settings.header_row, total_rows=0, warnings=['No rows found after header position.'])

    reader = csv.reader(io.StringIO('\n'.join(relevant_lines)), delimiter=detected)
    parsed = list(reader)

    if not parsed:
        return TabularPreviewResult(columns=[], rows=[], detected_delimiter=detected, header_row=settings.header_row, total_rows=0, warnings=['Failed to parse file.'])

    columns = [col.strip() for col in parsed[0]]
    data_rows = parsed[1:]
    total_rows = len(data_rows)
    preview_rows = [list(row) for row in data_rows[:max_rows]]

    seen: set[str] = set()
    for col in columns:
        if col in seen:
            warnings.append(f'Duplicate column name: {col!r}.')
        seen.add(col)

    col_counts = {len(row) for row in data_rows[:100] if row}
    if len(col_counts) > 1:
        warnings.append('Inconsistent number of columns across rows.')

    return TabularPreviewResult(
        columns=columns,
        rows=preview_rows,
        detected_delimiter=detected,
        header_row=settings.header_row,
        total_rows=total_rows,
        warnings=warnings,
    )


def preview_las(path: Path) -> LasPreviewResult:
    if not path.exists():
        return LasPreviewResult(well_name=None, well_id=None, depth_unit=None, curves=[], start_depth=None, stop_depth=None, step=None, null_value=None, warnings=['File not found.'])

    try:
        las = lasio.read(str(path))
    except Exception as exc:
        return LasPreviewResult(well_name=None, well_id=None, depth_unit=None, curves=[], start_depth=None, stop_depth=None, step=None, null_value=None, warnings=[f'Failed to parse LAS file: {exc}'])

    def _header_text(name: str) -> str | None:
        item = las.well.get(name)
        if item is None:
            return None
        value = str(getattr(item, 'value', '') or '').strip()
        return value or None

    def _header_float(name: str) -> float | None:
        item = las.well.get(name)
        if item is None:
            return None
        try:
            return float(getattr(item, 'value', None))
        except (TypeError, ValueError):
            return None

    well_name = _header_text('WELL') or _header_text('ORIGINALWELLNAME')
    well_id = _header_text('UWI')

    depth_unit: str | None = None
    for mnemonic in ('DEPT', 'DEPTH', 'MD'):
        curve = las.curves.get(mnemonic)
        if curve and curve.unit:
            depth_unit = curve.unit
            break

    curves = [
        LasPreviewCurve(
            mnemonic=curve.mnemonic,
            unit=curve.unit or '',
            description=(curve.descr or '').strip() or None,
        )
        for curve in las.curves
    ]

    warnings: list[str] = []
    wrap_item = las.well.get('WRAP')
    if wrap_item and str(getattr(wrap_item, 'value', '')).strip().upper() == 'YES':
        warnings.append('LAS file uses wrapped format — some curve data may not load correctly.')

    return LasPreviewResult(
        well_name=well_name,
        well_id=well_id,
        depth_unit=depth_unit,
        curves=curves,
        start_depth=_header_float('STRT'),
        stop_depth=_header_float('STOP'),
        step=_header_float('STEP'),
        null_value=_header_float('NULL'),
        warnings=warnings,
    )
