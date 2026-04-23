from __future__ import annotations

import csv
import io

import pandas as pd

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select

from subsidence.data.schema import CurveMetadata, WellModel
from subsidence.observability import operation_log

from .projects import (
    ExportRequest,
    _manager_project_path,
    _require_open_project,
)

router = APIRouter(tags=['projects'])


def _select_export_well(session, well_id: str | None) -> WellModel:
    if well_id:
        well = session.get(WellModel, well_id)
    else:
        well = session.scalar(select(WellModel).order_by(WellModel.name.asc(), WellModel.id.asc()))
    if well is None:
        raise HTTPException(status_code=404, detail='No wells available for export')
    return well


@router.post('/export/las')
def export_las(payload: ExportRequest, request: Request) -> Response:
    manager = _require_open_project(request)
    with operation_log('export.las', project_path=_manager_project_path(manager), well_id=payload.well_id):
        with manager.get_session() as session:
            well = _select_export_well(session, payload.well_id)
            curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well.id).order_by(CurveMetadata.id.asc())))
            if not curve_rows:
                raise HTTPException(status_code=404, detail=f'No curves found for well: {well.id}')
            frame = pd.read_parquet(manager.project_path / curve_rows[0].data_uri)
            if 'DEPT' not in frame.columns:
                raise HTTPException(status_code=500, detail='Curve parquet is missing DEPT column')
            curve_headers = [(row.mnemonic, row.unit or '') for row in curve_rows if row.mnemonic in frame.columns]

            lines = [
                '~Version Information',
                ' VERS.  2.0 : CWLS LOG ASCII STANDARD',
                ' WRAP.  NO  : One line per depth step',
                '~Well Information',
                f' WELL.  {well.name} : Well name',
                f' UWI.   {well.uwi or well.id} : Unique well identifier',
                f' KB.M   {well.kb_elev:.3f} : Kelly bushing elevation',
                ' NULL.  -999.25 : Null value',
                '~Curve Information',
                ' DEPT.M : Measured depth',
            ]
            for mnemonic, unit in curve_headers:
                lines.append(f' {mnemonic}.{unit or ""} : Exported curve')
            lines.append('~ASCII')

            export_columns = ['DEPT', *[mnemonic for mnemonic, _ in curve_headers]]
            for row_values in frame[export_columns].itertuples(index=False, name=None):
                formatted = []
                for value in row_values:
                    if pd.isna(value):
                        formatted.append('-999.250000')
                    else:
                        formatted.append(f'{float(value):.6f}')
                lines.append(' '.join(formatted))

            body = '\n'.join(lines) + '\n'
            filename = f'{well.name.replace(" ", "_")}.las'
            return Response(content=body, media_type='application/octet-stream', headers={'Content-Disposition': f'attachment; filename="{filename}"'})


@router.post('/export/csv')
def export_csv(payload: ExportRequest, request: Request) -> Response:
    manager = _require_open_project(request)
    with operation_log('export.csv', project_path=_manager_project_path(manager), well_id=payload.well_id):
        with manager.get_session() as session:
            well = _select_export_well(session, payload.well_id)
            curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well.id).order_by(CurveMetadata.id.asc())))
            if not curve_rows:
                raise HTTPException(status_code=404, detail=f'No curves found for well: {well.id}')
            frame = pd.read_parquet(manager.project_path / curve_rows[0].data_uri)
            if 'DEPT' not in frame.columns:
                raise HTTPException(status_code=500, detail='Curve parquet is missing DEPT column')

            output = io.StringIO()
            output.write(f'# WELL,{well.name}\n')
            output.write(f'# CRS,{well.crs}\n')
            writer = csv.writer(output)
            export_columns = ['DEPT', *[row.mnemonic for row in curve_rows if row.mnemonic in frame.columns]]
            writer.writerow(export_columns)
            for row_values in frame[export_columns].itertuples(index=False, name=None):
                writer.writerow(row_values)

            filename = f'{well.name.replace(" ", "_")}.csv'
            return Response(content=output.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="{filename}"'})
