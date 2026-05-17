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

- Improve column mapping behavior.
- If a user assigns a field to a new source column, automatically clear the previous source column for that field.
- The user should not need to manually set the old column back to `-` before choosing a new one.

### 4. User Attributes From Extra Columns

- Preserve imported columns that are not part of the core schema as user-defined attributes.
- Store them in the database first; decide later where and how they should be displayed or used.
- Apply this consistently across relevant importers after reviewing the schema.

### 5. Checkpoint Revert And Comments

Implemented. Maintainer implementation notes are local-only and are not part of the public documentation tree.

## Non-Goals

- No implementation in the current branch until explicitly approved.
- No schema changes before the detailed design is reviewed.
