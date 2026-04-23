# Reference Sources

This document lists reusable knowledge sources for future implementation and maintenance.

---

## External Scientific References

Directory:

- `repos/`

Use for:

- burial history algorithms
- decompaction and backstripping formulas
- subsidence and thermal modeling references
- scientific workflow patterns

Primary rule:

- Prefer `repos/` when checking equations, numerical workflow, or scientific assumptions.

---

## Internal Legacy Reference

Directory:

- `subsidence_archive/`

Use for:

- previous local implementation patterns
- old loaders/parsers
- data-layer ideas
- legacy UI behavior that may still describe desired product behavior

Primary rule:

- Prefer `subsidence_archive/` when checking what was already built locally or when recovering useful implementation details.

---

## Implemented Contract Archive

Directory:

- `docs/contracts/implemented/`

Use for:

- understanding why existing code was implemented
- reviewing old phase decisions
- tracing feature origin and acceptance criteria

Primary rule:

- Treat implemented contracts as historical context, not active planning.

---

## Active Contracts

Directory:

- `docs/contracts/`

Use for:

- current implementation plans
- future work that still needs execution
- contract-linked todo items

Primary rule:

- Active development work should be represented by an active contract and a linked `todo.md` item.
