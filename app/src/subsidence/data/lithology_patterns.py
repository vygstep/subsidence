from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_SVG_BYTES = 256 * 1024

_CODE_RE = re.compile(r"[^a-z0-9_]+")
_EXTERNAL_URL_RE = re.compile(r"url\(\s*['\"]?\s*(?:https?:|data:|javascript:)", re.IGNORECASE)
_BLOCKED_TAGS = {"script", "foreignobject"}
_BLOCKED_URI_PREFIXES = ("http:", "https:", "data:", "javascript:")


class SvgValidationError(ValueError):
    pass


def normalize_pattern_code(value: str | None) -> str:
    code = _CODE_RE.sub("_", (value or "").strip().lower()).strip("_")
    if not code:
        raise SvgValidationError("Pattern code is required")
    return code


def sanitize_svg_content(content: str) -> tuple[str, int, int]:
    encoded = content.encode("utf-8")
    if len(encoded) > MAX_SVG_BYTES:
        raise SvgValidationError(f"SVG exceeds {MAX_SVG_BYTES} byte limit")
    lower_content = content.lower()
    if "<!doctype" in lower_content or "<?xml-stylesheet" in lower_content:
        raise SvgValidationError("SVG doctype and external stylesheet declarations are not allowed")

    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise SvgValidationError(f"Invalid SVG XML: {exc}") from exc

    if _local_name(root.tag) != "svg":
        raise SvgValidationError("SVG root element is required")

    for element in root.iter():
        tag_name = _local_name(element.tag).lower()
        if tag_name in _BLOCKED_TAGS:
            raise SvgValidationError(f"Blocked SVG element: {tag_name}")
        for attr_name, attr_value in element.attrib.items():
            normalized_attr = _local_name(attr_name).lower()
            value = (attr_value or "").strip()
            lower_value = value.lower()
            if normalized_attr.startswith("on"):
                raise SvgValidationError(f"Blocked SVG event attribute: {normalized_attr}")
            if normalized_attr in {"href", "xlink:href"} and lower_value.startswith(_BLOCKED_URI_PREFIXES):
                raise SvgValidationError("External SVG href values are not allowed")
            if _EXTERNAL_URL_RE.search(value):
                raise SvgValidationError("External SVG url() values are not allowed")

    width, height = _read_tile_size(root)
    return content.strip(), width, height


def sanitize_svg_file(path: Path) -> tuple[str, int, int]:
    if path.suffix.lower() != ".svg":
        raise SvgValidationError("Only .svg files can be imported")
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise SvgValidationError("SVG must be UTF-8 encoded") from exc
    return sanitize_svg_content(content)


def _local_name(name: str) -> str:
    if "}" in name:
        return name.rsplit("}", 1)[-1]
    return name


def _read_tile_size(root: ET.Element) -> tuple[int, int]:
    view_box = root.attrib.get("viewBox") or root.attrib.get("viewbox")
    if view_box:
        parts = view_box.replace(",", " ").split()
        if len(parts) == 4:
            try:
                return max(1, round(float(parts[2]))), max(1, round(float(parts[3])))
            except ValueError:
                pass
    width = _read_dimension(root.attrib.get("width"))
    height = _read_dimension(root.attrib.get("height"))
    return width or 64, height or 64


def _read_dimension(value: str | None) -> int | None:
    if not value:
        return None
    match = re.match(r"^\s*(\d+(?:\.\d+)?)", value)
    if not match:
        return None
    return max(1, round(float(match.group(1))))
