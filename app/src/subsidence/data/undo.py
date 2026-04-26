from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .schema import CurveMetadata, DeviationSurveyModel, FormationStratLink, FormationTopModel, VisualConfig, WellModel
from .strat_link import auto_link_all_formations_to_chart


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


def _capture_well_snapshot(session: Session, project_path: Path | str, well_id: str) -> dict[str, Any]:
    project_path = Path(project_path)
    well = session.get(WellModel, well_id)
    if well is None:
        raise ValueError(f'Well not found: {well_id}')

    curve_rows = list(session.scalars(select(CurveMetadata).where(CurveMetadata.well_id == well_id)))
    deviation = session.scalar(select(DeviationSurveyModel).where(DeviationSurveyModel.well_id == well_id))
    tops = list(session.scalars(select(FormationTopModel).where(FormationTopModel.well_id == well_id)))
    top_ids = [t.id for t in tops]
    links = list(session.scalars(
        select(FormationStratLink).where(FormationStratLink.formation_id.in_(top_ids))
    )) if top_ids else []

    files: dict[str, bytes] = {}
    relative_paths: set[str] = {row.data_uri for row in curve_rows}
    if deviation is not None:
        relative_paths.add(deviation.data_uri)
    if well.source_las_path:
        relative_paths.add(well.source_las_path)
    for relative_path in relative_paths:
        file_path = project_path / relative_path
        if file_path.exists():
            files[relative_path] = file_path.read_bytes()

    return {
        'well': _model_to_dict(well),
        'curve_metadata': [_model_to_dict(row) for row in curve_rows],
        'deviation': _model_to_dict(deviation) if deviation is not None else None,
        'formation_tops': [_model_to_dict(row) for row in tops],
        'formation_strat_links': [_model_to_dict(link) for link in links],
        'files': files,
    }


def _restore_well_snapshot(session: Session, project_path: Path | str, snapshot: dict[str, Any]) -> None:
    project_path = Path(project_path)
    if session.get(WellModel, snapshot['well']['id']) is not None:
        return

    for relative_path, payload in snapshot['files'].items():
        file_path = project_path / relative_path
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
    session.flush()
    for row in snapshot.get('formation_strat_links', []):
        session.add(FormationStratLink(**row))


def _delete_well_snapshot(session: Session, project_path: Path | str, snapshot: dict[str, Any]) -> None:
    project_path = Path(project_path)
    well = session.get(WellModel, snapshot['well']['id'])
    if well is not None:
        session.delete(well)
        session.flush()

    for relative_path in snapshot['files']:
        file_path = project_path / relative_path
        if file_path.exists():
            file_path.unlink()


class UpdateFormationDepth(Command):
    def __init__(
        self,
        top_id: int,
        old_depth: float,
        new_depth: float,
        project_path: Path | str | None = None,
    ) -> None:
        self.top_id = top_id
        self.old_depth = old_depth
        self.new_depth = new_depth
        self.project_path = Path(project_path) if project_path else None

    @property
    def description(self) -> str:
        return f'Update formation top {self.top_id} depth'

    def _set_depth(self, session: Session, depth_md: float) -> None:
        from .deviation_transform import compute_tvd_tvdss
        top = session.get(FormationTopModel, self.top_id)
        if top is None:
            raise ValueError(f'Formation top not found: {self.top_id}')
        top.depth_md = depth_md
        if self.project_path is not None and top.well is not None:
            tvd, tvdss = compute_tvd_tvdss(self.project_path, top.well, depth_md)
            top.depth_tvd = tvd
            top.depth_tvdss = tvdss

    def apply(self, session: Session) -> None:
        self._set_depth(session, self.new_depth)

    def revert(self, session: Session) -> None:
        self._set_depth(session, self.old_depth)


class CreateFormation(Command):
    def __init__(self, snapshot: dict[str, Any]) -> None:
        self._snapshot = snapshot

    @property
    def description(self) -> str:
        return f"Add formation {self._snapshot['name']!r}"

    def apply(self, session: Session) -> None:
        formation_id = self._snapshot['id']
        if session.get(FormationTopModel, formation_id) is not None:
            return
        session.add(FormationTopModel(**self._snapshot))

    def revert(self, session: Session) -> None:
        formation = session.get(FormationTopModel, self._snapshot['id'])
        if formation is None:
            return
        session.delete(formation)


class UpdateFormation(Command):
    def __init__(self, formation_id: int, old_values: dict[str, Any], new_values: dict[str, Any]) -> None:
        self.formation_id = formation_id
        self.old_values = old_values
        self.new_values = new_values

    @property
    def description(self) -> str:
        return f'Update formation {self.formation_id}'

    def apply(self, session: Session) -> None:
        self._apply_values(session, self.new_values)

    def revert(self, session: Session) -> None:
        self._apply_values(session, self.old_values)

    def _apply_values(self, session: Session, values: dict[str, Any]) -> None:
        formation = session.get(FormationTopModel, self.formation_id)
        if formation is None:
            raise ValueError(f'Formation top not found: {self.formation_id}')
        for key, value in values.items():
            setattr(formation, key, value)


class UpdateFormationStratLink(Command):
    def __init__(self, formation_id: int, chart_id: int, old_strat_unit_id: int | None, new_strat_unit_id: int | None) -> None:
        self.formation_id = formation_id
        self.chart_id = chart_id
        self.old_strat_unit_id = old_strat_unit_id
        self.new_strat_unit_id = new_strat_unit_id

    @property
    def description(self) -> str:
        return f'Update strat link for formation {self.formation_id}'

    def apply(self, session: Session) -> None:
        self._set_link(session, self.new_strat_unit_id)

    def revert(self, session: Session) -> None:
        self._set_link(session, self.old_strat_unit_id)

    def _set_link(self, session: Session, strat_unit_id: int | None) -> None:
        link = session.scalar(
            select(FormationStratLink).where(
                FormationStratLink.formation_id == self.formation_id,
                FormationStratLink.chart_id == self.chart_id,
            )
        )
        if strat_unit_id is None:
            if link is not None:
                session.delete(link)
            return
        if link is None:
            session.add(
                FormationStratLink(
                    formation_id=self.formation_id,
                    chart_id=self.chart_id,
                    strat_unit_id=strat_unit_id,
                )
            )
            return
        link.strat_unit_id = strat_unit_id


class RemoveFormation(Command):
    def __init__(self, snapshot: dict[str, Any]) -> None:
        self._snapshot = snapshot

    @property
    def description(self) -> str:
        return f"Delete formation {self._snapshot['name']!r}"

    def apply(self, session: Session) -> None:
        formation = session.get(FormationTopModel, self._snapshot['id'])
        if formation is None:
            return
        session.delete(formation)

    def revert(self, session: Session) -> None:
        if session.get(FormationTopModel, self._snapshot['id']) is not None:
            return
        session.add(FormationTopModel(**self._snapshot))


class UpdateWell(Command):
    def __init__(self, well_id: str, old_values: dict[str, Any], new_values: dict[str, Any]) -> None:
        self.well_id = well_id
        self.old_values = old_values
        self.new_values = new_values

    @property
    def description(self) -> str:
        return f'Update well {self.well_id}'

    def apply(self, session: Session) -> None:
        self._apply_values(session, self.new_values)

    def revert(self, session: Session) -> None:
        self._apply_values(session, self.old_values)

    def _apply_values(self, session: Session, values: dict[str, Any]) -> None:
        well = session.get(WellModel, self.well_id)
        if well is None:
            raise ValueError(f'Well not found: {self.well_id}')
        for key, value in values.items():
            setattr(well, key, value)


class ActivateStratChart(Command):
    def __init__(self, chart_id: int, previous_active_chart_id: int | None) -> None:
        self.chart_id = chart_id
        self.previous_active_chart_id = previous_active_chart_id
        self._captured_changes: list[dict[str, Any]] | None = None

    @property
    def description(self) -> str:
        return f'Activate strat chart {self.chart_id}'

    def apply(self, session: Session) -> None:
        from .schema import StratChart

        chart = session.get(StratChart, self.chart_id)
        if chart is None:
            raise ValueError(f'Strat chart not found: {self.chart_id}')

        session.query(StratChart).update({StratChart.is_active: False})
        chart.is_active = True

        if self._captured_changes is None:
            formations = session.scalars(select(FormationTopModel)).all()
            before = {
                formation.id: {
                    'color': formation.color,
                    'age_top_ma': formation.age_top_ma,
                    'had_link': session.scalar(
                        select(FormationStratLink.id).where(
                            FormationStratLink.formation_id == formation.id,
                            FormationStratLink.chart_id == self.chart_id,
                        )
                    ) is not None,
                }
                for formation in formations
            }

            auto_link_all_formations_to_chart(session, chart)
            session.flush()

            self._captured_changes = []
            for formation in formations:
                after_has_link = session.scalar(
                    select(FormationStratLink.id).where(
                        FormationStratLink.formation_id == formation.id,
                        FormationStratLink.chart_id == self.chart_id,
                    )
                ) is not None
                previous = before[formation.id]
                link_created = after_has_link and not previous['had_link']
                if (
                    link_created
                    or formation.color != previous['color']
                    or formation.age_top_ma != previous['age_top_ma']
                ):
                    self._captured_changes.append({
                        'formation_id': formation.id,
                        'old_color': previous['color'],
                        'old_age_top_ma': previous['age_top_ma'],
                        'link_created': link_created,
                    })
            return

        auto_link_all_formations_to_chart(session, chart)

    def revert(self, session: Session) -> None:
        from .schema import StratChart

        session.query(StratChart).update({StratChart.is_active: False})
        if self.previous_active_chart_id is not None:
            previous_chart = session.get(StratChart, self.previous_active_chart_id)
            if previous_chart is not None:
                previous_chart.is_active = True

        for change in self._captured_changes or []:
            formation = session.get(FormationTopModel, change['formation_id'])
            if formation is None:
                continue
            if change['link_created']:
                link = session.scalar(
                    select(FormationStratLink).where(
                        FormationStratLink.formation_id == formation.id,
                        FormationStratLink.chart_id == self.chart_id,
                    )
                )
                if link is not None:
                    session.delete(link)
            formation.color = change['old_color']
            formation.age_top_ma = change['old_age_top_ma']


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
    """Undo command for a well import.

    Snapshot is captured at import time (before the transaction commits) via
    ``ImportWell.capture()``, so ``apply()`` is a pure idempotent restore and
    carries no hidden first-call side-effects.
    """

    def __init__(self, project_path: Path | str, snapshot: dict[str, Any]) -> None:
        self.project_path = Path(project_path)
        self._snapshot = snapshot

    @property
    def description(self) -> str:
        return f'Import well {self._snapshot["well"]["id"]}'

    @classmethod
    def capture(cls, session: Session, project_path: Path | str, well_id: str) -> 'ImportWell':
        """Call inside the import transaction after flush, before commit."""
        return cls(project_path, _capture_well_snapshot(session, project_path, well_id))

    def apply(self, session: Session) -> None:
        """Restore the well from the pre-captured snapshot.  No-op if already present (first push)."""
        _restore_well_snapshot(session, self.project_path, self._snapshot)

    def revert(self, session: Session) -> None:
        _delete_well_snapshot(session, self.project_path, self._snapshot)


class RemoveWell(Command):
    def __init__(self, project_path: Path | str, snapshot: dict[str, Any]) -> None:
        self.project_path = Path(project_path)
        self._snapshot = snapshot

    @property
    def description(self) -> str:
        return f"Delete well {self._snapshot['well']['name']!r}"

    @classmethod
    def capture(cls, session: Session, project_path: Path | str, well_id: str) -> 'RemoveWell':
        return cls(project_path, _capture_well_snapshot(session, project_path, well_id))

    def apply(self, session: Session) -> None:
        _delete_well_snapshot(session, self.project_path, self._snapshot)

    def revert(self, session: Session) -> None:
        _restore_well_snapshot(session, self.project_path, self._snapshot)
