# app

Core app for building a merged subsidence curve from multiple source repositories.

## What is inside

- `src/subsidence/pipeline.py` — CSV loading, normalization, merge, export
- `src/subsidence/cli.py` — command-line entry point
- `tests/` — baseline tests for merge behavior

## Input format

Every input CSV must contain:

- `time`
- `value`

Example:

```csv
time,value
0,0.0
1,1.2
2,1.7
```

## Run

```bash
pip install -e .
python -m subsidence.cli --inputs "../repos/**/*.csv" --output out/merged_curve.csv
```
