from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from subsidence.api.main import app
from subsidence.data.schema import LithologySet, LithologySetEntry


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
