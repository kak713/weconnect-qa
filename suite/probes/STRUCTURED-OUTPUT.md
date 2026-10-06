# Structured finding output

The client asked that the automation emit steps-to-reproduce with each failure, so a run produces
fix-ready rows directly instead of findings someone transcribes by hand.

`_finding-reporter.mjs` is that layer. A probe builds a reporter, records one finding per failing
case, and calls `finish()`. Each run writes `suite/findings-output.json`, keyed by probe name, with
rows in the exact shape the bug tracker uses:

    id, title, severity, persona, steps, expected, actual, area, source

## Worked example

`gate-probe.mjs` is wired through it. When run against the isolated stack it emits one row per
endpoint with no authorization gate — title, the persona it was tested as, numbered steps,
expected vs actual, and a timestamped source. Those rows map straight onto the tracker columns, so
closing the loop is an import rather than a retype.

## Status

- **Done:** the reporter, and `gate-probe` wired through it end to end (36 rows from the recorded
  authorization run).
- **Next (the Phase 3 automation deliverable):** wire the same reporter into the remaining probes —
  rbac-write, state-boundary, validation, lifecycle, idempotency, mass-assignment, boundary,
  state-transition — and add a small step that merges `findings-output.json` into the tracker
  workbook. The pattern is proven; rolling it across the suite is mechanical.
