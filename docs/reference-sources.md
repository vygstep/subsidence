# Reference Sources

This document defines the active knowledge sources that may be reused during implementation.

## `repos/`

`repos/` is the external scientific and algorithmic reference source.

Primary purposes:

- subsidence engine reference
- burial history logic
- decompaction and backstripping formulas
- scientific workflow patterns
- reference implementations for domain algorithms

Use `repos/` to answer:

- how the scientific engine should work
- how formulas and numerical workflows should be structured
- which algorithmic patterns are worth adopting

## `subsidence_archive/`

`subsidence_archive/` is the internal implementation reference source.

Primary purposes:

- data engine reference
- loaders and parsers reuse
- API and package layout ideas
- reusable local code fragments
- previous project documentation and implementation context

Use `subsidence_archive/` to answer:

- what has already been built locally
- which implementation parts can be copied or adapted
- which internal patterns are still useful in the new version

## Reuse Rule

Reuse from both sources is allowed.

- prefer `repos/` for scientific logic and formulas
- prefer `subsidence_archive/` for local implementation patterns and data-layer reuse

All reused material should be adapted to the active Compass and Phase 1 scope.
