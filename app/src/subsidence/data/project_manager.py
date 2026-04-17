from __future__ import annotations

import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

try:
    from platformdirs import user_cache_dir
except ImportError:
    def user_cache_dir(app_name: str) -> str:
        return str(Path(tempfile.gettempdir()) / app_name)

from sqlalchemy import text
from sqlalchemy.orm import Session

from .engine import create_all_tables, create_engine_for_project, validate_project_db
from .schema import ProjectMeta, SCHEMA_VERSION, UserModel

if os.name == 'nt':
    import msvcrt
else:
    import fcntl

APP_NAME = 'SUBSIDENCE'
APP_VERSION = '0.1.0'
BUNDLE_SUFFIX = '.subsidence'
PROJECT_DB_NAME = 'project.db'
MANIFEST_NAME = 'manifest.json'
LOCK_NAME = '.subsidence.lock'
SESSION_ROOT = Path(user_cache_dir(APP_NAME)) / 'sessions'
BUNDLE_DIRS = ('curves', 'deviation', 'results', 'originals', 'checkpoints')


@dataclass(slots=True)
class ProjectOpenState:
    project_path: Path
    session_id: str
    session_dir: Path
    working_db_path: Path
    lock_path: Path
    lock_handle: Any
    engine: Any


class ProjectManager:
    def __init__(self) -> None:
        self._state: ProjectOpenState | None = None

    @property
    def is_open(self) -> bool:
        return self._state is not None

    @property
    def project_path(self) -> Path | None:
        return self._state.project_path if self._state else None

    @property
    def working_db_path(self) -> Path | None:
        return self._state.working_db_path if self._state else None

    def create_project(self, name: str, path: Path | str) -> Path:
        bundle_path = self._resolve_bundle_path(name, path)
        if bundle_path.exists():
            raise FileExistsError(f'Project already exists: {bundle_path}')

        bundle_path.mkdir(parents=True)
        for directory in BUNDLE_DIRS:
            (bundle_path / directory).mkdir()

        project_uuid = str(uuid4())
        db_path = bundle_path / PROJECT_DB_NAME
        engine = create_engine_for_project(db_path)
        try:
            create_all_tables(engine)
            with Session(engine) as session:
                session.add(
                    ProjectMeta(
                        id=1,
                        project_name=name,
                        app_version=APP_VERSION,
                        schema_version=SCHEMA_VERSION,
                        project_uuid=project_uuid,
                    )
                )
                session.add(
                    UserModel(
                        id=str(uuid4()),
                        display_name='Local User',
                        is_local_default=True,
                        server_account_id=None,
                    )
                )
                self._seed_dictionaries(session, bundle_path)
                session.commit()
            with engine.connect() as conn:
                conn.execute(text('PRAGMA wal_checkpoint(TRUNCATE)'))
        finally:
            engine.dispose()

        manifest = {
            'app': APP_NAME,
            'schema_version': SCHEMA_VERSION,
            'uuid': project_uuid,
            'project_name': name,
            'created': self._utc_now_iso(),
        }
        (bundle_path / MANIFEST_NAME).write_text(json.dumps(manifest, indent=2), encoding='utf-8')
        return bundle_path

    def open_project(self, path: Path | str) -> dict[str, Any]:
        if self._state is not None:
            raise RuntimeError('A project is already open. Close it before opening another one.')

        bundle_path = Path(path)
        manifest = self._load_manifest(bundle_path)
        canonical_db = bundle_path / PROJECT_DB_NAME
        validate_project_db(canonical_db)

        session_id = str(uuid4())
        session_dir = SESSION_ROOT / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        lock_path = bundle_path / LOCK_NAME
        lock_handle = self._acquire_lock(lock_path, session_id)

        working_db_path = session_dir / 'working.db'
        shutil.copy2(canonical_db, working_db_path)
        engine = create_engine_for_project(working_db_path)

        self._state = ProjectOpenState(
            project_path=bundle_path,
            session_id=session_id,
            session_dir=session_dir,
            working_db_path=working_db_path,
            lock_path=lock_path,
            lock_handle=lock_handle,
            engine=engine,
        )

        return {
            'project_name': manifest.get('project_name') or bundle_path.stem,
            'project_uuid': manifest['uuid'],
            'project_path': str(bundle_path),
            'working_db_path': str(working_db_path),
            'session_id': session_id,
            'recovery_available': False,
        }

    def close_project(self) -> None:
        if self._state is None:
            return

        state = self._state
        try:
            with state.engine.connect() as conn:
                conn.execute(text('PRAGMA wal_checkpoint(TRUNCATE)'))
                conn.execute(text('PRAGMA optimize'))
        finally:
            state.engine.dispose()
            self._release_lock(state.lock_handle)
            state.lock_handle.close()
            shutil.rmtree(state.session_dir, ignore_errors=True)
            self._state = None

    def _resolve_bundle_path(self, name: str, path: Path | str) -> Path:
        base = Path(path)
        bundle_name = name if name.endswith(BUNDLE_SUFFIX) else f'{name}{BUNDLE_SUFFIX}'
        return base / bundle_name

    def _load_manifest(self, bundle_path: Path) -> dict[str, Any]:
        manifest_path = bundle_path / MANIFEST_NAME
        if not manifest_path.exists():
            raise FileNotFoundError(f'Manifest file is missing: {manifest_path}')

        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        if manifest.get('app') != APP_NAME:
            raise ValueError(f'Unexpected manifest app: {manifest.get("app")}')
        if int(manifest.get('schema_version', 0)) > SCHEMA_VERSION:
            raise ValueError(
                f'Project schema version {manifest.get("schema_version")} is newer than supported {SCHEMA_VERSION}'
            )
        return manifest

    def _acquire_lock(self, lock_path: Path, session_id: str):
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        handle = lock_path.open('a+b')
        if lock_path.stat().st_size == 0:
            handle.write(b' ')
            handle.flush()
        handle.seek(0)

        try:
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            handle.close()
            raise RuntimeError(f'Project is locked by another session: {lock_path}') from error

        handle.seek(0)
        payload = json.dumps(
            {
                'pid': os.getpid(),
                'session_id': session_id,
                'locked_at': self._utc_now_iso(),
            },
            indent=2,
        ).encode('utf-8')
        handle.write(payload)
        handle.truncate()
        handle.flush()
        return handle

    def _release_lock(self, handle) -> None:
        handle.seek(0)
        try:
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass

    def _seed_dictionaries(self, session: Session, bundle_path: Path) -> None:
        try:
            from .dict_seeder import seed_dictionaries
        except ImportError:
            return
        seed_dictionaries(session, bundle_path)

    def _utc_now_iso(self) -> str:
        return datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat()
