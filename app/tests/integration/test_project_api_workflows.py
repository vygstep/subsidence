from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import pytest
import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import select as sa_select

from subsidence.api import projects as projects_api
from subsidence.api.main import app
from subsidence.data.importers import DEFAULT_WELL_NAME
from subsidence.data.importers.log_resampling import VERTICAL_TVD_IMPORT_WARNING
from subsidence.data.schema import (
    CalculationResult,
    CompactionModel,
    CompactionModelParam,
    CompactionPreset,
    CurveMetadata,
    CurveMnemonicEntry,
    CurveMnemonicSet,
    FormationTopModel,
    TopSetHorizon,
    LithologyDictEntry,
    LithologyPattern,
    LithologyPatternPalette,
    LithologySet,
    LithologySetEntry,
    MeasurementUnit,
    MeasurementUnitAlias,
    SeaLevelCurve,
    SeaLevelPoint,
    StratChart,
    StratUnit,
    UnitDimension,
    VisualConfig,
    WellModel,
)
from subsidence.data.unit_registry import convert_values, convert_values_to_engine, resolve_unit


@pytest.fixture
def api_client():
    manager = app.state.project_manager
    if manager.is_open:
        manager.close_project()

    with TestClient(app) as client:
        yield client

    if manager.is_open:
        manager.close_project()


def _create_project(client: TestClient, tmp_path: Path, name: str = 'workflow') -> Path:
    response = client.post('/api/projects', json={'name': name, 'path': str(tmp_path), 'overwrite': True})
    assert response.status_code == 200, response.text
    project_path = Path(response.json()['project_path'])

    response = client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text
    return project_path


def _write_minimal_las(path: Path, well_name: str = 'LAS Well') -> Path:
    path.write_text(
        '~Version Information\n'
        ' VERS. 2.0 : CWLS LOG ASCII STANDARD\n'
        ' WRAP. NO  : One line per depth step\n'
        '~Well Information\n'
        ' STRT.M 100.0 : Start depth\n'
        ' STOP.M 300.0 : Stop depth\n'
        ' STEP.M 100.0 : Step\n'
        ' NULL. -999.25 : Null value\n'
        f' WELL. {well_name} : Well name\n'
        ' KB.M 15.0 : Kelly bushing\n'
        '~Curve Information\n'
        ' DEPT.M : Depth\n'
        ' GR.API : Gamma ray\n'
        ' RHOB.G/C3 : Bulk density\n'
        '~ASCII\n'
        '100.0 80.0 2.35\n'
        '200.0 85.0 2.40\n'
        '300.0 90.0 2.45\n',
        encoding='utf-8',
    )
    return path


def _write_minimal_las_without_well_name(path: Path) -> Path:
    path.write_text(
        '~Version Information\n'
        ' VERS. 2.0 : CWLS LOG ASCII STANDARD\n'
        ' WRAP. NO  : One line per depth step\n'
        '~Well Information\n'
        ' STRT.M 100.0 : Start depth\n'
        ' STOP.M 300.0 : Stop depth\n'
        ' STEP.M 100.0 : Step\n'
        ' NULL. -999.25 : Null value\n'
        '~Curve Information\n'
        ' DEPT.M : Depth\n'
        ' GR.API : Gamma ray\n'
        '~ASCII\n'
        '100.0 80.0\n'
        '200.0 85.0\n'
        '300.0 90.0\n',
        encoding='utf-8',
    )
    return path


def test_pick_file_uses_isolated_native_picker(api_client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    selected_path = tmp_path / 'logs.csv'
    calls = []

    def fake_pick_path(kind: str, initial_dir: str | None, file_types: list[tuple[str, str]] | None = None) -> str:
        calls.append((kind, initial_dir, file_types))
        return str(selected_path)

    monkeypatch.setattr(projects_api, '_pick_path', fake_pick_path)

    response = api_client.post('/api/projects/pick-file', json={
        'initial_path': str(tmp_path),
        'file_types': [['CSV files', '*.csv']],
    })

    assert response.status_code == 200, response.text
    assert response.json() == {'path': str(selected_path)}
    assert calls == [('file', str(tmp_path), [('CSV files', '*.csv')])]


def test_pick_file_reports_native_picker_failures(api_client: TestClient, monkeypatch: pytest.MonkeyPatch):
    def fake_pick_path(kind: str, initial_dir: str | None, file_types: list[tuple[str, str]] | None = None) -> None:
        raise RuntimeError('TclError: failed')

    monkeypatch.setattr(projects_api, '_pick_path', fake_pick_path)

    response = api_client.post('/api/projects/pick-file', json={})

    assert response.status_code == 500
    assert 'Failed to open file picker' in response.json()['detail']


def test_project_lifecycle_save_close_reopen_preserves_wells(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'lifecycle')

    response = api_client.post('/api/projects/wells', json={
        'name': 'Lifecycle Well',
        'x': 100.0,
        'y': 200.0,
        'kb': 10.0,
        'td': 1200.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text

    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text

    response = api_client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    wells = response.json()
    assert [well['well_id'] for well in wells] == [well_id]
    assert wells[0]['well_name'] == 'Lifecycle Well'

    response = api_client.get('/api/projects/recent')
    assert response.status_code == 200, response.text
    assert any(item['path'] == str(project_path) for item in response.json())


def test_new_project_seeds_builtin_reference_data(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'builtin-reference-data')

    manager = api_client.app.state.project_manager
    with manager.get_session() as session:
        builtin_chart = session.scalar(sa_select(StratChart).where(StratChart.name == 'ICS 2023'))
        assert builtin_chart is not None
        builtin_units = session.scalars(sa_select(StratUnit).where(StratUnit.chart_id == builtin_chart.id)).all()
        assert len(builtin_units) > 0
        assert any(unit.unit_code for unit in builtin_units)

        sea_level_curves = session.scalars(
            sa_select(SeaLevelCurve).where(SeaLevelCurve.is_builtin.is_(True))
        ).all()
        assert {curve.name for curve in sea_level_curves} == {
            'Haq composite curve (binned 10 Myrs)',
            'Van der Meer et al. (2017)',
            'Kocsis & Scotese (2020)',
            'Verard (2015)',
        }
        for curve in sea_level_curves:
            point_count = len(session.scalars(sa_select(SeaLevelPoint).where(SeaLevelPoint.curve_id == curve.id)).all())
            assert point_count == 53

        lithology_codes = {
            row.lithology_code
            for row in session.scalars(sa_select(LithologyDictEntry)).all()
        }
        assert lithology_codes == {
            'sandstone',
            'shale',
            'limestone',
            'dolomite',
            'evaporite',
            'coal',
            'igneous',
            'conglomerate',
            'metamorphic',
        }

        builtin_presets = session.scalars(
            sa_select(CompactionPreset).where(CompactionPreset.is_builtin.is_(True))
        ).all()
        assert {preset.source_lithology_code for preset in builtin_presets} == lithology_codes

        default_set = session.scalar(
            sa_select(LithologySet).where(LithologySet.is_builtin.is_(True), LithologySet.name == 'Default Lithologies')
        )
        assert default_set is not None
        default_set_count = len(
            session.scalars(sa_select(LithologySetEntry).where(LithologySetEntry.set_id == default_set.id)).all()
        )
        assert default_set_count == 9

        builtin_model = session.scalar(sa_select(CompactionModel).where(CompactionModel.is_builtin.is_(True)))
        assert builtin_model is not None
        model_param_count = len(
            session.scalars(sa_select(CompactionModelParam).where(CompactionModelParam.model_id == builtin_model.id)).all()
        )
        assert model_param_count == 9

        palette = session.scalar(
            sa_select(LithologyPatternPalette).where(
                LithologyPatternPalette.is_builtin.is_(True),
                LithologyPatternPalette.origin == 'equinor',
            )
        )
        assert palette is not None
        pattern_count = len(
            session.scalars(sa_select(LithologyPattern).where(LithologyPattern.palette_id == palette.id)).all()
        )
        assert pattern_count == 74


def test_project_open_self_heals_missing_builtin_reference_data(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'builtin-reference-self-heal')

    manager = api_client.app.state.project_manager
    with manager.get_session() as session:
        session.execute(SeaLevelPoint.__table__.delete())
        session.execute(SeaLevelCurve.__table__.delete())
        session.execute(StratUnit.__table__.delete())
        session.execute(StratChart.__table__.delete())
        session.commit()

    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text

    response = api_client.get('/api/strat-charts')
    assert response.status_code == 200, response.text
    charts = response.json()
    assert any(chart['name'] == 'ICS 2023' and chart['is_builtin'] for chart in charts)

    response = api_client.get('/api/sea-level-curves')
    assert response.status_code == 200, response.text
    curves = response.json()
    assert len([curve for curve in curves if curve['is_builtin']]) == 4
    assert {curve['point_count'] for curve in curves if curve['is_builtin']} == {53}


def test_well_color_defaults_patch_and_backfill_persist(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'well-colors')

    response = api_client.post('/api/projects/wells', json={
        'name': 'Color Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 1000.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']
    assert response.json()['color_hex'].startswith('#')

    response = api_client.get(f'/api/wells/{well_id}')
    assert response.status_code == 200, response.text
    assert response.json()['color_hex'].startswith('#')

    response = api_client.patch(f'/api/wells/{well_id}', json={'color_hex': '#123abc'})
    assert response.status_code == 200, response.text
    assert response.json()['color_hex'] == '#123abc'

    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text

    response = api_client.get(f'/api/wells/{well_id}')
    assert response.status_code == 200, response.text
    assert response.json()['color_hex'] == '#123abc'

    manager = app.state.project_manager
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        assert well is not None
        well.color_hex = None
        session.commit()

    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text

    response = api_client.get(f'/api/wells/{well_id}')
    assert response.status_code == 200, response.text
    assert response.json()['color_hex'].startswith('#')
    assert len(response.json()['color_hex']) == 7


def test_logs_csv_import_supports_comma_and_tab_delimiters(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'logs-csv')
    comma_csv = tmp_path / 'logs_comma.csv'
    comma_csv.write_text(
        'well_name,DEPT,GR,RT\n'
        'CSV Well,100,80,12\n'
        'CSV Well,200,82,13\n'
        'CSV Well,300,85,15\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={'csv_path': str(comma_csv)})
    assert response.status_code == 200, response.text
    payload = response.json()
    well_id = payload['well_id']
    assert payload['curve_count'] == 2

    tab_csv = tmp_path / 'logs_tab.tsv'
    tab_csv.write_text(
        'well_name\tMD\tCALI\n'
        'CSV Well\t100\t8.5\n'
        'CSV Well\t200\t8.6\n'
        'CSV Well\t300\t8.7\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={'csv_path': str(tab_csv), 'well_id': well_id})
    assert response.status_code == 200, response.text
    assert response.json()['curve_count'] == 3

    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/open', json={'path': str(tmp_path / 'logs-csv.subsidence')})
    assert response.status_code == 200, response.text

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    wells = response.json()
    assert len(wells) == 1
    assert wells[0]['well_name'] == 'CSV Well'
    assert [curve['mnemonic'] for curve in wells[0]['curves']] == ['GR', 'RT', 'CALI']


def test_logs_csv_import_uses_unit_registry_for_depth_and_fraction_units(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    project_path = _create_project(api_client, tmp_path, 'csv-unit-registry')
    csv_path = tmp_path / 'logs_units.csv'
    csv_path.write_text(
        'well_name,DEPT[ft],NPHI[%]\n'
        'CSV Unit Well,100,35\n'
        'CSV Unit Well,200,36\n'
        'CSV Unit Well,300,37\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={'csv_path': str(csv_path)})
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        curve = session.scalar(sa_select(CurveMetadata).where(CurveMetadata.mnemonic == 'NPHI'))
        assert curve is not None
        assert curve.unit == 'v/v'
        assert curve.original_unit == '%'
        assert curve.sampling_kind == 'CONSTANT'
        assert curve.nominal_step_m == pytest.approx(0.2)
        frame = pd.read_parquet(project_path / curve.data_uri)

    assert frame['DEPT'].iloc[0] == pytest.approx(0.0)
    assert frame['DEPT'].iloc[-1] == pytest.approx(100.0)
    assert frame['DEPT'].iloc[1] - frame['DEPT'].iloc[0] == pytest.approx(0.2)
    assert frame.loc[frame['DEPT'] < 30.48, 'NPHI'].isna().all()
    valid_nphi = frame.dropna(subset=['NPHI'])
    assert valid_nphi['DEPT'].iloc[-1] <= 91.44
    assert valid_nphi['NPHI'].iloc[-1] == pytest.approx(0.37, abs=1e-3)


def test_logs_csv_reimport_replaces_curve_type_metadata(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    _create_project(api_client, tmp_path, 'logs-curve-type-reimport')
    csv_path = tmp_path / 'logs_curve_type.csv'
    csv_path.write_text(
        'DEPT,GR\n'
        '0,10\n'
        '10,20\n'
        '20,30\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'depth_column': 'DEPT',
        'curve_types': {'GR': 'discrete'},
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    manager = app.state.project_manager
    with manager.get_session() as session:
        curves = list(session.scalars(sa_select(CurveMetadata).where(CurveMetadata.well_id == well_id, CurveMetadata.mnemonic == 'GR')))
        assert [(curve.mnemonic, curve.curve_type) for curve in curves] == [('GR', 'discrete')]

    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'depth_column': 'DEPT',
        'curve_types': {'GR': 'continuous'},
    })
    assert response.status_code == 200, response.text

    with manager.get_session() as session:
        curves = list(session.scalars(sa_select(CurveMetadata).where(CurveMetadata.well_id == well_id, CurveMetadata.mnemonic == 'GR')))
        assert [(curve.mnemonic, curve.curve_type) for curve in curves] == [('GR', 'continuous')]


def test_curve_import_uses_unit_fallback_only_for_unambiguous_units(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    project_path = _create_project(api_client, tmp_path, 'curve-unit-fallback')
    csv_path = tmp_path / 'logs_unit_fallback.csv'
    csv_path.write_text(
        'well_name,DEPT,BULK[kg/m3],MYSTERY[%],RTLIKE[ohm.m]\n'
        'Unit Fallback Well,100,2350,35,12\n'
        'Unit Fallback Well,200,2400,36,13\n'
        'Unit Fallback Well,300,2450,37,14\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={'csv_path': str(csv_path)})
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        curves = {
            curve.mnemonic: curve
            for curve in session.scalars(sa_select(CurveMetadata)).all()
        }

        density = curves['BULK']
        assert density.family_code == 'bulk_density'
        assert density.standard_mnemonic is None
        assert density.unit == 'kg/m3'
        assert density.original_unit == 'kg/m3'
        frame = pd.read_parquet(project_path / density.data_uri)

        percent = curves['MYSTERY']
        assert percent.family_code is None
        assert percent.unit == '%'

        resistivity = curves['RTLIKE']
        assert resistivity.family_code is None
        assert resistivity.unit == 'ohm.m'

    assert frame['DEPT'].iloc[0] == pytest.approx(0.0)
    assert frame['DEPT'].iloc[-1] == pytest.approx(300.0)
    assert frame.loc[frame['DEPT'] < 100.0, 'BULK'].isna().all()
    assert frame.loc[frame['DEPT'] == 100.0, 'BULK'].iloc[0] == pytest.approx(2350.0)
    assert frame.loc[frame['DEPT'] == 200.0, 'BULK'].iloc[0] == pytest.approx(2400.0)
    assert frame.loc[frame['DEPT'] == 300.0, 'BULK'].iloc[0] == pytest.approx(2450.0)


def test_las_import_auto_creates_well_and_survives_reopen(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'las-import')
    las_path = _write_minimal_las(tmp_path / 'minimal.las')

    response = api_client.post('/api/projects/import-las', json={'las_path': str(las_path)})
    assert response.status_code == 200, response.text
    payload = response.json()
    well_id = payload['well_id']
    assert payload['well_name'] == 'LAS Well'
    assert payload['curve_count'] == 2

    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    wells = response.json()
    assert [well['well_id'] for well in wells] == [well_id]
    assert wells[0]['well_name'] == 'LAS Well'
    assert [curve['mnemonic'] for curve in wells[0]['curves']] == ['GR', 'RHOB']


@pytest.mark.parametrize(
    ('endpoint', 'payload_factory', 'expected_data_count'),
    [
        (
            '/api/projects/import-las',
            lambda path: {'las_path': str(_write_minimal_las_without_well_name(path / 'fallback.las'))},
            ('curve_count', 1),
        ),
        (
            '/api/projects/import-logs-csv',
            lambda path: {
                'csv_path': str(path / 'fallback_logs.csv'),
                'depth_column': 'DEPT',
                '_write': (
                    path / 'fallback_logs.csv',
                    'DEPT,GR\n100,80\n200,82\n300,85\n',
                ),
            },
            ('curve_count', 1),
        ),
        (
            '/api/projects/import-tops',
            lambda path: {
                'csv_path': str(path / 'fallback_tops.csv'),
                'depth_ref': 'MD',
                '_write': (
                    path / 'fallback_tops.csv',
                    'top_name,depth_md,strat_age_ma\nTop A,100,10\nTop B,200,20\n',
                ),
            },
            ('formation_count', 2),
        ),
        (
            '/api/projects/import-deviation',
            lambda path: {
                'csv_path': str(path / 'fallback_deviation.csv'),
                '_write': (
                    path / 'fallback_deviation.csv',
                    'md,incl_deg,azim_deg\n0,0,0\n100,1,90\n200,2,95\n',
                ),
            },
            ('mode', 'INCL_AZIM'),
        ),
    ],
)
def test_imports_without_target_or_file_well_name_use_central_fallback_well(
    api_client: TestClient,
    tmp_path: Path,
    endpoint: str,
    payload_factory,
    expected_data_count: tuple[str, object],
) -> None:
    _create_project(api_client, tmp_path, f'fallback-{endpoint.rsplit("/", 1)[-1]}')
    payload = payload_factory(tmp_path)
    write_spec = payload.pop('_write', None)
    if write_spec is not None:
        path, content = write_spec
        path.write_text(content, encoding='utf-8')

    response = api_client.post(endpoint, json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    key, expected_value = expected_data_count
    assert result[key] == expected_value

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    wells = response.json()
    assert len(wells) == 1
    assert wells[0]['well_id'] == result['well_id']
    assert wells[0]['well_name'] == DEFAULT_WELL_NAME


def test_las_import_uses_unit_registry_for_depth_and_curve_units(api_client: TestClient, tmp_path: Path) -> None:
    project_path = _create_project(api_client, tmp_path, 'las-unit-registry')
    las_path = tmp_path / 'units.las'
    las_path.write_text(
        '~Version Information\n'
        ' VERS. 2.0 : CWLS LOG ASCII STANDARD\n'
        ' WRAP. NO  : One line per depth step\n'
        '~Well Information\n'
        ' STRT.FT 100.0 : Start depth\n'
        ' STOP.FT 300.0 : Stop depth\n'
        ' STEP.FT 100.0 : Step\n'
        ' NULL. -999.25 : Null value\n'
        ' WELL. Unit Well : Well name\n'
        '~Curve Information\n'
        ' DEPT.FT : Depth\n'
        ' RHOB.KG/M3 : Bulk density\n'
        '~ASCII\n'
        '100.0 2350.0\n'
        '200.0 2400.0\n'
        '300.0 2450.0\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-las', json={'las_path': str(las_path)})
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        curve = session.scalar(sa_select(CurveMetadata).where(CurveMetadata.mnemonic == 'RHOB'))
        assert curve is not None
        assert curve.unit == 'g/cc'
        assert curve.original_unit == 'KG/M3'
        assert curve.sampling_kind == 'CONSTANT'
        assert curve.nominal_step_m == pytest.approx(0.2)
        frame = pd.read_parquet(project_path / curve.data_uri)

    assert frame['DEPT'].iloc[0] == pytest.approx(0.0)
    assert frame['DEPT'].iloc[-1] == pytest.approx(91.44)
    assert frame['DEPT'].iloc[1] - frame['DEPT'].iloc[0] == pytest.approx(0.2)
    assert frame.loc[frame['DEPT'] < 30.48, 'RHOB'].isna().all()
    assert frame.loc[frame['DEPT'] == 91.44, 'RHOB'].iloc[0] == pytest.approx(2.45)


def test_tops_deviation_and_strat_chart_workflows(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'geology')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Geology Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    tops_csv = tmp_path / 'tops.csv'
    tops_csv.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Geology Well,Top A,100,10,#aaaaaa\n'
        'Geology Well,Top B,300,20,#bbbbbb\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-tops', json={'csv_path': str(tops_csv), 'well_id': well_id, 'depth_ref': 'MD'})
    assert response.status_code == 200, response.text
    assert response.json()['formation_count'] == 2

    deviation_csv = tmp_path / 'deviation.csv'
    deviation_csv.write_text(
        'well_name,md,incl_deg,azim_deg\n'
        'Geology Well,0,0,0\n'
        'Geology Well,100,1,90\n'
        'Geology Well,300,2,95\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-deviation', json={'csv_path': str(deviation_csv), 'well_id': well_id})
    assert response.status_code == 200, response.text
    assert response.json()['mode'] == 'INCL_AZIM'

    chart_csv = tmp_path / 'custom_chart.csv'
    chart_csv.write_text(
        'unit_id,parent_unit_id,unit_name,rank_name,start_age_ma,end_age_ma,html_rgb_hash\n'
        '1,,System A,system,50,0,#123456\n'
        '2,1,Stage A,stage,25,0,#abcdef\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/strat-charts/import', json={
        'csv_path': str(chart_csv),
        'column_map': {
            'unit_id': 'unit_id',
            'parent_unit_id': 'parent_unit_id',
            'unit_name': 'unit_name',
            'rank_name': 'rank_name',
            'start_age_ma': 'start_age_ma',
            'end_age_ma': 'end_age_ma',
            'color': 'html_rgb_hash',
        },
    })
    assert response.status_code == 200, response.text
    assert response.json()['units_imported'] == 2

    response = api_client.get('/api/strat-charts')
    assert response.status_code == 200, response.text
    custom_chart = next(chart for chart in response.json() if chart['name'] == 'custom_chart')
    assert custom_chart['unit_count'] == 2

    response = api_client.patch(f"/api/strat-charts/{custom_chart['id']}/activate")
    assert response.status_code == 200, response.text
    assert response.json()['is_active'] is True

    response = api_client.delete(f"/api/strat-charts/{custom_chart['id']}")
    assert response.status_code == 204, response.text

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = response.json()[0]
    assert len(well['formations']) == 2
    assert well['deviation']['mode'] == 'INCL_AZIM'


def test_strat_chart_import_requires_mapping_and_validates_parent_age_interval(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'strat-chart-mapping')

    chart_csv = tmp_path / 'mapped_chart.csv'
    chart_csv.write_text(
        'id,parent,name,code,rank,base,top,color\n'
        '1,,System A,SA,system,50,0,#123456\n'
        '2,1,Stage A,Sta,stage,25,5,#abcdef\n',
        encoding='utf-8',
    )
    column_map = {
        'unit_id': 'id',
        'parent_unit_id': 'parent',
        'unit_name': 'name',
        'unit_code': 'code',
        'rank_name': 'rank',
        'start_age_ma': 'base',
        'end_age_ma': 'top',
        'color': 'color',
    }

    response = api_client.post('/api/strat-charts/import', json={'csv_path': str(chart_csv), 'column_map': column_map})
    assert response.status_code == 200, response.text
    assert response.json()['units_imported'] == 2

    response = api_client.get('/api/strat-charts')
    assert response.status_code == 200, response.text
    chart = next(chart for chart in response.json() if chart['name'] == 'mapped_chart')
    response = api_client.get('/api/strat-units', params={'chart_id': chart['id'], 'limit': '1000'})
    assert response.status_code == 200, response.text
    units = {unit['name']: unit for unit in response.json()}
    assert units['System A']['parent_id'] is None
    assert units['System A']['chart_id'] == chart['id']
    assert units['System A']['unit_code'] == 'SA'
    assert units['Stage A']['parent_id'] == units['System A']['id']
    assert units['Stage A']['chart_id'] == chart['id']
    assert units['Stage A']['unit_code'] == 'Sta'

    invalid_csv = tmp_path / 'invalid_chart.csv'
    invalid_csv.write_text(
        'id,parent,name,rank,base,top,color\n'
        '1,,System A,system,50,0,#123456\n'
        '2,1,Stage Outside,stage,60,5,#abcdef\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/strat-charts/import', json={'csv_path': str(invalid_csv), 'column_map': column_map})
    assert response.status_code == 422, response.text
    assert 'line 3' in response.json()['detail']
    assert 'outside parent' in response.json()['detail']


def test_strat_chart_import_validates_rank_hierarchy(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'strat-chart-rank-validation')

    column_map = {
        'unit_id': 'id',
        'parent_unit_id': 'parent',
        'unit_name': 'name',
        'rank_name': 'rank',
        'start_age_ma': 'base',
        'end_age_ma': 'top',
    }

    invalid_rank_order_csv = tmp_path / 'invalid_rank_order.csv'
    invalid_rank_order_csv.write_text(
        'id,parent,name,rank,base,top\n'
        '1,,Stage Parent,stage,50,0\n'
        '2,1,System Child,system,25,5\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/strat-charts/import', json={'csv_path': str(invalid_rank_order_csv), 'column_map': column_map})
    assert response.status_code == 422, response.text
    assert 'line 3' in response.json()['detail']
    assert 'system cannot be child of stage' in response.json()['detail'].lower()

    unknown_rank_csv = tmp_path / 'unknown_rank.csv'
    unknown_rank_csv.write_text(
        'id,parent,name,rank,base,top\n'
        '1,,Custom Unit,custom_rank,50,0\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/strat-charts/import', json={'csv_path': str(unknown_rank_csv), 'column_map': column_map})
    assert response.status_code == 422, response.text
    assert 'line 2' in response.json()['detail']
    assert 'Unknown rank "custom_rank"' in response.json()['detail']


def test_strat_chart_import_accepts_rgb_and_cmyk_color_columns(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'strat-chart-colors')

    rgb_csv = tmp_path / 'rgb_chart.csv'
    rgb_csv.write_text(
        'id,name,base,top,rgb\n'
        '1,RGB Unit,10,0,255/128/0\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/strat-charts/import', json={
        'csv_path': str(rgb_csv),
        'column_map': {
            'unit_id': 'id',
            'unit_name': 'name',
            'start_age_ma': 'base',
            'end_age_ma': 'top',
            'color': 'rgb',
        },
    })
    assert response.status_code == 200, response.text

    cmyk_csv = tmp_path / 'cmyk_chart.csv'
    cmyk_csv.write_text(
        'id,name,base,top,cmyk\n'
        '1,CMYK Unit,10,0,0/100/100/0\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/strat-charts/import', json={
        'csv_path': str(cmyk_csv),
        'column_map': {
            'unit_id': 'id',
            'unit_name': 'name',
            'start_age_ma': 'base',
            'end_age_ma': 'top',
            'color': 'cmyk',
        },
    })
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        rgb_unit = session.scalar(sa_select(StratUnit).where(StratUnit.name == 'RGB Unit'))
        cmyk_unit = session.scalar(sa_select(StratUnit).where(StratUnit.name == 'CMYK Unit'))
        assert rgb_unit is not None
        assert cmyk_unit is not None
        assert rgb_unit.color_hex == '#ff8000'
        assert cmyk_unit.color_hex == '#ff0000'


def test_builtin_ics_chart_cannot_be_deleted(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'builtin-chart')

    response = api_client.get('/api/strat-charts')
    assert response.status_code == 200, response.text
    builtin_chart = next(chart for chart in response.json() if chart['is_builtin'])

    response = api_client.delete(f"/api/strat-charts/{builtin_chart['id']}")
    assert response.status_code == 403, response.text

    response = api_client.get('/api/strat-charts')
    assert response.status_code == 200, response.text
    assert any(chart['id'] == builtin_chart['id'] for chart in response.json())


def test_compaction_presets_seed_and_allow_user_duplicates(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'compaction-presets')

    response = api_client.get('/api/compaction-presets')
    assert response.status_code == 200, response.text
    presets = response.json()
    assert presets
    assert all('id' in item for item in presets)
    builtin = next(item for item in presets if item['is_builtin'])
    assert builtin['origin'] == 'builtin'
    assert builtin['source_lithology_code']

    response = api_client.get(f"/api/compaction-presets/{builtin['id']}")
    assert response.status_code == 200, response.text
    builtin_detail = response.json()
    assert builtin_detail['name']
    assert '(default)' not in builtin_detail['name']

    response = api_client.patch(f"/api/compaction-presets/{builtin['id']}", json={'name': 'Should fail'})
    assert response.status_code == 403, response.text

    response = api_client.post('/api/compaction-presets', json={'clone_from_id': builtin['id']})
    assert response.status_code == 201, response.text
    user_copy = response.json()
    assert user_copy['name'] == builtin_detail['name']
    assert user_copy['origin'] == 'user'
    assert user_copy['is_builtin'] is False

    response = api_client.post('/api/compaction-presets', json={
        'name': 'Custom Coal',
        'density': 1800.0,
        'porosity_surface': 0.62,
        'compaction_coeff': 0.41,
    })
    assert response.status_code == 201, response.text
    custom = response.json()
    assert custom['name'] == 'Custom Coal'

    response = api_client.patch(f"/api/compaction-presets/{custom['id']}", json={
        'name': 'Custom Coal',
        'description': 'Editable user preset',
        'density': 1810.0,
    })
    assert response.status_code == 200, response.text
    assert response.json()['density'] == pytest.approx(1810.0)
    assert response.json()['description'] == 'Editable user preset'

    response = api_client.delete(f"/api/compaction-presets/{builtin['id']}")
    assert response.status_code == 403, response.text

    response = api_client.delete(f"/api/compaction-presets/{custom['id']}")
    assert response.status_code == 204, response.text

    response = api_client.get('/api/compaction-presets')
    assert response.status_code == 200, response.text
    remaining_ids = {item['id'] for item in response.json()}
    assert builtin['id'] in remaining_ids
    assert user_copy['id'] in remaining_ids
    assert custom['id'] not in remaining_ids


def test_compaction_inputs_are_normalized_to_engine_units(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'compaction-unit-normalization')

    response = api_client.post('/api/compaction-presets', json={
        'name': 'Metric API Input',
        'density': 2.65,
        'density_unit': 'g/cc',
        'porosity_surface': 35.0,
        'porosity_surface_unit': 'percent',
        'compaction_coeff': 0.00051,
        'compaction_coeff_unit': 'm^-1',
    })
    assert response.status_code == 201, response.text
    preset = response.json()
    assert preset['density'] == pytest.approx(2650.0)
    assert preset['porosity_surface'] == pytest.approx(0.35)
    assert preset['compaction_coeff'] == pytest.approx(0.51)

    response = api_client.patch(f"/api/compaction-presets/{preset['id']}", json={
        'density': 2.72,
        'density_unit': 'g/cm3',
        'porosity_surface': 40.0,
        'porosity_surface_unit': '%',
    })
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated['density'] == pytest.approx(2720.0)
    assert updated['porosity_surface'] == pytest.approx(0.40)
    assert updated['compaction_coeff'] == pytest.approx(0.51)

    response = api_client.patch(f"/api/compaction-presets/{preset['id']}", json={'density_unit': 'g/cc'})
    assert response.status_code == 400, response.text


def test_compaction_model_params_are_normalized_to_engine_units(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'compaction-model-unit-normalization')

    response = api_client.post('/api/compaction-models', json={'name': 'User model'})
    assert response.status_code == 201, response.text
    model = response.json()

    response = api_client.patch(
        f"/api/compaction-models/{model['id']}/params/shale",
        json={
            'density': 2.7,
            'density_unit': 'g/cc',
            'porosity_surface': 38.0,
            'porosity_surface_unit': '%',
            'compaction_coeff': 0.00049,
            'compaction_coeff_unit': '1/m',
        },
    )
    assert response.status_code == 200, response.text
    param = response.json()
    assert param['density'] == pytest.approx(2700.0)
    assert param['porosity_surface'] == pytest.approx(0.38)
    assert param['compaction_coeff'] == pytest.approx(0.49)


def test_default_lithology_set_is_seeded(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'lithology-sets')

    response = api_client.get('/api/lithology-sets')
    assert response.status_code == 200, response.text
    sets = response.json()
    assert sets
    default_set = next(item for item in sets if item['is_builtin'])
    assert default_set['name'] == 'Default Lithologies'
    assert default_set['entry_count'] > 0

    response = api_client.get(f"/api/lithology-sets/{default_set['id']}")
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail['name'] == 'Default Lithologies'
    assert detail['entries']
    first_entry = detail['entries'][0]
    assert 'compaction_preset_label' in first_entry
    assert 'density' in first_entry


def test_lithology_sets_self_heal_for_open_project(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'lithology-self-heal')

    manager = api_client.app.state.project_manager
    with manager.get_session() as session:
        session.execute(LithologySetEntry.__table__.delete())
        session.execute(LithologySet.__table__.delete())
        session.commit()

    response = api_client.get('/api/lithology-sets')
    assert response.status_code == 200, response.text
    sets = response.json()
    assert any(item['name'] == 'Default Lithologies' for item in sets)


def test_lithology_set_user_crud(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'lithology-set-crud')

    response = api_client.get('/api/lithology-sets')
    assert response.status_code == 200, response.text
    default_set = next(item for item in response.json() if item['is_builtin'])

    response = api_client.post('/api/lithology-sets', json={'name': 'Project Lithologies'})
    assert response.status_code == 201, response.text
    created = response.json()
    assert created['name'] == 'Project Lithologies'
    assert created['is_builtin'] is False

    response = api_client.patch(f"/api/lithology-sets/{default_set['id']}", json={'name': 'Nope'})
    assert response.status_code == 403, response.text

    response = api_client.post(f"/api/lithology-sets/{default_set['id']}/copy")
    assert response.status_code == 201, response.text
    copied = response.json()
    assert copied['is_builtin'] is False
    assert copied['entry_count'] == default_set['entry_count']

    response = api_client.patch(f"/api/lithology-sets/{created['id']}", json={'name': 'Edited Lithologies'})
    assert response.status_code == 200, response.text
    assert response.json()['name'] == 'Edited Lithologies'

    response = api_client.post(f"/api/lithology-sets/{created['id']}/entries", json={})
    assert response.status_code == 201, response.text
    entry = response.json()
    assert entry['lithology_code'].startswith('LITH_')
    assert entry['display_name'] == entry['lithology_code']
    assert entry['density'] is None

    response = api_client.patch(
        f"/api/lithology-sets/{created['id']}/entries/{entry['id']}",
        json={
            'lithology_code': 'CLAYX',
            'display_name': 'Clay X',
            'color_hex': '#123456',
            'pattern_id': 'clay',
        },
    )
    assert response.status_code == 200, response.text
    edited_entry = response.json()
    assert edited_entry['lithology_code'] == 'CLAYX'
    assert edited_entry['display_name'] == 'Clay X'
    assert edited_entry['color_hex'] == '#123456'
    assert edited_entry['pattern_id'] == 'clay'

    response = api_client.get(f"/api/lithology-sets/{created['id']}")
    assert response.status_code == 200, response.text
    assert any(row['id'] == entry['id'] for row in response.json()['entries'])

    response = api_client.delete(f"/api/lithology-sets/{created['id']}")
    assert response.status_code == 204, response.text

    response = api_client.get('/api/lithology-sets')
    assert response.status_code == 200, response.text
    remaining_ids = {item['id'] for item in response.json()}
    assert default_set['id'] in remaining_ids
    assert copied['id'] in remaining_ids
    assert created['id'] not in remaining_ids


def test_lithology_pattern_palettes_seeded(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'pattern-palettes')

    response = api_client.get('/api/lithology-pattern-palettes')
    assert response.status_code == 200, response.text
    palettes = response.json()
    builtin = next(item for item in palettes if item['is_builtin'])
    assert builtin['name'] == 'Equinor Lithology Patterns'
    assert builtin['origin'] == 'equinor'
    assert builtin['license_name'] == 'MIT'
    assert builtin['entry_count'] == 74

    response = api_client.get(f"/api/lithology-pattern-palettes/{builtin['id']}")
    assert response.status_code == 200, response.text
    detail = response.json()
    codes = {row['code'] for row in detail['patterns']}
    assert {'sandstone', 'shale', 'limestone', 'dolomite', 'conglomerate'} <= codes
    assert '30017' in codes
    sandstone = next(row for row in detail['patterns'] if row['code'] == 'sandstone')
    assert sandstone['svg_content'].startswith('<svg')
    assert sandstone['source_code'] == '30000'
    assert sandstone['tile_width'] == 64

    response = api_client.patch(f"/api/lithology-pattern-palettes/{builtin['id']}", json={'name': 'Nope'})
    assert response.status_code == 403, response.text


def test_lithology_pattern_palettes_self_heal_for_open_project(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'pattern-self-heal')

    manager = api_client.app.state.project_manager
    with manager.get_session() as session:
        session.execute(LithologyPattern.__table__.delete())
        session.execute(LithologyPatternPalette.__table__.delete())
        session.commit()

    response = api_client.get('/api/lithology-pattern-palettes')
    assert response.status_code == 200, response.text
    assert any(item['name'] == 'Equinor Lithology Patterns' for item in response.json())


def test_lithology_pattern_palette_user_crud_and_svg_validation(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'pattern-crud')

    response = api_client.get('/api/lithology-pattern-palettes')
    assert response.status_code == 200, response.text
    builtin = next(item for item in response.json() if item['is_builtin'])

    response = api_client.post('/api/lithology-pattern-palettes', json={'name': 'Project Patterns'})
    assert response.status_code == 201, response.text
    palette = response.json()
    assert palette['name'] == 'Project Patterns'
    assert palette['is_builtin'] is False

    svg_path = tmp_path / 'custom.svg'
    svg_path.write_text(
        '<svg viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h8v8H0z"/></svg>',
        encoding='utf-8',
    )
    response = api_client.post(
        f"/api/lithology-pattern-palettes/{palette['id']}/patterns/import",
        json={'path': str(svg_path), 'code': 'custom_dot', 'display_name': 'Custom Dot'},
    )
    assert response.status_code == 201, response.text
    pattern = response.json()
    assert pattern['code'] == 'custom_dot'
    assert pattern['tile_width'] == 8

    bad_svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    response = api_client.post(
        f"/api/lithology-pattern-palettes/{palette['id']}/patterns",
        json={'code': 'bad', 'display_name': 'Bad', 'svg_content': bad_svg},
    )
    assert response.status_code == 400, response.text

    response = api_client.post('/api/lithology-pattern-palettes', json={
        'name': 'Equinor Copy',
        'clone_from_id': builtin['id'],
    })
    assert response.status_code == 201, response.text
    copied = response.json()
    assert copied['is_builtin'] is False
    assert copied['entry_count'] == builtin['entry_count']

    response = api_client.post('/api/lithology-sets', json={'name': 'Pattern Linked Lithologies'})
    assert response.status_code == 201, response.text
    lithology_set = response.json()
    response = api_client.post(
        f"/api/lithology-sets/{lithology_set['id']}/entries",
        json={'lithology_code': 'CUSTOM', 'pattern_id': 'custom_dot'},
    )
    assert response.status_code == 201, response.text

    response = api_client.delete(
        f"/api/lithology-pattern-palettes/{palette['id']}/patterns/{pattern['id']}"
    )
    assert response.status_code == 409, response.text


def test_subsidence_rest_and_websocket_recalculation(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'subsidence-calc')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Subsidence Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 900.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    for payload in [
        {'name': 'Top A', 'depth_md': 100.0, 'age_ma': 10.0, 'color': '#aaaaaa'},
        {'name': 'Top B', 'depth_md': 400.0, 'age_ma': 30.0, 'color': '#bbbbbb'},
        {'name': 'Top C', 'depth_md': 700.0, 'age_ma': 60.0, 'color': '#cccccc'},
    ]:
        response = api_client.post(f'/api/wells/{well_id}/formations', json=payload)
        assert response.status_code == 201, response.text

    response = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert response.status_code == 200, response.text
    rest_results = response.json()
    assert rest_results
    assert rest_results[0]['burial_path']

    with api_client.websocket_connect('/api/ws/recalculate') as websocket:
        websocket.send_json({'well_id': well_id, 'water_depth_m': 0.0})
        computing = websocket.receive_json()
        assert computing['status'] == 'computing'
        complete = websocket.receive_json()
        assert complete['status'] == 'complete'
        assert complete['results']

    response = api_client.get('/api/subsidence/stored-results')
    assert response.status_code == 200, response.text
    stored = response.json()
    assert [item['well_id'] for item in stored] == [well_id]


def test_visual_config_persists_project_and_well_scopes(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'visual-config')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Config Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    response = api_client.patch('/api/projects/visual-config', json={
        'scope': 'project',
        'scope_id': None,
        'config': {'depthPerPixel': 2.5, 'subsidenceWidth': 320},
    })
    assert response.status_code == 200, response.text
    response = api_client.patch('/api/projects/visual-config', json={
        'scope': 'well',
        'scope_id': well_id,
        'config': {'trackOrder': ['depth', 'formations', 'track-1']},
    })
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/save')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/close')
    assert response.status_code == 200, response.text
    response = api_client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text

    response = api_client.get('/api/projects/visual-config?scope=project')
    assert response.status_code == 200, response.text
    assert response.json()['config']['depthPerPixel'] == 2.5
    response = api_client.get(f'/api/projects/visual-config?scope=well&scope_id={well_id}')
    assert response.status_code == 200, response.text
    assert response.json()['config']['trackOrder'] == ['depth', 'formations', 'track-1']


def test_undo_redo_create_well_and_delete_well(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'undo-delete')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Undo Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    response = api_client.post('/api/projects/undo')
    assert response.status_code == 200, response.text
    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    assert response.json() == []

    response = api_client.post('/api/projects/redo')
    assert response.status_code == 200, response.text
    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    assert [well['well_id'] for well in response.json()] == [well_id]

    response = api_client.delete(f'/api/projects/wells/{well_id}')
    assert response.status_code == 200, response.text
    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_delete_well_removes_stored_calculation_results(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'delete-well-results')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Result Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    result_uri = f'results/{well_id}-subsidence.json'
    result_path = project_path / result_uri
    result_path.write_text('{"series":[]}', encoding='utf-8')

    manager = api_client.app.state.project_manager
    with manager.get_session() as session:
        session.add(CalculationResult(
            well_id=well_id,
            kind='subsidence',
            algorithm='airy_backstrip',
            params_json='{}',
            inputs_hash='test-hash',
            data_uri=result_uri,
            is_stale=False,
        ))
        session.add(VisualConfig(scope='well', scope_id=well_id, config=json.dumps({'tracks': ['track-1']})))
        session.commit()

    response = api_client.delete(f'/api/projects/wells/{well_id}')
    assert response.status_code == 200, response.text

    with manager.get_session() as session:
        assert session.get(WellModel, well_id) is None
        stored_results = session.scalars(
            sa_select(CalculationResult).where(CalculationResult.well_id == well_id)
        ).all()
        assert stored_results == []
        assert session.scalar(
            sa_select(VisualConfig).where(VisualConfig.scope == 'well', VisualConfig.scope_id == well_id)
        ) is None
    assert not result_path.exists()

    response = api_client.post('/api/projects/undo')
    assert response.status_code == 200, response.text
    with manager.get_session() as session:
        assert session.get(WellModel, well_id) is not None
        restored_results = session.scalars(
            sa_select(CalculationResult).where(CalculationResult.well_id == well_id)
        ).all()
        assert len(restored_results) == 1
        assert restored_results[0].data_uri == result_uri
        restored_visual = session.scalar(
            sa_select(VisualConfig).where(VisualConfig.scope == 'well', VisualConfig.scope_id == well_id)
        )
        assert restored_visual is not None
        assert json.loads(restored_visual.config)['tracks'] == ['track-1']
    assert result_path.exists()

    response = api_client.post('/api/projects/redo')
    assert response.status_code == 200, response.text
    with manager.get_session() as session:
        assert session.get(WellModel, well_id) is None
        assert session.scalars(
            sa_select(CalculationResult).where(CalculationResult.well_id == well_id)
        ).all() == []
        assert session.scalar(
            sa_select(VisualConfig).where(VisualConfig.scope == 'well', VisualConfig.scope_id == well_id)
        ) is None
    assert not result_path.exists()


def test_delete_single_curve_removes_only_that_parquet_column(api_client: TestClient, tmp_path: Path):
    project_path = _create_project(api_client, tmp_path, 'delete-single-curve-column')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Curve Delete Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 200.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'logs.csv'
    csv_path.write_text(
        'DEPT,GR,RHOB\n'
        '0,20,2.1\n'
        '100,40,2.2\n'
        '200,60,2.3\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text

    manager = api_client.app.state.project_manager
    with manager.get_session() as session:
        rows = session.scalars(sa_select(CurveMetadata).where(CurveMetadata.well_id == well_id)).all()
        assert {row.mnemonic for row in rows} == {'GR', 'RHOB'}
        parquet_path = project_path / rows[0].data_uri
        assert parquet_path.exists()
        assert {'DEPT', 'GR', 'RHOB'}.issubset(pd.read_parquet(parquet_path).columns)

    response = api_client.delete(f'/api/wells/{well_id}/curves/GR')
    assert response.status_code == 204, response.text

    with manager.get_session() as session:
        rows = session.scalars(sa_select(CurveMetadata).where(CurveMetadata.well_id == well_id)).all()
        assert [row.mnemonic for row in rows] == ['RHOB']
        parquet_path = project_path / rows[0].data_uri
        frame = pd.read_parquet(parquet_path)
        assert 'DEPT' in frame.columns
        assert 'RHOB' in frame.columns
        assert 'GR' not in frame.columns

    response = api_client.delete(f'/api/wells/{well_id}/curves/RHOB')
    assert response.status_code == 204, response.text
    assert not parquet_path.exists()


def test_checkpoint_create_restore_delete(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'checkpoints')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Checkpoint A',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    first_well_id = response.json()['well_id']

    response = api_client.post('/api/projects/checkpoints', json={
        'name': 'before-second-well',
        'description': 'Checkpoint before adding the second well',
    })
    assert response.status_code == 200, response.text
    checkpoint_payload = response.json()
    checkpoint_id = checkpoint_payload['id']
    assert checkpoint_payload['description'] == 'Checkpoint before adding the second well'
    assert checkpoint_payload['statistics']['project_name'] == 'checkpoints'
    assert checkpoint_payload['statistics']['well_count'] == 1
    assert checkpoint_payload['statistics']['well_names'] == ['Checkpoint A']

    response = api_client.post('/api/projects/wells', json={
        'name': 'Checkpoint B',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 600.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    assert len(response.json()) == 2

    response = api_client.post(f'/api/projects/checkpoints/{checkpoint_id}/restore')
    assert response.status_code == 200, response.text
    before_restore_checkpoint_id = response.json()['id']
    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    wells = response.json()
    assert [well['well_id'] for well in wells] == [first_well_id]
    assert wells[0]['well_name'] == 'Checkpoint A'

    response = api_client.delete(f'/api/projects/checkpoints/{before_restore_checkpoint_id}')
    assert response.status_code == 200, response.text
    response = api_client.get('/api/projects/checkpoints')
    assert response.status_code == 200, response.text
    checkpoints = response.json()
    assert all(item['id'] != before_restore_checkpoint_id for item in checkpoints)
    original = next(item for item in checkpoints if item['id'] == checkpoint_id)
    assert original['description'] == 'Checkpoint before adding the second well'
    assert original['statistics']['well_count'] == 1


def test_measurement_units_seeded_on_project_create(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'measurement-units')

    manager = app.state.project_manager
    with manager.get_session() as session:
        dimensions = {
            row.code: row
            for row in session.scalars(sa_select(UnitDimension)).all()
        }
        units = {
            row.code: row
            for row in session.scalars(sa_select(MeasurementUnit)).all()
        }
        aliases = session.scalars(sa_select(MeasurementUnitAlias)).all()

        assert dimensions['depth'].engine_unit_code == 'depth_m'
        assert dimensions['density'].engine_unit_code == 'density_kg_m3'
        assert dimensions['fraction'].engine_unit_code == 'fraction_vv'
        assert dimensions['compaction_coeff'].engine_unit_code == 'compaction_km_inv'

        assert units['depth_ft'].to_engine_factor == pytest.approx(0.3048)
        assert units['density_g_cc'].to_engine_factor == pytest.approx(1000.0)
        assert units['fraction_percent'].to_engine_factor == pytest.approx(0.01)
        assert units['compaction_m_inv'].to_engine_factor == pytest.approx(1000.0)
        assert len(aliases) >= len(units)


def test_unit_registry_resolves_by_dimension_and_converts_to_engine(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    _create_project(api_client, tmp_path, 'unit-registry')

    manager = app.state.project_manager
    with manager.get_session() as session:
        assert resolve_unit(session, 'm') is None

        depth_ft = resolve_unit(session, 'FT', 'depth')
        depth_m = resolve_unit(session, 'm', 'depth')
        density_g_cc = resolve_unit(session, 'g/cm3', 'density')
        fraction_percent = resolve_unit(session, '%', 'fraction')
        compaction_m_inv = resolve_unit(session, '1/m', 'compaction_coeff')

        assert depth_ft is not None
        assert depth_m is not None
        assert density_g_cc is not None
        assert fraction_percent is not None
        assert compaction_m_inv is not None

        assert convert_values_to_engine([10.0], depth_ft) == pytest.approx([3.048])
        assert convert_values([3.048], depth_m, depth_ft) == pytest.approx([10.0])
        assert convert_values_to_engine([2.65], density_g_cc) == pytest.approx([2650.0])
        assert convert_values_to_engine([35.0], fraction_percent) == pytest.approx([0.35])
        assert convert_values_to_engine([0.00051], compaction_m_inv) == pytest.approx([0.51])


def test_measurement_unit_read_api(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'unit-api')

    response = api_client.get('/api/unit-dimensions')
    assert response.status_code == 200, response.text
    dimensions = response.json()
    density_dimension = next(item for item in dimensions if item['code'] == 'density')
    assert density_dimension['engine_unit_code'] == 'density_kg_m3'
    assert density_dimension['unit_count'] >= 2
    assert density_dimension['alias_count'] >= 2

    response = api_client.get('/api/unit-dimensions/density')
    assert response.status_code == 200, response.text
    density_detail = response.json()
    unit_codes = {unit['code'] for unit in density_detail['units']}
    assert {'density_kg_m3', 'density_g_cc'} <= unit_codes
    g_cc = next(unit for unit in density_detail['units'] if unit['code'] == 'density_g_cc')
    assert g_cc['to_engine_factor'] == pytest.approx(1000.0)
    assert any(alias['normalized_alias'] == 'g/cm3' for alias in g_cc['aliases'])

    response = api_client.get('/api/measurement-units?dimension_code=fraction')
    assert response.status_code == 200, response.text
    fraction_units = response.json()
    assert {unit['code'] for unit in fraction_units} == {'fraction_vv', 'fraction_percent'}

    response = api_client.get('/api/measurement-unit-aliases?unit_code=depth_ft')
    assert response.status_code == 200, response.text
    aliases = response.json()
    assert {alias['normalized_alias'] for alias in aliases} >= {'ft', 'foot', 'feet'}

    response = api_client.get('/api/unit-dimensions/nope')
    assert response.status_code == 404, response.text


def test_mnemonic_sets_seeded_on_project_create(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path)

    response = api_client.get('/api/mnemonic-sets')
    assert response.status_code == 200, response.text
    sets = response.json()

    builtin = [s for s in sets if s['is_builtin']]
    assert len(builtin) == 1
    assert builtin[0]['name'] == 'Default Mnemonics'
    assert builtin[0]['entry_count'] > 0

    set_id = builtin[0]['id']
    response = api_client.get(f'/api/mnemonic-sets/{set_id}')
    assert response.status_code == 200, response.text
    detail = response.json()
    assert detail['id'] == set_id
    assert len(detail['entries']) == builtin[0]['entry_count']

    entry = detail['entries'][0]
    assert 'pattern' in entry
    assert 'family_code' in entry
    assert 'is_active' in entry


def test_mnemonic_set_seed_is_idempotent(api_client: TestClient, tmp_path: Path) -> None:
    project_path = _create_project(api_client, tmp_path)

    api_client.post('/api/projects/close')
    api_client.post('/api/projects/open', json={'path': str(project_path)})

    response = api_client.get('/api/mnemonic-sets')
    sets = response.json()
    builtin = [s for s in sets if s['is_builtin']]
    assert len(builtin) == 1

    manager = app.state.project_manager
    with manager.get_session() as session:
        set_count = len(session.scalars(sa_select(CurveMnemonicSet).where(CurveMnemonicSet.is_builtin.is_(True))).all())
        assert set_count == 1
        entry_count_first = builtin[0]['entry_count']
        actual_count = len(session.scalars(sa_select(CurveMnemonicEntry)).all())
        assert actual_count == entry_count_first


def test_mnemonic_set_user_crud(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'mnemonic-set-crud')

    response = api_client.get('/api/mnemonic-sets')
    assert response.status_code == 200, response.text
    default_set = next(item for item in response.json() if item['is_builtin'])

    response = api_client.post('/api/mnemonic-sets', json={'name': 'Project Mnemonics'})
    assert response.status_code == 201, response.text
    created = response.json()
    assert created['name'] == 'Project Mnemonics'
    assert created['is_builtin'] is False
    assert created['entry_count'] == 0

    response = api_client.patch(f"/api/mnemonic-sets/{default_set['id']}", json={'name': 'Nope'})
    assert response.status_code == 403, response.text

    response = api_client.delete(f"/api/mnemonic-sets/{default_set['id']}")
    assert response.status_code == 403, response.text

    response = api_client.post(f"/api/mnemonic-sets/{default_set['id']}/copy")
    assert response.status_code == 201, response.text
    copied = response.json()
    assert copied['name'] == 'Default Mnemonics Copy'
    assert copied['is_builtin'] is False
    assert copied['entry_count'] == default_set['entry_count']

    response = api_client.get(f"/api/mnemonic-sets/{copied['id']}")
    assert response.status_code == 200, response.text
    copied_detail = response.json()
    assert len(copied_detail['entries']) == default_set['entry_count']

    response = api_client.patch(f"/api/mnemonic-sets/{created['id']}", json={'name': 'Edited Mnemonics'})
    assert response.status_code == 200, response.text
    assert response.json()['name'] == 'Edited Mnemonics'

    response = api_client.post(f"/api/mnemonic-sets/{default_set['id']}/entries", json={'pattern': 'NOPE'})
    assert response.status_code == 403, response.text

    response = api_client.post(f"/api/mnemonic-sets/{created['id']}/entries", json={'pattern': '  '})
    assert response.status_code == 400, response.text

    response = api_client.post(
        f"/api/mnemonic-sets/{created['id']}/entries",
        json={'pattern': '[', 'is_regex': True},
    )
    assert response.status_code == 400, response.text

    response = api_client.post(
        f"/api/mnemonic-sets/{created['id']}/entries",
        json={
            'pattern': 'CALX',
            'priority': 50,
            'family_code': 'caliper',
            'canonical_mnemonic': 'CALI',
            'canonical_unit': 'in',
        },
    )
    assert response.status_code == 201, response.text
    entry = response.json()
    assert entry['pattern'] == 'CALX'
    assert entry['family_code'] == 'caliper'

    response = api_client.patch(
        f"/api/mnemonic-sets/{created['id']}/entries/{entry['id']}",
        json={'pattern': 'CAL.*', 'is_regex': True, 'is_active': False},
    )
    assert response.status_code == 200, response.text
    edited_entry = response.json()
    assert edited_entry['pattern'] == 'CAL.*'
    assert edited_entry['is_regex'] is True
    assert edited_entry['is_active'] is False

    response = api_client.patch(
        f"/api/mnemonic-sets/{created['id']}/entries/{entry['id']}",
        json={'pattern': '[', 'is_regex': True},
    )
    assert response.status_code == 400, response.text

    response = api_client.delete(f"/api/mnemonic-sets/{created['id']}/entries/{entry['id']}")
    assert response.status_code == 204, response.text

    response = api_client.delete(f"/api/mnemonic-sets/{created['id']}")
    assert response.status_code == 204, response.text

    response = api_client.get('/api/mnemonic-sets')
    assert response.status_code == 200, response.text
    remaining_ids = {item['id'] for item in response.json()}
    assert default_set['id'] in remaining_ids
    assert copied['id'] in remaining_ids
    assert created['id'] not in remaining_ids


def test_mnemonic_resolver_prefers_user_set_over_builtin(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'mnemonic-override')

    response = api_client.post('/api/mnemonic-sets', json={'name': 'Project Mnemonics'})
    assert response.status_code == 201, response.text
    user_set = response.json()

    response = api_client.post(
        f"/api/mnemonic-sets/{user_set['id']}/entries",
        json={
            'pattern': 'GR',
            'priority': 1,
            'family_code': 'caliper',
            'canonical_mnemonic': 'CALI',
            'canonical_unit': 'in',
        },
    )
    assert response.status_code == 201, response.text

    csv_path = tmp_path / 'logs_override.csv'
    csv_path.write_text(
        'well_name,DEPT,GR\n'
        'Override Well,100,8.5\n'
        'Override Well,200,8.6\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-logs-csv', json={'csv_path': str(csv_path)})
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        curve = session.scalar(sa_select(CurveMetadata).where(CurveMetadata.mnemonic == 'GR'))
        assert curve is not None
        assert curve.family_code == 'caliper'
        assert curve.standard_mnemonic == 'CALI'
        assert curve.unit == 'in'


def test_tops_import_with_column_map(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-column-map')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Map Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_nonstandard.csv'
    csv_path.write_text(
        'well_name,formation,md_depth,age\n'
        'Map Well,Jurassic Top,100,15\n'
        'Map Well,Cretaceous Base,300,80\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'column_map': {'top_name': 'formation', 'depth_md': 'md_depth'},
    })
    assert response.status_code == 200, response.text
    assert response.json()['formation_count'] == 2

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    top_names = [f['name'] for f in well['formations']]
    assert 'Jurassic Top' in top_names
    assert 'Cretaceous Base' in top_names


def _csv_response_rows(response) -> list[dict[str, str]]:
    text = response.content.decode('utf-8-sig')
    return list(csv.DictReader(io.StringIO(text)))


def test_wells_import_preserves_unknown_columns_as_extra_attributes(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'well-user-attributes')
    csv_path = tmp_path / 'wells_extra.csv'
    csv_path.write_text(
        'well_name,kb,td,operator,extra_country\n'
        'Extra Well,11,250,Acme,Norway\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-wells', json={'csv_path': str(csv_path)})
    assert response.status_code == 200, response.text
    well_id = response.json()['well_ids'][0]

    manager = app.state.project_manager
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        assert well is not None
        extra = json.loads(well.extra or '{}')
        assert extra['operator'] == 'Acme'
        assert extra['country'] == 'Norway'

    response = api_client.post('/api/export/wells/info', json={'scope': 'current', 'well_id': well_id})
    assert response.status_code == 200, response.text
    rows = _csv_response_rows(response)
    assert rows[0]['extra_operator'] == 'Acme'
    assert rows[0]['extra_country'] == 'Norway'


def test_las_import_preserves_well_header_extra_metadata(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'las-header-user-attributes')
    las_path = tmp_path / 'extra_header.las'
    las_path.write_text(
        '~Version Information\n'
        ' VERS. 2.0 : CWLS LOG ASCII STANDARD\n'
        ' WRAP. NO  : One line per depth step\n'
        '~Well Information\n'
        ' STRT.M 0.0 : Start depth\n'
        ' STOP.M 1.0 : Stop depth\n'
        ' STEP.M 0.5 : Step\n'
        ' NULL. -999.25 : Null value\n'
        ' WELL. Header Well : Well name\n'
        ' COMP. Test Company : Company\n'
        ' BASIN. North Sea : Basin\n'
        '~Curve Information\n'
        ' DEPT.M : Depth\n'
        ' GR.API : Gamma ray\n'
        '~ASCII\n'
        '0.0 80.0\n'
        '0.5 85.0\n'
        '1.0 90.0\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-las', json={'las_path': str(las_path)})
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    manager = app.state.project_manager
    with manager.get_session() as session:
        well = session.get(WellModel, well_id)
        assert well is not None
        extra = json.loads(well.extra or '{}')
        assert extra['company'] == 'Test Company'
        assert extra['basin'] == 'North Sea'


def test_tops_import_export_preserves_unknown_columns_as_extra_attributes(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-user-attributes')
    response = api_client.post('/api/projects/wells', json={'name': 'Top Extra Well', 'td': 500.0})
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_extra.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,age_ma,source_quality,extra_interpreter\n'
        'Top Extra Well,Top A,100,10,checked,SV\n'
        'Top Extra Well,Top B,200,20,reviewed,SV\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'Extra TopSet',
    })
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        top = session.scalar(sa_select(FormationTopModel).where(FormationTopModel.name == 'Top A'))
        assert top is not None
        extra = json.loads(top.extra or '{}')
        assert extra['source_quality'] == 'checked'
        assert extra['interpreter'] == 'SV'

    response = api_client.post('/api/export/wells/tops', json={'scope': 'current', 'well_id': well_id})
    assert response.status_code == 200, response.text
    rows = _csv_response_rows(response)
    assert rows[0]['extra_source_quality'] == 'checked'
    assert rows[0]['extra_interpreter'] == 'SV'


def test_strat_chart_import_export_preserves_unknown_columns_as_extra_attributes(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'strat-user-attributes')
    chart_csv = tmp_path / 'custom_strat_extra.csv'
    chart_csv.write_text(
        'id,parent,name,rank,top,base,hex,authority\n'
        '1,,System A,system,0,20,#abcdef,Local\n'
        '2,1,Stage A,stage,0,10,#fedcba,Local child\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/strat-charts/import', json={
        'csv_path': str(chart_csv),
        'column_map': {
            'unit_id': 'id',
            'parent_unit_id': 'parent',
            'unit_name': 'name',
            'rank_name': 'rank',
            'end_age_ma': 'top',
            'start_age_ma': 'base',
            'color': 'hex',
        },
    })
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        chart = session.scalar(sa_select(StratChart).where(StratChart.name == 'custom_strat_extra'))
        assert chart is not None
        unit = session.scalar(sa_select(StratUnit).where(StratUnit.chart_id == chart.id, StratUnit.name == 'Stage A'))
        assert unit is not None
        assert json.loads(unit.extra or '{}')['authority'] == 'Local child'
        chart_id = chart.id

    response = api_client.post('/api/export/strat-charts', json={'scope': 'selected', 'chart_id': chart_id})
    assert response.status_code == 200, response.text
    rows = _csv_response_rows(response)
    stage = next(row for row in rows if row['unit_name'] == 'Stage A')
    assert stage['extra_authority'] == 'Local child'


def test_sea_level_import_export_preserves_unknown_columns_as_extra_attributes(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'sea-level-user-attributes')
    curve_csv = tmp_path / 'sea_level_extra.csv'
    curve_csv.write_text(
        'age,level,source_model\n'
        '10,5,Haq\n'
        '0,0,Present\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/sea-level-curves/import', json={
        'csv_path': str(curve_csv),
        'curve_name': 'Extra Sea Level',
        'column_map': {'age_ma': 'age', 'sea_level_m': 'level'},
    })
    assert response.status_code == 200, response.text
    curve_id = response.json()['curve_id']

    manager = app.state.project_manager
    with manager.get_session() as session:
        point = session.scalar(sa_select(SeaLevelPoint).where(SeaLevelPoint.curve_id == curve_id, SeaLevelPoint.age_ma == 10.0))
        assert point is not None
        assert json.loads(point.extra or '{}')['source_model'] == 'Haq'

    response = api_client.post('/api/export/sea-level-curves', json={'scope': 'selected', 'curve_id': curve_id})
    assert response.status_code == 200, response.text
    rows = _csv_response_rows(response)
    oldest = next(row for row in rows if row['age_ma'] == '10.0')
    assert oldest['extra_source_model'] == 'Haq'


def test_logs_import_extends_well_td_with_warning(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'logs-extends-td')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Logs TD Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 100.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'logs_extend_td.csv'
    csv_path.write_text(
        'well_name,DEPT,GR\n'
        'Logs TD Well,0,80\n'
        'Logs TD Well,200,90\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text
    assert response.json()['qc_warnings'] == [
        'Imported data extends below current TD 100.0 m; TD was updated to 200.0 m.'
    ]

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    assert well['td_md'] == pytest.approx(200.0)


def test_logs_csv_tvdss_import_without_deviation_uses_vertical_fallback(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    project_path = _create_project(api_client, tmp_path, 'logs-tvdss-vertical-fallback')
    response = api_client.post('/api/projects/wells', json={
        'name': 'TVDSS Logs Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 200.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'logs_tvdss.csv'
    csv_path.write_text(
        'TVDSS,GR\n'
        '90,80\n'
        '190,90\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'depth_column': 'TVDSS',
        'trusted_depth_reference': 'TVDSS',
    })
    assert response.status_code == 200, response.text
    assert VERTICAL_TVD_IMPORT_WARNING in response.json()['qc_warnings']

    manager = app.state.project_manager
    with manager.get_session() as session:
        curve = session.scalar(sa_select(CurveMetadata).where(CurveMetadata.well_id == well_id, CurveMetadata.mnemonic == 'GR'))
        assert curve is not None
        assert curve.trusted_depth_reference == 'MD'
        frame = pd.read_parquet(project_path / curve.data_uri)

    assert frame['DEPT'].iloc[0] == pytest.approx(0.0)
    assert frame['DEPT'].iloc[-1] == pytest.approx(200.0)
    assert frame.loc[frame['DEPT'] < 100.0, 'GR'].isna().all()
    assert frame.loc[frame['DEPT'] == 100.0, 'GR'].iloc[0] == pytest.approx(80.0)
    assert frame.loc[frame['DEPT'] == 200.0, 'GR'].iloc[0] == pytest.approx(90.0)


def test_deviation_import_does_not_rewrite_md_log_storage_but_updates_tvdss_display(
    api_client: TestClient,
    tmp_path: Path,
) -> None:
    project_path = _create_project(api_client, tmp_path, 'logs-md-storage-derived-tvdss')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Derived TVDSS Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 200.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'logs_md.csv'
    csv_path.write_text(
        'DEPT,GR\n'
        '100,80\n'
        '200,90\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text

    manager = app.state.project_manager
    with manager.get_session() as session:
        curve = session.scalar(sa_select(CurveMetadata).where(CurveMetadata.well_id == well_id, CurveMetadata.mnemonic == 'GR'))
        assert curve is not None
        curve_path = project_path / curve.data_uri
        frame_before = pd.read_parquet(curve_path)

    response = api_client.get(f'/api/wells/{well_id}/curves/full', params={'depth_basis': 'TVDSS'})
    assert response.status_code == 200, response.text
    [curve_before_deviation] = response.json()
    assert curve_before_deviation['depths'][0] == pytest.approx(100.0)

    deviation_csv = tmp_path / 'inclined_deviation.csv'
    deviation_csv.write_text(
        'md,incl_deg,azim_deg\n'
        '0,60,0\n'
        '200,60,0\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-deviation', json={
        'csv_path': str(deviation_csv),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text

    frame_after = pd.read_parquet(curve_path)
    pd.testing.assert_frame_equal(frame_before, frame_after)

    response = api_client.get(f'/api/wells/{well_id}/curves/full', params={'depth_basis': 'TVDSS'})
    assert response.status_code == 200, response.text
    [curve_after_deviation] = response.json()
    assert curve_after_deviation['depths'][0] < 100.0
    assert curve_after_deviation['depths'][0] == pytest.approx(40.0)
    assert curve_after_deviation['values'][0] == pytest.approx(80.0)


def test_deviation_import_extends_well_td_with_warning(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'deviation-extends-td')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Deviation TD Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 100.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'deviation_extend_td.csv'
    csv_path.write_text(
        'md,incl_deg,azim_deg\n'
        '0,0,0\n'
        '200,0,0\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-deviation', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text
    assert response.json()['qc_warnings'] == [
        'Imported data extends below current TD 100.0 m; TD was updated to 200.0 m.'
    ]

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    assert well['td_md'] == pytest.approx(200.0)


def test_tops_import_warns_and_extrapolates_below_deviation_survey(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-deviation-extrapolation')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Deviation Short Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 300.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    deviation_csv = tmp_path / 'short_deviation.csv'
    deviation_csv.write_text(
        'md,incl_deg,azim_deg\n'
        '0,60,0\n'
        '100,60,0\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-deviation', json={
        'csv_path': str(deviation_csv),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text

    tops_csv = tmp_path / 'tops_below_deviation.csv'
    tops_csv.write_text(
        'well_name,top_name,depth_md,age_ma\n'
        'Deviation Short Well,Deep Top,200,20\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(tops_csv),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text
    assert response.json()['qc_warnings'] == [
        'Deviation survey ends at 100.0 m; TVD/TVDSS below this depth uses the last inclination/azimuth.'
    ]

    response = api_client.get(f'/api/wells/{well_id}/formations')
    assert response.status_code == 200, response.text
    [top] = response.json()
    assert top['depth_tvd'] == pytest.approx(100.0)
    assert top['depth_tvdss'] == pytest.approx(90.0)


def test_tops_import_create_top_set_preserves_td_extension_warning(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-td-warning-two-pass')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Tops TD Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 100.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    tops_csv = tmp_path / 'tops_extend_td_with_topset.csv'
    tops_csv.write_text(
        'well_name,top_name,depth_md,age_ma\n'
        'Tops TD Well,Deep Top,200,20\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(tops_csv),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'TD Warning TopSet',
    })
    assert response.status_code == 200, response.text
    assert response.json()['qc_warnings'] == [
        'Imported data extends below current TD 100.0 m; TD was updated to 200.0 m.'
    ]

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    assert well['td_md'] == pytest.approx(200.0)


def test_tops_first_import_creates_well_with_default_td_warning(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-first-import-default-td-warning')

    tops_csv = tmp_path / 'tops_first_import.csv'
    tops_csv.write_text(
        'well_name,top_name,depth_md,age_ma\n'
        'First Tops Well,Deep Top,250,20\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(tops_csv),
        'create_zone_set': True,
        'zone_set_name': 'First Import TopSet',
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['qc_warnings'] == [
        'Imported data extends below current TD 100.0 m; TD was updated to 250.0 m.'
    ]

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    [well] = response.json()
    assert well['well_name'] == 'First Tops Well'
    assert well['td_md'] == pytest.approx(250.0)


def test_deviation_first_import_creates_well_with_default_td_warning(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'deviation-first-import-default-td-warning')

    deviation_csv = tmp_path / 'deviation_first_import.csv'
    deviation_csv.write_text(
        'well_name,md,incl_deg,azim_deg\n'
        'First Deviation Well,0,0,0\n'
        'First Deviation Well,250,0,0\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/projects/import-deviation', json={
        'csv_path': str(deviation_csv),
        'create_new_well': True,
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['qc_warnings'] == [
        'Imported data extends below current TD 100.0 m; TD was updated to 250.0 m.'
    ]

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    [well] = response.json()
    assert well['well_name'] == 'First Deviation Well'
    assert well['td_md'] == pytest.approx(250.0)


def test_tops_import_accepts_unconformity_rows(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-unconformity')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Unconformity Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_with_unconformity.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,boundary_type,age_ma,hiatus_duration_ma,eroded_thickness_m\n'
        'Unconformity Well,Paleogene,100,strat,40,,\n'
        'Unconformity Well,J/K Unconformity,200,unconformity,145,79,120\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'depth_ref': 'MD',
    })
    assert response.status_code == 200, response.text
    assert response.json()['formation_count'] == 2
    assert response.json()['linked_count'] == 0

    manager = app.state.project_manager
    with manager.get_session() as session:
        row = session.scalar(
            sa_select(FormationTopModel).where(
                FormationTopModel.well_id == well_id,
                FormationTopModel.kind == 'unconformity',
            )
        )
        assert row is not None
        assert row.name == 'J/K Unconformity'
        assert row.age_top_ma == pytest.approx(145)
        assert row.age_base_ma is None
        assert row.hiatus_duration_ma == pytest.approx(79)
        assert row.eroded_thickness_m == pytest.approx(120)


def test_tops_import_can_create_zone_set_from_imported_tops(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-zone-set-create')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Zone Import Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_zone_set.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Zone Import Well,H1,100,10,#111111\n'
        'Zone Import Well,H2,250,20,#222222\n'
        'Zone Import Well,H3,400,30,#333333\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'Imported ZoneSet',
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['zone_set_id'] is not None
    assert payload['horizon_count'] == 3
    assert payload['zone_count'] == 2

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    assert well['active_top_set_id'] == payload['zone_set_id']
    assert well['active_top_set_name'] == 'Imported ZoneSet'
    assert [z['thickness_md'] for z in well['zones']] == [150.0, 150.0]


def test_tops_import_rejects_create_zone_set_with_existing_name(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-zone-set-duplicate-name')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Duplicate TopSet Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_duplicate_zone_set.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Duplicate TopSet Well,H1,100,10,#111111\n'
        'Duplicate TopSet Well,H2,250,20,#222222\n',
        encoding='utf-8',
    )

    first = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'Duplicate TopSet',
    })
    assert first.status_code == 200, first.text
    top_set_id = first.json()['zone_set_id']

    second = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'Duplicate TopSet',
    })
    assert second.status_code == 409, second.text
    assert 'already exists' in second.json()['detail']

    response = api_client.get('/api/top-sets')
    assert response.status_code == 200, response.text
    top_sets = response.json()
    assert [ts['name'] for ts in top_sets].count('Duplicate TopSet') == 1
    assert next(ts for ts in top_sets if ts['name'] == 'Duplicate TopSet')['id'] == top_set_id


def test_tops_import_new_zone_set_does_not_steal_existing_top_set_picks(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-zone-set-independent-picks')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Independent TopSet Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_independent_zone_sets.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Independent TopSet Well,H1,100,10,#111111\n'
        'Independent TopSet Well,H2,250,20,#222222\n',
        encoding='utf-8',
    )
    first = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'First TopSet',
    })
    assert first.status_code == 200, first.text
    first_top_set_id = first.json()['zone_set_id']

    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Independent TopSet Well,H1,120,10,#aaaaaa\n'
        'Independent TopSet Well,H2,280,20,#bbbbbb\n',
        encoding='utf-8',
    )
    second = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'Second TopSet',
    })
    assert second.status_code == 200, second.text
    second_top_set_id = second.json()['zone_set_id']
    assert second_top_set_id != first_top_set_id

    manager = app.state.project_manager
    with manager.get_session() as session:
        first_horizons = session.scalars(
            sa_select(TopSetHorizon).where(TopSetHorizon.top_set_id == first_top_set_id)
        ).all()
        second_horizons = session.scalars(
            sa_select(TopSetHorizon).where(TopSetHorizon.top_set_id == second_top_set_id)
        ).all()
        first_horizon_ids = {h.id for h in first_horizons}
        second_horizon_ids = {h.id for h in second_horizons}
        first_picks = session.scalars(
            sa_select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id, FormationTopModel.horizon_id.in_(first_horizon_ids))
            .order_by(FormationTopModel.name.asc())
        ).all()
        second_picks = session.scalars(
            sa_select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id, FormationTopModel.horizon_id.in_(second_horizon_ids))
            .order_by(FormationTopModel.name.asc())
        ).all()

    assert len(first_picks) == 2
    assert len(second_picks) == 2
    assert [pick.name for pick in first_picks] == ['H1', 'H2']
    assert [pick.depth_md for pick in first_picks] == [100.0, 250.0]
    assert [pick.color for pick in first_picks] == ['#111111', '#222222']
    assert [pick.name for pick in second_picks] == ['H1', 'H2']
    assert [pick.depth_md for pick in second_picks] == [120.0, 280.0]
    assert [pick.color for pick in second_picks] == ['#aaaaaa', '#bbbbbb']

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    assert well['active_top_set_id'] == second_top_set_id


def test_tops_import_can_attach_to_existing_zone_set_by_top_names(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-zone-set-existing')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Existing ZoneSet Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    response = api_client.post('/api/top-sets', json={'name': 'Regional ZoneSet'})
    assert response.status_code == 201, response.text
    top_set_id = response.json()['id']
    for name, age in [('H1', 10.0), ('H2', 20.0), ('H3', 30.0)]:
        response = api_client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name, 'age_ma': age})
        assert response.status_code == 201, response.text

    csv_path = tmp_path / 'tops_existing_zone_set.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma\n'
        'Existing ZoneSet Well,H1,100,10\n'
        'Existing ZoneSet Well,H2,250,20\n'
        'Existing ZoneSet Well,HX,300,25\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'zone_set_id': top_set_id,
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['zone_set_id'] == top_set_id
    assert payload['horizon_count'] == 4
    assert payload['zone_count'] == 3
    assert payload['qc_warnings'] == []

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    well = next(w for w in response.json() if w['well_id'] == well_id)
    assert well['active_top_set_id'] == top_set_id
    assert len(well['zones']) == 3
    assert [
        (zone['upper_horizon']['name'], zone['lower_horizon']['name'], zone['thickness_md'])
        for zone in well['zones']
    ] == [
        ('H1', 'H2', 150.0),
        ('H2', 'HX', 50.0),
        ('HX', 'H3', None),
    ]


def test_tops_import_into_top_set_is_idempotent(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-idempotent')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Repeat Import Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_repeat.csv'
    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Repeat Import Well,H1,100,10,#111111\n'
        'Repeat Import Well,H2,250,20,#222222\n',
        encoding='utf-8',
    )

    first = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'create_zone_set': True,
        'zone_set_name': 'Repeat TopSet',
    })
    assert first.status_code == 200, first.text
    top_set_id = first.json()['zone_set_id']

    csv_path.write_text(
        'well_name,top_name,depth_md,strat_age_ma,color\n'
        'Repeat Import Well,H1,110,10,#aaaaaa\n'
        'Repeat Import Well,H2,260,20,#bbbbbb\n',
        encoding='utf-8',
    )
    second = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'zone_set_id': top_set_id,
    })
    assert second.status_code == 200, second.text
    assert second.json()['formation_count'] == 2
    assert second.json()['horizon_count'] == 2
    assert second.json()['zone_count'] == 1

    manager = app.state.project_manager
    with manager.get_session() as session:
        picks = session.scalars(
            sa_select(FormationTopModel)
            .where(FormationTopModel.well_id == well_id)
            .order_by(FormationTopModel.name.asc())
        ).all()
        horizons = session.scalars(sa_select(TopSetHorizon).where(TopSetHorizon.top_set_id == top_set_id)).all()

    assert len(picks) == 2
    assert len(horizons) == 2
    assert [pick.depth_md for pick in picks] == [110.0, 260.0]
    assert [pick.color for pick in picks] == ['#aaaaaa', '#bbbbbb']


def test_tops_import_into_existing_top_set_preserves_cross_well_order(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-cross-well-order')
    bur_response = api_client.post('/api/projects/wells', json={
        'name': 'BUR-2',
        'x': 0.0,
        'y': 0.0,
        'kb': 0.0,
        'td': 10000.0,
        'crs': 'local',
    })
    assert bur_response.status_code == 200, bur_response.text
    bur_id = bur_response.json()['well_id']

    dun_response = api_client.post('/api/projects/wells', json={
        'name': 'DUN-99',
        'x': 0.0,
        'y': 0.0,
        'kb': 0.0,
        'td': 4000.0,
        'crs': 'local',
    })
    assert dun_response.status_code == 200, dun_response.text
    dun_id = dun_response.json()['well_id']

    bur_csv = tmp_path / 'BUR-2_tops.txt'
    bur_csv.write_text(
        'well\tsurface\tmd\tage_ma\n'
        'BUR-2\tQ\t0\t0\n'
        'BUR-2\tP1uf\t98.45\t273.01\n'
        'BUR-2\tP1kg\t303.91\t278\n'
        'BUR-2\tC3\t529.85\t299\n'
        'BUR-2\tC2vr\t890.81\t313\n'
        'BUR-2\tC2b\t932.93\t315.2\n'
        'BUR-2\tC1bb\t1316.52\t337\n'
        'BUR-2\tC1t\t1362.71\t346.7\n'
        'BUR-2\tD3fm\t1399.05\t358.9\n'
        'BUR-2\tD2gv\t1807.39\t382.7\n'
        'BUR-2\tV\t1856.46\t539\n'
        'BUR-2\tRF3\t2356.46\t600\n'
        'BUR-2\tRF12\t4106.46\t1030\n'
        'BUR-2\tBase_RF12\t9606.46\t1650\n',
        encoding='utf-8',
    )
    dun_csv = tmp_path / 'DUN-99_tops.txt'
    dun_csv.write_text(
        'well\tsurface\tmd\tage_ma\n'
        'DUN-99\tQ\t0\t0\n'
        'DUN-99\tP3t\t20\t251.9\n'
        'DUN-99\tP2ur\t310\t264.28\n'
        'DUN-99\tP2kz\t480\t266.9\n'
        'DUN-99\tP1uf\t620\t273.01\n'
        'DUN-99\tP1kg\t660\t278\n'
        'DUN-99\tP1ar\t740\t283.5\n'
        'DUN-99\tC3\t980\t299\n'
        'DUN-99\tC2m\t1280\t307\n'
        'DUN-99\tC2vr\t1670\t313\n'
        'DUN-99\tC2b\t1730\t315.2\n'
        'DUN-99\tC1s\t1810\t323.2\n'
        'DUN-99\tC1ok\t2040\t331\n'
        'DUN-99\tC1tl\t2260\t334\n'
        'DUN-99\tC1bb\t2320\t337\n'
        'DUN-99\tC1t\t2660\t346.7\n'
        'DUN-99\tD3fm\t2875\t358.9\n'
        'DUN-99\tD3f3\t2960\t372.2\n'
        'DUN-99\tD2gv\t3150\t382.7\n'
        'DUN-99\tD2ef1\t3250\t387.7\n'
        'DUN-99\tBase_RF12\t3260\t1650\n',
        encoding='utf-8',
    )
    column_map = {
        'well_name': 'well',
        'top_name': 'surface',
        'depth_md': 'md',
        'age_ma': 'age_ma',
    }

    first = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(bur_csv),
        'well_id': bur_id,
        'create_zone_set': True,
        'zone_set_name': 'Regional TopSet',
        'column_map': column_map,
    })
    assert first.status_code == 200, first.text
    top_set_id = first.json()['zone_set_id']

    second = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(dun_csv),
        'well_id': dun_id,
        'zone_set_id': top_set_id,
        'column_map': column_map,
    })
    assert second.status_code == 200, second.text

    response = api_client.get('/api/top-sets')
    assert response.status_code == 200, response.text
    top_set = next(item for item in response.json() if item['id'] == top_set_id)
    horizon_names = [horizon['name'] for horizon in top_set['horizons']]

    assert horizon_names == [
        'Q',
        'P3t',
        'P2ur',
        'P2kz',
        'P1uf',
        'P1kg',
        'P1ar',
        'C3',
        'C2m',
        'C2vr',
        'C2b',
        'C1s',
        'C1ok',
        'C1tl',
        'C1bb',
        'C1t',
        'D3fm',
        'D3f3',
        'D2gv',
        'D2ef1',
        'V',
        'RF3',
        'RF12',
        'Base_RF12',
    ]

    inventory = api_client.get('/api/wells/inventory')
    assert inventory.status_code == 200, inventory.text
    bur_well = next(well for well in inventory.json() if well['well_id'] == bur_id)
    assert bur_well['active_top_set_id'] == top_set_id
    expected_pairs = list(zip(horizon_names, horizon_names[1:]))
    visible_pairs = [
        (zone['upper_horizon']['name'], zone['lower_horizon']['name'])
        for zone in bur_well['zones']
    ]
    assert all(pair in expected_pairs for pair in visible_pairs)
    assert all(
        zone['thickness_md'] is None or zone['thickness_md'] > 0.0
        for zone in bur_well['zones']
    )

    bur_subsidence = api_client.post(f'/api/wells/{bur_id}/subsidence')
    assert bur_subsidence.status_code == 200, bur_subsidence.text
    bur_curve_names = [curve['formation_name'] for curve in bur_subsidence.json()]
    assert 'Q → P1uf' in bur_curve_names
    assert 'P1uf → P1kg' in bur_curve_names
    assert 'P1uf → P1ar' not in bur_curve_names


def test_deviation_import_with_column_map(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'deviation-column-map')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Deviated Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'deviation_nonstandard.csv'
    csv_path.write_text(
        'well_name,depth,inclination,bearing\n'
        'Deviated Well,0,0,0\n'
        'Deviated Well,100,2,45\n'
        'Deviated Well,300,5,50\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-deviation', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'column_map': {'md': 'depth', 'incl_deg': 'inclination', 'azim_deg': 'bearing'},
    })
    assert response.status_code == 200, response.text
    assert response.json()['mode'] == 'INCL_AZIM'


def test_deviation_import_export_preserves_numeric_extra_columns(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'deviation-extra-numeric')
    response = api_client.post('/api/projects/wells', json={'name': 'Deviation Extra Well', 'td': 500.0})
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'deviation_extra.csv'
    csv_path.write_text(
        'well_name,md,incl_deg,azim_deg,dogleg_severity\n'
        'Deviation Extra Well,0,0,0,0\n'
        'Deviation Extra Well,100,2,45,1.5\n'
        'Deviation Extra Well,300,5,50,2.5\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-deviation', json={'csv_path': str(csv_path), 'well_id': well_id})
    assert response.status_code == 200, response.text

    response = api_client.post('/api/export/wells/deviation', json={'scope': 'current', 'well_id': well_id})
    assert response.status_code == 200, response.text
    rows = _csv_response_rows(response)
    assert rows[1]['dogleg_severity'] == '1.5'


def test_tops_import_with_incomplete_column_map_returns_400(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'tops-bad-map')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Bad Map Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'tops_bad_map.csv'
    csv_path.write_text(
        'well_name,formation,md_depth\n'
        'Bad Map Well,Some Top,100\n',
        encoding='utf-8',
    )

    # column_map maps top_name but NOT depth_md — depth_md will be missing after remapping
    response = api_client.post('/api/projects/import-tops', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
        'column_map': {'top_name': 'formation'},
    })
    assert response.status_code == 400, response.text
    assert 'depth_md' in response.json()['detail']


def test_logs_import_without_well_name_imports_to_explicit_well(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'logs-no-well-name')
    response = api_client.post('/api/projects/wells', json={
        'name': 'Target Well',
        'x': 0.0,
        'y': 0.0,
        'kb': 10.0,
        'td': 500.0,
        'crs': 'local',
    })
    assert response.status_code == 200, response.text
    well_id = response.json()['well_id']

    csv_path = tmp_path / 'logs_no_wellname.csv'
    csv_path.write_text(
        'DEPT,GR,RHOB\n'
        '100,75,2.3\n'
        '200,78,2.4\n'
        '300,80,2.5\n',
        encoding='utf-8',
    )

    response = api_client.post('/api/projects/import-logs-csv', json={
        'csv_path': str(csv_path),
        'well_id': well_id,
    })
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['well_id'] == well_id
    assert payload['curve_count'] == 2

    response = api_client.get('/api/wells/inventory')
    assert response.status_code == 200, response.text
    wells = response.json()
    target = next(w for w in wells if w['well_id'] == well_id)
    assert target['well_name'] == 'Target Well'
    assert {c['mnemonic'] for c in target['curves']} == {'GR', 'RHOB'}


def test_invalid_user_regex_does_not_break_mnemonic_resolver(api_client: TestClient, tmp_path: Path) -> None:
    _create_project(api_client, tmp_path, 'mnemonic-invalid-regex')

    manager = app.state.project_manager
    with manager.get_session() as session:
        user_set = CurveMnemonicSet(name='Broken Regex Set', is_builtin=False, sort_order=-10)
        session.add(user_set)
        session.flush()
        session.add(
            CurveMnemonicEntry(
                set_id=user_set.id,
                pattern='[',
                is_regex=True,
                priority=999,
                family_code='broken',
                canonical_mnemonic='BROKEN',
                canonical_unit='broken',
                is_active=True,
            )
        )
        session.commit()

    response = api_client.get('/api/projects/dictionary/curves/match?mnemonic=GR')
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload['matched'] is True
    assert payload['family_code'] == 'gamma_ray'
    assert payload['canonical_mnemonic'] == 'GR'


# ---------------------------------------------------------------------------
# ZONE-001 tests
# ---------------------------------------------------------------------------

def _create_well_with_top_set(client, tmp_path: Path):
    """Create a project, a well with 3 picks, a TopSet with 4 horizons, and link them."""
    _create_project(client, tmp_path, 'zone-test')

    resp = client.post('/api/projects/wells', json={
        'name': 'Zone Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 1000.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_id = resp.json()['well_id']

    # Create 4 picks with known depths and ages (deeper = older = larger Ma)
    picks = [('H1', 100.0, 10.0), ('H2', 300.0, 20.0), ('H3', 600.0, 30.0), ('H4', 900.0, 40.0)]
    for name, depth, age in picks:
        resp = client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa', 'age_ma': age,
        })
        assert resp.status_code == 201, resp.text

    # Create TopSet with 4 horizons with matching ages
    resp = client.post('/api/top-sets', json={'name': 'Main Set'})
    assert resp.status_code == 201, resp.text
    top_set_id = resp.json()['id']

    for name, age in [('H1', 10.0), ('H2', 20.0), ('H3', 30.0), ('H4', 40.0)]:
        resp = client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name, 'age_ma': age})
        assert resp.status_code == 201, resp.text

    # Link well to TopSet
    resp = client.put(f'/api/wells/{well_id}/active-top-set', json={'top_set_id': top_set_id})
    assert resp.status_code == 200, resp.text

    return well_id, top_set_id


def test_zone_lifecycle_four_horizons_create_three_zones(api_client: TestClient, tmp_path: Path):
    """4 horizons → 3 zones per linked well."""
    well_id, _ = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    assert len(zones) == 3
    names = [(z['upper_horizon']['name'], z['lower_horizon']['name']) for z in zones]
    assert names == [('H1', 'H2'), ('H2', 'H3'), ('H3', 'H4')]

    # Zones should have computed thickness_md
    assert zones[0]['thickness_md'] == pytest.approx(200.0)
    assert zones[1]['thickness_md'] == pytest.approx(300.0)
    assert zones[2]['thickness_md'] == pytest.approx(300.0)

    # Zones should appear in inventory
    resp = api_client.get('/api/wells/inventory')
    assert resp.status_code == 200, resp.text
    inv = next(w for w in resp.json() if w['well_id'] == well_id)
    assert len(inv['zones']) == 3


def test_top_set_pick_insert_endpoint_adds_marker_from_data_manager(api_client: TestClient, tmp_path: Path):
    """Data Manager can insert a new TopSet marker above/below an existing marker."""
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.get(f'/api/top-sets/{top_set_id}')
    assert resp.status_code == 200, resp.text
    horizons = resp.json()['horizons']
    h2_id = next(h['id'] for h in horizons if h['name'] == 'H2')

    resp = api_client.post(
        f'/api/top-sets/{top_set_id}/picks',
        json={'well_id': well_id, 'insert_before_horizon_id': h2_id},
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created['well_id'] == well_id
    assert created['horizon_id'] != h2_id
    assert created['name'].startswith('Top ')
    assert created['depth_md'] is None

    resp = api_client.get(f'/api/top-sets/{top_set_id}')
    assert resp.status_code == 200, resp.text
    ordered_names = [h['name'] for h in resp.json()['horizons']]
    assert ordered_names == ['H1', created['name'], 'H2', 'H3', 'H4']

    resp = api_client.patch(
        f'/api/wells/{well_id}/formations/{created["formation_id"]}',
        json={'depth_md': 200.0},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()['depth_md'] == pytest.approx(200.0)

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 4

    resp = api_client.delete(f'/api/top-sets/{top_set_id}/horizons/{created["horizon_id"]}')
    assert resp.status_code == 204, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    assert all(top['id'] != created['formation_id'] for top in resp.json())

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 3


def test_linked_top_set_marker_rename_syncs_all_well_picks(api_client: TestClient, tmp_path: Path):
    well_a_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.post('/api/projects/wells', json={
        'name': 'Second Zone Well', 'x': 1.0, 'y': 1.0, 'kb': 0.0, 'td': 1000.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_b_id = resp.json()['well_id']

    for name, depth, age in [('H1', 110.0, 10.0), ('H2', 330.0, 20.0), ('H3', 650.0, 30.0), ('H4', 920.0, 40.0)]:
        resp = api_client.post(f'/api/wells/{well_b_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#bbbbbb', 'age_ma': age,
        })
        assert resp.status_code == 201, resp.text

    resp = api_client.put(f'/api/wells/{well_b_id}/active-top-set', json={'top_set_id': top_set_id})
    assert resp.status_code == 200, resp.text

    resp = api_client.get(f'/api/wells/{well_a_id}/formations')
    assert resp.status_code == 200, resp.text
    h2_pick_a = next(top for top in resp.json() if top['name'] == 'H2')

    resp = api_client.patch(
        f'/api/wells/{well_a_id}/formations/{h2_pick_a["id"]}',
        json={'name': 'Renamed H2'},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()['name'] == 'Renamed H2'

    resp = api_client.get(f'/api/top-sets/{top_set_id}')
    assert resp.status_code == 200, resp.text
    horizons = resp.json()['horizons']
    assert any(h['id'] == h2_pick_a['horizon_id'] and h['name'] == 'Renamed H2' for h in horizons)

    resp = api_client.get(f'/api/wells/{well_a_id}/formations')
    assert resp.status_code == 200, resp.text
    assert any(top['horizon_id'] == h2_pick_a['horizon_id'] and top['name'] == 'Renamed H2' for top in resp.json())

    resp = api_client.get(f'/api/wells/{well_b_id}/formations')
    assert resp.status_code == 200, resp.text
    well_b_tops = resp.json()
    assert any(top['horizon_id'] == h2_pick_a['horizon_id'] and top['name'] == 'Renamed H2' for top in well_b_tops)
    assert any(top['name'] == 'H1' and top['depth_md'] == pytest.approx(110.0) for top in well_b_tops)

    resp = api_client.get('/api/wells/inventory')
    assert resp.status_code == 200, resp.text
    well_b_inventory = next(well for well in resp.json() if well['well_id'] == well_b_id)
    assert any(top['horizon_id'] == h2_pick_a['horizon_id'] and top['name'] == 'Renamed H2' for top in well_b_inventory['formations'])
    zone_names = [
        (zone['upper_horizon']['name'], zone['lower_horizon']['name'])
        for zone in well_b_inventory['zones']
    ]
    assert ('H1', 'Renamed H2') in zone_names
    assert ('Renamed H2', 'H3') in zone_names


def test_unlinked_top_rename_stays_local(api_client: TestClient, tmp_path: Path):
    well_a_id, _top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.post(f'/api/wells/{well_a_id}/formations', json={
        'name': 'Local Pick', 'depth_md': 950.0, 'color': '#cccccc', 'age_ma': 45.0,
    })
    assert resp.status_code == 201, resp.text
    local_pick_id = resp.json()['id']
    assert resp.json()['horizon_id'] is None

    resp = api_client.patch(
        f'/api/wells/{well_a_id}/formations/{local_pick_id}',
        json={'name': 'Local Pick Renamed'},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()['name'] == 'Local Pick Renamed'
    assert resp.json()['horizon_id'] is None

    resp = api_client.get(f'/api/wells/{well_a_id}/formations')
    assert resp.status_code == 200, resp.text
    assert any(top['id'] == local_pick_id and top['name'] == 'Local Pick Renamed' for top in resp.json())


def test_formation_api_rejects_depth_outside_well_td(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'formation-depth-guard')

    resp = api_client.post('/api/projects/wells', json={
        'name': 'Depth Guard Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 600.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_id = resp.json()['well_id']

    resp = api_client.post(f'/api/wells/{well_id}/formations', json={
        'name': 'Too Deep',
        'depth_md': 800.0,
        'color': '#aaaaaa',
    })
    assert resp.status_code == 400, resp.text
    assert 'outside well interval' in resp.json()['detail']

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_formation_api_rejects_invalid_depth_update_without_mutation(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'formation-depth-update-guard')

    resp = api_client.post('/api/projects/wells', json={
        'name': 'Depth Update Guard Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 600.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_id = resp.json()['well_id']

    resp = api_client.post(f'/api/wells/{well_id}/formations', json={
        'name': 'Valid Top',
        'depth_md': 500.0,
        'color': '#aaaaaa',
    })
    assert resp.status_code == 201, resp.text
    formation_id = resp.json()['id']

    resp = api_client.patch(
        f'/api/wells/{well_id}/formations/{formation_id}',
        json={'depth_md': 800.0},
    )
    assert resp.status_code == 400, resp.text
    assert 'outside well interval' in resp.json()['detail']

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    [formation] = resp.json()
    assert formation['depth_md'] == pytest.approx(500.0)


def test_top_set_pick_api_rejects_depth_outside_well_td(api_client: TestClient, tmp_path: Path):
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.post(
        f'/api/top-sets/{top_set_id}/picks',
        json={'well_id': well_id, 'depth_md': 1200.0},
    )
    assert resp.status_code == 400, resp.text
    assert 'outside well interval' in resp.json()['detail']

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 4


def test_delete_linked_top_pick_clears_to_ghost(api_client: TestClient, tmp_path: Path):
    well_id, _top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    h2 = next(top for top in resp.json() if top['name'] == 'H2')
    assert h2['horizon_id'] is not None
    assert h2['depth_md'] == pytest.approx(300.0)

    resp = api_client.delete(f'/api/wells/{well_id}/formations/{h2["id"]}')
    assert resp.status_code == 204, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    h2_after = next(top for top in resp.json() if top['id'] == h2['id'])
    assert h2_after['horizon_id'] == h2['horizon_id']
    assert h2_after['depth_md'] is None
    assert h2_after['depth_tvd'] is None
    assert h2_after['depth_tvdss'] is None

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    assert any(zone['thickness_md'] is None for zone in zones)


def test_delete_unlinked_top_pick_removes_row(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'delete-unlinked-top-pick')
    resp = api_client.post('/api/projects/wells', json={
        'name': 'Unlinked Pick Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 1000.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_id = resp.json()['well_id']

    resp = api_client.post(f'/api/wells/{well_id}/formations', json={
        'name': 'Standalone Top', 'depth_md': 300.0, 'color': '#aaaaaa',
    })
    assert resp.status_code == 201, resp.text
    formation_id = resp.json()['id']
    assert resp.json()['horizon_id'] is None

    resp = api_client.delete(f'/api/wells/{well_id}/formations/{formation_id}')
    assert resp.status_code == 204, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/formations')
    assert resp.status_code == 200, resp.text
    assert all(top['id'] != formation_id for top in resp.json())


def test_zone_lifecycle_delete_middle_horizon_merges_zones(api_client: TestClient, tmp_path: Path):
    """Deleting a middle horizon preserves manual lithology from one adjacent zone."""
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    # Patch zone H2→H3 with lithology fractions
    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    zone_h2_h3 = next(z for z in zones if z['upper_horizon']['name'] == 'H2')
    zone_id = zone_h2_h3['zone_id']
    resp = api_client.patch(f'/api/wells/{well_id}/zones/{zone_id}', json={
        'lithology_fractions': '{"sandstone": 0.6, "shale": 0.4}',
        'lithology_source': 'manual',
    })
    assert resp.status_code == 200, resp.text
    assert resp.json()['lithology_fractions'] == '{"sandstone": 0.6, "shale": 0.4}'

    # Delete H2 horizon (middle)
    resp = api_client.get(f'/api/top-sets/{top_set_id}')
    assert resp.status_code == 200, resp.text
    h2_id = next(h['id'] for h in resp.json()['horizons'] if h['name'] == 'H2')
    resp = api_client.delete(f'/api/top-sets/{top_set_id}/horizons/{h2_id}')
    assert resp.status_code == 204, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    assert len(zones) == 2
    names = {(z['upper_horizon']['name'], z['lower_horizon']['name']) for z in zones}
    assert ('H1', 'H3') in names

    merged = next(z for z in zones if z['upper_horizon']['name'] == 'H1' and z['lower_horizon']['name'] == 'H3')
    assert json.loads(merged['lithology_fractions']) == pytest.approx({'sandstone': 0.6, 'shale': 0.4})
    assert merged['lithology_source'] == 'manual'

    # Thickness should be recalculated for merged zone
    assert merged['thickness_md'] == pytest.approx(500.0)


def test_zone_lifecycle_delete_middle_horizon_keeps_auto_when_both_zones_auto(api_client: TestClient, tmp_path: Path):
    """Merging two auto zones should not freeze the merged zone as manual."""
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.get(f'/api/top-sets/{top_set_id}')
    assert resp.status_code == 200, resp.text
    h2_id = next(h['id'] for h in resp.json()['horizons'] if h['name'] == 'H2')
    resp = api_client.delete(f'/api/top-sets/{top_set_id}/horizons/{h2_id}')
    assert resp.status_code == 204, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    merged = next(z for z in resp.json() if z['upper_horizon']['name'] == 'H1' and z['lower_horizon']['name'] == 'H3')
    assert merged['lithology_fractions'] is None
    assert merged['lithology_source'] == 'auto'


def test_zone_lifecycle_delete_middle_horizon_weight_averages_manual_lithology(api_client: TestClient, tmp_path: Path):
    """Merging two manual zones should thickness-weight their fractions."""
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    zones = resp.json()
    zone_h1_h2 = next(z for z in zones if z['upper_horizon']['name'] == 'H1')
    zone_h2_h3 = next(z for z in zones if z['upper_horizon']['name'] == 'H2')

    resp = api_client.patch(f'/api/wells/{well_id}/zones/{zone_h1_h2["zone_id"]}', json={
        'lithology_fractions': '{"sandstone": 1.0}',
        'lithology_source': 'manual',
    })
    assert resp.status_code == 200, resp.text
    resp = api_client.patch(f'/api/wells/{well_id}/zones/{zone_h2_h3["zone_id"]}', json={
        'lithology_fractions': '{"shale": 1.0}',
        'lithology_source': 'manual',
    })
    assert resp.status_code == 200, resp.text

    resp = api_client.get(f'/api/top-sets/{top_set_id}')
    assert resp.status_code == 200, resp.text
    h2_id = next(h['id'] for h in resp.json()['horizons'] if h['name'] == 'H2')
    resp = api_client.delete(f'/api/top-sets/{top_set_id}/horizons/{h2_id}')
    assert resp.status_code == 204, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    merged = next(z for z in resp.json() if z['upper_horizon']['name'] == 'H1' and z['lower_horizon']['name'] == 'H3')
    assert json.loads(merged['lithology_fractions']) == pytest.approx({'sandstone': 0.4, 'shale': 0.6})
    assert merged['lithology_source'] == 'manual'


def test_top_set_pick_split_copies_manual_lithology_to_new_zones(api_client: TestClient, tmp_path: Path):
    """Splitting a manual zone should copy its fractions to both replacement zones."""
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    zone_h1_h2 = next(z for z in resp.json() if z['upper_horizon']['name'] == 'H1')
    resp = api_client.patch(f'/api/wells/{well_id}/zones/{zone_h1_h2["zone_id"]}', json={
        'lithology_fractions': '{"sandstone": 0.25, "shale": 0.75}',
        'lithology_source': 'manual',
    })
    assert resp.status_code == 200, resp.text

    resp = api_client.post(
        f'/api/top-sets/{top_set_id}/picks',
        json={'well_id': well_id, 'split_zone_id': zone_h1_h2['zone_id'], 'depth_md': 200.0},
    )
    assert resp.status_code == 201, resp.text
    created_name = resp.json()['name']

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    split_zones = [
        z for z in resp.json()
        if (z['upper_horizon']['name'], z['lower_horizon']['name']) in {('H1', created_name), (created_name, 'H2')}
    ]
    assert len(split_zones) == 2
    for zone in split_zones:
        assert json.loads(zone['lithology_fractions']) == pytest.approx({'sandstone': 0.25, 'shale': 0.75})
        assert zone['lithology_source'] == 'manual'


def test_zone_lifecycle_pick_move_updates_thickness(api_client: TestClient, tmp_path: Path):
    """Moving a pick updates thickness_md; lithology_fractions preserved."""
    well_id, top_set_id = _create_well_with_top_set(api_client, tmp_path)

    # Set lithology on H1→H2 zone
    resp = api_client.get(f'/api/wells/{well_id}/zones')
    zones = resp.json()
    zone_h1_h2 = next(z for z in zones if z['upper_horizon']['name'] == 'H1')
    resp = api_client.patch(f'/api/wells/{well_id}/zones/{zone_h1_h2["zone_id"]}', json={
        'lithology_fractions': '{"sandstone": 1.0}',
        'lithology_source': 'manual',
    })
    assert resp.status_code == 200, resp.text

    # Move H2 pick from 300 to 400
    resp = api_client.get(f'/api/wells/{well_id}/formations')
    h2_pick = next(f for f in resp.json() if f['name'] == 'H2')
    resp = api_client.patch(f'/api/wells/{well_id}/formations/{h2_pick["id"]}', json={'depth_md': 400.0})
    assert resp.status_code == 200, resp.text

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    zones = resp.json()
    z = next(z for z in zones if z['upper_horizon']['name'] == 'H1')
    assert z['thickness_md'] == pytest.approx(300.0)
    assert z['lithology_fractions'] == '{"sandstone": 1.0}'
    assert z['lithology_source'] == 'manual'


def test_zone_lithology_fraction_sum_validation(api_client: TestClient, tmp_path: Path):
    """Fractions summing to > 1.0 return 400."""
    well_id, _ = _create_well_with_top_set(api_client, tmp_path)
    resp = api_client.get(f'/api/wells/{well_id}/zones')
    zone_id = resp.json()[0]['zone_id']

    resp = api_client.patch(f'/api/wells/{well_id}/zones/{zone_id}', json={
        'lithology_fractions': '{"sandstone": 0.7, "shale": 0.5}',
        'lithology_source': 'manual',
    })
    assert resp.status_code == 400, resp.text
    assert '1.0' in resp.json()['detail'] or '1.2' in resp.json()['detail']


def test_zone_no_active_top_set_returns_empty(api_client: TestClient, tmp_path: Path):
    """Well with no active TopSet has empty zones array."""
    _create_project(api_client, tmp_path, 'zone-empty')
    resp = api_client.post('/api/projects/wells', json={
        'name': 'Plain Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 500.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_id = resp.json()['well_id']

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    assert resp.status_code == 200, resp.text
    assert resp.json() == []

    resp = api_client.get('/api/wells/inventory')
    inv = next(w for w in resp.json() if w['well_id'] == well_id)
    assert inv['zones'] == []


# ---------------------------------------------------------------------------
# ZONE-004 tests
# ---------------------------------------------------------------------------

def _create_well_with_zone_subsidence(client, tmp_path: Path):
    """Create a project + well with 3 dated picks and a linked TopSet for subsidence tests."""
    _create_project(client, tmp_path, 'zone-sub')

    resp = client.post('/api/projects/wells', json={
        'name': 'Sub Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 300.0, 'crs': 'local',
    })
    assert resp.status_code == 200, resp.text
    well_id = resp.json()['well_id']

    for name, depth, age in [('A', 0.0, 10.0), ('B', 100.0, 50.0), ('C', 200.0, 100.0)]:
        resp = client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa',
            'age_ma': age, 'lithology': 'sandstone',
        })
        assert resp.status_code == 201, resp.text

    resp = client.post('/api/top-sets', json={'name': 'Sub Set'})
    assert resp.status_code == 201, resp.text
    top_set_id = resp.json()['id']

    for name, age in [('A', 10.0), ('B', 50.0), ('C', 100.0)]:
        resp = client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name, 'age_ma': age})
        assert resp.status_code == 201, resp.text

    resp = client.put(f'/api/wells/{well_id}/active-top-set', json={'top_set_id': top_set_id})
    assert resp.status_code == 200, resp.text

    return well_id, top_set_id


def test_zone004_legacy_path_requires_no_top_set(api_client: TestClient, tmp_path: Path):
    """Without an active TopSet, subsidence uses legacy FormationTopModel path."""
    _create_project(api_client, tmp_path, 'zone-legacy')
    resp = api_client.post('/api/projects/wells', json={
        'name': 'Legacy Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 300.0, 'crs': 'local',
    })
    well_id = resp.json()['well_id']
    for name, depth, age in [('A', 0.0, 10.0), ('B', 100.0, 50.0), ('C', 200.0, 100.0)]:
        api_client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa',
            'age_ma': age, 'lithology': 'sandstone',
        })

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert len(results) == 3
    names = [r['formation_name'] for r in results]
    assert names.count('A') == 1
    assert names.count('B') == 2


def test_zone004_zone_path_used_when_top_set_active(api_client: TestClient, tmp_path: Path):
    """With an active TopSet, subsidence uses zone path; formation names become horizon pairs."""
    well_id, top_set_id = _create_well_with_zone_subsidence(api_client, tmp_path)

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    zones = resp.json()
    for zone in zones:
        api_client.patch(f'/api/wells/{well_id}/zones/{zone["zone_id"]}', json={
            'lithology_fractions': '{"sandstone": 1.0}',
            'lithology_source': 'manual',
        })

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert len(results) == 3
    names = {r['formation_name'] for r in results}
    assert 'C' in names
    assert 'A → B' in names
    assert 'B → C' in names


def test_zone004_zone_path_matches_legacy_for_single_lithology(api_client: TestClient, tmp_path: Path):
    """Zone path with {sandstone: 1.0} fractions reproduces legacy single-lithology burial depths."""
    _create_project(api_client, tmp_path, 'zone-match')
    resp = api_client.post('/api/projects/wells', json={
        'name': 'Match Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 300.0, 'crs': 'local',
    })
    well_id = resp.json()['well_id']
    for name, depth, age in [('X', 0.0, 10.0), ('Y', 100.0, 50.0), ('Z', 200.0, 100.0)]:
        api_client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa',
            'age_ma': age, 'lithology': 'sandstone',
        })

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    legacy_results = resp.json()
    assert len(legacy_results) == 3
    legacy = {r['formation_name']: r['burial_path'] for r in legacy_results[1:]}
    assert legacy_results[0]['formation_name'] == 'Y'

    resp = api_client.post('/api/top-sets', json={'name': 'Match Set'})
    top_set_id = resp.json()['id']
    for name, age in [('X', 10.0), ('Y', 50.0), ('Z', 100.0)]:
        api_client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name, 'age_ma': age})
    api_client.put(f'/api/wells/{well_id}/active-top-set', json={'top_set_id': top_set_id})

    resp = api_client.get(f'/api/wells/{well_id}/zones')
    for zone in resp.json():
        api_client.patch(f'/api/wells/{well_id}/zones/{zone["zone_id"]}', json={
            'lithology_fractions': '{"sandstone": 1.0}',
            'lithology_source': 'manual',
        })

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    zone_payload = resp.json()
    assert len(zone_payload) == 3
    assert zone_payload[0]['formation_name'] == 'Z'
    zone_results = {r['formation_name']: r['burial_path'] for r in zone_payload[1:]}

    assert len(legacy) == len(zone_results) == 2

    legacy_x = legacy['X']
    zone_xy = zone_results['X → Y']
    assert len(legacy_x) == len(zone_xy)
    for lp, zp in zip(legacy_x, zone_xy):
        assert lp['age_ma'] == pytest.approx(zp['age_ma'])
        assert lp['depth_m'] == pytest.approx(zp['depth_m'], abs=1e-6)

    legacy_y = legacy['Y']
    zone_yz = zone_results['Y → Z']
    assert len(legacy_y) == len(zone_yz)
    for lp, zp in zip(legacy_y, zone_yz):
        assert lp['age_ma'] == pytest.approx(zp['age_ma'])
        assert lp['depth_m'] == pytest.approx(zp['depth_m'], abs=1e-6)


def test_zone004_zones_without_lithology_use_default(api_client: TestClient, tmp_path: Path):
    """Zones with null lithology_fractions still produce subsidence results (using default params)."""
    well_id, _ = _create_well_with_zone_subsidence(api_client, tmp_path)

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert len(results) == 3
    for r in results:
        assert len(r['burial_path']) > 0


# ---------------------------------------------------------------------------
# ZONE-003 tests
# ---------------------------------------------------------------------------

def _insert_discrete_lithology_curve(
    project_path: Path,
    well_id: str,
    depths: list[float],
    codes: list[int],
    code_map: dict[str, str] | None,
    app_state,
) -> None:
    """Write a parquet file and insert a CurveMetadata row for a discrete lithology curve."""
    import json as _json
    import hashlib

    curves_dir = project_path / 'curves'
    curves_dir.mkdir(exist_ok=True)
    data_uri = f'curves/{well_id}_FACIES.parquet'
    parquet_path = project_path / data_uri

    frame = pd.DataFrame({'DEPT': depths, 'FACIES': codes})
    frame.to_parquet(parquet_path, index=False)

    from subsidence.data.schema import CurveMetadata as _CM
    from sqlalchemy import select as _sel
    manager = app_state.project_manager
    with manager.get_session() as session:
        row = _CM(
            well_id=well_id,
            mnemonic='FACIES',
            unit='',
            curve_type='discrete',
            family_code='lithology',
            depth_min=min(depths),
            depth_max=max(depths),
            n_samples=len(depths),
            data_uri=data_uri,
            source_hash=hashlib.sha256(b'test').hexdigest(),
            null_value=-999.25,
            discrete_code_map=_json.dumps(code_map) if code_map else None,
        )
        session.add(row)
        session.commit()


def test_zone003_recalculate_lithology_sets_auto_fractions(api_client: TestClient, tmp_path: Path):
    """Recalculate-lithology populates fractions from discrete curve for non-manual zones."""
    project_path = _create_project(api_client, tmp_path, 'zone003-auto')

    resp = api_client.post('/api/projects/wells', json={
        'name': 'Z3 Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 300.0, 'crs': 'local',
    })
    well_id = resp.json()['well_id']

    for name, depth, age in [('A', 0.0, 10.0), ('B', 150.0, 50.0), ('C', 300.0, 100.0)]:
        resp = api_client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa', 'age_ma': age,
        })
        assert resp.status_code == 201, resp.text

    resp = api_client.post('/api/top-sets', json={'name': 'Z3 Set'})
    top_set_id = resp.json()['id']
    for name, age in [('A', 10.0), ('B', 50.0), ('C', 100.0)]:
        api_client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name, 'age_ma': age})
    api_client.put(f'/api/wells/{well_id}/active-top-set', json={'top_set_id': top_set_id})

    # Zone A→B: depth 0–150, codes 1 (sandstone). Zone B→C: depth 150–300, codes 2 (shale).
    depths = list(range(0, 301, 10))
    codes = [1 if d < 150 else 2 for d in depths]
    _insert_discrete_lithology_curve(
        project_path, well_id, depths, codes,
        {'1': 'sandstone', '2': 'shale'},
        api_client.app.state,
    )

    resp = api_client.post(f'/api/wells/{well_id}/zones/recalculate-lithology')
    assert resp.status_code == 200, resp.text
    assert resp.json()['zones_updated'] == 2

    zones = api_client.get(f'/api/wells/{well_id}/zones').json()
    fractions_by_name = {
        f'{z["upper_horizon"]["name"]} → {z["lower_horizon"]["name"]}': z['lithology_fractions']
        for z in zones
    }
    import json as _json
    ab = _json.loads(fractions_by_name['A → B'])
    bc = _json.loads(fractions_by_name['B → C'])
    assert ab.get('sandstone', 0) == pytest.approx(1.0, abs=0.01)
    assert bc.get('shale', 0) == pytest.approx(1.0, abs=0.01)


def test_zone003_manual_zones_not_overwritten(api_client: TestClient, tmp_path: Path):
    """Zones with lithology_source='manual' are skipped by recalculate-lithology."""
    project_path = _create_project(api_client, tmp_path, 'zone003-manual')

    resp = api_client.post('/api/projects/wells', json={
        'name': 'Manual Well', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 200.0, 'crs': 'local',
    })
    well_id = resp.json()['well_id']

    for name, depth, age in [('A', 0.0, 10.0), ('B', 100.0, 50.0), ('C', 200.0, 100.0)]:
        api_client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa', 'age_ma': age,
        })

    resp = api_client.post('/api/top-sets', json={'name': 'Manual Set'})
    top_set_id = resp.json()['id']
    for name, age in [('A', 10.0), ('B', 50.0), ('C', 100.0)]:
        api_client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name, 'age_ma': age})
    api_client.put(f'/api/wells/{well_id}/active-top-set', json={'top_set_id': top_set_id})

    # Manually set zone A→B
    zones = api_client.get(f'/api/wells/{well_id}/zones').json()
    ab_zone = next(z for z in zones if z['upper_horizon']['name'] == 'A')
    api_client.patch(f'/api/wells/{well_id}/zones/{ab_zone["zone_id"]}', json={
        'lithology_fractions': '{"limestone": 1.0}',
        'lithology_source': 'manual',
    })

    # Discrete curve: all sandstone
    depths = list(range(0, 201, 10))
    codes = [1] * len(depths)
    _insert_discrete_lithology_curve(
        project_path, well_id, depths, codes,
        {'1': 'sandstone'},
        api_client.app.state,
    )

    resp = api_client.post(f'/api/wells/{well_id}/zones/recalculate-lithology')
    assert resp.status_code == 200, resp.text
    # Only B→C should be updated (A→B is manual)
    assert resp.json()['zones_updated'] == 1

    import json as _json
    zones_after = api_client.get(f'/api/wells/{well_id}/zones').json()
    ab_after = next(z for z in zones_after if z['upper_horizon']['name'] == 'A')
    assert _json.loads(ab_after['lithology_fractions']).get('limestone') == pytest.approx(1.0)


def test_zone003_no_curve_returns_zero_updates(api_client: TestClient, tmp_path: Path):
    """Recalculate-lithology is a no-op when no discrete lithology curve exists."""
    well_id, _ = _create_well_with_zone_subsidence(api_client, tmp_path)
    resp = api_client.post(f'/api/wells/{well_id}/zones/recalculate-lithology')
    assert resp.status_code == 200, resp.text
    assert resp.json()['zones_updated'] == 0


# ---------------------------------------------------------------------------
# BSTRIP-001 tests
# ---------------------------------------------------------------------------

def test_bstrip001_water_depth_shifts_burial_deeper(api_client: TestClient, tmp_path: Path):
    """Per-zone water_depth_m = 50 shifts all paleo burial depths 50 m deeper than water_depth_m = 0.

    The present-day anchor (age_ma=0, from actual TVDSS) is excluded — it does not shift
    with paleobathymetry since it is grounded to the measured well depth.
    """
    well_id, _ = _create_well_with_zone_subsidence(api_client, tmp_path)

    # Base calculation with default water_depth_m = 0
    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    base_results = {r['formation_name']: r['burial_path'] for r in resp.json()}

    # Set water_depth_m = 50 on both upper picks (A and B)
    formations = api_client.get(f'/api/wells/{well_id}/formations').json()
    for f in formations:
        if f['name'] in ('A', 'B'):
            api_client.patch(f'/api/wells/{well_id}/formations/{f["id"]}', json={'water_depth_m': 50.0})

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    shifted = {r['formation_name']: r['burial_path'] for r in resp.json()}

    for name in base_results:
        for bp_base, bp_shifted in zip(base_results[name], shifted[name]):
            if bp_base['age_ma'] == 0:
                continue  # present-day TVDSS anchor is not affected by paleobathymetry
            assert bp_shifted['depth_m'] == pytest.approx(bp_base['depth_m'] + 50.0, abs=0.1)


def test_bstrip001_sea_level_curve_shifts_burial(api_client: TestClient, tmp_path: Path):
    """Sea level curve with constant +30 m shifts paleo burial depths by -30 m (shallower).

    sign convention: sea_level_m > 0 means sea surface was above the modern datum.
    offset = water_depth - sea_level, so a higher sea level reduces burial depth.
    Present-day anchors (age_ma=0) are excluded from comparison.
    """
    well_id, _ = _create_well_with_zone_subsidence(api_client, tmp_path)

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    base_results = {r['formation_name']: r['burial_path'] for r in resp.json()}

    # Create a sea level curve with constant 30 m at all relevant ages
    resp = api_client.post('/api/sea-level-curves', json={'name': 'Test Curve'})
    assert resp.status_code == 201, resp.text
    curve_id = resp.json()['id']

    api_client.post(f'/api/sea-level-curves/{curve_id}/points', json=[
        {'age_ma': 200.0, 'sea_level_m': 30.0},
        {'age_ma': 0.0, 'sea_level_m': 30.0},
    ])

    resp = api_client.put(f'/api/wells/{well_id}/active-sea-level-curve', json={'curve_id': curve_id})
    assert resp.status_code == 200, resp.text

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    shifted = {r['formation_name']: r['burial_path'] for r in resp.json()}

    for name in base_results:
        for bp_base, bp_shifted in zip(base_results[name], shifted[name]):
            if bp_base['age_ma'] == 0:
                continue  # present-day TVDSS anchor is not affected by sea level correction
            assert bp_shifted['depth_m'] == pytest.approx(bp_base['depth_m'] - 30.0, abs=0.1)

    # Removing the curve restores original depths
    api_client.put(f'/api/wells/{well_id}/active-sea-level-curve', json={'curve_id': None})
    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    restored = {r['formation_name']: r['burial_path'] for r in resp.json()}
    for name in base_results:
        for bp_base, bp_restored in zip(base_results[name], restored[name]):
            if bp_base['age_ma'] == 0:
                continue
            assert bp_restored['depth_m'] == pytest.approx(bp_base['depth_m'], abs=0.1)


def test_bstrip001_eroded_thickness_increases_column_height(api_client: TestClient, tmp_path: Path):
    """eroded_thickness_m = 100 on a zone upper pick increases decompacted column vs 0."""
    well_id, _ = _create_well_with_zone_subsidence(api_client, tmp_path)

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    base_paths = {r['formation_name']: r['burial_path'] for r in resp.json()}

    # Add eroded_thickness_m = 100 to pick A (upper boundary of A→B zone)
    formations = api_client.get(f'/api/wells/{well_id}/formations').json()
    pick_a = next(f for f in formations if f['name'] == 'A')
    api_client.patch(f'/api/wells/{well_id}/formations/{pick_a["id"]}', json={'eroded_thickness_m': 100.0})

    resp = api_client.post(f'/api/wells/{well_id}/subsidence')
    assert resp.status_code == 200, resp.text
    eroded_paths = {r['formation_name']: r['burial_path'] for r in resp.json()}

    # A→B is thicker with eroded section → B→C is buried deeper at t=10 (pushed down by thicker A→B above it)
    bc_base = next(p['depth_m'] for p in base_paths['B → C'] if p['age_ma'] == pytest.approx(10.0))
    bc_eroded = next(p['depth_m'] for p in eroded_paths['B → C'] if p['age_ma'] == pytest.approx(10.0))
    assert bc_eroded > bc_base


def test_bstrip001_sea_level_crud(api_client: TestClient, tmp_path: Path):
    """CRUD operations for sea level curves work correctly."""
    _create_project(api_client, tmp_path, 'sl-crud')

    # Create
    resp = api_client.post('/api/sea-level-curves', json={'name': 'Haq 1987', 'source': 'Haq et al.'})
    assert resp.status_code == 201, resp.text
    curve_id = resp.json()['id']

    # Upload points
    points = [{'age_ma': float(a), 'sea_level_m': float(a * 0.1)} for a in range(0, 201, 10)]
    resp = api_client.post(f'/api/sea-level-curves/{curve_id}/points', json=points)
    assert resp.status_code == 201, resp.text
    assert resp.json()['count'] == len(points)

    # List
    resp = api_client.get('/api/sea-level-curves')
    assert resp.status_code == 200, resp.text
    curves = resp.json()
    assert any(c['id'] == curve_id and c['point_count'] == len(points) for c in curves)

    # Cannot delete while in use
    resp2 = api_client.post('/api/projects/wells', json={
        'name': 'W', 'x': 0.0, 'y': 0.0, 'kb': 0.0, 'td': 100.0, 'crs': 'local',
    })
    well_id = resp2.json()['well_id']
    api_client.put(f'/api/wells/{well_id}/active-sea-level-curve', json={'curve_id': curve_id})
    resp = api_client.delete(f'/api/sea-level-curves/{curve_id}')
    assert resp.status_code == 409

    # After clearing, can delete
    api_client.put(f'/api/wells/{well_id}/active-sea-level-curve', json={'curve_id': None})
    resp = api_client.delete(f'/api/sea-level-curves/{curve_id}')
    assert resp.status_code == 204


def test_bstrip001_import_sea_level_curve_from_csv(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'sl-import')
    csv_path = tmp_path / 'sea_level.csv'
    csv_path.write_text(
        'metadata line\n'
        'age;level\n'
        '0;0\n'
        '10;15\n'
        '20;-25\n',
        encoding='utf-8',
    )

    resp = api_client.post('/api/sea-level-curves/import', json={
        'csv_path': str(csv_path),
        'curve_name': 'Imported SL',
        'column_map': {'age_ma': 'age', 'sea_level_m': 'level'},
        'delimiter': ';',
        'header_row': 1,
    })
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload['point_count'] == 3

    resp = api_client.get('/api/sea-level-curves')
    assert resp.status_code == 200, resp.text
    curve = next(c for c in resp.json() if c['id'] == payload['curve_id'])
    assert curve['name'] == 'Imported SL'
    assert curve['is_builtin'] is False
    assert curve['point_count'] == 3

    resp = api_client.get(f"/api/sea-level-curves/{payload['curve_id']}/points")
    assert resp.status_code == 200, resp.text
    assert resp.json() == [
        {'age_ma': 20.0, 'sea_level_m': -25.0},
        {'age_ma': 10.0, 'sea_level_m': 15.0},
        {'age_ma': 0.0, 'sea_level_m': 0.0},
    ]


def test_builtin_sea_level_curve_points_are_read_only(api_client: TestClient, tmp_path: Path):
    _create_project(api_client, tmp_path, 'sl-builtin-readonly')

    resp = api_client.get('/api/sea-level-curves')
    assert resp.status_code == 200, resp.text
    builtin = next(curve for curve in resp.json() if curve['is_builtin'])

    resp = api_client.post(
        f"/api/sea-level-curves/{builtin['id']}/points",
        json=[{'age_ma': 0.0, 'sea_level_m': 0.0}],
    )
    assert resp.status_code == 409, resp.text

    resp = api_client.get(f"/api/sea-level-curves/{builtin['id']}/points")
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) == 53
