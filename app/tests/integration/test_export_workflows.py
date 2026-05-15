from pathlib import Path
import csv
import io

from fastapi.testclient import TestClient

from subsidence.api.main import app


def _create_project(client: TestClient, tmp_path: Path, name: str = 'export-workflow') -> Path:
    response = client.post('/api/projects', json={'name': name, 'path': str(tmp_path), 'overwrite': True})
    assert response.status_code == 200, response.text
    project_path = Path(response.json()['project_path'])
    response = client.post('/api/projects/open', json={'path': str(project_path)})
    assert response.status_code == 200, response.text
    return project_path


def test_export_current_well_info_download_round_trips_with_wells_import(tmp_path: Path) -> None:
    manager = app.state.project_manager
    if manager.is_open:
        manager.close_project()

    with TestClient(app) as client:
        _create_project(client, tmp_path, 'well-info-current')
        response = client.post('/api/projects/wells', json={
            'name': 'Export Well',
            'x': 123.0,
            'y': 456.0,
            'kb': 10.0,
            'td': 1500.0,
            'crs': 'local',
        })
        assert response.status_code == 200, response.text
        well_id = response.json()['well_id']
        response = client.patch(f'/api/wells/{well_id}', json={'gl_elev': 5.0, 'color_hex': '#dc2626'})
        assert response.status_code == 200, response.text

        response = client.post('/api/export/wells/info', json={
            'scope': 'current',
            'well_id': well_id,
        })
        assert response.status_code == 200, response.text
        assert response.headers['content-type'].startswith('text/csv')
        assert 'Export Well_well_info.csv' in response.headers['content-disposition']
        reader = csv.DictReader(io.StringIO(response.content.decode('utf-8-sig')))
        assert reader.fieldnames is not None
        assert 'well_id' not in reader.fieldnames
        assert 'uwi' not in reader.fieldnames
        assert 'source_las_path' not in reader.fieldnames
        assert 'color_hex' in reader.fieldnames
        csv_path = tmp_path / 'exported_well.csv'
        csv_path.write_bytes(response.content)

        response = client.post('/api/projects/close')
        assert response.status_code == 200, response.text
        response = client.post('/api/projects', json={'name': 'well-info-roundtrip', 'path': str(tmp_path), 'overwrite': True})
        assert response.status_code == 200, response.text
        clean_project = response.json()['project_path']
        response = client.post('/api/projects/open', json={'path': clean_project})
        assert response.status_code == 200, response.text

        response = client.post('/api/projects/import-wells', json={'csv_path': str(csv_path)})
        assert response.status_code == 200, response.text
        response = client.get('/api/wells/inventory')
        wells = response.json()
        assert len(wells) == 1
        assert wells[0]['well_name'] == 'Export Well'
        assert wells[0]['x'] == 123.0
        assert wells[0]['y'] == 456.0
        assert wells[0]['kb_elev'] == 10.0
        assert wells[0]['gl_elev'] == 5.0
        assert wells[0]['td_md'] == 1500.0
        assert wells[0]['crs'] == 'local'
        assert wells[0]['color_hex'] == '#dc2626'

    if manager.is_open:
        manager.close_project()


def test_export_all_well_info_to_folder_and_zip(tmp_path: Path) -> None:
    manager = app.state.project_manager
    if manager.is_open:
        manager.close_project()

    with TestClient(app) as client:
        _create_project(client, tmp_path, 'well-info-all')
        for name in ('A Well', 'B Well'):
            response = client.post('/api/projects/wells', json={
                'name': name,
                'x': 0.0,
                'y': 0.0,
                'kb': 0.0,
                'td': 100.0,
                'crs': 'local',
            })
            assert response.status_code == 200, response.text

        out_dir = tmp_path / 'exports'
        out_dir.mkdir()
        response = client.post('/api/export/wells/info', json={
            'scope': 'all',
            'packaging': 'one_file_per_well',
            'output_dir': str(out_dir),
        })
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload['file_count'] == 2
        assert sorted(path.name for path in out_dir.glob('*.csv')) == ['A Well_well_info.csv', 'B Well_well_info.csv']

        response = client.post('/api/export/wells/info', json={
            'scope': 'all',
            'packaging': 'one_file_per_well',
            'export_to_zip': True,
        })
        assert response.status_code == 200, response.text
        assert response.headers['content-type'] == 'application/zip'

    if manager.is_open:
        manager.close_project()
