# ADR-001: Compass Reset and Phase 1 Baseline

Status: Accepted

Date: 2026-04-16

## Context

The project is being reset onto a new product and architecture direction.
The target architecture is defined in `docs/app_compass.md`.
The active implementation scope is defined in `docs/phase1-contract.md`.

The previous project version is preserved as a reference snapshot under `subsidence_archive/legacy_reset_2026-04-16/`.

## Decisions

### 1. Strategic direction

The project now follows the Compass architecture as the active direction.

### 2. Execution scope

Work proceeds by phase.
Only Phase 1 foundation is active now.

### 3. Product structure

The active repository structure is:

- `frontend/` for the React client
- `app/` for the Python backend
- `docs/` for current project truth
- `subsidence_archive/` for legacy reference

### 4. Legacy handling

The legacy project is not part of the active architecture.
It remains available as a reusable knowledge and code source.

### 5. Delivery mode

Work is executed through reviewed checkpoints.
Each checkpoint should produce a concrete artifact that can be inspected before the next one starts.

## Consequences

- The active codebase can now be shaped directly around the Compass plan.
- Legacy implementation details do not constrain new architectural decisions.
- Reuse from the archive is allowed when it helps Phase 1, but reuse is optional rather than mandatory.
