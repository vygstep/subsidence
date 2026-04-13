from __future__ import annotations

import argparse
from pathlib import Path

from .pipeline import build_curve, export_curve_csv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build merged subsidence curve from multiple CSV files"
    )
    parser.add_argument(
        "--inputs",
        required=True,
        help='Glob pattern for input CSV files, e.g. "../repos/**/*.csv"',
    )
    parser.add_argument(
        "--output",
        default="out/merged_curve.csv",
        help="Output CSV path",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    files = sorted(Path().glob(args.inputs))
    if not files:
        raise SystemExit(f"No input files matched pattern: {args.inputs}")

    rows = build_curve(files)
    output_path = Path(args.output)
    export_curve_csv(rows, output_path)
    print(f"Merged curve exported to: {output_path}")
    print(f"Input files: {len(files)}")
    print(f"Rows: {len(rows)}")


if __name__ == "__main__":
    main()
