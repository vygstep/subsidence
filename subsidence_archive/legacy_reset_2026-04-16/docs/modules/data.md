# Data Module

## Purpose

The `subsidence.data` package is the current backbone of the project. It defines the domain objects used by the application and contains the logic for reading external well-related files into validated Python structures.

## Files

### `models.py`

Defines the main domain dataclasses and enums:

- `DepthReference` — supported depth bases: `MD`, `TVD`, `TVDSS`
- `TopKind` and `BoundaryType` — top and boundary classification
- `SurveyMode` — supported deviation survey column layouts
- `WellCreateInput` and `Well` — well creation contract and normalized well object
- `CRSEntry` and `CRSCatalog` — minimal CRS validation support
- `StratRank`, `StratUnit`, `StratChart` — stratigraphic dictionary structures
- `LogCurve` — normalized curve container with optional canonical mapping metadata
- `StratTopPick`, `UnconformityPick`, `TopUnconformityLink` — top and unconformity picks plus linking result
- `DeviationPoint`, `DeviationSurvey` — deviation survey structures
- `TopsLoadOptions` — options used during top import

Utility functions:

- `supported_deviation_formats()` returns the currently accepted deviation file layouts
- `make_strat_chart()` builds a validated stratigraphic chart from CSV rows
- `validate_tops()` runs object-level validation on top and unconformity picks

### `loaders.py`

Implements file loading and normalization:

- `load_las_curves()` reads LAS files with `lasio`, cleans invalid values, removes duplicate depths, optionally resolves curve aliases, and converts units where supported
- `load_csv_log_curves()` reads delimited log tables with `pandas`, auto-detects the depth column, and returns validated `LogCurve` objects
- `load_strat_tops_csv()` loads stratigraphic tops from CSV and applies a selected depth reference
- `load_unconformities_csv()` loads unconformity picks with required age bounds
- `load_strat_chart_csv()` loads stratigraphic units and ranks from CSV files
- `link_strat_tops_to_unconformities()` links tops to unconformities either by explicit reference or by depth proximity

Internal helpers in this file handle CSV delimiter sniffing, finite-value filtering, and duplicate-depth cleanup.

### `curve_dictionary.py`

Implements SQLite-backed curve alias resolution.

Main entities:

- `CurveAliasRule` — one alias rule loaded from the dictionary database
- `CurveMatchResult` — resolved family, canonical mnemonic, and canonical unit

Main functions:

- `load_curve_alias_rules()` reads active alias and family rows from SQLite
- `resolve_curve_alias()` matches an incoming mnemonic against wildcard or regex patterns

Matching priority follows the current project decision:

- source scope rank: `user` > `project` > `base`
- then rule `priority`
- then pattern length

### `unit_conversion.py`

Contains a small set of normalization helpers:

- `normalize_unit_name()` canonicalizes unit labels for comparisons
- `convert_depth_to_meters()` currently supports `m` and `ft`
- `convert_slowness()` converts `us/ft` and `us/m`
- `canonicalize_gamma_unit()` normalizes gamma-ray units to `gAPI`
- `convert_curve_units()` dispatches curve-family-specific conversions

## Public Package Surface

`subsidence.data.__init__` re-exports the current data-layer API so the rest of the application can import from one place.

## Inputs and Outputs

Inputs currently supported by this package:

- LAS log files
- CSV log tables
- CSV stratigraphic tops
- CSV unconformity picks
- CSV stratigraphic units and ranks
- SQLite dictionary tables for curve alias matching

Outputs returned by this package:

- validated domain dataclasses
- normalized depth arrays in meters
- optional canonical curve metadata resolved from the dictionary

## Current Gaps

- no repository layer for `project.db` outside curve dictionary lookup
- no JSON loader yet for `metadata.json`
- no deviation survey loader yet
- no explicit QC report object for import warnings and validation issues
- unit conversion coverage is still narrow and family-specific
