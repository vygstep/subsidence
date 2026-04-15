"""Shared constants and demo dataset for the Dash application."""
from __future__ import annotations

from .plotting.burial import BurialCurve, TimeScaleBand
from .plotting.well_log import CurveTrack, LithologyInterval, StratInterval

CLEAR_OPTIONS = [
    {"label": "Deviation survey", "value": "deviation"},
    {"label": "Stratigraphy", "value": "stratigraphy"},
    {"label": "Lithology", "value": "lithology"},
    {"label": "Logs", "value": "logs"},
    {"label": "Tops and unconformities", "value": "tops"},
]

MODAL_IDS = [
    "create-well",
    "modify-well",
    "add-deviation",
    "add-stratigraphy",
    "add-log",
    "clear-well-data",
    "delete-well",
]

CARD_CLASS = "border-0 shadow-sm"
GRAPH_CARD_STYLE = {"border": "1px solid #cbd5e1", "borderRadius": "0.6rem", "width": "100%"}

SYSTEM_BANDS = [
    TimeScaleBand("Cenozoic", 0.0, 66.0, "#f3e36f"),
    TimeScaleBand("Mesozoic", 66.0, 252.0, "#72c7d6"),
]

AGE_BANDS = [
    TimeScaleBand("Q", 0.0, 2.58, "#fff3a3"),
    TimeScaleBand("Ng", 2.58, 23.03, "#ffd166"),
    TimeScaleBand("Pg", 23.03, 66.0, "#e9a03b"),
    TimeScaleBand("K", 66.0, 145.0, "#8fd17f"),
    TimeScaleBand("J", 145.0, 201.3, "#34b3e4"),
    TimeScaleBand("Tr", 201.3, 252.0, "#9b6fc0"),
]

SUMMARY_AGE_MIN_MA = min(band.younger_age_ma for band in SYSTEM_BANDS + AGE_BANDS)
SUMMARY_AGE_MAX_MA = max(band.older_age_ma for band in SYSTEM_BANDS + AGE_BANDS)


def _demo_data() -> dict[str, dict]:
    return {
        "WELL-A": {
            "burial_curves": [
                BurialCurve("Present-day burial", [160, 120, 80, 40, 0], [700, 980, 1280, 1650, 1900], "#264653"),
                BurialCurve("Compacted burial", [160, 120, 80, 40, 0], [620, 900, 1180, 1520, 1770], "#2a9d8f", dash="dash"),
                BurialCurve("Decompacted burial", [160, 120, 80, 40, 0], [520, 790, 1050, 1380, 1600], "#e76f51", dash="dot"),
            ],
            "strat": [
                StratInterval("Neogene", 1000, 1200, 2.58, 23.03, "#f2c14e"),
                StratInterval("Paleogene", 1200, 1500, 23.03, 66.0, "#e88b4a"),
                StratInterval("Cretaceous", 1500, 1900, 66.0, 145.0, "#99d17b"),
            ],
            "lithology": [
                LithologyInterval("Sand", 1000, 1120, "#d8b36a"),
                LithologyInterval("Shale", 1120, 1380, "#8d99ae"),
                LithologyInterval("Lmst", 1380, 1620, "#bfc0c0"),
                LithologyInterval("Sand", 1620, 1900, "#d8b36a"),
            ],
            "curves": [
                CurveTrack("GR", "gAPI", [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900], [65, 70, 82, 78, 73, 88, 96, 90, 84, 79], "#2a9d8f"),
                CurveTrack("DT", "us/ft", [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900], [82, 85, 87, 91, 94, 96, 93, 89, 86, 84], "#e76f51"),
            ],
        },
        "WELL-B": {
            "burial_curves": [
                BurialCurve("Present-day burial", [160, 120, 80, 40, 0], [520, 760, 1040, 1360, 1600], "#264653"),
                BurialCurve("Compacted burial", [160, 120, 80, 40, 0], [470, 700, 970, 1270, 1490], "#2a9d8f", dash="dash"),
                BurialCurve("Decompacted burial", [160, 120, 80, 40, 0], [390, 630, 890, 1150, 1360], "#e76f51", dash="dot"),
            ],
            "strat": [
                StratInterval("Quaternary", 800, 940, 0.0, 2.58, "#f8e08e"),
                StratInterval("Neogene", 940, 1230, 2.58, 23.03, "#e8b949"),
                StratInterval("Paleogene", 1230, 1600, 23.03, 66.0, "#cf7a3f"),
            ],
            "lithology": [
                LithologyInterval("Clay", 800, 980, "#8d99ae"),
                LithologyInterval("Sand", 980, 1260, "#d8b36a"),
                LithologyInterval("Lmst", 1260, 1450, "#bfc0c0"),
                LithologyInterval("Shale", 1450, 1600, "#7f8c8d"),
            ],
            "curves": [
                CurveTrack("GR", "gAPI", [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600], [55, 61, 68, 75, 81, 79, 74, 69, 66], "#2a9d8f"),
                CurveTrack("RHOB", "g/cm3", [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600], [2.15, 2.18, 2.21, 2.24, 2.28, 2.31, 2.29, 2.26, 2.23], "#264653"),
            ],
        },
    }


DATASET: dict[str, dict] = _demo_data()
