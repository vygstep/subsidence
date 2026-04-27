from __future__ import annotations

from pathlib import Path

import pytest
import pandas as pd
from fastapi.testclient import TestClient
from sqlalchemy import select as sa_select

from subsidence.api.main import app
from subsidence.data.schema import (
    CurveMetadata,
    CurveMnemonicEntry,
    CurveMnemonicSet,
    LithologyPattern,
    LithologyPatternPalette,
    LithologySet,
    LithologySetEntry,
    MeasurementUnit,
    MeasurementUnitAlias,
    UnitDimension,
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
        frame = pd.read_parquet(project_path / curve.data_uri)

    assert frame['DEPT'].tolist() == pytest.approx([30.48, 60.96, 91.44])
    assert frame['NPHI'].tolist() == pytest.approx([0.35, 0.36, 0.37])


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

    assert frame['BULK'].tolist() == pytest.approx([2350.0, 2400.0, 2450.0])


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
        frame = pd.read_parquet(project_path / curve.data_uri)

    assert frame['DEPT'].tolist() == pytest.approx([30.48, 60.96, 91.44])
    assert frame['RHOB'].tolist() == pytest.approx([2.35, 2.4, 2.45])


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
        '1,,System A,system,0,50,#123456\n'
        '2,1,Stage A,stage,0,25,#abcdef\n',
        encoding='utf-8',
    )
    response = api_client.post('/api/strat-charts/import', json={'csv_path': str(chart_csv)})
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
    assert builtin['entry_count'] >= 10

    response = api_client.get(f"/api/lithology-pattern-palettes/{builtin['id']}")
    assert response.status_code == 200, response.text
    detail = response.json()
    codes = {row['code'] for row in detail['patterns']}
    assert {'sandstone', 'shale', 'limestone', 'dolomite', 'conglomerate'} <= codes
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

    response = api_client.post('/api/projects/checkpoints', json={'name': 'before-second-well', 'description': ''})
    assert response.status_code == 200, response.text
    checkpoint_id = response.json()['id']

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
    assert all(item['id'] != before_restore_checkpoint_id for item in response.json())


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

    # Create 4 picks with known depths
    pick_depths = {'H1': 100.0, 'H2': 300.0, 'H3': 600.0, 'H4': 900.0}
    for name, depth in pick_depths.items():
        resp = client.post(f'/api/wells/{well_id}/formations', json={
            'name': name, 'depth_md': depth, 'color': '#aaaaaa',
        })
        assert resp.status_code == 201, resp.text

    # Create TopSet with 4 horizons
    resp = client.post('/api/top-sets', json={'name': 'Main Set'})
    assert resp.status_code == 201, resp.text
    top_set_id = resp.json()['id']

    for name in ['H1', 'H2', 'H3', 'H4']:
        resp = client.post(f'/api/top-sets/{top_set_id}/horizons', json={'name': name})
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


def test_zone_lifecycle_delete_middle_horizon_merges_zones(api_client: TestClient, tmp_path: Path):
    """Deleting a middle horizon merges adjacent zones; lithology cleared."""
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

    # Merged zone lithology is cleared
    merged = next(z for z in zones if z['upper_horizon']['name'] == 'H1' and z['lower_horizon']['name'] == 'H3')
    assert merged['lithology_fractions'] is None
    assert merged['lithology_source'] == 'manual'

    # Thickness should be recalculated for merged zone
    assert merged['thickness_md'] == pytest.approx(500.0)


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
    assert len(results) == 2
    names = [r['formation_name'] for r in results]
    assert 'A' in names and 'B' in names


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
    assert len(results) == 2
    names = {r['formation_name'] for r in results}
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
    legacy = {r['formation_name']: r['burial_path'] for r in resp.json()}

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
    zone_results = {r['formation_name']: r['burial_path'] for r in resp.json()}

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
    assert len(results) == 2
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
