# Future Import, Stratigraphy, and Checkpoint Work

Status: Draft
Branch: TBD

## Goal

Keep related future work visible without mixing it into the active data import workflow branch.

This contract is intentionally short. Each item needs a proper code review and detailed implementation plan before work starts.

## Items

### 1. Stratigraphy Model Improvements

Implemented. Maintainer implementation notes are local-only and are not part of the public documentation tree.

### 2. Multi-File Import

- Support selecting and importing multiple files in one import workflow.
- Decide per data type whether mapping is shared across files or configured per file.
- Show per-file success/error summary.
- Keep this separate from the current multi-well CSV foundation.

### 3. Import Mapping UX

Moved to `docs/contracts/import-mapping-ux.md`.

### 4. User Attributes From Extra Columns

Implemented. Maintainer implementation notes are local-only and are not part of the public documentation tree.

### 5. Checkpoint Revert And Comments

Implemented. Maintainer implementation notes are local-only and are not part of the public documentation tree.

## Non-Goals

- No implementation in the current branch until explicitly approved.
- No schema changes before the detailed design is reviewed.
