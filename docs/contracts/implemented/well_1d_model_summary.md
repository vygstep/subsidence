# 1D Well Modeling Summary

## Goal
Implement a strict 1D well model with these stages:
1. total burial / total subsidence
2. decompaction
3. Airy backstripping
4. stepwise backstripping through time
5. thermal subsidence fitting

This document is written for code implementation, not for presentation.

---

## 1. Required input data

### 1.1 Layer table
One row per stratigraphic layer.

Required fields:

```python
Layer = {
    "layer_id": str,
    "top_age_ma": float,          # depositional age of top boundary
    "base_age_ma": float,         # depositional age of base boundary
    "thickness_present_m": float, # present-day compacted thickness
    "lithology": str,
    "rho_grain_kg_m3": float,     # grain density
    "phi0": float,                # surface porosity for Athy law
    "compaction_c_1_m": float,    # compaction coefficient
}
```

Conventions:
- ages in Ma
- thickness in meters
- layers sorted from oldest/bottom to youngest/top, or vice versa, but one convention must be fixed globally
- `top_age_ma <= base_age_ma` or opposite convention must be fixed and validated

### 1.2 Optional erosion events
If erosion exists, represent it as explicit removed section.

```python
ErosionEvent = {
    "event_age_ma": float,
    "eroded_thickness_m": float,
    "lithology": str,
    "rho_grain_kg_m3": float,
    "phi0": float,
    "compaction_c_1_m": float,
}
```

Implementation note:
- easiest approach: convert each erosion event into a synthetic layer and include it in the burial history before stripping

### 1.3 Global parameters

```python
ModelParams = {
    "rho_water_kg_m3": 1030.0,
    "rho_mantle_kg_m3": 3300.0,
    "sea_level_m": 0.0,          # can be scalar or time series
    "paleobathymetry_m": 0.0,    # can be scalar or per time step
}
```

---

## 2. Time discretization

Use event-based time steps.

Recommended:
- one time step per depositional boundary
- additional time steps for erosion events

Example:

```python
time_steps_ma = sorted(unique([
    all layer top ages,
    all layer base ages,
    all erosion ages,
]))
```

Backward workflow:
- start at present day
- remove youngest layer/event step by step
- after each removal, decompact remaining column
- compute tectonic subsidence at that restored state

---

## 3. Stage 1: total burial / total subsidence

## 3.1 Purpose
Build the observed burial history from present-day compacted thicknesses.

## 3.2 Minimal implementation
At each time step, sum thicknesses of all units already deposited by that time.

```python
def compute_total_burial(layers, time_steps_ma):
    result = []
    for t in time_steps_ma:
        active_layers = [layer for layer in layers if layer_is_present_at_time(layer, t)]
        s_total_m = sum(layer["thickness_present_m"] for layer in active_layers)
        result.append({"time_ma": t, "s_total_m": s_total_m})
    return result
```

## 3.3 Presence rule
Define one strict rule and use it everywhere.
Example:

```python
def layer_is_present_at_time(layer, t_ma):
    # Example convention: larger Ma = older
    # Layer exists after its deposition is completed
    return layer["top_age_ma"] <= t_ma <= layer["base_age_ma"]
```

The exact inequality depends on the age convention. Validate once and keep consistent.

---

## 4. Stage 2: decompaction

## 4.1 Purpose
Restore original thicknesses of compacted layers.

## 4.2 Porosity law
Use Athy-type porosity-depth relation.

```python
def porosity_at_depth(phi0, c_1_m, depth_m):
    return phi0 * exp(-c_1_m * depth_m)
```

Equivalent mathematical form used in code:

```python
phi_z = phi0 * exp(-c * z)
```

where:
- `phi0` = initial porosity at surface
- `c` = compaction coefficient
- `z` = burial depth in meters

## 4.3 Mean porosity for a layer
For a layer between `z_top` and `z_base`:

```python
def mean_porosity(phi0, c_1_m, z_top_m, z_base_m):
    h = z_base_m - z_top_m
    if h <= 0:
        raise ValueError("Layer thickness must be positive")
    return (phi0 / (c_1_m * h)) * (exp(-c_1_m * z_top_m) - exp(-c_1_m * z_base_m))
```

This is the analytical integral of the Athy law through the layer.

## 4.4 Grain-volume conservation
Use solid volume conservation to reconstruct decompacted thickness.

Code form:

```python
def decompact_thickness(thickness_present_m, phi_mean_present, phi0):
    solid_fraction_present = 1.0 - phi_mean_present
    solid_fraction_initial = 1.0 - phi0
    return thickness_present_m * solid_fraction_present / solid_fraction_initial
```

Equivalent expression:

```python
h_decomp = h_present * (1.0 - phi_mean_present) / (1.0 - phi0)
```

## 4.5 Bulk density of a layer

```python
def bulk_density(rho_grain, rho_water, phi_mean):
    return rho_grain * (1.0 - phi_mean) + rho_water * phi_mean
```

Equivalent expression:

```python
rho_bulk = rho_grain * (1.0 - phi_mean) + rho_water * phi_mean
```

## 4.6 Decompaction workflow for a column
Decompaction is not a one-line calculation for all layers at once. The burial depth of each layer depends on the restored thicknesses of the layers above it.

Recommended algorithm:

```python
def decompact_column(layers, rho_water):
    """
    layers: remaining layers at one restoration step
    order: top to bottom for depth accumulation
    returns restored thickness, mean porosity, bulk density, top/base depths
    """
    restored = []
    z_top = 0.0

    for layer in layers:  # top -> bottom
        # initial estimate from present thickness
        h = layer["thickness_present_m"]

        for _ in range(20):
            z_base = z_top + h
            phi_mean = mean_porosity(
                layer["phi0"],
                layer["compaction_c_1_m"],
                z_top,
                z_base,
            )
            h_new = decompact_thickness(
                layer["thickness_present_m"],
                phi_mean,
                layer["phi0"],
            )
            if abs(h_new - h) < 1e-6:
                h = h_new
                break
            h = h_new

        z_base = z_top + h
        phi_mean = mean_porosity(
            layer["phi0"],
            layer["compaction_c_1_m"],
            z_top,
            z_base,
        )
        rho_bulk = bulk_density(layer["rho_grain_kg_m3"], rho_water, phi_mean)

        restored.append({
            **layer,
            "z_top_m": z_top,
            "z_base_m": z_base,
            "thickness_decomp_m": h,
            "phi_mean": phi_mean,
            "rho_bulk_kg_m3": rho_bulk,
        })

        z_top = z_base

    return restored
```

Implementation notes:
- process top -> bottom so restored depth of each layer includes restored thicknesses above it
- use fixed-point iteration or another iterative solver
- validate `0 <= phi_mean < 1`
- clamp or raise if invalid values appear

---

## 5. Stage 3: Airy backstripping

## 5.1 Purpose
Separate tectonic subsidence from sediment and water loading.

## 5.2 Sediment load term
For one restored state:

```python
def sediment_load_subsidence(restored_layers, rho_water, rho_mantle):
    denom = rho_mantle - rho_water
    return sum(
        ((layer["rho_bulk_kg_m3"] - rho_water) / denom) * layer["thickness_decomp_m"]
        for layer in restored_layers
    )
```

Equivalent expression:

```python
S_sed = sum(((rho_bulk_i - rho_water) / (rho_mantle - rho_water)) * h_decomp_i)
```

## 5.3 Water load term

```python
def water_load_subsidence(water_depth_m, rho_water, rho_mantle):
    return (rho_water / (rho_mantle - rho_water)) * water_depth_m
```

Equivalent expression:

```python
S_water = (rho_water / (rho_mantle - rho_water)) * water_depth_m
```

Where:

```python
water_depth_m = paleobathymetry_m + sea_level_m
```

If no paleobathymetry and no sea-level correction are available, set:

```python
water_depth_m = 0.0
```

## 5.4 Tectonic subsidence term
At a given time step:

```python
def tectonic_subsidence(s_total_m, s_sed_m, s_water_m):
    return s_total_m - s_sed_m - s_water_m
```

Equivalent expression:

```python
S_tect = S_total - S_sed - S_water
```

Implementation note:
- `S_total` at restoration step should correspond to restored total thickness of the remaining column at that step
- do not mix present compacted thickness and restored thickness in the same equation without a defined convention

Recommended consistent choice:
- after each stripping step, compute `S_total_restored = sum(thickness_decomp_m)` for remaining layers
- then compute sediment load and water load from that same restored state

---

## 6. Stage 4: stepwise backstripping through time

## 6.1 Purpose
Restore tectonic subsidence history by removing layers one by one from youngest to oldest.

## 6.2 Required ordering
Create a stripping sequence from youngest/topmost unit toward oldest/bottommost unit.

## 6.3 Core algorithm

```python
def run_backstripping(all_layers, params, water_depth_by_time):
    """
    all_layers must be ordered top -> bottom for decompaction at each step.
    stripping proceeds by removing the youngest top layer each iteration.
    """
    working_layers = list(all_layers)
    history = []

    while len(working_layers) > 0:
        restored_layers = decompact_column(
            working_layers,
            rho_water=params["rho_water_kg_m3"],
        )

        s_total_restored_m = sum(layer["thickness_decomp_m"] for layer in restored_layers)
        s_sed_m = sediment_load_subsidence(
            restored_layers,
            rho_water=params["rho_water_kg_m3"],
            rho_mantle=params["rho_mantle_kg_m3"],
        )

        t_ma = working_layers[0]["top_age_ma"]  # or another explicit event age rule
        water_depth_m = water_depth_by_time.get(t_ma, 0.0)
        s_water_m = water_load_subsidence(
            water_depth_m,
            rho_water=params["rho_water_kg_m3"],
            rho_mantle=params["rho_mantle_kg_m3"],
        )

        s_tect_m = tectonic_subsidence(s_total_restored_m, s_sed_m, s_water_m)

        history.append({
            "time_ma": t_ma,
            "n_layers_remaining": len(working_layers),
            "s_total_restored_m": s_total_restored_m,
            "s_sed_m": s_sed_m,
            "s_water_m": s_water_m,
            "s_tect_m": s_tect_m,
            "restored_layers": restored_layers,
        })

        # remove youngest top layer
        working_layers = working_layers[1:]

    return history
```

## 6.4 Important implementation rule
The exact time attached to each stripping step must be explicit.

Choose one convention, for example:
- use age of top of removed layer
- or use age of base of removed layer
- or use event age table constructed separately

Do not mix conventions.

---

## 7. Stage 5: thermal subsidence fitting

## 7.1 Purpose
Fit a simple thermal subsidence curve to the tectonic subsidence history.

## 7.2 Minimal exponential form
Use a simple exponential relaxation model.

```python
def thermal_model(time_ma, s0_m, tau_ma):
    return s0_m * exp(-time_ma / tau_ma)
```

Equivalent expression:

```python
S_model(t) = S0 * exp(-t / tau)
```

where:
- `S0` = initial amplitude
- `tau` = thermal time constant

## 7.3 Misfit function

```python
def thermal_misfit(params, time_ma, s_tect_obs_m):
    s0_m, tau_ma = params
    s_pred = [thermal_model(t, s0_m, tau_ma) for t in time_ma]
    return sum((obs - pred) ** 2 for obs, pred in zip(s_tect_obs_m, s_pred))
```

Equivalent expression:

```python
misfit = sum((S_tect_obs_k - S_model_k) ** 2 for k in time_steps)
```

## 7.4 Fitting step
Use any optimizer.
Example placeholder:

```python
from scipy.optimize import minimize

result = minimize(
    thermal_misfit,
    x0=[1000.0, 50.0],
    args=(time_ma_array, s_tect_array),
    bounds=[(0.0, None), (1e-6, None)],
)
```

Return:

```python
{
    "s0_m": result.x[0],
    "tau_ma": result.x[1],
    "misfit": result.fun,
}
```

Implementation note:
- fit only the part of the curve that is intended to represent thermal relaxation
- if the tectonic subsidence history has multiple phases, split phases before fitting

---

## 8. Minimal function list for implementation

Recommended program structure:

```python
def layer_is_present_at_time(layer, t_ma):
    ...


def porosity_at_depth(phi0, c_1_m, depth_m):
    ...


def mean_porosity(phi0, c_1_m, z_top_m, z_base_m):
    ...


def decompact_thickness(thickness_present_m, phi_mean_present, phi0):
    ...


def bulk_density(rho_grain, rho_water, phi_mean):
    ...


def decompact_column(layers, rho_water):
    ...


def sediment_load_subsidence(restored_layers, rho_water, rho_mantle):
    ...


def water_load_subsidence(water_depth_m, rho_water, rho_mantle):
    ...


def tectonic_subsidence(s_total_m, s_sed_m, s_water_m):
    ...


def run_backstripping(all_layers, params, water_depth_by_time):
    ...


def thermal_model(time_ma, s0_m, tau_ma):
    ...


def thermal_misfit(params, time_ma, s_tect_obs_m):
    ...


def fit_thermal_model(time_ma, s_tect_obs_m):
    ...
```

---

## 9. Output schema

Minimal output object:

```python
Result = {
    "history": [
        {
            "time_ma": float,
            "s_total_restored_m": float,
            "s_sed_m": float,
            "s_water_m": float,
            "s_tect_m": float,
            "restored_layers": list,
        },
        ...
    ],
    "thermal_fit": {
        "s0_m": float,
        "tau_ma": float,
        "misfit": float,
    },
}
```

Optional flattened output for tables:

```python
BackstripRow = {
    "time_ma": float,
    "s_total_restored_m": float,
    "s_sed_m": float,
    "s_water_m": float,
    "s_tect_m": float,
}
```

Optional layer-state table at each time step:

```python
LayerStateRow = {
    "time_ma": float,
    "layer_id": str,
    "z_top_m": float,
    "z_base_m": float,
    "thickness_decomp_m": float,
    "phi_mean": float,
    "rho_bulk_kg_m3": float,
}
```

---

## 10. Validation rules

Implement these checks before computation:

```python
assert rho_mantle > rho_water
assert all(layer["thickness_present_m"] > 0 for layer in layers)
assert all(0.0 <= layer["phi0"] < 1.0 for layer in layers)
assert all(layer["compaction_c_1_m"] > 0 for layer in layers)
assert all(layer["rho_grain_kg_m3"] > rho_water for layer in layers)
```

Checks during decompaction:

```python
assert 0.0 <= phi_mean < 1.0
assert thickness_decomp_m > 0.0
assert z_base_m > z_top_m
```

Checks on age ordering:
- all layers must follow one consistent age convention
- stripping order must match depositional order

---

## 11. Simplifications allowed in v1

For first implementation, these simplifications are acceptable:

```python
sea_level_m = 0.0
paleobathymetry_m = 0.0
no_erosion_events
fixed lithology parameters from lookup table
single thermal phase fit
```

Then v2 can add:
- erosion as synthetic layers
- sea-level curve
- paleobathymetry by interval
- multi-phase tectonic history
- McKenzie-specific parameterization with beta

---

## 12. Minimal lithology parameter table example

```python
LITHOLOGY_PARAMS = {
    "sandstone": {"phi0": 0.49, "compaction_c_1_m": 2.7e-4, "rho_grain_kg_m3": 2650.0},
    "shale":     {"phi0": 0.63, "compaction_c_1_m": 5.7e-4, "rho_grain_kg_m3": 2720.0},
    "limestone": {"phi0": 0.50, "compaction_c_1_m": 2.0e-4, "rho_grain_kg_m3": 2710.0},
    "dolomite":  {"phi0": 0.45, "compaction_c_1_m": 1.7e-4, "rho_grain_kg_m3": 2870.0},
}
```

These values must be treated as configurable, not hard-coded scientific truth.

---

## 13. Minimal implementation order

Recommended coding order:

```python
1. input schema + validation
2. porosity / mean porosity functions
3. decompact_thickness
4. decompact_column
5. sediment_load_subsidence
6. water_load_subsidence
7. tectonic_subsidence
8. run_backstripping
9. thermal_model + fit
10. table outputs
```

---

## 14. What this 1D implementation does not solve

Not included in this specification:
- flexural backstripping
- spatial load redistribution
- elastic thickness inversion
- dynamic topography modeling
- lower crust flow modeling
- pressure-dependent compaction
- geochemical / thermal maturity modeling

This specification is only for strict local 1D burial + decompaction + Airy backstripping + simple thermal fit.
