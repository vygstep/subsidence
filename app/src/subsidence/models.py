from dataclasses import dataclass, field


@dataclass(frozen=True)
class SourcePoint:
    source: str
    time: float
    value: float
    meta: dict[str, str] = field(default_factory=dict)
