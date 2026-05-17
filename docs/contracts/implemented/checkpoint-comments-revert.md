# Checkpoint Comments And Revert Workflow

Status: Implemented
Branch: feature/checkpoint-comments-revert

## Goal

Make checkpoints inspectable and restorable from the UI without changing the project-bundle ownership model.

Checkpoints belong to the currently open project bundle. Reverting a checkpoint from another project is out of scope.

## Current State

- Backend already supports checkpoint create/list/restore/delete.
- `CheckpointModel.description` already exists.
- Frontend `Create checkpoint` currently creates a checkpoint immediately with an auto-generated name and empty description.
- Frontend has no user-facing checkpoint list or restore/revert workflow.

## Required Behavior

### Create Checkpoint

Clicking `Create checkpoint` opens a compact dialog instead of creating silently.

The dialog shows:

- `Date` as a read-only automatically generated timestamp.
- `User comment` as a 3-line textarea.
- `Project statistics` summary:
  - project name;
  - well count and well names;
  - total log curve count;
  - total tops/picks count;
  - TopSet count;
  - strat chart count;
  - sea-level curve count;
  - deviation survey count.

Actions:

- `Cancel`
- `Create checkpoint`

The user comment is saved to checkpoint `description`.

### Revert From Checkpoint

Add a `Revert from checkpoint` project menu action.

Clicking it opens a compact dialog:

- list available checkpoints for the currently open project;
- selecting a checkpoint shows:
  - date;
  - checkpoint name;
  - saved user comment;
  - file size;
  - app/schema version;
  - project statistics if available.

Actions:

- `Cancel`
- `Revert`

Before restore, show this exact warning:

```text
Reverting will replace the current project state. Unsaved/current changes can be lost. If you want to preserve the current state, create a checkpoint first.
```

After restore:

- refresh project status;
- reload well inventories;
- reload the active well if possible;
- reload dictionaries/lists needed by the current UI;
- reset stale selection if the restored project no longer contains it.

### Statistics Snapshot

Checkpoint statistics should describe the project at checkpoint creation time.

Implementation can store the statistics as JSON inside `description` if no schema change is needed, but the visible user comment must remain clean and readable. Prefer a structured response if a lightweight schema addition is safer.

## Non-Goals

- Do not import/open checkpoint files from another project.
- Do not redesign checkpoint storage.
- Do not change the auto-created `before-restore-*` backend behavior unless needed for correctness.
- Do not implement multi-project checkpoint browsing.

## Implementation Stages

1. Backend/API inventory and statistics helper.
   - Add or expose project statistics for the current working DB.
   - Include statistics in checkpoint create/list responses.
2. Create checkpoint dialog.
   - Date, comment, compact statistics, explicit create button.
3. Revert checkpoint dialog.
   - List checkpoints, preview selected checkpoint, exact warning, restore call.
4. Post-restore frontend refresh.
   - Reload current project state enough to avoid stale UI after restore.
5. Tests.
   - Backend checkpoint create/list/restore still passes.
   - Description/comment persists.
   - Statistics are returned.
   - Frontend menu exposes create and revert actions.
