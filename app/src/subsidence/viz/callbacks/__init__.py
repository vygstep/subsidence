"""Callback registration."""
from __future__ import annotations

import dash

from .burial import register_burial_callbacks
from .sync import register_sync_callbacks
from .ui_state import register_ui_state_callbacks
from .well_log import register_well_log_callbacks


def register_all_callbacks(app: dash.Dash) -> None:
    register_burial_callbacks(app)
    register_well_log_callbacks(app)
    register_sync_callbacks(app)
    register_ui_state_callbacks(app)
