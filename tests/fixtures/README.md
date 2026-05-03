# Fixture files

JSON fixtures are portable microphone-level traces used by tests, demos, and `bargekit smoke`.

Each fixture contains:

- `name` — stable fixture id
- `totalMs` / `frameMs` — timing metadata
- `samples[]` — numeric level frames from `0` to `1`
- optional `segments[]` / `metadata` for explanation

These are synthetic traces, not recordings.
