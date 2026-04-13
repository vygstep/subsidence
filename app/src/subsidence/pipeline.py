from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from .models import SourcePoint


def load_curve_csv(path: Path) -> list[SourcePoint]:
    points: list[SourcePoint] = []
    with path.open("r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        required = {"time", "value"}
        missing = required.difference(set(reader.fieldnames or []))
        if missing:
            raise ValueError(f"{path}: missing required columns: {sorted(missing)}")

        for row in reader:
            points.append(
                SourcePoint(
                    source=str(path),
                    time=float(row["time"]),
                    value=float(row["value"]),
                )
            )
    return points


def normalize_points(points: list[SourcePoint]) -> list[SourcePoint]:
    # Keep one point per (source, time); last occurrence wins.
    dedup: dict[tuple[str, float], SourcePoint] = {}
    for point in points:
        dedup[(point.source, point.time)] = point
    return sorted(dedup.values(), key=lambda p: (p.time, p.source))


def merge_curves(points: list[SourcePoint]) -> list[tuple[float, float, int]]:
    grouped: dict[float, list[float]] = defaultdict(list)
    for point in points:
        grouped[point.time].append(point.value)

    merged: list[tuple[float, float, int]] = []
    for time in sorted(grouped):
        vals = grouped[time]
        merged.append((time, sum(vals) / len(vals), len(vals)))
    return merged


def build_curve(csv_files: list[Path]) -> list[tuple[float, float, int]]:
    all_points: list[SourcePoint] = []
    for file_path in csv_files:
        all_points.extend(load_curve_csv(file_path))
    normalized = normalize_points(all_points)
    return merge_curves(normalized)


def export_curve_csv(rows: list[tuple[float, float, int]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["time", "value", "samples"])
        writer.writerows(rows)
