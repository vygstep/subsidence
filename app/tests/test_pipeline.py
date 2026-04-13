from pathlib import Path

from subsidence.pipeline import build_curve


def test_build_curve_averages_values(tmp_path: Path) -> None:
    a = tmp_path / "a.csv"
    b = tmp_path / "b.csv"

    a.write_text("time,value\n0,0\n1,1\n", encoding="utf-8")
    b.write_text("time,value\n0,2\n1,3\n", encoding="utf-8")

    merged = build_curve([a, b])
    assert merged == [(0.0, 1.0, 2), (1.0, 2.0, 2)]
