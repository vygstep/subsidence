from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from subsidence.api.main import app


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
