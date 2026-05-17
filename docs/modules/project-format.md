# Project Format Module

This module describes the local `.subsidence` project bundle.

---

## Project Folder

A project is stored as a local folder with `.subsidence` semantics. The exact folder name is user-defined.

Expected contents may include:

- `project.db`
- `manifest.json`
- `curves/`
- `deviation/`
- `results/`
- `checkpoints/`

Generated runtime project folders should not be committed unless they are explicit test fixtures.

Exports are written to user-selected external folders by default, not into the project bundle.

---

## SQLite Metadata

The SQLite database stores:

- Project metadata.
- Wells.
- Curve metadata.
- Formation tops.
- Strat charts and strat units.
- Links between tops and strat units.
- Visual configuration.
- Dictionaries.
- Sea-level curves.
- Compaction/lithology/unit/mnemonic dictionary state.
- Undo/redo data where applicable.

---

## Payload Files

Large numeric arrays should not live in normal JSON payloads.

Expected payload examples:

- Curve samples in Parquet files under `curves/`.
- Deviation samples under `deviation/`.
- Computed results under `results/`.

Current log payload rule:

- Imported LAS/CSV log curves are stored on a per-well MD reference grid.
- Continuous curves are interpolated to that grid.
- Discrete curves are down-step blocked, with null gaps preserved.

---

## Checkpoints

Checkpoints store recoverable project states, plus a user comment and compact project statistics.

Common bug areas:

- Checkpoint restore changes backend state but frontend remains stale.
- Checkpoints include payload files inconsistently.
- Generated checkpoint files are accidentally committed.

---

## Compatibility Rule

Any project format change must include:

- What changed.
- Whether existing projects still open.
- Whether a migration is needed.
- How tests verify save/reopen compatibility.
