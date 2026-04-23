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
- Undo/redo data where applicable.

---

## Payload Files

Large numeric arrays should not live in normal JSON payloads.

Expected payload examples:

- Curve samples in Parquet files under `curves/`.
- Deviation samples under `deviation/`.
- Computed results under `results/`.

---

## Checkpoints

Checkpoints store recoverable project states.

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
