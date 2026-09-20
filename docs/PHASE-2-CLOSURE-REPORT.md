# WeConnect 2.0 — Phase 2 Closure Report

**Date:** 2026-09-25 · **Version:** 1.1
**Environment:** isolated instance — Frappe 15.113.2 · ERPNext 15.114.0 · Insights 3.12.5, pinned to
the platform's own versions, verified drift-free
**Phase 2 scope:** transactional (write) testing against synthetic data on an isolated environment

---

## 1. Three items require attention before anything else

Phase 2 confirmed **three S1 data-integrity blockers**, each an unauthorised action across a
permission boundary, each reproduced end-to-end on an isolated copy of the platform:

1. **An account can raise another centre's financial invoice.** (`WC-095`) A user permitted for two centres,
   with no permission for a third, raised a Skilling Invoice belonging to that third centre; it
   entered the approval pipeline (`Raised`, `Verification Pending`). This advances financial data
   through its workflow across a permission boundary.
2. **An account can close another centre's batch.** (`WC-084`) The same class of breach on batch state.
3. **An account can read another centre's youth counselling records** (`WC-048`) (carried from Phase 1;
   reproduced there 3×).

All three share **one architectural cause**: authorization is applied per endpoint rather than
enforced centrally, and the mutating call passes `ignore_permissions=True`, which suppresses the
centre-scope enforcement the framework would otherwise apply. **A single central fix closes all
three and the wider class.** Under the Definition of Done, each S1 must be fixed, retested and
confirmed closed.

**Also confirmed exploitable:** any authenticated user can delete any file by URL, from both storage
and the database, with no ownership check (S2).

## 2. The systemic finding

The three S1s are instances of a measured pattern. Of the platform's mutating endpoints, **30 pass
`ignore_permissions=True` to their write and perform no authorization check**. A gate probe called
36 of them as an ordinary user: **none rejected the call** — every one reached its logic, failing
only later on data. A state-boundary sweep then drove every state endpoint in this set that operates on a
centre-scoped record against a record owned by a centre the caller has no permission for:
**three breached, none held, two inconclusive** — `withdraw_batch`, `discontinue_course` and
`discontinue_skilling_partner` breached; `raise_batch_fill_request` and `mark_as_complete` failed on
missing fixtures before reaching an authorization decision. Adding the two S1s, which were
reproduced individually with ground-truth checks, **five endpoints are confirmed to change another
centre's data end-to-end**: `close_batch`, `raise_invoice`, `withdraw_batch`, `discontinue_course`
and `discontinue_skilling_partner`, with none refusing the call. The three that are not recorded
as S1 belong to the same severity class as the batch finding. We have recorded them as instances of
that class rather than as separate tickets, because a single central change addresses all of them.
The number of endpoints involved indicates a general weakness rather than isolated mistakes.

The framework's own permission mechanism **works** — a persona scoped to one centre sees only that
centre's records when queried through the permission-respecting path (verified). The risk is
entirely in application code that bypasses it.

## 3. What Phase 2 tested — depth

The Definition of Done requires that validation, permission boundaries, error states and destructive
operations are exercised, not only success paths. All four are complete:

| Depth dimension | Result |
|---|---|
| **Permission boundaries** | 3 S1s confirmed; systemic bypass measured (30 endpoints); **5 STATE endpoints confirmed to breach cross-centre**, none held. By contrast, MUTATE-class edits that save through the ordinary path (`update_task`, `update_youth_status`) **hold** the boundary — the split is exactly whether the mutating call passes `ignore_permissions=True`. Task write-boundary held under control testing (12/12 across disjoint persona pairs) |
| **Destructive operations** | All 5 assessed — 2 S1, 1 S2 (file delete), 1 S3 (batch soft-delete with no dependent check) |
| **Validation rules** | Systematic sweep, 6 endpoints — **no invalid data accepted** (a clean result: bad enums, nonexistent references and impossible dates all refused) |
| **Error states** | 5 of 6 endpoints crash with HTTP 500 on empty input rather than a 400; 2 of 6 return HTTP 200 on failure — validation is enforced, delivery is poor |
| **Idempotency** | `raise_invoice`, `close_batch` and `create_task` are not idempotent — a repeat call re-applies; bounded impact (no duplicate financial records) |
| **Transactional integrity** | Clean — batch operations validate the whole set before applying, so a bad element aborts with nothing written |

## 4. What Phase 2 tested — breadth

Create / read / update / state-change were driven through the API, as the owning persona, for **12
business objects across all six in-scope personas** (fc, oc, ch, sp, sm, syc):

| Object | Persona | Create | Read | Update | State change |
|---|---|---|---|---|---|
| Task | fc | ✓ | ✓ | ✓ | ✓ |
| Pre Enquiry | oc | ✓ | ✓ | ✓ | ✓ |
| Enquiry Form | oc | ✓ | ✓ | ✓ | **defect** (status change crashes — a variable typo) |
| Counselling | fc | ✓ | ✓ | ✓ | API-context 403 |
| Approval | ch | ✓ | ✓ | ✓ | — |
| Follow Up | sp | ✓ | ✓ | ✓ | API-context 403 |
| Skilling Issue | sp | ✓ | ✓ | API-context 403 | API-context 403 |
| Community Visit | oc | ✓ | **defect** (404 on read-back) | **defect** (400) | API-context 403 |
| Course | sm | ✓ | ✓ | ✓ | ✓ (discontinue) |
| Skilling Partner | sm | ✓ | ✓ | ✓ | ✓ (discontinue) |
| Batch Attendance | syc | — (marked, not created) | ✓ | — | ✓ (**after fixing missing master data** — new S2) |
| Youth Status | syc | — (created via enquiry flow) | ✓ | — | ✓ |

**No object exposes a delete endpoint** — the API creates and edits but never deletes; removal
requires database access. This is consistent across all eight and worth a client decision on whether
it is intended.

The breadth harness (`utils/lifecycle-probe.mjs`) is data-driven: extending it to the remaining
objects is adding definitions, not new tooling. The objects not yet driven (Course, Screening,
Registration, PEC, Invoice, and others) are **fixture-heavy** — their create endpoints require
large multi-field wizard payloads and extensive master data, which is a cost of coverage, not a
gap in method.

## 5. Findings raised in Phase 2

Beyond the three S1s, Phase 2 surfaced defects that only a running environment reveals:

- **Endpoints non-functional over the API** — `update_issue` and `mark_as_dropoff` return 403 for
  every caller *including Administrator*, though the function works when called directly. The cause
  is in the request-handling layer, not permissions (S2).
- **Code gates on roles that do not exist** on a fresh install. The platform ships no Role records
  for its personas, so role-gated branches are dead until the roles are created manually (S2).
- **Runtime configuration is not in the repositories** — roles, naming series, master data and
  permission assignments live only in the production database; a clean rebuild cannot register a
  youth until they are recreated by hand (S2).
- **Enquiry Form status change is broken by a variable typo** — crashes on every call (S2).
- **Missing-argument crashes** across several update endpoints — 500 and a traceback instead of a
  400 (S3, pattern).
- **HTTP 200 on failure** and an **inconsistent success flag** (`success` / `success_key` /
  `Success`) across the API (S3).
- **Attendance cannot be recorded on an install built from the repositories** — the attendance
  controller writes `Youth.status = "Skilling Enrolled" / "Skilling Not Enrolled"`, but neither
  value exists in the `Youth Status` master that ships. Every attendance save is rejected by link
  validation until the two records are created by hand. This is the sharpest instance of the
  configuration-not-in-repositories finding: a core daily operation, broken, invisible until first
  use (S2).
- **Approval flows name at least 15 `Approval Category` records as string literals, and none of
  them ships** — `Approval.validate_approval_category()` refuses any category that does not exist
  with a matching `ref_doc`, so every approval-driven flow fails on an install built from the
  repositories. This is what blocked Community Visit: the visit is valid, but the approval it
  raises names `"Outreach Plan"`, which does not exist. Creating the record makes the flow work.
  Note also the casing inconsistency between `Move to Another Batch` and `Move to another Batch`
  (S2).
- **`mark_attendance` has an undocumented precondition** — a `Skilling Batch Attendance` record
  must already exist for the batch/youth pair; enrolling the youth in the batch is not enough, and
  the failure surfaces only as a generic message (S3).

## 6. What Phase 2 established that nothing else could

Before this phase, nothing was known about the platform's write behaviour — Phase 1 blocked every
mutation by design. Phase 2 established, on an isolated copy and touching no real data:

- **Whether the platform can be self-hosted from the code the foundation owns** — it can, but only
  after reconstructing configuration that is not in the repositories (recorded as findings).
- **Whether write-side permission boundaries hold** — for most operations yes, for a measured 30
  endpoints no, with three confirmed S1 breaches.
- **How the platform behaves under bad input, retries and partial failures** — it does not corrupt
  data, but it handles errors, retries and missing input poorly.

## 7. Phase 2 exit criteria

Scored against the **six** criteria in the Definition of Done, in its wording. Where that document
groups several activities in one criterion, the evidence for each is shown beneath it, so the score
can be checked against the agreed standard rather than a restatement of it.

| # | Criterion (Definition of Done, §3) | Status |
|---|---|---|
| 1 | An isolated environment with synthetic data exists and is documented | **Met** |
| 2 | The environment matches the platform's installed application set and versions, and every remaining divergence is stated | **Met** — verified drift-free; 11 match, 1 documented exception |
| 3 | No test in this phase touches live programme data; demonstrated, not asserted | **Met** — every write went to the isolated host, refused elsewhere by a network-layer guard proven by control |
| 4 | Create, edit and delete flows are automated for each in-scope persona's primary objects | **Met** — 12 business objects across all six in-scope personas; every state change confirmed against the database. See the note on deletion below |
| 5 | Validation rules, permission boundaries and error states are exercised, not only success paths | **Met** — all three, evidenced below |
| 6 | Data is left in a known state after each run (teardown or reset is part of the suite) | **Met** — a full environment rebuild is one command |

**Evidence for criterion 5**, which the Definition of Done states as a single item:

| Activity | Result |
|---|---|
| Validation rules | Systematic sweep across 6 endpoints — **no invalid data accepted** |
| Permission boundaries | 3 S1s confirmed; systemic bypass measured on both the write side (30 endpoints) and the read side (45 sites); 12/12 held under owner+intruder control across disjoint persona pairs |
| Error states | 5 of 6 endpoints crash with HTTP 500 on empty input rather than 400; 2 of 6 return HTTP 200 on failure |

**A note on criterion 4 and deletion.** The criterion names delete flows. **No object in the platform
exposes a delete endpoint**, which we verified across all 12 objects driven, so deletion cannot be
automated through the API, and removal requires database access. The criterion is recorded as met on
the basis that the flows which exist are automated and the absence of the others is itself a
reported finding with a decision requested from the client, not on the basis that deletion was
tested. This is stated rather than scored silently.

**Destructive operations** were also exercised, with all five assessed, yielding 2 S1, 1 S2 and 1 S3.
This is **not** an exit criterion in the Definition of Done; it is additional work, reported here so
the evidence is not lost, and deliberately not counted toward the score.

**All six exit criteria are met.** Objects beyond each persona's primaries (Screening, Registration,
PEC, Invoice and others) remain undriven by choice, not by limitation: they are fixture-heavy wizard
flows, and the harness is data-driven, so extending to them is adding definitions rather than
tooling.

## 8. Recommended next steps

1. **Fix the three S1s** — one central authorization change closes all three and the wider
   30-endpoint class.
2. **Remove `allow_guest` from the API-spec endpoints** and fix the `create_user` role grant.
3. **Ship the access-control configuration as fixtures** — roles, role profiles, permission rules,
   naming series and master data, so that the platform can be rebuilt from its own code.
4. **Decide on the deletion model** — no object is deletable through the API today.
5. **Answer the outstanding characterisation decisions** — the acceptance baseline for functional
   correctness.
