from __future__ import annotations


def _normalize_unit(unit: str) -> str:
    return unit.strip().lower().replace(" ", "")


def convert_depth_to_meters(values: list[float], unit: str) -> list[float]:
    normalized = _normalize_unit(unit)
    if normalized in {"m", "meter", "meters", "metre", "metres", ""}:
        return values
    if normalized in {"ft", "feet", "foot"}:
        return [value * 0.3048 for value in values]
    raise ValueError(f"Unsupported depth unit: {unit}")
