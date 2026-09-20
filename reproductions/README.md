# Reproductions

One script for each of the confirmed critical findings. Each performs the unauthorised action
using an account scoped to a different centre from the record it targets, then reports whether the
permission boundary held.

| Script | Defect |
|---|---|
| `s1-batch-close.mjs` | An account closes another centre's batch. |
| `s1-invoice-raise.mjs` | An account raises another centre's invoice. |

The third critical finding, where an account read another centre's counselling records, was found
in Phase 1 against the live platform and is documented in the findings register. It has a different
immediate cause from these two, described there, though both trace back to the same weakness in how
authorisation is applied.

## Use

These scripts have **no dependencies** — Node alone runs them, so they work against a remediated
build with nothing installed. Record ids come from the fixtures manifest the seeder writes
(`suite/fixtures.json`).

```
cd ../suite && npm run seed          # if not already seeded
cd ../reproductions

# ids from suite/fixtures.json: north_batch_open, north_invoice, north_batch
S1_BATCH_ID=<north_batch_open> node s1-batch-close.mjs
S1_INVOICE_ID=<north_invoice> S1_BATCH_ID=<north_batch> node s1-invoice-raise.mjs
```

Configuration defaults to the isolated stack; override with `TEST_BASE_URL`, `TEST_SITE` and
`TEST_PERSONA_PWD` to point at another environment.

Exit code `1` means the boundary was breached (defect present); `0` means it held (fixed). Run the
same script after applying a fix to confirm closure. Each run needs a **fresh target** — a batch
already closed, or an invoice already raised, cannot demonstrate the transition, so re-seed between
runs.
