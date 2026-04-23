# well_1d_model_architecture.md

## Purpose

This document defines a minimal implementation architecture for 1D well subsidence modeling.
The target reader is a coding agent. The goal is to make the implementation straightforward.

Scope:
- burial history
- decompaction
- Airy backstripping
- tectonic subsidence
- simple thermal fitting

Out of scope:
- flexural modeling
- 2D/3D basin modeling
- pressure-dependent compaction
- full geodynamic inversion

---

## 1. Recommended package structure

```text
src/
  well1d/
    __init__.py
    models.py         # dataclasses / schemas
    constants.py      # default densities and lithology presets
    compaction.py     # porosity, bulk density, decompaction functions
    burial.py         # burial history and time-step construction
    backstrip.py      # Airy backstripping logic
    thermal.py        # thermal subsidence fitting
    erosion.py        # erosion event handling
    validation.py     # input QC
    pipeline.py       # end-to-end runner
    io.py             # read/write CSV/JSON/parquet if needed
    types.py          # aliases / protocols if desired

tests/
  test_compaction.py
  test_burial.py
  test_backstrip.py
  test_thermal.py
  test_pipeline.py
```

---

## 2. Core data model

Implementation should use plain dataclasses first.
Pydantic is optional.

### 2.1 Layer

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Layer:
    name: str
    top_age_ma: float
    base_age_ma: float
    thickness_present_m: float
    lithology: str
    rho_grain_kg_m3: float
    phi0: float
    compaction_c_per_m: float
    paleobathymetry_m: float = 0.0
    sea_level_m: float = 0.0
```

Rules:
- `top_age_ma >= base_age_ma` if ages are expressed as Ma before present.
- `thickness_present_m >= 0`
- `0 <= phi0 < 1`
- `compaction_c_per_m >= 0`

### 2.2 Erosion event

```python
@dataclass
class ErosionEvent:
    event_age_ma: float
    removed_thickness_m: float
    lithology: str
    rho_grain_kg_m3: float
    phi0: float
    compaction_c_per_m: float
    name: str = "erosion"
```

Interpretation:
- erosion is implemented as a synthetic removed layer restored during backward reconstruction.

### 2.3 Well input

```python
from dataclasses import dataclass, field
from typing import List

@dataclass
class WellInput:
    well_name: str
    layers: List[Layer]
    erosion_events: List[ErosionEvent] = field(default_factory=list)
    rho_water_kg_m3: float = 1030.0
    rho_mantle_kg_m3: float = 3300.0
```
```

### 2.4 Time-step result

```python
from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class LayerState:
    name: str
    thickness_decompacted_m: float
    top_depth_m: float
    base_depth_m: float
    mean_porosity: float
    bulk_density_kg_m3: float

@dataclass
class TimeStepResult:
    age_ma: float
    active_layer_names: List[str]
    layer_states: List[LayerState]
    total_subsidence_m: float
    sediment_load_subsidence_m: float
    water_load_subsidence_m: float
    tectonic_subsidence_m: float
    metadata: Dict[str, Any]
```

### 2.5 Final model output

```python
@dataclass
class ThermalFitResult:
    s0_m: float
    tau_ma: float
    misfit_sse: float
    success: bool

@dataclass
class WellModelResult:
    well_name: str
    steps: List[TimeStepResult]
    thermal_fit: ThermalFitResult | None
```

---

## 3. Internal conventions

### Age convention
- Use `Ma before present`.
- Present day = `0.0` Ma.
- Older ages have larger values.
- Time steps should be sorted from old to young for output, but backward stripping logic may iterate from young to old.

### Depth convention
- Positive downward.
- All depths and thicknesses in meters.

### Density convention
- kg/m3.

### Porosity convention
- fraction, not percent.
- Example: `0.45`, not `45`.

---

## 4. Validation requirements

Implement validation before running the model.

### 4.1 Layer-level checks

```python
def validate_layer(layer: Layer) -> None:
    assert layer.thickness_present_m >= 0
    assert 0.0 <= layer.phi0 < 1.0
    assert layer.compaction_c_per_m >= 0.0
    assert layer.rho_grain_kg_m3 > 1000.0
    assert layer.top_age_ma >= layer.base_age_ma
```

### 4.2 Stratigraphic consistency checks

```python
def validate_layer_sequence(layers: list[Layer]) -> None:
    # layers should be ordered from oldest at bottom to youngest at top
    # or vice versa, but code must normalize once and keep a single convention.
    ...
```

Required checks:
- no negative thickness
- no age inversion
- no overlapping impossible intervals
- no duplicate ambiguous ages unless explicitly allowed

### 4.3 Physical checks
- `rho_mantle_kg_m3 > rho_water_kg_m3`
- bulk density must be between water and grain density
- mean porosity must remain in `[0, phi0]`

---

## 5. Minimal physics functions

All formulas below should be implemented exactly as code-level functions.

### 5.1 Porosity at depth

```python
def porosity_at_depth(phi0: float, c_per_m: float, depth_m: float) -> float:
    return phi0 * math.exp(-c_per_m * depth_m)
```

### 5.2 Mean porosity over a layer

Use analytic integral.

For a layer between `z_top` and `z_base`:

```python
def mean_porosity(phi0: float, c_per_m: float, z_top_m: float, z_base_m: float) -> float:
    h = z_base_m - z_top_m
    if h <= 0:
        return 0.0
    if c_per_m == 0.0:
        return phi0
    integral = (phi0 / c_per_m) * (math.exp(-c_per_m * z_top_m) - math.exp(-c_per_m * z_base_m))
    return integral / h
```
```

### 5.3 Bulk density of a compacted layer

```python
def bulk_density(rho_grain_kg_m3: float, rho_water_kg_m3: float, phi_mean: float) -> float:
    return rho_grain_kg_m3 * (1.0 - phi_mean) + rho_water_kg_m3 * phi_mean
```

### 5.4 Decompacted thickness

Use solid mass conservation.

```python
def decompact_thickness(thickness_present_m: float, phi_mean_present: float, phi0: float) -> float:
    solid_fraction_present = 1.0 - phi_mean_present
    solid_fraction_initial = 1.0 - phi0
    if solid_fraction_initial <= 0.0:
        raise ValueError("Invalid phi0")
    return thickness_present_m * solid_fraction_present / solid_fraction_initial
```
```

### 5.5 Sediment load contribution

```python
def sediment_load_subsidence(thickness_m: float, rho_bulk_kg_m3: float, rho_water_kg_m3: float, rho_mantle_kg_m3: float) -> float:
    return thickness_m * (rho_bulk_kg_m3 - rho_water_kg_m3) / (rho_mantle_kg_m3 - rho_water_kg_m3)
```

### 5.6 Water load contribution

```python
def water_load_subsidence(water_depth_m: float, rho_water_kg_m3: float, rho_mantle_kg_m3: float) -> float:
    return water_depth_m * rho_water_kg_m3 / (rho_mantle_kg_m3 - rho_water_kg_m3)
```

### 5.7 Tectonic subsidence

```python
def tectonic_subsidence(total_subsidence_m: float, sediment_load_m: float, water_load_m: float) -> float:
    return total_subsidence_m - sediment_load_m - water_load_m
```

---

## 6. Time-step construction

The implementation needs discrete geological time steps.

### 6.1 Recommended rule
Use one step per depositional top/base boundary and one step per erosion event.

Example:

```python
def build_time_steps_ma(layers: list[Layer], erosion_events: list[ErosionEvent]) -> list[float]:
    ages = {0.0}
    for layer in layers:
        ages.add(layer.top_age_ma)
        ages.add(layer.base_age_ma)
    for event in erosion_events:
        ages.add(event.event_age_ma)
    return sorted(ages, reverse=True)  # old -> young
```

Alternative:
- use only top ages if the stratigraphic table is already discretized by tops.

---

## 7. Burial history implementation

### 7.1 Goal
Compute total present-equivalent accumulated thickness at each time step.

### 7.2 Minimal function

```python
def compute_total_subsidence_m(active_layers: list[Layer]) -> float:
    return sum(layer.thickness_present_m for layer in active_layers)
```

### 7.3 Active layer selection

A layer is active at age `t_ma` if it has already been deposited by that age.
With ages in Ma:
- layer exists after deposition starts and before present.
- exact condition depends on how deposition interval is defined.

Recommended simplified rule:

```python
def is_layer_active(layer: Layer, age_ma: float) -> bool:
    return layer.base_age_ma <= age_ma <= layer.top_age_ma
```

If the depositional semantics differ, normalize them once and document it.

---

## 8. Decompaction algorithm

### 8.1 Important constraint
Decompaction is state-dependent.
When upper layers are removed, burial depth of lower layers decreases, so porosity must be recalculated.

### 8.2 Required algorithm
At each backstripping step:
1. define the surviving column
2. reconstruct depths in that reduced column
3. compute porosity for each layer at its reconstructed depth
4. compute decompacted thickness
5. rebuild column geometry using decompacted thicknesses
6. iterate if necessary until thicknesses converge

### 8.3 Practical iterative implementation

```python
def decompact_column(
    layers: list[Layer],
    rho_water_kg_m3: float,
    max_iter: int = 20,
    tol_m: float = 1e-3,
) -> list[LayerState]:
    # initialize with present thicknesses
    current_thicknesses = [layer.thickness_present_m for layer in layers]

    for _ in range(max_iter):
        old = current_thicknesses.copy()
        layer_states = []
        z_top = 0.0

        for layer, h in zip(layers, current_thicknesses):
            z_base = z_top + h
            phi_mean = mean_porosity(layer.phi0, layer.compaction_c_per_m, z_top, z_base)
            rho_bulk = bulk_density(layer.rho_grain_kg_m3, rho_water_kg_m3, phi_mean)
            h_decomp = decompact_thickness(layer.thickness_present_m, phi_mean, layer.phi0)
            layer_states.append((layer, z_top, z_base, phi_mean, rho_bulk, h_decomp))
            z_top = z_top + h_decomp

        current_thicknesses = [state[-1] for state in layer_states]

        max_diff = max(abs(a - b) for a, b in zip(old, current_thicknesses)) if old else 0.0
        if max_diff < tol_m:
            break

    # convert to LayerState objects using final geometry
    ...
```

Notes:
- this is a simple fixed-point scheme
- it is sufficient for a first implementation
- later it can be optimized or replaced

---

## 9. Backstripping algorithm

### 9.1 Required logic
Backstripping must proceed from present day backward into the past.
At each older step, remove younger layers and decompact the remaining column.

### 9.2 Column reconstruction rule
At age `t_ma`, include only layers that existed at that time.
If erosion event occurred after `t_ma`, restore its removed thickness as a synthetic layer.

### 9.3 Core function signature

```python
def run_backstripping(well: WellInput) -> list[TimeStepResult]:
    ...
```

### 9.4 Pseudocode

```python
results = []
time_steps = build_time_steps_ma(well.layers, well.erosion_events)

for age_ma in time_steps:
    active_layers = select_active_layers_for_age(well.layers, age_ma)
    active_layers = apply_restored_erosion_layers(active_layers, well.erosion_events, age_ma)

    layer_states = decompact_column(
        layers=active_layers,
        rho_water_kg_m3=well.rho_water_kg_m3,
    )

    total_subsidence_m = sum(state.thickness_decompacted_m for state in layer_states)

    sediment_load_m = sum(
        sediment_load_subsidence(
            thickness_m=state.thickness_decompacted_m,
            rho_bulk_kg_m3=state.bulk_density_kg_m3,
            rho_water_kg_m3=well.rho_water_kg_m3,
            rho_mantle_kg_m3=well.rho_mantle_kg_m3,
        )
        for state in layer_states
    )

    water_depth_m = estimate_water_depth_for_age(active_layers, age_ma)
    water_load_m = water_load_subsidence(
        water_depth_m=water_depth_m,
        rho_water_kg_m3=well.rho_water_kg_m3,
        rho_mantle_kg_m3=well.rho_mantle_kg_m3,
    )

    tectonic_m = tectonic_subsidence(
        total_subsidence_m=total_subsidence_m,
        sediment_load_m=sediment_load_m,
        water_load_m=water_load_m,
    )

    results.append(
        TimeStepResult(
            age_ma=age_ma,
            active_layer_names=[layer.name for layer in active_layers],
            layer_states=layer_states,
            total_subsidence_m=total_subsidence_m,
            sediment_load_subsidence_m=sediment_load_m,
            water_load_subsidence_m=water_load_m,
            tectonic_subsidence_m=tectonic_m,
            metadata={},
        )
    )
```

---

## 10. Erosion handling

### 10.1 Minimal implementation strategy
Represent erosion as synthetic depositional units that are present in the past and absent today.

### 10.2 Helper function

```python
def erosion_event_to_layer(event: ErosionEvent) -> Layer:
    return Layer(
        name=event.name,
        top_age_ma=event.event_age_ma,
        base_age_ma=event.event_age_ma,
        thickness_present_m=event.removed_thickness_m,
        lithology=event.lithology,
        rho_grain_kg_m3=event.rho_grain_kg_m3,
        phi0=event.phi0,
        compaction_c_per_m=event.compaction_c_per_m,
        paleobathymetry_m=0.0,
        sea_level_m=0.0,
    )
```

### 10.3 Rule
At model ages older than the erosion event, the removed layer should be added back into the active column.

---

## 11. Water depth / sea-level handling

### 11.1 Minimal first version
Use a single scalar per layer or per time step.
If unknown:
- `paleobathymetry_m = 0.0`
- `sea_level_m = 0.0`

### 11.2 Helper

```python
def estimate_water_depth_for_age(active_layers: list[Layer], age_ma: float) -> float:
    if not active_layers:
        return 0.0
    top_layer = active_layers[-1]
    return max(0.0, top_layer.paleobathymetry_m + top_layer.sea_level_m)
```

---

## 12. Thermal subsidence fit

### 12.1 Scope
Only fit a simple exponential decay to tectonic subsidence.
Do not embed full McKenzie inversion in the first version.

### 12.2 Model equation

```python
def thermal_model(age_ma: np.ndarray, s0_m: float, tau_ma: float) -> np.ndarray:
    return s0_m * np.exp(-age_ma / tau_ma)
```

### 12.3 Objective

```python
def thermal_misfit(params: tuple[float, float], age_ma: np.ndarray, tectonic_m: np.ndarray) -> float:
    s0_m, tau_ma = params
    pred = thermal_model(age_ma, s0_m, tau_ma)
    return float(np.sum((tectonic_m - pred) ** 2))
```

### 12.4 Fit function

```python
from scipy.optimize import minimize


def fit_thermal_subsidence(age_ma: np.ndarray, tectonic_m: np.ndarray) -> ThermalFitResult:
    x0 = np.array([np.nanmax(tectonic_m), 50.0], dtype=float)

    def obj(x: np.ndarray) -> float:
        s0_m, tau_ma = float(x[0]), float(x[1])
        if s0_m < 0.0 or tau_ma <= 0.0:
            return 1e30
        return thermal_misfit((s0_m, tau_ma), age_ma, tectonic_m)

    res = minimize(obj, x0=x0, method="Nelder-Mead")

    if not res.success:
        return ThermalFitResult(s0_m=np.nan, tau_ma=np.nan, misfit_sse=np.nan, success=False)

    return ThermalFitResult(
        s0_m=float(res.x[0]),
        tau_ma=float(res.x[1]),
        misfit_sse=float(res.fun),
        success=True,
    )
```

---

## 13. End-to-end pipeline

### 13.1 Public entrypoint

```python
def run_well_1d_model(well: WellInput, do_thermal_fit: bool = True) -> WellModelResult:
    validate_well_input(well)
    steps = run_backstripping(well)

    thermal_fit = None
    if do_thermal_fit:
        age_ma = np.array([step.age_ma for step in steps], dtype=float)
        tectonic_m = np.array([step.tectonic_subsidence_m for step in steps], dtype=float)
        mask = np.isfinite(age_ma) & np.isfinite(tectonic_m)
        if np.count_nonzero(mask) >= 3:
            thermal_fit = fit_thermal_subsidence(age_ma[mask], tectonic_m[mask])

    return WellModelResult(
        well_name=well.well_name,
        steps=steps,
        thermal_fit=thermal_fit,
    )
```

### 13.2 Execution order

```text
validate input
-> build time steps
-> reconstruct active column for each age
-> restore erosion if needed
-> decompact column
-> compute total subsidence
-> compute sediment load
-> compute water load
-> compute tectonic subsidence
-> save step result
-> optional thermal fit
-> return final result
```

---

## 14. Output format for export

### 14.1 Flat summary table

Each row = one geological time step.

Recommended fields:

```text
well_name
age_ma
total_subsidence_m
sediment_load_subsidence_m
water_load_subsidence_m
tectonic_subsidence_m
n_active_layers
active_layer_names_joined
```

### 14.2 Nested layer-state table

Each row = one layer at one time step.

Recommended fields:

```text
well_name
age_ma
layer_name
top_depth_m
base_depth_m
thickness_decompacted_m
mean_porosity
bulk_density_kg_m3
```

---

## 15. Minimal test plan

### 15.1 Unit tests

#### Porosity
```python
assert porosity_at_depth(0.5, 0.0, 1000.0) == 0.5
assert porosity_at_depth(0.5, 0.001, 1000.0) < 0.5
```

#### Bulk density
```python
rho = bulk_density(2650.0, 1030.0, 0.4)
assert 1030.0 < rho < 2650.0
```

#### Water load
```python
assert water_load_subsidence(0.0, 1030.0, 3300.0) == 0.0
assert water_load_subsidence(100.0, 1030.0, 3300.0) > 0.0
```

#### Tectonic subsidence
```python
assert tectonic_subsidence(1000.0, 200.0, 100.0) == 700.0
```

### 15.2 Integration tests
- one-layer synthetic case
- two-layer sandstone/shale case
- case with one erosion event
- case with zero paleobathymetry
- case with thermal fit

### 15.3 QC invariants
- no NaN in final results unless input missing
- tectonic subsidence is reproducible for same input
- deeper burial should not increase porosity
- decompacted thickness should be >= present thickness for compactable lithologies

---

## 16. Default lithology presets (optional)

If user does not provide `phi0` and `c`, use lookup table.

```python
LITHOLOGY_PRESETS = {
    "sandstone": {"rho_grain_kg_m3": 2650.0, "phi0": 0.49, "compaction_c_per_m": 0.00027},
    "shale": {"rho_grain_kg_m3": 2720.0, "phi0": 0.63, "compaction_c_per_m": 0.00057},
    "limestone": {"rho_grain_kg_m3": 2710.0, "phi0": 0.50, "compaction_c_per_m": 0.00020},
    "dolomite": {"rho_grain_kg_m3": 2870.0, "phi0": 0.45, "compaction_c_per_m": 0.00018},
}
```

Important:
- these are defaults only
- implementation must allow override per layer

---

## 17. Known simplifications in version 1

These are accepted simplifications for first implementation:
- local Airy isostasy only
- single water density
- no overpressure
- no grain-density change with depth
- no temperature-dependent compaction
- no lithology mixing inside one layer
- no uncertainty propagation

---

## 18. Recommended public API

```python
# high-level
run_well_1d_model(well: WellInput, do_thermal_fit: bool = True) -> WellModelResult

# validation
validate_well_input(well: WellInput) -> None

# time steps
build_time_steps_ma(layers: list[Layer], erosion_events: list[ErosionEvent]) -> list[float]

# decompaction
porosity_at_depth(phi0: float, c_per_m: float, depth_m: float) -> float
mean_porosity(phi0: float, c_per_m: float, z_top_m: float, z_base_m: float) -> float
bulk_density(rho_grain_kg_m3: float, rho_water_kg_m3: float, phi_mean: float) -> float
decompact_thickness(thickness_present_m: float, phi_mean_present: float, phi0: float) -> float
decompact_column(layers: list[Layer], rho_water_kg_m3: float, max_iter: int = 20, tol_m: float = 1e-3) -> list[LayerState]

# loads
sediment_load_subsidence(thickness_m: float, rho_bulk_kg_m3: float, rho_water_kg_m3: float, rho_mantle_kg_m3: float) -> float
water_load_subsidence(water_depth_m: float, rho_water_kg_m3: float, rho_mantle_kg_m3: float) -> float
tectonic_subsidence(total_subsidence_m: float, sediment_load_m: float, water_load_m: float) -> float

# backstripping
run_backstripping(well: WellInput) -> list[TimeStepResult]

# thermal fit
thermal_model(age_ma: np.ndarray, s0_m: float, tau_ma: float) -> np.ndarray
fit_thermal_subsidence(age_ma: np.ndarray, tectonic_m: np.ndarray) -> ThermalFitResult
```

---

## 19. What Codex should implement first

Priority order:

```text
1. dataclasses and validation
2. porosity / density / decompaction helpers
3. time-step builder
4. active-layer selection
5. decompact_column()
6. run_backstripping()
7. flat export tables
8. thermal fitting
9. tests
```

---

## 20. Minimal definition of done

Implementation is acceptable when all of the following are true:
- one well can be run end-to-end from structured input
- program returns a time-step table with tectonic subsidence
- program returns layer-state table with decompacted thickness and density
- thermal fit runs on resulting tectonic curve
- tests pass on synthetic examples
- code is modular and does not mix I/O with physics

