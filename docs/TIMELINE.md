# WeConnect 2.0 QA — Delivery Timeline

**Version:** 1.4 · **Date:** 2026-09-25
**Basis:** measured throughput from work completed, not estimated effort

---

## Where things stand

**Phases 1 and 2 are complete.** 119 findings recorded, each with an identifier, a severity and a
priority. Three critical breaches of the centre permission boundary were reproduced end to end and
checked against the database.

**Phase 3 is 3.5–4.5 QA working days.** That is the only QA work left.

**The finish date is not determined by QA throughput.** It depends on two things outside our control:

1. **Your response time.** Three items below need a decision. Each week one waits adds a week.
2. **Whether "complete" means *found* or *found, fixed and retested*.** If completion means defects
   found, the estimate above holds. If it includes remediation, your development team's fix cadence
   sets the date — our retest cycle is hours per round, theirs is not. This is the largest variable
   in the schedule, and it is why it appears as a question in the Definition of Done.

## What we need from you

| Item | What it blocks | Your effort |
|---|---|---|
| **Characterisation sign-off** — Part 1 of that document: confirm seven answers, acknowledge six, answer two | Any functional-correctness assertion, and therefore most of Phase 3 | One review, about ten minutes |
| **Definition of Done acceptance** | An agreed meaning of "complete" | One review |
| **BrowserStack capacity** — see the BrowserStack Recommendation | Phase 3 scope and cost | One decision |

Two items previously on this list are resolved. Test data provision fell away when the isolated
environment succeeded. Whether the invoice screen's page-load POST commits a record was settled by
testing: it does, and it is recorded as WC-038.

## Completed

| Work | Evidence |
|---|---|
| Platform characterisation — 7 apps, 8 services, 298 routes mapped | Route inventories generated from source |
| Test framework — authentication, read-only enforcement, diagnostics | Zero writes to your platform across every run |
| Reachability across every in-scope route | 235 / 235 static, 17 / 17 dynamic |
| Access control — RBAC read-leakage and authentication guard | 318 probes across 71 backend methods, 6 personas |
| Asset and link integrity | All 235 routes, ~2,200 asset requests, zero failures |
| Accessibility baseline — WCAG 2.1 AA | axe-core across all 235 routes |
| Isolated environment, version-matched to yours | Frappe 15.113.2 · ERPNext 15.114.0 · Insights 3.12.5 |
| Synthetic seed data across the business objects | 399 records, 113 doctypes, no real programme data |
| Transactional testing — create, edit, delete, state change | 12 business objects across all six personas |
| Validation, permission, idempotency and error-state coverage | Probe suite in `suite/probes/` |
| Security coverage against the OWASP API Security Top 10 | All ten categories examined |
| Stability verification | Three consecutive executions; every defect reproduces in all three |
| **Phases 1 and 2 complete** | All exit criteria met in both closure reports |

## Remaining — Phase 3

| # | Work | QA time | Depends on |
|---|---|---|---|
| 1 | BrowserStack integration proof | 0.5 day | — |
| 2 | Cross-browser matrix execution | 1–2 days | **You:** BrowserStack plan decision |
| 3 | CI integration | 1 day | — |
| 4 | Regression closure against a remediated build | 0.5 day per round | **You:** fixes existing |
| 5 | Final closure report and handover | 1 day | All above |

**Cross-browser execution and CI can begin now.** They run the existing suites, which assert
observed symptoms rather than correctness, so neither depends on the characterisation sign-off.
Functional-correctness testing and regression closure do depend on it.

## Recommended sequencing

**Start the four quick wins now, independently of any phase boundary.** WC-088 is a one-word typo
at two sites. WC-068 removes `allow_guest` from three endpoints. WC-023 is a configuration change.
WC-121 is one line of CORS configuration. None needs a scheduling conversation.

**The three S1s should not wait either.** Under the Definition of Done an S1 must be fixed,
retested and confirmed closed; it cannot be accepted or deferred.

**Run the characterisation sign-off in parallel with the BrowserStack decision**, not after it.
Nothing links them, and sequencing them together removes a week of waiting from the critical path.
