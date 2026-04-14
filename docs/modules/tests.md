# Test Modules

## Purpose

The current automated tests live in `app/tests` and focus on the data layer. They provide lightweight regression coverage for file loading and dictionary-driven normalization.

## Files

### `test_loaders.py`

Current covered behavior:

- CSV log loading with automatic depth-column detection
- stratigraphic tops loading with optional age and selected depth reference
- unconformity CSV loading with required fields
- curve dictionary matching from a temporary SQLite database
- linking stratigraphic tops to unconformities by explicit reference
- stratigraphic chart loading from units and ranks CSV files

## What Is Not Covered Yet

- LAS loading from real LAS fixtures
- warning paths for unknown curve aliases
- duplicate-depth cleanup edge cases
- unit conversion failure paths
- deviation survey validation and future loaders
- Plotly figure generation
- Dash callbacks
- FastAPI endpoints
- future burial-history and backstripping calculations

## Recommended Next Additions

- add LAS fixtures with representative mnemonics and units
- add tests for conversion and warning behavior
- add API tests once real endpoints exist
- add visualization smoke tests for figure structure
