# Core Module

## Purpose

The `subsidence.core` package is intended to host the computational logic for the two main scientific layers of the project:

- Level A — burial history
- Level B — tectonic subsidence via decompaction and backstripping

## Current Status

At the moment the package contains only `__init__.py` and serves as a placeholder.

The package-level docstring already defines the target scope:

- burial history
- backstripping
- decompaction

## Planned Responsibilities

The future contents of this package should likely include:

- burial-history model preparation from tops and stratigraphic inputs
- erosion and unconformity handling
- porosity and compaction transforms
- decompaction routines inspired by `pyBacktrack`
- tectonic subsidence calculation workflows
- export-friendly result structures for tables and plots

## Recommended Submodules

Likely module split when implementation starts:

- `burial_history.py`
- `decompaction.py`
- `backstripping.py`
- `schemas.py` or `results.py`
- `adapters/` for logic borrowed or translated from reference repositories

## Current Gaps

- no computational code
- no model inputs or result dataclasses in this package
- no links yet from `data` loaders into a calculation pipeline
