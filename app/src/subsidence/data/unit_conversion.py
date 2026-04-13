from __future__ import annotations


def normalize_unit_name(unit: str) -> str:
    return unit.strip().lower().replace(" ", "")


def convert_depth_to_meters(values: list[float], unit: str) -> list[float]:
    u = normalize_unit_name(unit)
    if u in {"m", "meter", "meters", "metre", "metres"}:
        return values
    if u in {"ft", "feet", "foot"}:
        return [v * 0.3048 for v in values]
    raise ValueError(f"Unsupported depth unit for conversion: {unit}")


def convert_slowness(values: list[float], from_unit: str, to_unit: str) -> list[float]:
    src = normalize_unit_name(from_unit)
    dst = normalize_unit_name(to_unit)
    if src == dst:
        return values

    if src == "us/ft" and dst == "us/m":
        return [v * 3.280839895 for v in values]
    if src == "us/m" and dst == "us/ft":
        return [v * 0.3048 for v in values]

    raise ValueError(f"Unsupported slowness conversion: {from_unit} -> {to_unit}")


def canonicalize_gamma_unit(unit: str) -> str:
    src = normalize_unit_name(unit)
    if src in {"", "api", "gapi"}:
        return "gAPI"
    return unit
