import pytest

from subsidence.data.importers.log_resampling import (
    VERTICAL_TVD_IMPORT_WARNING,
    build_md_grid,
    convert_source_depths_to_md,
    resample_continuous_to_md_grid,
    resample_discrete_to_md_grid,
)


def test_build_md_grid_covers_zero_to_td_and_includes_td() -> None:
    assert build_md_grid(1.0, 0.2) == [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    assert build_md_grid(0.55, 0.2) == [0.0, 0.2, 0.4, 0.55]


def test_continuous_resampling_preserves_null_gap() -> None:
    grid = build_md_grid(4.0, 1.0)

    result = resample_continuous_to_md_grid(
        grid,
        [0.0, 1.0, 2.0, 3.0, 4.0],
        [10.0, 20.0, None, 40.0, 50.0],
    )

    assert result.values == [10.0, 20.0, None, 40.0, 50.0]
    assert result.valid_depth_min == 0.0
    assert result.valid_depth_max == 4.0
    assert result.valid_sample_count == 4


def test_continuous_resampling_interpolates_inside_valid_interval_only() -> None:
    grid = build_md_grid(2.0, 0.5)

    result = resample_continuous_to_md_grid(grid, [0.0, 2.0], [10.0, 30.0])

    assert result.values == [10.0, 15.0, 20.0, 25.0, 30.0]


def test_discrete_resampling_steps_down_and_preserves_null_gap() -> None:
    grid = build_md_grid(4.0, 1.0)

    result = resample_discrete_to_md_grid(
        grid,
        [0.0, 2.0, 3.0, 4.0],
        [1.0, None, 3.0, 4.0],
    )

    assert result.values == [1.0, 1.0, None, 3.0, 4.0]


def test_tvdss_depth_conversion_uses_deviation_converter_when_available() -> None:
    result = convert_source_depths_to_md(
        [90.0, 100.0],
        depth_reference='TVDSS',
        kb_elev=10.0,
        tvd_to_md=lambda tvd: tvd + 1.0,
    )

    assert result.depths_md == [101.0, 111.0]
    assert result.warning is None


def test_tvdss_depth_conversion_uses_vertical_warning_without_deviation() -> None:
    result = convert_source_depths_to_md([90.0], depth_reference='TVDSS', kb_elev=10.0)

    assert result.depths_md == [100.0]
    assert result.warning == VERTICAL_TVD_IMPORT_WARNING


def test_tvd_depth_conversion_rejects_failed_deviation_conversion() -> None:
    with pytest.raises(ValueError, match='Could not convert TVD depth'):
        convert_source_depths_to_md([100.0], depth_reference='TVD', kb_elev=0.0, tvd_to_md=lambda _tvd: None)
