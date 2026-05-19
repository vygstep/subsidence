# Multi-File Import

Status: Implemented
Branch: feature/multi-file-import

## Goal

Allow import workflows to process multiple selected files while preserving the current single-file behavior and keeping each importer responsible for its own data rules.

## Scope

Multi-file import applies to:

- Logs: LAS and delimited text files, mixed in one selection.
- Tops CSV/TSV/TXT.
- Deviation CSV/TSV/TXT.
- Wells CSV/TSV/TXT.
- StratChart CSV/TSV/TXT.
- Sea level curve CSV/TSV/TXT.

## Required Behavior

- Existing single-file imports must keep working.
- The file picker must support selecting multiple files.
- Native file picking must keep `tkinter` isolated in a subprocess.
- The import wizard should process files sequentially.
- Preview must clearly show the current file, for example `File 2 of 5`.
- The user confirms/imports the current file, then the wizard advances to the next file.
- At the end, show a summary with imported, failed, and skipped files.
- Per-file errors should not crash the whole wizard.
- Logs may mix LAS and delimited text files; file type is detected per file.
- Tabular import mapping is initially per file. Shared mapping can be considered later only if the UX proves safe.
- Multi-well CSV behavior remains data-driven and independent from multi-file behavior.

## Architecture Notes

- Add file-list picking as a path-picker capability, not as importer-specific backend logic.
- Keep queue/progress state in the frontend import wizard layer.
- Keep backend import endpoints mostly single-file in the first implementation; the frontend orchestrates sequential imports.
- Do not mix import orchestration with persistence, rendering, or model calculation modules.
- Extract shared multi-file queue/status UI only when at least two importers use the same pattern.

## Implementation Plan

1. Add backend `pick-files` endpoint and frontend `pickFiles()` helper. Done.
2. Add a small shared multi-file queue/progress helper for import dialogs. Done.
3. Implement multi-file logs first because it has mixed LAS/CSV file-type detection. Done.
4. Add summary UI for completed multi-file runs. Done.
5. Extend the same sequential workflow to tops, deviation, wells, StratChart, and sea level curve imports. Done.
6. Add focused frontend tests for queue progression and summary behavior. Done.
7. Run backend picker/import tests where backend behavior changes. Done.

## Non-Goals

- No bulk backend import endpoint in the first implementation.
- No schema changes.
- No shared mapping across files until manually reviewed after the sequential workflow is stable.
