from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ..data.importers.preview import TabularParserSettings, preview_las, preview_tabular

router = APIRouter(tags=['import-preview'])


class TabularPreviewRequest(BaseModel):
    file_path: str
    delimiter: str = 'auto'
    header_row: int = 0


class TabularPreviewResponse(BaseModel):
    columns: list[str]
    rows: list[list[str]]
    detected_delimiter: str
    header_row: int
    total_rows: int | None
    warnings: list[str]


class LasPreviewRequest(BaseModel):
    file_path: str


class LasPreviewCurve(BaseModel):
    mnemonic: str
    unit: str
    description: str | None


class LasPreviewResponse(BaseModel):
    well_name: str | None
    well_id: str | None
    depth_unit: str | None
    curves: list[LasPreviewCurve]
    start_depth: float | None
    stop_depth: float | None
    step: float | None
    null_value: float | None
    warnings: list[str]


@router.post('/tabular', response_model=TabularPreviewResponse)
def preview_tabular_file(payload: TabularPreviewRequest) -> TabularPreviewResponse:
    result = preview_tabular(
        Path(payload.file_path),
        TabularParserSettings(delimiter=payload.delimiter, header_row=payload.header_row),
    )
    return TabularPreviewResponse(
        columns=result.columns,
        rows=result.rows,
        detected_delimiter=result.detected_delimiter,
        header_row=result.header_row,
        total_rows=result.total_rows,
        warnings=result.warnings,
    )


@router.post('/las', response_model=LasPreviewResponse)
def preview_las_file(payload: LasPreviewRequest) -> LasPreviewResponse:
    result = preview_las(Path(payload.file_path))
    return LasPreviewResponse(
        well_name=result.well_name,
        well_id=result.well_id,
        depth_unit=result.depth_unit,
        curves=[
            LasPreviewCurve(mnemonic=c.mnemonic, unit=c.unit, description=c.description)
            for c in result.curves
        ],
        start_depth=result.start_depth,
        stop_depth=result.stop_depth,
        step=result.step,
        null_value=result.null_value,
        warnings=result.warnings,
    )
