from __future__ import annotations

import hashlib

WELL_COLOR_PALETTE = (
    '#2563eb',
    '#dc2626',
    '#16a34a',
    '#d97706',
    '#7c3aed',
    '#0891b2',
    '#db2777',
    '#4b5563',
    '#65a30d',
    '#c2410c',
    '#0f766e',
    '#9333ea',
)

DEFAULT_WELL_COLOR = WELL_COLOR_PALETTE[0]


def is_valid_hex_color(value: str | None) -> bool:
    if value is None or len(value) != 7 or not value.startswith('#'):
        return False
    return all(ch in '0123456789abcdefABCDEF' for ch in value[1:])


def normalize_hex_color(value: str) -> str:
    color = value.strip()
    if not is_valid_hex_color(color):
        raise ValueError('color_hex must be a #RRGGBB color')
    return color.lower()


def default_well_color(seed: str, index: int = 0) -> str:
    digest = hashlib.sha256(seed.encode('utf-8')).digest()
    offset = int.from_bytes(digest[:2], byteorder='big', signed=False)
    return WELL_COLOR_PALETTE[(offset + index) % len(WELL_COLOR_PALETTE)]


def select_available_well_color(used_colors: set[str], seed: str) -> str:
    normalized_used = {color.lower() for color in used_colors if color}
    for index in range(len(WELL_COLOR_PALETTE)):
        color = default_well_color(seed, index)
        if color.lower() not in normalized_used:
            return color
    return default_well_color(seed, len(normalized_used))
