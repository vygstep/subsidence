from pathlib import Path
import sqlite3

from subsidence.data import BoundaryType
from subsidence.data import DepthReference
from subsidence.data import TopsLoadOptions
from subsidence.data import link_strat_tops_to_unconformities
from subsidence.data import load_csv_log_curves
from subsidence.data import load_strat_chart_csv
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


def test_load_csv_curves_with_dictionary_mapping(tmp_path: Path) -> None:
    db_path = tmp_path / "project.db"
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE dict_curve_family (
                family_id INTEGER PRIMARY KEY,
                family_code TEXT,
                canonical_mnemonic TEXT,
                canonical_unit TEXT,
                is_active INTEGER
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE dict_curve_alias (
                alias_id INTEGER PRIMARY KEY,
                source_scope TEXT,
                pattern TEXT,
                is_regex INTEGER,
                priority INTEGER,
                family_id INTEGER,
                canonical_mnemonic_override TEXT,
                canonical_unit_override TEXT,
                is_active INTEGER
            )
            """
        )
        conn.execute(
            "INSERT INTO dict_curve_family VALUES (1, 'gamma_ray', 'GR', 'gAPI', 1)"
        )
        conn.execute(
            "INSERT INTO dict_curve_alias VALUES (1, 'base', 'GR*', 0, 10, 1, NULL, NULL, 1)"
        )
        conn.commit()

    csv_path = tmp_path / "logs.csv"
    csv_path.write_text("MD,GRC\n1000,80\n1001,81\n", encoding="utf-8")

    curves = load_csv_log_curves(csv_path, dictionary_db_path=db_path)

    assert len(curves) == 1
    assert curves[0].mnemonic == "GRC"
    assert curves[0].standard_mnemonic == "GR"
    assert curves[0].family_code == "gamma_ray"
    assert curves[0].unit == "gAPI"


def test_link_strat_tops_to_unconformities_by_reference(tmp_path: Path) -> None:
    tops_csv = tmp_path / "tops.csv"
    tops_csv.write_text(
        "well_name,top_name,depth,boundary_type,unconformity_ref\n"
        "A-1,TOP_X,1300,unconformity,U1\n",
        encoding="utf-8",
    )
    unc_csv = tmp_path / "unconformities.csv"
    unc_csv.write_text(
        "well_name,unc_name,md,start_age_ma,base_age_ma\n"
        "A-1,U1,1300,50,55\n",
        encoding="utf-8",
    )

    tops = load_strat_tops_csv(tops_csv, options=TopsLoadOptions(depth_ref=DepthReference.MD))
    uncs = load_unconformities_csv(unc_csv)
    links = link_strat_tops_to_unconformities(tops, uncs)

    assert tops[0].boundary_type == BoundaryType.UNCONFORMITY
    assert len(links) == 1
    assert links[0].link_method == "ref"


def test_load_strat_chart_csv(tmp_path: Path) -> None:
    units_csv = tmp_path / "units.csv"
    ranks_csv = tmp_path / "ranks.csv"
    units_csv.write_text(
        "unit_id,parent_unit_id,unit_name_en,unit_name_ru,strat_code,rank_id,start_age_ma,end_age_ma,red,green,blue,standard_sort\n"
        "1,,SystemA,СистемаA,SA,5,0,10,10,20,30,1\n"
        "2,1,SeriesA,ОтделA,SB,6,0,5,40,50,60,2\n",
        encoding="utf-8",
    )
    ranks_csv.write_text(
        "rank_id,rank_name_en,rank_name_ru\n5,System,Система\n6,Series,Отдел\n",
        encoding="utf-8",
    )

    chart = load_strat_chart_csv(units_csv, ranks_csv)

    assert len(chart.units) == 2
    assert len(chart.ranks) == 2
    assert chart.units_by_id[2].parent_unit_id == 1
