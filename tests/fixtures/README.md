# Fixture files

JSON fixtures are portable microphone-level traces used by tests, demos, and `bargekit smoke`.

Each fixture contains:

- `name` — stable fixture id
- `totalMs` / `frameMs` — timing metadata
- `samples[]` — numeric level frames from `0` to `1`
- optional `segments[]` / `metadata` for explanation

Samples must be ordered by strictly increasing, nonnegative timestamps, and
every level (including an optional `baseline`) must be between `0` and `1`.
Multi-sample fixtures require a positive `frameMs` (it is inferred from sample
spacing when omitted). `totalMs` must be nonnegative and must not precede the
final sample timestamp. The CLI rejects invalid files with the filename and
offending sample index so fixtures can be corrected before simulation.

These are synthetic traces, not recordings.
