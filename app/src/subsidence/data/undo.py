from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .schema import CurveMetadata, DeviationSurveyModel, FormationTopModel, VisualConfig, WellModel


class Command(ABC):
    @abstractmethod
    def apply(self, session: Session) -> None:
        ...

    @abstractmethod
    def revert(self, session: Session) -> None:
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        ...


class UndoStack:
    def __init__(self, max_size: int = 200) -> None:
        self._commands: list[Command] = []
        self._index = 0
        self._clean_index = 0
        self._max_size = max_size

    @property
    def is_clean(self) -> bool:
        return self._clean_index == self._index

    @property
    def can_undo(self) -> bool:
        return self._index > 0

    @property
    def can_redo(self) -> bool:
        return self._index < len(self._commands)

    def push(self, command: Command, session: Session) -> None:
        if self._index < len(self._commands):
            del self._commands[self._index :]
        command.apply(session)
        session.flush()
        self._commands.append(command)
        self._index += 1
        self._trim_to_max_size()

    def undo(self, session: Session) -> Command:
        if not self.can_undo:
            raise RuntimeError('Nothing to undo.')
        command = self._commands[self._index - 1]
        command.revert(session)
        session.flush()
        self._index -= 1
        return command

    def redo(self, session: Session) -> Command:
        if not self.can_redo:
            raise RuntimeError('Nothing to redo.')
        command = self._commands[self._index]
        command.apply(session)
        session.flush()
        self._index += 1
        return command

    def clear(self) -> None:
        self._commands.clear()
        self._index = 0
        self._clean_index = 0

    def mark_clean(self) -> None:
        self._clean_index = self._index

    def mark_dirty(self) -> None:
        self._clean_index = -1

    def _trim_to_max_size(self) -> None:
        overflow = len(self._commands) - self._max_size
        if overflow <= 0:
            return
        del self._commands[:overflow]
        self._index = max(0, self._index - overflow)
        if self._clean_index >= 0:
            self._clean_index -= overflow
            if self._clean_index < 0:
                self._clean_index = -1


def _model_to_dict(model: Any) -> dict[str, Any]:
    return {column.name: getattr(model, column.name) for column in model.__table__.columns}


def _normalize_config(config: Any) -> str | None:
    if config is None:
        return None
    if isinstance(config, str):
        return config
    return json.dumps(config, sort_keys=True)


class UpdateFormationDepth(Command):
    def __init__(self, top_id: int, old_depth: float, new_depth: float) -> None:
        self.top_id = top_id
        self.old_depth = old_depth
        self.new_depth = new_depth

    @property
    def description(self) -> str:
        return f'Update formation top {self.top_id} depth'

    def apply(self, session: Session) -> None:
        top = session.get(FormationTopModel, self.top_id)
        if top is None:
            raise ValueError(f'Formation top not found: {self.top_id}')
        top.depth_md = self.new_depth

    def revert(self, session: Session) -> None:
        top = session.get(FormationTopModel, self.top_id)
        if top is None:
            raise ValueError(f'Formation top not found: {self.top_id}')
        top.depth_md = self.old_depth


class UpdateVisualConfig(Command):
    def __init__(self, scope: str, scope_id: str, old_config: Any, new_config: Any) -> None:
        self.scope = scope
        self.scope_id = scope_id
        self.old_config = _normalize_config(old_config)
        self.new_config = _normalize_config(new_config)

    @property
    def description(self) -> str:
        return f'Update visual config {self.scope}:{self.scope_id}'

    def apply(self, session: Session) -> None:
        record = self._get_record(session)
        if self.new_config is None:
            if record is not None:
                session.delete(record)
            return
        if record is None:
            record = VisualConfig(scope=self.scope, scope_id=self.scope_id, config=self.new_config)
            session.add(record)
        else:
            record.config = self.new_config

    def revert(self, session: Session) -> None:
        record = self._get_record(session)
        if self.old_config is None:
            if record is not None:
                session.delete(record)
            return
        if record is None:
            session.add(VisualConfig(scope=self.scope, scope_id=self.scope_id, config=self.old_config))
        else:
            record.config = self.old_config

    def _get_record(self, session: Session) -> VisualConfig | None:
        return session.scalar(
            select(VisualConfig).where(
                VisualConfig.scope == self.scope,
                VisualConfig.scope_id == self.scope_id,
            )
        )


class ImportWell(Command):
    def __init__(self, project_path: Path | str, well_id: str) -> None:
        self.project_path = Path(project_path)
        self.well_id = well_id
        self._snapshot: dict[str, Any] | None = None

    @property
    def description(self) -> str:
        return f'Import well {self.well_id}'

    def apply(self, session: Session) -> None:
        if self._snapshot is None:
            self._snapshot = self._capture_snapshot(session)
            return
        if session.get(WellModel, self.well_id) is not None:
            return
        self._restore_snapshot(session, self._snapshot)

    def revert(self, session: Session) -> None:
        if self._snapshot is None:
            self._snapshot = self._capture_snapshot(session)
        well = session.get(WellModel, self.well_id)
        if well is None:
            return
        session.delete(well)
        session.flush()
        for relative_path in self._snapshot['files']:
            file_path = self.project_path / relative_path
            if file_path.exists():
                file_path.unlink()

    def _capture_snapshot(self, session: Session) -> dict[str, Any]:
        well = session.get(WellModel, self.well_id)
        if well is None:
            raise ValueError(f'Well not found: {self.well_id}')
        curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == self.well_id)))
        deviation = session.scalar(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == self.well_id))
        tops = list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == self.well_id)))

        files: dict[str, bytes] = {}
        relative_paths = {row.data_uri for row in curve_rows}
        if deviation is not None:
            relative_paths.add(deviation.data_uri)
        if well.source_las_path:
            relative_paths.add(well.source_las_path)
        for relative_path in relative_paths:
            file_path = self.project_path / relative_path
            if file_path.exists():
                files[relative_path] = file_path.read_bytes()

        return {
            'well': _model_to_dict(well),
            'curve_metadata': [_model_to_dict(row) for row in curve_rows],
            'deviation': _model_to_dict(deviation) if deviation is not None else None,
            'formation_tops': [_model_to_dict(row) for row in tops],
            'files': files,
        }

    def _restore_snapshot(self, session: Session, snapshot: dict[str, Any]) -> None:
        for relative_path, payload in snapshot['files'].items():
            file_path = self.project_path / relative_path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(payload)

        session.add(WellModel(**snapshot['well']))
        session.flush()
        for row in snapshot['curve_metadata']:
            session.add(CurveMetadata(**row))
        if snapshot['deviation'] is not None:
            session.add(DeviationSurveyModel(**snapshot['deviation']))
        for row in snapshot['formation_tops']:
            session.add(FormationTopModel(**row))
