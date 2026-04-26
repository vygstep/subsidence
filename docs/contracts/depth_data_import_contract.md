# Contract: Depth-Aware Log, Deviation, and Tops Import

> **OBSOLETE** — superseded by `DEPTH-001` in `docs/contracts/bugs_and_features.md`.
> The actionable requirements have been extracted and simplified into DEPTH-001.
> This file is retained as a reference only.

**Status:** obsolete — see DEPTH-001 in bugs_and_features.md  
**Scope:** backend data model, import behavior, derived depth transforms, viewer behavior, QC, and tests  
**Target codebase:** `SUBSIDENCE` local web application  
**Primary goal:** support log curves, deviation surveys, and tops imported from different files with different depth references, different sampling steps, and inconsistent depth ranges without corrupting original data.

---

## 1. Problem Statement

The application currently imports wells, log curves, tops, unconformities, and deviation surveys into a `.subsidence` project. The next required behavior is depth-aware import and display.

The system must correctly handle:

1. Log curves from different files with different sampling:
   - constant 0.2 m step;
   - constant 0.5 m step;
   - irregular/variable step;
   - missing intervals;
   - different min/max depth ranges.
2. Deviation survey import, where inclination/azimuth affects calculated `TVD`, `TVDSS`, and optionally XY offsets.
3. Tops/formations whose depth may be deeper than current well TD.
4. Imported data where the user explicitly states which depth column is trusted:
   - `MD`;
   - `TVD`;
   - `TVDSS`.
5. Existing project performance requirements:
   - metadata stays in SQLite;
   - dense numeric arrays stay in Parquet payloads;
   - viewer uses LOD/downsampling for display;
   - original imported data remains reproducible after save/reopen.

---

## 2. Non-Negotiable Design Rules

### 2.1 Original samples are immutable

Do not overwrite, silently resample, or silently correct original imported depth/value samples.

Raw imported arrays must preserve:

- original depth values;
- original depth type chosen by the user;
- original sampling pattern;
- original min/max range;
- source file identity;
- curve identity;
- import warnings/QC flags.

### 2.2 No forced global depth grid on import

Do not resample all curves to a shared `0.1 m`, `0.2 m`, or `0.5 m` grid during import.

Each curve keeps its own native grid. Shared grids are allowed only as explicit derived products for display, export, modeling, or calculation.

### 2.3 User-selected trusted depth is authoritative for the imported object

Every imported log, top, or deviation payload must store `depth_reference` metadata.

Allowed values:

```text
MD
TVD
TVDSS
```

The importer must not guess the trusted depth silently when multiple depth columns exist. The frontend import dialog must send the selected trusted depth to the backend.

### 2.4 MD/TVD/TVDSS conversion is derived, not assumed

Conversion between `MD`, `TVD`, and `TVDSS` requires an active trajectory/deviation model and datum metadata.

The system may calculate missing depth representations only when sufficient information exists:

- deviation survey stations;
- calculation method;
- well elevation datum such as KB/DF/GL where required;
- active datum used to convert `TVD` to `TVDSS`.

### 2.5 Depth conflicts are QC, not fatal errors

Depth inconsistencies should not crash import unless the source file cannot be parsed.

Examples of warnings, not fatal errors:

- curve maximum depth is deeper than current well TD;
- tops are deeper than current well TD;
- deviation survey is shorter than log curves;
- some curves cover only part of the well;
- sampling is irregular;
- depth values are not strictly increasing after cleanup.

Fatal errors should be reserved for invalid file structure, missing required depth column, non-numeric required depth values, or no valid samples.

---

## 3. Project Format Additions

The project bundle already separates SQLite metadata and payload files. This contract extends that pattern.

Expected project folders:

```text
<project>.subsidence/
  project.db
  manifest.json
  curves/
  deviation/
  depth_transforms/
  results/
  checkpoints/
```

New folder:

```text
depth_transforms/
```

Purpose:

- cache derived trajectory/depth conversion payloads;
- avoid recomputing TVD/TVDSS for every viewer request;
- keep derived arrays separate from raw log and deviation payloads.

Do not store dense depth-transform arrays in JSON.

---

## 4. Backend Data Model Contract

The exact SQLAlchemy naming may follow the current style in `schema.py`, but the persisted concepts below are required.

### 4.1 Well / wellbore metadata

The well or wellbore record must support at least:

```text
id
name
uwi / external_id optional
kb_elevation optional
df_elevation optional
gl_elevation optional
surface_x optional
surface_y optional
surface_crs optional
td_md optional
td_tvd optional
td_tvdss optional
active_deviation_id optional
active_depth_transform_id optional
```

Implementation note:

- If the current schema has only one well object and no separate wellbore object, do not introduce a full wellbore model unless needed now.
- Keep the first implementation minimal: one active trajectory per well is enough.

### 4.2 Log run metadata

Each imported LAS/log CSV file should create or update a log-run/group object.

Required fields:

```text
id
well_id
source_file_id / source_path
name
imported_at
trusted_depth_reference   -- MD / TVD / TVDSS
native_depth_unit         -- m / ft if available
sampling_kind             -- CONSTANT / VARIABLE / SINGLE_POINT / UNKNOWN
nominal_step              -- nullable float
min_depth_native
max_depth_native
min_md_derived nullable
max_md_derived nullable
min_tvd_derived nullable
max_tvd_derived nullable
min_tvdss_derived nullable
max_tvdss_derived nullable
qc_status                 -- OK / WARNING / ERROR
qc_summary_json optional
```

### 4.3 Curve metadata

Each curve must have metadata in SQLite and samples in Parquet.

Required fields:

```text
id
well_id
log_run_id
mnemonic
family optional
unit optional
payload_path
sample_count
trusted_depth_reference   -- inherited from log run unless overridden
sampling_kind
nominal_step nullable
min_depth_native
max_depth_native
min_value nullable
max_value nullable
null_count
qc_status
qc_summary_json optional
```

### 4.4 Curve payload Parquet schema

Curve payloads must keep native samples and may include derived depth columns when available.

Required columns:

```text
sample_index: int64
depth_native: float64
value: float64 nullable
```

Required metadata or companion fields:

```text
trusted_depth_reference: MD | TVD | TVDSS
native_depth_unit: m | ft | unknown
value_unit: string | null
```

Optional derived columns:

```text
md: float64 nullable
tvd: float64 nullable
tvdss: float64 nullable
```

Rules:

- If trusted depth is `MD`, then `md == depth_native` after unit normalization.
- If trusted depth is `TVD`, then `tvd == depth_native` after unit normalization.
- If trusted depth is `TVDSS`, then `tvdss == depth_native` after unit normalization.
- Optional derived columns may be added during import if an active depth transform already exists.
- If conversion is not possible, derived columns remain absent or null.

### 4.5 Deviation survey metadata

Deviation import creates a deviation survey record.

Required fields:

```text
id
well_id
source_file_id / source_path
name
imported_at
trusted_depth_reference   -- normally MD, but must be explicit
method                    -- MINIMUM_CURVATURE initially preferred; may be UNKNOWN if source provides TVD directly
station_count
min_depth_native
max_depth_native
min_md_derived nullable
max_md_derived nullable
min_tvd_derived nullable
max_tvd_derived nullable
payload_path
qc_status
qc_summary_json optional
is_active bool
```

### 4.6 Deviation payload Parquet schema

Required columns:

```text
station_index: int64
depth_native: float64
inclination_deg: float64 nullable
azimuth_deg: float64 nullable
```

Optional columns:

```text
md: float64 nullable
tvd: float64 nullable
tvdss: float64 nullable
northing_offset: float64 nullable
easting_offset: float64 nullable
dls: float64 nullable
```

Rules:

- If input has MD, INC, AZI, calculate trajectory using minimum curvature or an explicitly named method.
- If input already has TVD/TVDSS, preserve those values and still store the trusted depth reference.
- If input has no inclination/azimuth but has MD/TVD pairs, allow the survey as a depth lookup table but flag limited trajectory quality.

### 4.7 Depth transform metadata

A depth transform is an active derived product for a well.

Required fields:

```text
id
well_id
deviation_survey_id nullable
created_at
method
step_md nullable
payload_path
min_md
max_md
min_tvd nullable
max_tvd nullable
min_tvdss nullable
max_tvdss nullable
is_active bool
qc_status
qc_summary_json optional
```

### 4.8 Depth transform Parquet schema

Recommended columns:

```text
md: float64
tvd: float64 nullable
tvdss: float64 nullable
inclination_deg: float64 nullable
azimuth_deg: float64 nullable
northing_offset: float64 nullable
easting_offset: float64 nullable
```

Rules:

- This payload is derived and may be regenerated.
- It must not replace raw deviation payloads.
- It is used for fast interpolation and viewer/calc depth conversion.

### 4.9 Formation / top metadata

Existing formation/top rows must store explicit depth reference.

Required/additional fields:

```text
depth_value
trusted_depth_reference   -- MD / TVD / TVDSS
md_derived nullable
tvd_derived nullable
tvdss_derived nullable
qc_status
qc_summary_json optional
```

Rules:

- Existing `top_depth` fields should be treated as `depth_value` with a known reference.
- If legacy projects lack this field, migration should default to `MD` only if current behavior historically treated tops as MD.
- Do not silently reinterpret legacy top depths as TVD/TVDSS.

---

## 5. Import Behavior Contract

### 5.1 LAS/log CSV import

Input from frontend must include:

```json
{
  "path": "...",
  "target_well_id": "... optional ...",
  "target_policy": "existing_or_create",
  "trusted_depth_reference": "MD",
  "depth_unit": "m"
}
```

Allowed `trusted_depth_reference`:

```text
MD
TVD
TVDSS
```

Importer steps:

1. Resolve target well using existing well-resolution behavior.
2. Parse depth column and curve columns.
3. Normalize units to internal metric depth if source unit is known.
4. Preserve native sample grid.
5. Detect sampling kind:
   - `CONSTANT` if depth deltas are stable within tolerance;
   - `VARIABLE` if deltas vary;
   - `SINGLE_POINT` if only one valid sample;
   - `UNKNOWN` if detection fails.
6. Write curve metadata to SQLite.
7. Write each curve payload to Parquet.
8. If active depth transform exists, populate derived MD/TVD/TVDSS columns where possible.
9. Run QC checks.
10. Return import result including warnings.

Do not merge curves from different files into one common payload unless that behavior already exists and is intentional. Different source files should remain traceable.

### 5.2 Deviation import

Input from frontend must include:

```json
{
  "path": "...",
  "target_well_id": "...",
  "trusted_depth_reference": "MD",
  "depth_unit": "m",
  "set_active": true,
  "method": "MINIMUM_CURVATURE"
}
```

Importer steps:

1. Resolve target well.
2. Parse station depths and available trajectory columns.
3. Preserve raw station payload.
4. Calculate derived trajectory if enough columns exist.
5. Write deviation metadata and payload.
6. If `set_active == true`, mark this survey active for the well.
7. Generate or refresh active depth transform payload.
8. Recompute derived depth columns for existing curve/top payloads only if explicitly requested by service behavior.

Recommended first implementation:

- Generate active depth transform immediately.
- Do not rewrite every existing curve payload automatically unless this is cheap and covered by tests.
- Instead, convert on load or via a dedicated refresh function.

### 5.3 Tops import

Input from frontend must include:

```json
{
  "path": "...",
  "target_well_id": "...",
  "trusted_depth_reference": "MD",
  "depth_unit": "m"
}
```

Importer steps:

1. Resolve target well.
2. Parse top names and depth values.
3. Store original `depth_value` with `trusted_depth_reference`.
4. Derive MD/TVD/TVDSS if active transform supports it.
5. Link to active strat chart if possible.
6. Run QC checks.
7. Return inserted tops and warnings.

Tops deeper than TD:

- must be imported;
- must receive warning flag `TOP_BELOW_TD`;
- must be visible in Data Manager;
- may be visually rendered outside current well interval only if viewer range allows it.

---

## 6. Depth Conversion Contract

### 6.1 Internal depth units

Internal depth calculations should use meters.

If imported depth is in feet, convert to meters for internal arrays and preserve source unit in metadata.

### 6.2 Conversion direction

Supported conversions:

```text
MD -> TVD -> TVDSS
TVD -> MD approximate/inverse through active transform
TVDSS -> TVD -> MD approximate/inverse through active transform and datum
```

The inverse conversions (`TVD -> MD`, `TVDSS -> MD`) are interpolation-based and may be ambiguous in complex wells. For the first implementation, assume monotonic TVD with MD. If not monotonic, flag `NON_MONOTONIC_TVD` and avoid inverse conversion.

### 6.3 Active depth transform

All display and calculation code must know which depth basis it uses.

Recommended viewer modes:

```text
MD
TVD
TVDSS
```

Default viewer mode:

```text
MD
```

If the user switches viewer depth basis:

- curves with derived depths can be displayed in that basis;
- curves without derived depths are either hidden or displayed with warning, depending on current UX choice;
- tops without derived depths receive warning indicator.

### 6.4 Interpolation rules

For depth transforms:

- continuous trajectory columns: linear interpolation;
- inclination/azimuth: linear interpolation for display/cache, unless better method is already implemented;
- categorical data: never interpolate as continuous.

For log curves on a derived display grid:

- continuous curves: linear interpolation;
- categorical/lithology curves: nearest or previous-step interpolation;
- flags: nearest/previous only, never linear;
- tops/formations: event lines, not interpolated curves.

---

## 7. QC Contract

### 7.1 QC severity

Use three levels:

```text
OK
WARNING
ERROR
```

`ERROR` means object cannot be used without user correction.  
`WARNING` means object can be stored and displayed/calculated with caution.

### 7.2 Required QC flags

Use stable string codes.

Depth range flags:

```text
CURVE_BELOW_TD
TOP_BELOW_TD
DEVIATION_SHORTER_THAN_CURVES
CURVE_OUTSIDE_DEVIATION_RANGE
TOP_OUTSIDE_DEVIATION_RANGE
MISSING_WELL_TD
```

Sampling flags:

```text
VARIABLE_SAMPLING
DUPLICATE_DEPTHS
NON_MONOTONIC_DEPTH
LARGE_DEPTH_GAPS
SINGLE_SAMPLE_CURVE
```

Depth reference flags:

```text
MISSING_TRUSTED_DEPTH_REFERENCE
UNSUPPORTED_DEPTH_REFERENCE
DEPTH_UNIT_UNKNOWN
DEPTH_TRANSFORM_UNAVAILABLE
TVDSS_DATUM_UNAVAILABLE
NON_MONOTONIC_TVD
```

Value flags:

```text
ALL_VALUES_NULL
HIGH_NULL_FRACTION
VALUES_OUTSIDE_FAMILY_RANGE
```

Trajectory flags:

```text
MISSING_INCLINATION
MISSING_AZIMUTH
TRAJECTORY_METHOD_UNKNOWN
TRAJECTORY_CALCULATION_FAILED
```

### 7.3 QC storage

Each affected metadata object should have:

```text
qc_status
qc_summary_json
```

Example `qc_summary_json`:

```json
{
  "flags": ["VARIABLE_SAMPLING", "CURVE_BELOW_TD"],
  "messages": [
    "Curve has variable sampling: min step 0.18 m, median step 0.20 m, max step 1.40 m.",
    "Curve max MD 2540.2 m is deeper than current well TD 2500.0 m."
  ],
  "stats": {
    "sample_count": 12044,
    "min_depth": 100.0,
    "max_depth": 2540.2,
    "median_step": 0.2
  }
}
```

### 7.4 QC behavior

Importer must return warnings to frontend.

Frontend must show import warnings in the import result dialog or diagnostics area.

Data Manager should allow selecting an object and seeing QC summary in settings pane later. First implementation may only expose warnings in import result and API payload.

---

## 8. API Contract

### 8.1 Import endpoints

Existing public API paths should remain unchanged where possible.

Extend request models for:

- LAS import;
- logs CSV import;
- tops import;
- deviation import.

Add field:

```text
trusted_depth_reference: "MD" | "TVD" | "TVDSS"
```

Add optional fields:

```text
depth_unit: "m" | "ft" | "unknown"
set_active: bool              -- deviation only
trajectory_method: string     -- deviation only
```

### 8.2 Well detail endpoint

`GET /api/wells/{well_id}` should return:

```text
well metadata
curve metadata summaries
formation/top metadata with depth reference
active deviation summary
active depth transform summary
QC summaries where relevant
```

Do not return dense curve arrays in well detail.

### 8.3 Curve endpoint

`GET /api/wells/{well_id}/curves` should support optional depth basis:

```text
?depth_basis=MD
?depth_basis=TVD
?depth_basis=TVDSS
```

Behavior:

- If `depth_basis` is omitted, default to `MD`.
- If requested basis is unavailable for a curve, return curve-level warning and omit converted points for that curve, or return native basis explicitly.
- Do not silently label native TVD as MD.

Response curve payload must identify depth basis:

```json
{
  "curve_id": "...",
  "mnemonic": "GR",
  "depth_basis": "MD",
  "native_depth_reference": "MD",
  "points": [[1000.0, 85.2], [1000.2, 86.0]],
  "qc_status": "OK",
  "qc_flags": []
}
```

### 8.4 Deviation endpoint

`GET /api/wells/{well_id}/deviation` should return active survey metadata and station payload or LOD payload as currently appropriate.

Add:

```text
trusted_depth_reference
method
is_active
has_depth_transform
qc_status
qc_flags
```

### 8.5 New optional endpoint: refresh depth transform

Recommended endpoint:

```text
POST /api/wells/{well_id}/depth-transform/refresh
```

Request:

```json
{
  "deviation_survey_id": "... optional ...",
  "method": "MINIMUM_CURVATURE",
  "step_md": 0.2,
  "rewrite_curve_payloads": false
}
```

Response:

```json
{
  "depth_transform_id": "...",
  "well_id": "...",
  "min_md": 0.0,
  "max_md": 2500.0,
  "qc_status": "OK",
  "warnings": []
}
```

This endpoint is optional for first implementation if deviation import already refreshes the active transform.

---

## 9. Frontend Contract

### 9.1 Import dialogs

Update these dialogs:

```text
frontend/src/components/layout/ImportLasDialog.tsx
frontend/src/components/layout/ImportTopsDialog.tsx
frontend/src/components/layout/ImportDeviationDialog.tsx
```

Each import dialog must include a trusted depth selector:

```text
Trusted depth column/reference:
[MD] [TVD] [TVDSS]
```

Default:

```text
MD
```

Deviation dialog should also include:

```text
Set as active deviation survey: true/false
Trajectory method: MINIMUM_CURVATURE
```

### 9.2 Store ownership

`wellDataStore` owns loaded well depth metadata:

```text
active deviation summary
active depth transform summary
curve depth references
formation depth references
QC summaries
```

`viewStore` owns current viewer depth basis:

```text
viewerDepthBasis: MD | TVD | TVDSS
```

`workspaceStore` should not own scientific depth conversion state. It may persist visual preference for current depth basis only if required.

### 9.3 Viewer behavior

The log viewer must not assume all curves share one grid.

For each rendered curve:

- use the depth array provided by backend for the requested basis;
- use existing LOD/downsampling path;
- do not interpolate curves together in the frontend unless this is a viewer-only display function;
- do not mutate stored curve arrays.

Depth track label must show current basis:

```text
MD, m
TVD, m
TVDSS, m
```

### 9.4 Settings pane

For curve settings, show:

```text
native depth reference
sampling kind
nominal step
min/max native depth
available derived depths
QC status/warnings
source file
```

For tops settings, show:

```text
trusted depth reference
native top depth
derived MD/TVD/TVDSS when available
QC status/warnings
```

For well settings, show:

```text
TD MD / TD TVD / TD TVDSS
active deviation survey
active depth transform status
```

---

## 10. Performance Contract

### 10.1 Storage

Keep current architecture:

```text
SQLite: metadata, object identity, QC summaries, visual config
Parquet: dense numeric arrays
```

Do not move curve sample arrays into regular SQLite rows.

### 10.2 Loading

Well detail endpoint returns metadata and summaries only.

Curve endpoint loads only requested curves and requested depth window/LOD if the current endpoint supports it.

Do not load all curves from all wells when switching active well.

### 10.3 Derived cache

Depth transform cache should be used for repeated MD/TVD/TVDSS conversions.

Recommended algorithm:

1. Load active depth transform Parquet.
2. For requested curve payload, read native depth/value columns.
3. If requested basis equals native basis, return directly.
4. If conversion is needed, interpolate through transform.
5. Apply visible-window clipping and LOD.
6. Return points.

### 10.4 Indexing / metadata speed

SQLite tables should be indexed by:

```text
well_id
log_run_id
curve_id
formation_id
source_file_id if present
active deviation/depth transform flags
```

Parquet file names should remain deterministic enough for debugging, for example:

```text
curves/<well_id>/<log_run_id>/<curve_id>.parquet
deviation/<well_id>/<deviation_survey_id>.parquet
depth_transforms/<well_id>/<depth_transform_id>.parquet
```

---

## 11. Migration Contract

Existing projects must still open.

If existing curve metadata lacks `trusted_depth_reference`, migration should set:

```text
trusted_depth_reference = "MD"
```

Only do this if current historical behavior was MD-based.

If existing tops/formations lack depth reference, migration should set:

```text
trusted_depth_reference = "MD"
```

Add compatibility note:

```text
Legacy imported depths are assumed to be MD because previous viewer and calculation behavior treated formation/log depths as MD.
```

If this assumption is not true in current code, do not migrate silently; instead set `UNKNOWN` internally and require user correction. However, preferred first implementation is to preserve historical MD behavior.

---

## 12. Logging Contract

Add structured backend events for:

```text
import.depth_reference.selected
import.curve.qc.warning
import.tops.qc.warning
import.deviation.qc.warning
depth_transform.refresh.start
depth_transform.refresh.success
depth_transform.refresh.failure
```

Required fields where available:

```text
project_path
well_id
well_name
input_path
trusted_depth_reference
sample_count
min_depth
max_depth
qc_flags
duration_ms
```

Do not log dense arrays.

---

## 13. Required Tests

### 13.1 Backend tests

Add tests under `app/tests` following current style.

Required scenarios:

#### Logs import preserves native sampling

Input:

- one log file with 0.2 m step;
- one log file with 0.5 m step;
- one log file with irregular depth step.

Expected:

- import succeeds;
- each curve metadata stores correct `sampling_kind`;
- payload preserves original native depth values;
- save/reopen preserves metadata and payload.

#### Logs import with trusted TVD

Input:

- logs CSV with depth interpreted as `TVD`.

Expected:

- `trusted_depth_reference == TVD`;
- payload `depth_native` equals input depth;
- returned curve payload is not mislabeled as MD.

#### Deviation import creates active depth transform

Input:

- deviation survey with MD, inclination, azimuth.

Expected:

- deviation metadata saved;
- payload saved;
- active deviation set;
- active depth transform exists;
- save/reopen preserves it.

#### Tops deeper than TD are warnings

Input:

- well TD = 2500 m;
- top depth = 2600 m.

Expected:

- import succeeds;
- top exists;
- QC includes `TOP_BELOW_TD`;
- no crash in well detail endpoint.

#### Curve deeper than deviation range

Input:

- deviation max MD = 2000 m;
- curve max MD = 2500 m.

Expected:

- import succeeds;
- QC includes `CURVE_OUTSIDE_DEVIATION_RANGE` or equivalent;
- converted TVD request warns or clips safely.

#### Save/reopen compatibility

Expected:

- project can be opened after migration;
- legacy depths default to MD if migration rule applies;
- imported curves, tops, deviation, and depth transform survive reopen.

### 13.2 Frontend tests

Required scenarios:

#### Import dialogs send trusted depth reference

Expected:

- LAS/log import request includes `trusted_depth_reference`;
- tops import request includes `trusted_depth_reference`;
- deviation import request includes `trusted_depth_reference` and `set_active`.

#### Well detail hydrates depth metadata

Expected:

- `wellDataStore` stores active deviation summary;
- curve metadata includes native depth reference;
- tops include trusted depth reference;
- QC warnings remain visible in state.

#### Viewer depth basis

Expected:

- default depth basis is `MD`;
- switching to `TVD` calls curve endpoint with `depth_basis=TVD`;
- depth track label changes.

### 13.3 Existing regression commands

All implementation must pass:

```bash
cd app
pytest tests
```

```bash
cd frontend
npm run test -- --run
```

---

## 14. Implementation Order

### Phase 1 — Metadata and request models

1. Add depth reference enums/types.
2. Extend SQLite schema and migrations.
3. Extend Pydantic/API request and response models.
4. Default legacy data to MD where compatible.

### Phase 2 — Importers

1. Update LAS/log CSV importers.
2. Update tops importer.
3. Update deviation importer.
4. Add QC generation.
5. Write payloads with native depth preservation.

### Phase 3 — Depth transform service

1. Add depth transform builder.
2. Add interpolation helpers.
3. Add active transform metadata.
4. Integrate with deviation import.

### Phase 4 — Loaders and API output

1. Update curve loaders to support requested depth basis.
2. Update well detail response.
3. Update deviation response.
4. Keep LOD behavior intact.

### Phase 5 — Frontend import UI and store state

1. Add trusted depth selector to import dialogs.
2. Store returned depth/QC metadata.
3. Add viewer depth basis state.
4. Show depth basis in depth track.

### Phase 6 — Tests and diagnostics

1. Add backend import/save/reopen tests.
2. Add frontend request/store/viewer tests.
3. Add logging events.
4. Run full backend/frontend test commands.

---

## 15. Acceptance Criteria

Implementation is accepted only when:

1. Curves from different files with 0.2 m, 0.5 m, and irregular sampling import without forced resampling.
2. Each curve preserves native depth samples in Parquet.
3. Each imported object records trusted depth reference.
4. Deviation import can create an active depth transform.
5. Tops deeper than TD are imported and flagged, not rejected.
6. Curves deeper than TD or deviation range are imported and flagged, not silently clipped.
7. Viewer/API never mislabels TVD/TVDSS as MD.
8. Save/reopen preserves metadata, payload files, QC flags, and active depth transform.
9. Dense arrays remain outside SQLite.
10. Existing test commands pass.

---

## 16. Explicit Anti-Goals

Do not implement these in the first pass unless already trivial:

1. Full multi-lateral wellbore model.
2. Complex non-monotonic inverse TVD-to-MD handling.
3. Automatic geological correction of wrong tops.
4. Automatic unit guessing without user-visible warning.
5. Automatic resampling of all project curves to a project-wide master grid.
6. Moving all samples into SQLite.
7. Frontend-side scientific depth conversion as the source of truth.

---

## 17. Canonical Summary for Codex

Implement depth-aware import and storage.

- Keep raw samples immutable.
- Store metadata in SQLite and dense arrays in Parquet.
- Every imported object must have `trusted_depth_reference = MD | TVD | TVDSS`.
- Curves keep native sampling; do not force a shared grid on import.
- Deviation surveys create active derived depth transforms for fast MD/TVD/TVDSS conversion.
- Tops and curves outside TD/range are imported with QC warnings.
- API/viewer must explicitly label the depth basis being returned/rendered.
- Existing project save/reopen behavior must remain compatible.
- Add tests before or together with importer/schema changes.
