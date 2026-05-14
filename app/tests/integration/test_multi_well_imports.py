from __future__ import annotations

import csv
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from subsidence.data.importers.deviation import import_deviation_csv_multi
from subsidence.data.importers.logs_csv import import_logs_csv_multi
from subsidence.data.importers.tops import import_tops_csv_multi
from subsidence.data.importers.wells import import_wells_csv
from subsidence.data.schema import CurveMetadata, DeviationSurveyModel, FormationTopModel, MeasurementUnit, MeasurementUnitAlias, UnitDimension, WellModel


def _write_csv(tmp_path: Path, name: str, rows: list[dict[str, str]]) -> Path:
    path = tmp_path / name
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return path


def _seed_depth_unit_meter(session: Session) -> None:
    session.add(UnitDimension(code='depth', display_name='Depth', engine_unit_code='m'))
    session.add(MeasurementUnit(code='m', dimension_code='depth', symbol='m', display_name='meter'))
    session.add(MeasurementUnitAlias(dimension_code='depth', unit_code='m', alias='m', normalized_alias='m'))
    session.flush()


def test_import_wells_csv_creates_and_updates_wells(test_db: Session, tmp_path: Path):
    existing = WellModel(id='existing', name='Well A', kb_elev=10.0, td_md=100.0)
    test_db.add(existing)
    test_db.flush()
    csv_path = _write_csv(tmp_path, 'wells.csv', [
        {'well_name': 'Well A', 'uwi': 'A-1', 'kb': '25', 'td': '900', 'x': '10', 'y': '20', 'crs': 'EPSG:4326'},
        {'well_name': 'Well B', 'uwi': 'B-1', 'kb': '30', 'td': '1200', 'x': '11', 'y': '21', 'crs': 'EPSG:4326'},
    ])

    wells, warnings, row_count = import_wells_csv(test_db, csv_path)

    assert warnings == []
    assert row_count == 2
    assert {well.name for well in wells} == {'Well A', 'Well B'}
    assert existing.uwi == 'A-1'
    assert existing.td_md == 900.0
    created = test_db.scalar(select(WellModel).where(WellModel.name == 'Well B'))
    assert created is not None
    assert created.kb_elev == 30.0


def test_logs_csv_multi_validates_depth_per_well(test_db: Session, tmp_path: Path):
    _seed_depth_unit_meter(test_db)
    csv_path = _write_csv(tmp_path, 'logs.csv', [
        {'well_name': 'Well A', 'DEPT': '100', 'GR': '80'},
        {'well_name': 'Well A', 'DEPT': '200', 'GR': '90'},
        {'well_name': 'Well B', 'DEPT': '50', 'GR': '70'},
        {'well_name': 'Well B', 'DEPT': '150', 'GR': '75'},
    ])

    wells, warnings, _max_by_well, row_count = import_logs_csv_multi(test_db, tmp_path, csv_path)

    assert len(warnings) == 2
    assert row_count == 4
    assert {well.name for well in wells} == {'Well A', 'Well B'}
    curves = test_db.scalars(select(CurveMetadata).where(CurveMetadata.mnemonic == 'GR')).all()
    assert len(curves) == 2


def test_tops_csv_multi_imports_picks_for_each_well(test_db: Session, tmp_path: Path):
    csv_path = _write_csv(tmp_path, 'tops.csv', [
        {'well_name': 'Well A', 'top_name': 'Top A', 'depth_md': '100', 'age_ma': '10'},
        {'well_name': 'Well A', 'top_name': 'Top B', 'depth_md': '200', 'age_ma': '20'},
        {'well_name': 'Well B', 'top_name': 'Top A', 'depth_md': '80', 'age_ma': '10'},
        {'well_name': 'Well B', 'top_name': 'Top B', 'depth_md': '180', 'age_ma': '20'},
    ])

    picks, warnings, well_ids, row_count = import_tops_csv_multi(test_db, csv_path)

    assert len(warnings) == 2
    assert row_count == 4
    assert len(well_ids) == 2
    assert len(picks) == 4
    assert len(test_db.scalars(select(FormationTopModel)).all()) == 4


def test_deviation_csv_multi_validates_depth_per_well(test_db: Session, tmp_path: Path):
    csv_path = _write_csv(tmp_path, 'deviation.csv', [
        {'well_name': 'Well A', 'md': '100', 'incl_deg': '0', 'azim_deg': '0'},
        {'well_name': 'Well A', 'md': '200', 'incl_deg': '1', 'azim_deg': '5'},
        {'well_name': 'Well B', 'md': '50', 'incl_deg': '0', 'azim_deg': '0'},
        {'well_name': 'Well B', 'md': '150', 'incl_deg': '2', 'azim_deg': '10'},
    ])

    surveys, warnings, row_count = import_deviation_csv_multi(test_db, tmp_path, csv_path)

    assert len(warnings) == 2
    assert row_count == 4
    assert len(surveys) == 2
    assert len(test_db.scalars(select(DeviationSurveyModel)).all()) == 2
