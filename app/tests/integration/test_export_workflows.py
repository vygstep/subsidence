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


def test_export_current_well_logs_csv_round_trips_with_logs_import(tmp_path: Path) -> None:
    manager = app.state.project_manager
    if manager.is_open:
        manager.close_project()

    with TestClient(app) as client:
        _create_project(client, tmp_path, 'logs-csv-export')
        source_csv = tmp_path / 'source_logs.csv'
        source_csv.write_text(
            'well_name,DEPT [m],GR [api],RHOB [g/cm3]\n'
            'Export Log Well,100,75,2.35\n'
            'Export Log Well,200,80,2.40\n'
            'Export Log Well,300,85,2.45\n',
            encoding='utf-8',
        )
        response = client.post('/api/projects/import-logs-csv', json={'csv_path': str(source_csv)})
        assert response.status_code == 200, response.text
        well_id = response.json()['well_id']

        response = client.post(f'/api/export/wells/logs/csv', json={
            'scope': 'current',
            'well_id': well_id,
        })
        assert response.status_code == 200, response.text
        assert response.headers['content-type'].startswith('text/csv')
        reader = csv.DictReader(io.StringIO(response.content.decode('utf-8-sig')))
        assert reader.fieldnames == ['well_name', 'DEPT [m]', 'GR [gAPI]', 'RHOB [g/cc]']
        export_csv = tmp_path / 'exported_logs.csv'
        export_csv.write_bytes(response.content)

        response = client.post('/api/projects/close')
        assert response.status_code == 200, response.text
        clean_project = _create_project(client, tmp_path, 'logs-csv-roundtrip')
        response = client.post('/api/projects/import-logs-csv', json={'csv_path': str(export_csv)})
        assert response.status_code == 200, response.text
        response = client.get('/api/wells/inventory')
        assert response.status_code == 200, response.text
        wells = response.json()
        assert len(wells) == 1
        assert wells[0]['well_name'] == 'Export Log Well'
        assert [curve['mnemonic'] for curve in wells[0]['curves']] == ['GR', 'RHOB']
        assert [curve['unit'] for curve in wells[0]['curves']] == ['gAPI', 'g/cc']
        assert clean_project.exists()

    if manager.is_open:
        manager.close_project()


def test_export_current_well_logs_las_round_trips_with_las_import(tmp_path: Path) -> None:
    manager = app.state.project_manager
    if manager.is_open:
        manager.close_project()

    with TestClient(app) as client:
        _create_project(client, tmp_path, 'logs-las-export')
        source_csv = tmp_path / 'source_logs_for_las.csv'
        source_csv.write_text(
            'well_name,DEPT [m],GR [api],RHOB [g/cm3]\n'
            'Export LAS Well,100,75,2.35\n'
            'Export LAS Well,200,80,2.40\n'
            'Export LAS Well,300,85,2.45\n',
            encoding='utf-8',
        )
        response = client.post('/api/projects/import-logs-csv', json={'csv_path': str(source_csv)})
        assert response.status_code == 200, response.text
        well_id = response.json()['well_id']
        response = client.patch(f'/api/wells/{well_id}', json={
            'kb_elev': 12.0,
            'td_md': 350.0,
            'x': 123.0,
            'y': 456.0,
            'crs': 'local',
        })
        assert response.status_code == 200, response.text

        response = client.post(f'/api/export/wells/logs/las', json={
            'scope': 'current',
            'well_id': well_id,
        })
        assert response.status_code == 200, response.text
        assert response.headers['content-type'] == 'application/octet-stream'
        export_las = tmp_path / 'exported_logs.las'
        export_las.write_bytes(response.content)

        response = client.post('/api/projects/close')
        assert response.status_code == 200, response.text
        _create_project(client, tmp_path, 'logs-las-roundtrip')
        response = client.post('/api/projects/import-las', json={'las_path': str(export_las)})
        assert response.status_code == 200, response.text
        response = client.get('/api/wells/inventory')
        assert response.status_code == 200, response.text
        wells = response.json()
        assert len(wells) == 1
        assert wells[0]['well_name'] == 'Export LAS Well'
        assert wells[0]['kb_elev'] == 12.0
        assert wells[0]['td_md'] == 350.0
        assert wells[0]['x'] == 123.0
        assert wells[0]['y'] == 456.0
        assert wells[0]['crs'] == 'local'
        assert [curve['mnemonic'] for curve in wells[0]['curves']] == ['GR', 'RHOB']
        assert [curve['unit'] for curve in wells[0]['curves']] == ['gAPI', 'g/cc']

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
