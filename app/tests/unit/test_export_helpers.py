from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from subsidence.api.main import app
from subsidence.api.export import (
    csv_bytes,
    _regular_depth_grid,
    _resample_continuous_curve,
    _resample_discrete_curve,
    sanitize_filename,
    validate_output_dir,
    write_export_files,
    zip_bytes,
)

import numpy as np
from types import SimpleNamespace


def test_export_capabilities_route_is_registered() -> None:
    with TestClient(app) as client:
        response = client.get('/api/export/capabilities')

    assert response.status_code == 200
    assert response.json() == {
        'table_packaging': ['one_file_per_well', 'one_file_for_all_wells'],
        'las_packaging': ['one_file_per_well'],
        'supports_output_dir': True,
        'supports_zip': True,
    }


def test_sanitize_filename_removes_platform_unsafe_characters() -> None:
    assert sanitize_filename(' Well: A/B*?.csv ') == 'Well_ A_B__.csv'
    assert sanitize_filename('...') == 'export'


def test_csv_bytes_writes_utf8_bom_header_and_blank_nulls() -> None:
    payload = csv_bytes(['well_id', 'well_name', 'td_md'], [
        {'well_id': 'w1', 'well_name': 'A', 'td_md': 100.0},
        {'well_id': 'w2', 'well_name': None, 'td_md': None, 'ignored': 'x'},
    ])

    text = payload.decode('utf-8-sig')
    assert text.splitlines() == [
        'well_id,well_name,td_md',
        'w1,A,100.0',
        'w2,,',
    ]


def test_zip_bytes_sanitizes_member_names() -> None:
    payload = zip_bytes([('bad/name.csv', b'a,b\n1,2\n')])

    import zipfile
    import io

    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        assert archive.namelist() == ['bad_name.csv']
        assert archive.read('bad_name.csv') == b'a,b\n1,2\n'


def test_validate_output_dir_accepts_existing_directory(tmp_path: Path) -> None:
    assert validate_output_dir(str(tmp_path)) == tmp_path.resolve()
    assert validate_output_dir(None) is None


def test_validate_output_dir_rejects_missing_or_file(tmp_path: Path) -> None:
    with pytest.raises(HTTPException):
        validate_output_dir(str(tmp_path / 'missing'))

    file_path = tmp_path / 'file.txt'
    file_path.write_text('x', encoding='utf-8')
    with pytest.raises(HTTPException):
        validate_output_dir(str(file_path))


def test_write_export_files_returns_written_paths(tmp_path: Path) -> None:
    result = write_export_files(tmp_path, [('well:1.csv', b'abc')])

    assert result.status == 'ok'
    assert result.file_count == 1
    assert result.files[0].filename == 'well_1.csv'
    assert Path(result.files[0].path).read_bytes() == b'abc'
    assert result.files[0].byte_size == 3


def test_regular_depth_grid_uses_requested_step_and_includes_max_depth() -> None:
    grid = _regular_depth_grid(100.0, 100.55, 0.2)

    assert grid.tolist() == [100.0, 100.2, 100.4, 100.55]


def test_continuous_las_resampling_interpolates_without_bridging_large_gaps() -> None:
    row = SimpleNamespace(nominal_step_m=1.0)
    grid = np.array([0.0, 0.5, 1.0, 2.0, 4.0, 5.0])
    depths = np.array([0.0, 1.0, 5.0])
    values = np.array([10.0, 20.0, 50.0])

    result = _resample_continuous_curve(grid, depths, values, row)

    assert result[:3].tolist() == [10.0, 15.0, 20.0]
    assert np.isnan(result[3])
    assert np.isnan(result[4])
    assert result[5] == 50.0


def test_discrete_las_resampling_steps_down_without_bridging_large_gaps() -> None:
    row = SimpleNamespace(nominal_step_m=1.0)
    grid = np.array([0.0, 0.5, 1.0, 2.0, 4.0, 5.0])
    depths = np.array([0.0, 1.0, 5.0])
    values = np.array([1.0, 2.0, 3.0])

    result = _resample_discrete_curve(grid, depths, values, row)

    assert result[:3].tolist() == [1.0, 1.0, 2.0]
    assert np.isnan(result[3])
    assert np.isnan(result[4])
    assert result[5] == 3.0
