# WeConnect 2.0 — QA Automation

The automated test suite and the findings from the QA engagement on WeConnect 2.0.

## Start here

1. **`docs/engagement-report.pdf`** — the summary. The first block tells you what we found and the
   four things worth fixing this week.
2. **`docs/CHARACTERISATION.md`, Part 1** — the one thing we need from you. About ten minutes:
   confirm seven answers we worked out ourselves, acknowledge six, answer two.
3. **`verify/`** — re-check findings against your own environment once you start fixing.
   `node verify/run.mjs`, nothing to install, read-only by default. It covers 23 findings
   mechanically, including 17 of the 17 P1 items.
4. **`tracker/WeConnect-QA-Bug-Tracker.xlsx`** — the 79 defects in the Bugs-sheet format you
   asked for, with a Daily Report tab. CSVs alongside it for Google Sheets.
5. **`docs/PERMISSION-MODEL-PROPOSAL.md`** — a draft of the permission model the platform is
   missing. It gates all three critical findings, so it is the longest pole in any remediation.

## Contents

| Directory | Purpose |
|---|---|
| `environment/` | Stand up an isolated copy of the platform for transactional testing. |
| `suite/` | The automated test suite: fixtures, probes, and the write-safety guard. |
| `reproductions/` | Standalone scripts to reproduce and re-verify each S1 defect. |
| `findings/` | The findings register. Every defect, with evidence, a severity and a suggested fix. |
| `evidence/` | Machine-readable outputs backing the findings. |
| `tracker/` | The defect tracker in spreadsheet form: Bug Title, Steps to Reproduce, Expected, Actual, Attachment, plus daily progress. |
| `verify/` | Re-checks findings against your environment and reports which are fixed. |
| `docs/` | The engagement report and the rest of the written record, including the characterisation document we need signed. |

## Scope

Two phases are complete.

- **Phase 1** covered read-only testing across six persona applications, looking at reachability,
  access control, accessibility, asset integrity and the API contract. It swept 235 static routes
  and 17 dynamic routes, and produced 49 findings.
- **Phase 2** covered transactional testing against synthetic data on an isolated copy of the
  platform. It examined write-side permission boundaries, destructive operations, validation, error
  handling, idempotency and transactional integrity. Create, read, update and state changes were
  driven for 12 business objects across all six in-scope personas, and three critical defects were
  confirmed end to end, each checked against the database.

Testing was then mapped against the OWASP API Security Top 10 and the standard functional
test-design techniques, and the categories that had not been covered were tested: cross-origin
policy, mass assignment, boundary values and state transitions.

The register stands at 119 active findings: 3 S1, 37 S2, 31 S3, 8 S4, 40 informational.

Every finding carries a stable identifier (`WC-001` onwards) and a priority from P1 to P4.
`verify/` re-checks the mechanically checkable ones against your own environment and reports
which are fixed — `node verify/run.mjs`, nothing to install, read-only by default.

`docs/engagement-report.pdf` is the summary and the best place to start. The most useful thing you
can do in return is review `docs/CHARACTERISATION.md`. It marks 15 decisions, but we went back
through them and answered what we could ourselves: seven are settled and need only your
confirmation, six are narrowed to a smaller question, and **two genuinely need you**. Section 12
of that document sets out which is which.
Those answers decide what the automated tests are allowed to treat as correct behaviour.

## Running the suite

**Prerequisites:** Docker, Node 22, Python 3.11, and a **GitHub token with read access to the
eight WeConnect backend repositories**. The stack is built from those repositories, so `up.sh`
stops straight away if the token is not set.

```
export GITHUB_TOKEN=<token with read access to the backend repositories>

cd environment && ./up.sh          # clone frappe_docker (pinned), build the image, create the site
cd ../suite && npm install         # install probe dependencies
cp .env.example .env               # defaults are fine; see the note below
npm run seed                       # reference data, personas, and transactional records
npm test                           # run the full probe suite
```

A first run takes roughly 20 minutes, nearly all of it building the image.

**Configuration** lives in `suite/.env` (copy `suite/.env.example`). The defaults address the
isolated stack and need no change. Two optional entries, `LIVE_USER` and `LIVE_PWD`, are read-only
credentials for the live platform and are needed **only** by `npm run verify`, which compares the
isolated stack's application versions against the live ones. Leave them unset and skip that command
if you would rather not supply a credential.

**Nothing here writes to the live platform.** A guard at the network layer refuses any request
that would change data unless it is addressed to the isolated stack. The suite includes tests for
the guard itself, so its behaviour is checked on every run.

## Reproducing a defect

```
cd reproductions && node s1-invoice-raise.mjs
```

Each script sets up the record it needs, performs the unauthorised action as an account scoped to
a different centre, checks the result against the database and reports what happened. Running the
same script after a fix will confirm whether the boundary now holds.
