from __future__ import annotations


def normalize_unit_name(unit: str) -> str:
    return unit.strip().lower().replace(" ", "")


def convert_depth_to_meters(values: list[float], unit: str) -> list[float]:
    u = normalize_unit_name(unit)
    if u in {"m", "meter", "meters", "metre", "metres", ""}:
        return values
    if u in {"ft", "feet", "foot"}:
        return [v * 0.3048 for v in values]
    raise ValueError(f"Unsupported depth unit: {unit!r}")


def canonicalize_gamma_unit(unit: str) -> str:
    u = normalize_unit_name(unit)
    if u in {"", "api", "gapi"}:
        return "gAPI"
    return unit


def _convert_slowness(values: list[float], from_unit: str, to_unit: str) -> list[float]:
    src = normalize_unit_name(from_unit)
    dst = normalize_unit_name(to_unit)
    if src == dst:
        return values
    if src == "us/ft" and dst == "us/m":
        return [v * 3.280839895 for v in values]
    if src == "us/m" and dst == "us/ft":
        return [v * 0.3048 for v in values]
    raise ValueError(f"Unsupported slowness conversion: {from_unit!r} -> {to_unit!r}")


def convert_curve_units(
    values: list[float],
    from_unit: str,
    to_unit: str,
    family_code: str | None = None,
) -> list[float]:
    src = normalize_unit_name(from_unit)
    dst = normalize_unit_name(to_unit)
    if not src or not dst or src == dst:
        return values

    family = (family_code or "").lower()
    if "slowness" in family or family in {"acoustic", "sonic", "sonic_p", "sonic_s"}:
        return _convert_slowness(values, from_unit, to_unit)

    raise ValueError(
        f"Unsupported unit conversion for family {family_code!r}: "
        f"{from_unit!r} -> {to_unit!r}"
    )
