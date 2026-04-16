from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class DepthReference(str, Enum):
    MD = "MD"
    TVD = "TVD"
    TVDSS = "TVDSS"


@dataclass(frozen=True)
class LogCurve:
    mnemonic: str
    unit: str
    depth_ref: DepthReference
    depths: list[float]
    values: list[float]
    null_value: float = -999.25

    def validate(self) -> None:
        if not self.mnemonic.strip():
            raise ValueError("mnemonic is required")
        if len(self.depths) != len(self.values):
            raise ValueError("depths and values must have same length")
        if len(self.depths) < 2:
            raise ValueError("curve must contain at least 2 samples")
        if any(next_depth <= depth for depth, next_depth in zip(self.depths, self.depths[1:])):
            raise ValueError("depths must be strictly increasing")
