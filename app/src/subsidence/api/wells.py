from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from subsidence.data import load_las_curves

router = APIRouter(tags=["wells"])
_SAMPLE_WELL_ID = "sample"
_SAMPLE_WELL_NAME = "SAMPLE-1"
_SAMPLE_PATH = Path(__file__).resolve().parents[3] / "data" / "sample.las"


class CurveResponse(BaseModel):
    mnemonic: str
    unit: str
    depths: list[float]
    values: list[float]
    null_value: float


class WellResponse(BaseModel):
    well_id: str
    well_name: str
    kb_elev: float
    td_md: float
    x: float
    y: float
    crs: str
    curves: list[CurveResponse]
    formations: list[dict]


@router.get("/wells/sample", response_model=WellResponse)
def get_sample_well() -> WellResponse:
    if not _SAMPLE_PATH.exists():
        raise HTTPException(status_code=404, detail="Sample LAS file is missing")

    curves = load_las_curves(_SAMPLE_PATH)
    if not curves:
        raise HTTPException(status_code=500, detail="Sample LAS file contains no valid curves")

    td_md = max(depth for curve in curves for depth in curve.depths)
    return WellResponse(
        well_id=_SAMPLE_WELL_ID,
        well_name=_SAMPLE_WELL_NAME,
        kb_elev=10.0,
        td_md=td_md,
        x=0.0,
        y=0.0,
        crs="unset",
        curves=[
            CurveResponse(
                mnemonic=curve.mnemonic,
                unit=curve.unit,
                depths=curve.depths,
                values=curve.values,
                null_value=curve.null_value,
            )
            for curve in curves
        ],
        formations=[],
    )
