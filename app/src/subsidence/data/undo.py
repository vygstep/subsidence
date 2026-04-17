from __future__ import annotations


class UndoStack:
    """Minimal clean/dirty tracker for the persistence layer.

    Phase 2.5 Step 4 only needs save/autosave clean-state semantics.
    Command history and undo/redo behavior are added in Step 9.
    """

    def __init__(self) -> None:
        self._is_clean = True

    @property
    def is_clean(self) -> bool:
        return self._is_clean

    def mark_clean(self) -> None:
        self._is_clean = True

    def mark_dirty(self) -> None:
        self._is_clean = False
