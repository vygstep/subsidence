from pathlib import Path

from subsidence.data import DepthReference
from subsidence.data import TopsLoadOptions
from subsidence.data import load_csv_log_curves
from subsidence.data import load_strat_tops_csv
from subsidence.data import load_unconformities_csv


def test_load_csv_log_curves_detects_depth_column(tmp_path: Path) -> None:
    csv_path = tmp_path / "logs.csv"
    csv_path.write_text(
        "MD,GR,DT\n1000,80,90\n1001,82,91\n1002,84,92\n",
        encoding="utf-8",
    )

    curves = load_csv_log_curves(csv_path, depth_ref=DepthReference.MD)
    mnemonics = {curve.mnemonic for curve in curves}

    assert mnemonics == {"GR", "DT"}
    assert all(curve.depth_ref == DepthReference.MD for curve in curves)


def test_load_strat_tops_csv_reads_optional_age(tmp_path: Path) -> None:
    csv_path = tmp_path / "tops.csv"
    csv_path.write_text(
        "well_name,top_name,depth,strat_age_ma\nA-1,TOP_A,1200,10.5\n",
        encoding="utf-8",
    )

    picks = load_strat_tops_csv(
        csv_path,
        options=TopsLoadOptions(depth_ref=DepthReference.TVD),
    )

    assert len(picks) == 1
    assert picks[0].depth_ref == DepthReference.TVD
    assert picks[0].strat_age_ma == 10.5


def test_load_unconformities_csv_requires_expected_fields(tmp_path: Path) -> None:
    csv_path = tmp_path / "unconformities.csv"
    csv_path.write_text(
        "well_name,unc_name,md,start_age_ma,base_age_ma\nA-1,U1,1300,50,55\n",
        encoding="utf-8",
    )

    picks = load_unconformities_csv(csv_path)

    assert len(picks) == 1
    assert picks[0].unc_name == "U1"
    assert picks[0].md == 1300.0
