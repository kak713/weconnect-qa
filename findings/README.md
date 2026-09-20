# Findings register

113 active findings. Every S1 and S2 carries either a reproduction or confirmation from the source
code. Items we are unsure about are marked as such. Findings we withdrew are struck through rather
than deleted, so the record of what we thought and why remains readable.

| Severity | Count | Meaning |
|---|---|---|
| S1 — Blocker | 3 | Data loss, unauthorised data exposure, or a broken core journey. Must be fixed. |
| S2 — Critical | 34 | A security control is missing or ineffective, or key business logic fails. |
| S3 — Major | 29 | A significant function behaves incorrectly, but a workaround exists or the impact is bounded. |
| S4 — Minor | 8 | Presentation, wording, or hygiene. |
| Info | 39 | Characterisation, context, and clean results. |

These levels follow the conventional industry scale (ISTQB). Until 2026-09-22 this register used
Blocker / Major / Minor / Cosmetic for S1–S4, which skipped "Critical" and read one level less
severe than intended. Only the names changed; no finding was re-triaged.

## The three critical findings

In each case an account performed an action on a record belonging to a centre it has no permission
for. They share an underlying cause, described in the next section, and a single change to how
authorisation is enforced would address all three.

1. **Raising another centre's invoice.** `youth_skilling.api.invoice.raise_invoice`. An account
   with no permission for a centre raised that centre's invoice into the approval pipeline. The
   database confirms the invoice status as `Raised`. Reproduce with
   `reproductions/s1-invoice-raise.mjs`.

2. **Closing another centre's batch.** `youth_skilling.api.batch_management.close_batch`. The same
   account closed a batch belonging to that centre. The database confirms `batch_status` as
   `Closed`. Reproduce with `reproductions/s1-batch-close.mjs`.

3. **Reading another centre's counselling records.**
   `facilitator_and_counsellor.api.counselling.list.get_counselling_list`. An account received ten
   of ten counselling records from centres it has no permission for, each naming a youth.
   Found in Phase 1 and reproduced three times.

   The cause of this one differs from the other two. The handler's centre filter is present and
   correct; it is never reached, because the line above it returns early for any caller holding the
   `System Manager` role. We confirmed against the live platform, read-only, that the account in
   question holds that role: it can read `/api/resource/User` and `/api/resource/Role Profile`,
   which only a System Manager can do.

## The underlying cause

The framework's own permission mechanism is working correctly. A write that goes through the
ordinary `.save()` path is refused when it targets another centre's record, and that holds even for
accounts carrying `System Manager`. In every case we found, the application code goes around that
mechanism rather than through it, in one of two ways.

**On writes.** Thirty endpoints that change data pass `ignore_permissions=True` to the call that
writes, which switches the framework's check off, and none of them performs a check of its own
beforehand (`evidence/truly-bypassed-endpoints.json`). We called 36 of them as an ordinary user and
none refused the call (`evidence/gate-probe-results.json`). Driving the state-changing ones against
another centre's records, three made the change and none refused; two could not be judged because
the test data did not support them (`evidence/state-boundary-results.json`). Counting the two
critical findings above, five endpoints are confirmed to change another centre's data:
`close_batch`, `raise_invoice`, `withdraw_batch`, `discontinue_course` and
`discontinue_skilling_partner`. Endpoints that save through the ordinary path hold the boundary,
and the difference between the two groups is whether `ignore_permissions=True` is passed to the
write.

**On reads.** Filtering by centre, region or partner is applied only when the caller does not hold
`System Manager`. We counted 45 places where this happens, across 26 files in seven of the eight
applications. The filters themselves are present and correct; they sit inside a condition that
excludes that role. This affects every account, because the permission model gives staff no working
alternative: of the 293 doctypes the platform installs, 178 grant permissions to `System Manager`
and to no other role, and the remaining 115 grant none at all.

## Selected major findings

- The complete API specification is served without authentication.
- An unauthenticated endpoint attempts to grant a top-privilege account.
- Any authenticated user can delete any file by URL, with no ownership check.
- Two update endpoints do not work over the API for any caller, including the superuser.
- The access-control configuration and the master data the code depends on are absent from the
  repositories, so a rebuild from the code the foundation owns cannot run the core flows.
- Server tracebacks are returned to callers with no valid credential.
- The authentication route-guard is disabled in the `ch` and `fc` applications. We checked all
  eight; the other six behave correctly.
- Each environment's frontend is configured to call the wrong API. `.env.uat` points at the dev
  API and `.env.prod` points at the uat API, in all nine repositories, and no configuration names a
  production API at all.
- A ninth role profile, `Placement Youth Coordinator`, is routed on login to `/pyc/`, for which no
  application exists in any repository.
- Attendance cannot be recorded on an install built from the repositories. The attendance
  controller writes two `Youth.status` values that no application ships, so every attendance save
  is rejected until those records are created by hand.
- Approval flows name at least 15 `Approval Category` records as string literals, and none of them
  ships either.

## The full register

`findings-log.md` in this directory holds every finding in full, with its evidence, reproduction,
severity reasoning and suggested fix, in the order we found them. This README summarises it and is
not a replacement for it.

The register also records the corrections we made to our own work. Where we had a finding's cause
wrong, the entry says so and explains what changed, rather than being quietly edited. Five entries
carry a correction of that kind.

## Evidence

The `evidence/` directory holds the machine-readable output behind these findings: the endpoint
authorisation audit, the results of the gate probe and the boundary sweep, the validation and
idempotency results, the measured data volumes, and the extracted doctype schemas.
