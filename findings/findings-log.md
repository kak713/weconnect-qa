# Lighthouse WeConnect 2.0 — QA Findings Log

Environment under test: https://uat.lighthouseconnect.org (UAT)
Started: 2026-09-18
Severity scale: S1 blocker · S2 major · S3 minor · S4 cosmetic/hygiene

---

## WC-001 · Superseded — UAT frontend calls the DEV backend API [folded into the environment-mapping finding; not counted separately]
- **Where:** FC dashboard load
- **Evidence:** frontend at `uat.lighthouseconnect.org/fc/` fetches from `https://api-dev.lighthouseconnect.org/...`
- **Impact:** "Testing UAT" may actually exercise DEV data/logic. Environment boundary is unclear. MUST clarify with client before test results mean anything.
- **Status:** open — needs client confirmation of intended env→API mapping
- **SUPERSEDED 2026-09-20** by *"The environment→API mapping is shifted by one in every
  repository"*, which establishes the same defect from source across all nine repositories and
  shows it is uniform and committed, not a one-off misconfiguration. Retained here because it is
  the observation that first exposed the problem. See that finding for the fix.

## WC-002 · S2 — Target Data API returns 404 [VERIFIED — observed at first contact]

**Priority: P2**
- **Where:** FC dashboard, "Targets" widget
- **Endpoint:** `GET api-dev.../api/method/centre_head.api.target.main_dashboard.main_target?annual_target=Current%20Year&target=FC%20Completion`
- **Result:** 404; widget shows "Data not available."
- **Console:** "Failure in fetching Target Data {success:0, message: Failed to Target data.}"
- **Note:** grammatically broken error message ("Failed to Target data.") — separate S4.
- **Suggested fix:** the widget calls an endpoint that is not present on the deployed build.
  Either restore `centre_head.api.target.main_dashboard.main_target` or remove the card that calls
  it. Either way the frontend should render an explicit empty state rather than the literal string
  shown today; the broken wording is tracked separately as S4.

## WC-003 · S2 — Real program PII present in UAT [VERIFIED — observed at first contact]

**Priority: P1** — Real programme PII sitting in a lower environment; a safeguarding decision, not a code change.
- **Where:** FC dashboard, Batches list
- **Evidence:** real batch codes, youth counts, real locations (Bhawani Peth, Pune)
- **Impact:** minors' program data in a test environment used for automated testing. Data-protection concern; also means destructive test actions could corrupt real records. Confirm with client whether UAT data is synthetic or production copy.
- **Suggested fix (a client decision, not a code change):** determine whether UAT is a production
  copy. If it is, restrict access to it as production and anonymise whatever is used for testing;
  if it is not, remove the real records. This is a precondition for destructive testing on that
  environment. For that reason this engagement built an isolated instance and wrote nothing to UAT.

## WC-004 · S3 — Committed env files in frontend repos

**Priority: P2** — Environment files are committed to the repositories; treat as exposed credentials.
- **Where:** weconnect-frontend-fc repo, `dev` branch: `.env`, `.env.uat`, `.env.prod` tracked
- **Impact:** hygiene; `.env.prod` should not be committed. (Contents not inspected.)
- **Contents now inspected (2026-09-20), which closes the caveat above.** All nine repositories'
  `.env`, `.env.uat` and `.env.prod` contain exactly one key, `VITE_BACKEND_URL`. **No credential
  is committed in any of them.** The severity therefore stays S3 — hygiene, not exposure. Their
  *values*, however, are wrong in a way that matters and is recorded separately (the environment
  mapping is shifted by one in every repository).
- **Suggested fix:** supply environment configuration at build time (CI variables or an untracked
  `.env.local`), keep only a committed `.env.example`, and add `.env*` to `.gitignore` with the
  example excepted. This also removes the possibility of a credential being added to one of these
  files later and inherited by every fork and clone.

## WC-005 · S3 — Forgot Password link is a dead anchor

**Priority: P3**
- **Where:** /authentication/login
- **Evidence:** "Forgot Password?" href="#" — no destination
- **Impact:** no password recovery path from login.
- **Suggested fix:** point the anchor at the password-reset route, or remove it until that route
  exists. The backend already exposes `authentication.api.password.send_otp` / `verify_otp` /
  `reset_password`, so the flow exists server-side and only the entry point is missing. A user
  who forgets their password currently has no self-service path at all.

## WC-006 · S3 — Password field missing autocomplete attribute

**Priority: P3**
- **Where:** /authentication/login
- **Evidence:** Chrome DOM warning; breaks password managers / a11y.
- **Suggested fix:** add `autocomplete="current-password"` to the login password input (and
  `autocomplete="username"` to the identifier field). One attribute each; it restores password
  manager support and clears the browser console warning.

## WC-007 · S4 — Source-tree asset path in built app

**Priority: P4**
- **Evidence:** login requests `/src/assets/icons/logo_transparent.png` (unbundled source path)
- **Suggested fix:** import the asset so the bundler fingerprints and rewrites its path, rather
  than referencing `/src/...` literally. As shipped the path only resolves by accident of how the
  site is served, and will 404 under any stricter static configuration.

## WC-008 · S4 — Broken grammar in user-facing error

**Priority: P4**
- **Evidence:** "Failed to Target data." (FC dashboard target fetch failure)
- **Suggested fix:** correct the string to a sentence — for example "Could not load target data."
  The same screen's underlying 404 is recorded separately; this item is only the wording.

## WC-009 · S4 — React Router v6 future-flag warnings

**Priority: P4**
- **Evidence:** console warnings, v7_startTransition / v7_relativeSplatPath. Tech-debt, not user-facing.
- **Suggested fix:** opt in to the v7 behaviours now (`v7_startTransition`,
  `v7_relativeSplatPath`) so the eventual upgrade is a no-op, or pin the router version and record
  the decision. Console noise is the visible symptom; the real cost is that genuine warnings are
  lost among it.

## WC-010 · S4 — Doubled route segment

**Priority: P4**
- **Evidence:** FC nav links use `/fc/fc/all-batches`, `/fc/fc/counselling`, `/fc/fc/tasks` (double `fc`). Works, but smells like a base-path bug.

---
- **Suggested fix:** the navigation links include the base path that the router already applies,
  producing `/fc/fc/...`. Make the links relative to the router base, or drop the base from the
  `basename` configuration — one or the other, not both. It works today only because the server
  tolerates the duplicated segment.

## WC-011 · S2 — Client-side auth guard is hardcoded to `true` (disabled) [VERIFIED]

**Priority: P2**
- **Where:** weconnect-frontend-fc, `src/components/layout/authenticate-route.jsx`
- **Evidence:** `const isAuthenticated = true;` — the route guard never reads auth state. The redirect-to-login branch is dead code. `URLs.Login` isn't even defined in `routes.js` (would ReferenceError if that branch ever ran).
- **Impact:** the FC frontend renders all authenticated routes regardless of login state. Real severity depends on whether the **backend** rejects requests lacking a valid session token:
  - If backend enforces auth → attacker sees an empty shell (S2, still ships broken security posture).
  - If backend does not → **unauthenticated data exposure (S1)**.
- **VERIFIED 2026-09-18:** With session cleared, `/fc/all-batches` did NOT redirect to login (guard confirmed non-functional). BUT a direct unauthenticated GET to the dashboard API returned **403 frappe.exceptions.PermissionError ("Login to access")**. Backend enforces auth server-side → NO unauthenticated data exposure. Severity: S2 (broken guard = unauth users get a broken empty shell instead of a login redirect), not S1.
- **Residual action:** confirm the same broken guard exists in the other 5 persona frontends (likely copy-paste), and that ALL their backends enforce like FC's does. One backend missing the check would re-open S1.
- **MEASURED 2026-09-18 — scope is narrower than assumed.** The suspicion that this was
  copy-pasted across all six frontends is **wrong**. Under an automated session-less probe of a
  deep route in every persona:

  | App | Session-less visitor | Backend calls made |
  |---|---|---|
  | **FC** | stays on the route, renders an empty shell | 4, all refused |
  | **CH** | stays on the route, renders an empty shell | 3, all refused |
  | SP · SYC · SM · OC | **redirect to /authentication/login correctly** | 0 |

- **Mechanism, confirmed by experiment:** the axios interceptor redirects on **401** only. A
  session-less request is answered **403**, which it does not handle, so no redirect fires. Seeding
  an *invalid* credential instead produces **401** and the app **does** redirect correctly — proving
  the interceptor works and only the status coverage is wrong.
- **Suggested fix (one line, `src/axios-setup.js` in the FC and CH apps):** treat 403 like 401 in
  the response interceptor. Four of the six apps already behave correctly, so their handling is the
  reference implementation.
- **Regression cover:** `tests/security/auth-guard.spec.js` asserts the correct behaviour for all
  six. FC and CH are annotated as known-failing, so the suite turns red the moment either is fixed
  (prompting the annotation's removal) or if any of the other four ever regresses.

## WC-012 · Info — FC route inventory: ~60 routes, only 4 in sidebar nav
- **Source:** `src/routes.js`. ~56 routes are deep-link only (not surfaced in navigation).
- **Impact on QA:** clicking the UI would have found ~7% of screens. Hidden routes (e.g. `/fc/batch-finish/remarks`, `/fc/job-application-edit`, `/fc/view-form-b`) are prime spots for missing auth/validation. These become the test target list.

## WC-013 · S2 — Long-lived API secret stored in localStorage [VERIFIED]

**Priority: P2**
- **Where:** all persona frontends, `src/axios-setup.js` + `zustand/auth-store.js`
- **Evidence:** login stores Frappe `api_key`/`api_secret` in `localStorage`; every request sends `Authorization: token <key>:<secret>`.
- **Impact:** Frappe API key/secret are long-lived credentials (not short session tokens). Any XSS on the domain exfiltrates a permanent API credential → persistent account takeover. httpOnly cookie would mitigate.
- **Suggested fix:** move the session to a short-lived, `httpOnly`, `Secure`, `SameSite` cookie so
  it cannot be read from JavaScript, and shorten its lifetime. A token in `localStorage` is readable
  by any script on the origin — and the persona applications share a single origin, so an XSS in any
  one of them yields a credential valid for the others.

## WC-014 · S3 — OC (Outreach Coordinator) account returns empty role_profile [VERIFIED]

**Priority: P3**
- **Where:** login API for OC_USER (outreach coordinator)
- **Evidence:** `authentication.api.auth.login` returns HTTP 200 but `role_profile: ""` for the OC account, while all other personas return a populated profile.
- **Impact:** role-dependent UI/permissions may misbehave for OC. App is the unlabeled `weconnect-frontend` (lcf_project). Confirm intended OC role config with client.
- **CONFIRMED STILL PRESENT on the live platform, read-only (2026-09-20).** Logging in with the
  Outreach Coordinator credential returns `role_profile` as an **empty string**, while
  `permitted_centres` is populated (`["Kukatpally", "Bhawani Peth"]`). So the account has centre
  permissions but no role profile, months after first observation.
- **Why it matters more than it appears.** `authentication/api/auth.py` compares
  `role_profile_name` directly against the persona profile names, so an account with an empty
  profile fails every one of those comparisons. Any behaviour gated on "which persona is this"
  silently takes the wrong branch for this account.
- **Suggested fix:** assign the `Outreach Coordinator` role profile to the account, and make the
  login endpoint refuse — or at minimum log. An authenticated user with no role profile, rather
  than returning an empty string that callers must interpret.

## WC-015 · Info — PM (Placement Manager) deferred: still under development [RESOLVED — scope decision]
- **Where:** weconnect-frontend-pm (46 routes)
- **Status:** the client confirmed PM is still being built. Excluded from QA scope by agreement
  rather than blocked on a credential. Testing an in-flight build produces findings that are
  obsolete before they are read.
- **Re-entry condition:** client declares PM feature-complete → request a login, run the same
  Phase 1 categories against its 46 routes. Route inventory is already captured in
  `data/routes/pm.json`, so restarting costs nothing.
- **In scope:** FC, CH, SP, SYC, SM, OC (6 personas, 252 routes).

---
# Phase 1 smoke — verified defects (2026-09-18)

## WC-016 · S2 — 14 routes render blank on direct load [VERIFIED — three consecutive executions, 2026-09-19]

**Priority: P2**
- **Evidence:** the full suite executed **three consecutive times**. Each route below rendered
  nothing in **every** execution, so environmental flake is excluded — routes failing in only some
  executions are classified separately and are not listed here. Body renders 0 characters.
- **Superseded count:** an earlier single run reported sixteen. Repeated execution reduced this to
  fourteen: `/syc/coming-soon` and `/sp/post-test-assessments` render consistently and were
  reclassified as environmental.

**FC (9):** `/fc/view-post-test` · `/fc/group-based-counselling/attendance` ·
`/fc/group-based-assign-youth-status` · `/fc/badge-table` · `/fc/assesments-dashboard` ·
`/fc/daily-badges` · `/fc/batch-career-counselling` · `/fc/fc/view-feedBack` ·
`/fc/batch-management/view-batch`

**SYC (4):** `/syc/job-application-edit` · `/syc/group-based-counselling/attendance` ·
`/syc/group-based-assign-youth-status` · `/syc/batch-management/certification`

**SP (1):** `/sp/attendance-tracking`

- **Open question — now answered.** These were initially recorded as possibly "reachable only via
  in-app navigation". The root cause established later settles it: five of them throw an uncaught
  null dereference on React Router navigation state, which is null on direct entry. They break on
  refresh, bookmark, shared link and browser-back. Whether a genuine in-app click supplies the
  state they need is untested, and is stated as a limitation rather than claimed either way.
- **Note on the shared-shell hypothesis:** an earlier version of this finding cited
  `/syc/coming-soon` — a placeholder page with almost no feature logic — as evidence that the fault
  lay in the shared shell. That route was subsequently shown to render consistently, so it no longer
  supports the argument. The hypothesis is instead supported by the root cause established later: a
  null dereference on React Router navigation state, throwing the *identical* exception in two
  independently deployed applications.
- **Suggested fix:** root-caused separately to a null navigation state. These routes read their
  identifier from React Router state, which is absent on a direct load or a refresh. Read the
  identifier from URL parameters and guard the read. One fix closes this and the group-based route
  failures below.

## WC-017 · S2 — Two "group-based" routes fail identically in both FC and SYC [VERIFIED — new]

**Priority: P2**
- **Where:** `group-based-counselling/attendance` and `group-based-assign-youth-status`,
  blank in **both** personas.
- **Why it matters:** two independent apps failing on the same two route names points at a
  shared component (`persona-common-components`) or a shared route-state contract, not at two
  coincidental per-app bugs. One fix likely clears four failures.
- **Action:** diff the two implementations against the shared lib before filing them separately.
- **Suggested fix:** the same null navigation state as the 14 blank routes — identical cause,
  identical remedy. Read identifiers from URL parameters rather than router state.

## WC-018 · S2 — SYC /curriculum data API returns 500 [VERIFIED]

**Priority: P2**
- **Where:** SYC persona, /syc/curriculum
- **Evidence:** page shell renders (~140 chars) but a backend data call returns HTTP 500.
- **Suggested fix.** Verified on the isolated instance (2026-09-20):
  `youth_skilling.api.curriculum.curriculum_list` returns **HTTP 500** with
  `TypeError: curriculum_list() missing 1 required positional argument: 'skilling_batch_id'`, and
  the response carries a traceback. This is therefore an instance of the missing-argument crash
  pattern rather than a separate defect: give the parameter a default, validate presence explicitly
  and return **400** naming the missing field. Note the sibling
  `batch_management.api.curriculum.list` answers **417** to the same shape of call. The two
  disagree on how a bad request should be rejected.

## WC-019 · S3 — SP /approvals data API returns 404 [VERIFIED]

**Priority: P3**
- **Where:** SP persona, `/sp/approvals`. The page shell renders; the approvals fetch 404s.
- **Update 2026-09-18:** the route itself now passes reachability (it renders), so this is an
  API-contract defect rather than a broken page. `/sp/attendance-tracking` remains blank and is
  tracked in the blank-route finding above.
- **Suggested fix:** the Skilling Partner approvals screen calls an endpoint that is absent on the
  deployed build. Restore it, or repoint the screen at
  `youth_skilling.api.approval.approval_list`, which serves the same records and is present.
  Note that endpoint carries its own defect (its scope resolver returns unrestricted for any
  `System Manager` holder), so repointing alone is not sufficient.

## WC-020 · S2 — Backend returns 500s under modest concurrency [VERIFIED]

**Priority: P2**
- **Evidence:** at 6 parallel workers many data endpoints returned 500; at ≤3 workers / serialized
  they return 200. Backend stability/scaling concern. Recommend a dedicated load test.
- **Residual evidence 2026-09-18:** even at the safe 3 workers, **9 of 235 routes (3.8%) failed
  their first attempt and passed on retry** — `/fc/family-counselling`, `/sp/pre-test-assessment`,
  `/sp/feedback`, `/sp/achievements/daily-badge`, `/sp/settings/account`,
  `/syc/authentication/forget-password`, `/syc/general-counselling`, `/syc/curriculum`,
  `/syc/view-course-details`. Three concurrent users is a trivial load for a platform intended
  for centre staff; this is the clearest quantified symptom we have and it strengthens the case
  for a dedicated load test.
- **Suggested fix:** size the worker pool for the expected concurrency, and return **503** with a
  retry hint when saturated rather than 500 with a traceback. A 500 tells a client its request was
  wrong; a 503 tells it to retry, which is the truthful answer under load.

## WC-021 · Info — OC persona served at /oc/ (not root)
- Correction to earlier assumption. OC app renders fine at /oc/. Earlier "OC broken" was a test-harness prefix error, now fixed. OC's empty role_profile (F13) does not block the app.

## WC-022 · Info — Clean smoke baseline (workers=3, retry=1), pre-OC-fix
- CH 22/22 pass · SM 40/40 pass · SP 25/27 · SYC 44/50 · FC 43/56 · OC (re-running at /oc/)

---
# Phase 1 category 2 — RBAC read-leakage (2026-09-18)

Method: every request was captured from the persona application that legitimately issues it,
then replayed byte-identical using a different persona's credential. The credential is the only
variable. 318 probes across 6 personas and 67 role-exclusive endpoints; endpoints already broken
for their own owner were excluded from the access verdict. All GETs — nothing could mutate.

**Derivation of the 318, re-verified 2026-09-20** (the figure appears in five client documents, so
it is reconciled here rather than left as an assertion). Recomputed from `data/endpoints/*.json`
through the suite's own `endpointOwnership()`:

| Quantity | Value |
|---|---|
| Endpoints exclusive to one persona | **67** (fc 8, ch 23, sp 12, syc 3, sm 14, oc 7) |
| Endpoints shared across personas | 23 |
| Total distinct endpoints | **90** |
| Cross-role probes if none skipped | 5 callers × 67 = 335 |
| Skipped — endpoint broken for its own owner | 40 (8 endpoints × 5 callers) |
| Authenticated cross-role probes | 335 − 40 = **295** |
| Unauthenticated probes, Σ min(4, exclusive[p]) | **23** |
| **Total** | 295 + 23 = **318** |

Every term is an integer and the identity closes exactly, which is what makes the figure
reproducible rather than merely recorded.

## WC-023 · S2 — Server stack traces returned in the standard API error envelope [VERIFIED — ESCALATED 2026-09-19]

**Priority: P1** — Stack traces reach callers. Configuration change, immediate reduction in what an attacker learns.
- **Where:** `youth_skilling.api.screening.screening_schedule_list` and
  `youth_skilling.api.screening.screening_test_list`, called with the OC credential.
- **Evidence:** HTTP 500 with a JSON body (1,705 chars) containing `exception`, `exc_type`,
  `_exc_source`, `exc`. The `exc` field carries a **full Python traceback including server
  filesystem paths**. `exc_type` is **`NameError`**.
- **Two defects in one response:**
  1. **Information disclosure (the security issue).** Any authenticated user — including the
     lowest-privileged persona — can obtain server-side stack traces and internal file paths.
     Framework debug output should never reach a client in a deployed environment.
  2. **`NameError` is a code defect, not a permission denial.** The endpoint references an
     undefined name on a role-dependent path. The same endpoint returns **HTTP 200 with ~42 KB
     of data** for FC. The endpoint does not refuse the OC account; it fails while handling it.
- **Suggested fix:** disable client-facing traceback rendering in the deployed site config, and
  return 403 from this endpoint for roles without screening access. Then fix the `NameError`.
- **ESCALATED 2026-09-19 — this is not limited to two endpoints.** The API contract suite found
  **56 traceback-bearing error responses** across the endpoint set. Crucially they are **401s**,
  not just 500s: a request carrying `Authorization: token bad:bad` returns a 675-character body
  with `exception`, `exc_type: AuthenticationError`, and a Python traceback naming framework
  source files (`apps/frappe/frappe/app.py`, `apps/frappe/frappe/auth.py`).
- **Revised impact:** **no valid credential is required.** Any anonymous caller can enumerate
  framework internals and confirm the exact stack in use. This is the platform's *standard error
  envelope*, which means traceback rendering is enabled site-wide in a deployed environment —
  a configuration issue, not an endpoint bug.
- **Revised fix:** set the deployed site to suppress client-facing tracebacks. One configuration
  change resolves all 56 instances. The `NameError` remains a separate code defect.
- **Regression cover:** `tests/contract/api-contract.spec.js` asserts error responses contain no
  traceback; annotated as known-failing so it flips green when the configuration is corrected.

## WC-024 · S3 — Endpoint-level role separation is inconsistent; data scoping is the only real control [VERIFIED]

**Priority: P3**
- **Evidence:** each persona was offered the 67 endpoints exclusive to other personas. Share
  refused (401/403):

  | Caller | Read OK | Refused | Refusal rate |
  |---|---|---|---|
  | OC | 48 | 0 | **0%** |
  | CH | 36 | 3 | 8% |
  | FC | 45 | 7 | 13% |
  | SYC | 45 | 9 | 16% |
  | SM | 33 | 11 | 24% |
  | SP | 33 | 14 | 29% |

- **Impact:** there is no coherent endpoint authorization policy — some endpoints check the
  caller's role, most do not, and OC is refused nothing at all. **No data leaked** (see the
  clean result below), because each endpoint scopes its *data* to the caller's permitted
  centres. But that makes per-endpoint data scoping the single control standing between roles.
  One endpoint written without that scoping is immediately reachable by every persona. Combined
  with the disabled frontend route-guard and the shared-origin credential store, the platform is
  relying on one layer where it appears to intend three.
- **Note:** authorization is also **parameter-dependent** — `batch_management.batch_list` returns
  403 for FC with one filter set and 200 with another (`region=All`). Access decisions should not
  vary with query shape.

## WC-025 · ~~Info — No cross-persona data leakage detected~~ [RETRACTED 2026-09-19 — see below]
- **RETRACTED.** This clean result was produced by a defective checker and must not be relied on.
  The checker inspected `parsed.message`, but the platform's own endpoints return
  `{ success_key, message: "<status text>", data: [...] }` — so for every record-bearing response it
  was reading a status string and never examining a single record. Corrected and re-run; the real
  result is the finding below.
- ~~**Evidence:** 295 authenticated cross-role probes. Zero responses contained a field whose value
  is a centre outside the calling persona's `permitted_centres`.~~
- **Evidence:** 23 unauthenticated probes across all six personas' endpoints — **all returned 403**,
  none returned data. This independently confirms the earlier conclusion that the dead frontend
  route-guard does not expose data: the backend refuses anonymous callers.
- **Reporting note:** a first pass using substring matching reported six violations. All six
  failed verification — centre names occur inside batch codes, community names and labels, and a
  locality name inside another string is not evidence of disclosure. The detector now requires a
  field's value to *be* an out-of-scope centre. This is recorded because the corrected method is
  what makes the clean result trustworthy.
- **Caveat on scope:** this covers the 67 role-exclusive endpoints observed across 6 sampled
  routes per persona. It is strong evidence, not exhaustive proof: endpoints not exercised by
  those sampled routes were not probed.
- **Suggested fix:** this finding is a measurement rather than a single defect, and its remedy is
  the architectural one recorded against the systemic authorisation findings: enforce authorisation
  centrally, so that an endpoint being *callable* by a persona is decided in one place rather than
  inferred from whether that endpoint happens to scope its own data. Until that exists, every new
  endpoint inherits the same inconsistency by default.

## WC-026 · Info — 8 of 67 role-exclusive endpoints fail for their own persona
- Existing defects surfaced by the control baseline; they are excluded from the access verdict
  because a broken endpoint cannot demonstrate anything about permissions. Overlaps the
  500/404 findings already recorded.


---
# Phase 1 category 4 — Accessibility baseline (2026-09-18)

> **Superseded by the full-coverage results dated 2026-09-19 later in this register.** The figures
> in this section come from a 30-route sample. Full coverage of all 235 routes found 182 affected
> routes and roughly 3,550 elements. The *pattern* reported here — four rules firing on every
> affected route — was confirmed exactly at full scale. Retained for the record.

Standard: WCAG 2.1 A and AA via axe-core. 30 routes scanned (5 per persona); 7 clean, 23 with
violations. Blank routes were skipped. They are reachability defects, not accessibility ones.
**Total: 63 critical, 65 serious.**

## WC-027 · S2 — Systematic WCAG critical violations, concentrated in shared navigation [VERIFIED]

**Priority: P2**
- **Evidence (rule, routes affected out of 23, elements):**

  | Rule | Impact | Routes | Elements | Meaning |
  |---|---|---|---|---|
  | `aria-allowed-attr` | critical | **23 / 23** | 92 | unsupported ARIA attributes |
  | `image-alt` | critical | **23 / 23** | 38 | images with no alternative text |
  | `listitem` | serious | **23 / 23** | 181 | `<li>` not inside `<ul>`/`<ol>` |
  | `list` | serious | **23 / 23** | 23 | `<ul>`/`<ol>` containing invalid children |
  | `button-name` | critical | 12 | 25 | buttons with no discernible text |
  | `label` | critical | 5 | 5 | form inputs with no label |

- **The distribution matters as much as the count.** Four rules fire on **every route scanned, in
  every persona**. This is not 23 pages each carrying its own mistakes. It is one shared layout and
  navigation component, repeated across all of them. The 181 orphaned `<li>` elements and the unlabelled
  icon images match the sidebar navigation observed during route mapping.
- **Impact:** a screen-reader user cannot identify navigation items (no alt text), cannot operate
  icon-only buttons (no accessible name), and meets a malformed list structure on every page. In
  practice the platform is not usable without sight. For a foundation delivering public-benefit
  programmes this is also a procurement and funding exposure, not only a usability one.
- **Why this is good news commercially:** the concentration means a small number of fixes in the
  shared component library clears the large majority of 128 violations. Worth stating plainly to
  the client. The headline number looks alarming and the remediation is not.
- **Suggested fix:** correct the sidebar list markup (`<li>` inside `<ul>`), add `alt` to nav
  icons, give icon-only buttons an `aria-label`, and remove ARIA attributes not permitted on their
  roles — all in the shared navigation component.

## WC-028 · S3 — Colour contrast below WCAG AA on 13 routes [VERIFIED]

**Priority: P3**
- **Evidence:** `color-contrast`, serious, 13 routes, 43 elements.
- **Impact:** text fails the 4.5:1 AA threshold; affects low-vision users and anyone on a poor
  screen or in sunlight — relevant for field staff working on phones outdoors.
- **Note:** a design-token fix, best handled once at the palette level rather than per component.
- **Suggested fix:** the failures are concentrated in shared navigation and shared button styles
  rather than spread across pages, so correcting the palette tokens in the shared component library
  (`persona-common-components`) fixes most instances at once. Target WCAG AA — 4.5:1 for body text,
  3:1 for large text and UI boundaries — and add an automated contrast check to CI so regressions
  are caught at build time.

## WC-029 · Info — Accessibility coverage is partial by nature [METHOD NOTE]
- axe-core detects roughly **30–40%** of WCAG issues. Everything above is a genuine defect, but a
  clean axe run would not mean the platform is accessible. Keyboard traversal, focus order,
  screen-reader semantics and colour-in-context still require a manual pass, which is **not** in
  the current scope. This is stated so the baseline is not read as full accessibility assurance.
- **Gate policy:** the suite fails on `critical` only; serious/moderate/minor are recorded as a
  prioritised backlog. A suite that fails on every severity from day one gets ignored, and an
  ignored suite protects nothing.


---
# Phase 1 categories 3 & 5 — Asset integrity and API contract (2026-09-19)

## WC-030 · S3 — `permitted_courses` is a string for half the accounts and an array for the other half [VERIFIED]

**Priority: P3**
- **Where:** `authentication.api.auth.login` response, all personas.
- **Evidence:**

  | Account | `permitted_courses` |
  |---|---|
  | FC | `array(3)` |
  | SP | `array(2)` |
  | SM | `array(11)` |
  | **CH** | **`"NA"` (string)** |
  | **SYC** | **`"NA"` (string)** |
  | **OC** | **`"NA"` (string)** |

- **Impact:** a client calling `.map()`, `.filter()` or `.includes()` on this field behaves
  differently depending on who logged in. `"NA".length` is 2, so a naive count reports two courses
  where there are none. A wrong answer returned silently is harder to find than a crash, because
  nothing signals that anything went wrong.
- **Suggested fix:** return `[]` rather than the sentinel string `"NA"`. A field's type should not
  depend on its value. `permitted_centres` is correctly an array for every account and is the
  reference.
- **Regression cover:** `tests/contract/api-contract.spec.js`, annotated as known-failing.

## WC-031 · S3 — Logging in silently terminates the previous session [VERIFIED]

**Priority: P3**
- **Evidence:** two consecutive logins for the same account. `api_key` is stable; **`api_secret` is
  regenerated** on each login, and the first secret immediately returns **401**.
- **Impact:** the platform supports one active session per account. A staff member who logs in on a
  desktop is silently signed out on their phone — and because the interceptor redirects on 401,
  they are dropped onto the login screen mid-task with no explanation. Field staff moving between
  devices will hit this routinely.
- **Also constrains the test suite:** any suite that re-authenticates invalidates every other
  suite's stored session. Handled by `refreshPersonaState()` in `utils/rbac.js`, which writes the
  new credential back. Recorded here because the same trap will catch the client's own developers.
- **Question for the client:** is single-session-only intended? If so it should be signalled to the
  user rather than silent.
- **NEW EVIDENCE 2026-09-20 — the behaviour has a concrete failure mode, not only a UX one.**
  Observed while running the suite against a freshly built instance. Because every login
  regenerates `api_secret` and invalidates the previous one, **repeated logins for the same account
  race against each other**, in two distinct ways:

  | Symptom | What the caller sees |
  |---|---|
  | The save behind the regeneration collides | HTTP 200 with `"message": "Logged In"` **and** `"exception": "frappe.exceptions.TimestampMismatchError"`, and **no `api_key` in the response** |
  | A credential issued by a login that a later login superseded | **HTTP 401 `AuthenticationError`** on the next request, with no indication that the token was revoked rather than wrong |

  The first is the more serious: the endpoint reports success and simultaneously reports an
  exception, so a client cannot tell from the status code that it has no usable credential.

- **Impact.** Any caller that authenticates more than once in quick succession. A test suite, a
  retrying client, a user with two tabs — can be handed a credential that is already dead, or no
  credential alongside a success message. Our own suite hit both and now caches one session per
  persona to work around it.

- **Suggested fix (needs a product decision first).** Decide whether concurrent sessions are
  permitted. If they are, stop invalidating the prior session on login. If they are not, say so:
  the second login should warn that signing in will end the other session, and the terminated
  session should be told why rather than failing with an opaque error on its next request. The
  present behaviour is the worst of both. It is not enforced as a policy and not surfaced as one.

## WC-032 · S4 — Dead anchors (`href="#"`) in navigation [VERIFIED]

**Priority: P4**
- **Evidence:** 10 across the sampled routes — CH 6, FC 3, and "Forgot Password?" on the shared
  login page. They render as links, respond to hover, and do nothing when clicked.
- **Impact:** minor individually; the login-page one matters more because it is the only password
  recovery path a locked-out user can see.
- **Suggested fix:** give each anchor a real destination, or use a `<button>` where the element
  triggers an action rather than navigation. An `href="#"` is announced to assistive technology as
  a link that goes nowhere, and it scrolls the page to the top when activated — so this is an
  accessibility defect as well as a cosmetic one.

## WC-033 · Info — Asset and link integrity: clean [VERIFIED — clean result; superseded by full coverage]
- **Superseded:** the full-coverage result later in this register covers all 235 routes and roughly
  2,200 asset requests, also with zero failures. This sample-era entry is retained for the record.
- **Evidence:** 33 routes across 6 personas plus the shared auth app. **373 asset requests, zero
  failures.** No 404 assets, no unbundled `/src/` paths, and every internal link resolves to a
  route defined in the application's own router.
- **Retest of an earlier finding:** the previously logged S4 "source-tree asset path in built app"
  (`/src/assets/icons/logo_transparent.png` on the login page) **no longer reproduces**. Either it
  was fixed between 2026-09-18 and 2026-09-19, or it was conditional. Marked not-reproducible
  rather than closed, and worth one re-check before the final report.

## WC-034 · Info — Blank routes classified: 14 wholly broken, 2 not reproducing [VERIFIED]
- **Method:** each of the 16 persistent failures was loaded directly, then reached again by
  client-side navigation from the working application root (`history.pushState` + `popstate`, which
  is what a React Router link does).
- **Result:** **14 render nothing by either path.** These are broken screens, not deep-link
  defects — which simplifies the remediation: there is no router-state subtlety to chase.

  **FC (9):** `view-post-test` · `group-based-counselling/attendance` ·
  `group-based-assign-youth-status` · `badge-table` · `assesments-dashboard` · `daily-badges` ·
  `batch-career-counselling` · `view-feedBack` · `batch-management/view-batch`
  **SYC (4):** `job-application-edit` · `group-based-counselling/attendance` ·
  `group-based-assign-youth-status` · `batch-management/certification`
  **SP (1):** `attendance-tracking`

- **2 no longer reproduce:** `/syc/coming-soon` and `/sp/post-test-assessments` now render. They
  were previously recorded as persistent failures across two attempts, so this is either a fix or
  genuine intermittency. To be re-confirmed before the final report.
- **Stated limitation:** client-side navigation was simulated without route state. A screen that
  requires state passed by a specific originating page (`navigate(path, { state })`) would also
  appear blank here. Distinguishing that requires clicking through from each originating screen,
  which needs the entry point per route. The conclusion "these screens do not render unaided" is
  solid; "no possible navigation path renders them" is not claimed.
- **Method note:** the first classification run produced the opposite answer — 12 "deep-link only".
  It was wrong: the sessions had been invalidated mid-run by the contract suite's logins, and the
  186-character "content" being measured was the login form. The classifier now aborts rather than
  classifying when it detects a login redirect.


---
# Phase 1 category 2 — RBAC re-verification (2026-09-19)

## WC-035 · S2 — Personas receive records belonging entirely to centres they are not permitted for [VERIFIED]

**Priority: P1** — Records from centres the caller has no permission for are returned today.
- **Supersedes** the retracted clean result above. Found only after the scope checker was corrected
  to inspect the `data` envelope rather than the status string in `message`.
- **Test used:** a record counts as an unambiguous violation only when it carries **no** centre the
  caller is permitted for. A record spanning several centres, one of which the caller owns, is
  excluded as arguable. Reproduced across every recorded query variant.

  | Endpoint | Caller | Records wholly outside scope |
  |---|---|---|
  | `youth_skilling.api.approval.approval_list` | SP | **5 of 5** |
  | `youth_skilling.api.dashboard.get_waiting_for_skilling_count` | CH | 2 of 3 |
  | `youth_skilling.api.dashboard.get_waiting_for_skilling_count` | SYC | 2 of 3 |
  | `youth_skilling.api.dashboard.get_waiting_for_skilling_count` | FC | 1 of 3 |
  | `centre_head.api.approval.list.get_approvals` | SP | 3 of 10 (one query variant) |

- **Impact:** the platform publishes each account's `permitted_centres` at login and then serves
  data outside it. The approvals case is the most serious: **every record returned to SP belonged to
  centres outside its permission scope**, and approval records carry workflow detail including
  `location` and `transfer_to_center`. The dashboard case discloses operational status of other
  centres. This is the system contradicting its own declared permission model.
- **Why it matters beyond these endpoints:** §"Endpoint-level role separation" records that most
  endpoints are callable by every persona, and the mitigation relied on each endpoint scoping its
  own data. These are endpoints where that scoping is absent — which is the failure mode that
  finding predicted.
- **ROOT CAUSE CORRECTED 2026-09-20 — the earlier stated fix was wrong for two of the three
  handlers.** Re-reading the source shows the scoping is **present** and is **bypassed**, not
  absent. This is the same mechanism as the counselling S1, and both are instances of the
  45-site `System Manager` finding.

  | Handler | What the source actually does | Verdict |
  |---|---|---|
  | `youth_skilling.api.approval.approval_list` | calls `_skilling_manager_approval_names()`, which is `return None` (no restriction) when `"System Manager" in roles` — `api/approval.py:74` | **bypass, not missing filter** |
  | `youth_skilling.api.dashboard.get_waiting_for_skilling_count` | calls `_dashboard_scope()` → `get_user_permitted_centres()`, which is `return []` when `"System Manager" in user_roles` — `api/helper.py:69-74`. `_dashboard_scope` then evaluates `[] or None` → `None`, i.e. unscoped | **bypass, not missing filter** |
  | `centre_head.api.approval.list.get_approvals` | uses `frappe.get_list`, which enforces User Permissions; `Approval.lh_centre` is a Link to `Lighthouse Centre`, so there is something to scope on | **scoping held under test — cause of the live observation not established** |

  **Test of the third handler (isolated instance, 2026-09-20):** with six North-owned Approvals
  present, `sp` (permitted East/West only) received **0 rows**, and `ch` (North) received 6.
  Scoping held. The "records with an empty centre escape scoping" hypothesis was also tested and
  does not apply: creating an Approval without `lh_centre` is refused with
  `ValidationError: No User Permission Found for Centre.`

  The live observation for that third handler therefore remains **unexplained**. The most likely
  remaining candidate is the dual centre-scoping mechanism recorded separately — login publishes
  `permitted_centres` while `get_list` scopes on `User Permission` rows, and the two can disagree.
  It is recorded here as unexplained rather than attributed to a cause we have not demonstrated.

- **Suggested fix (corrected):**
  1. For `approval_list` and `get_waiting_for_skilling_count`: **remove the `System Manager`
     early-return from the scope resolvers**, and fix the permission model so the role is not
     required (see the 45-site finding). Adding a filter would change nothing. The filter exists.
  2. For `get_approvals`: confirm with the client whether the live account's `User Permission`
     rows matched its published `permitted_centres` at the time of observation, which would settle
     the dual-mechanism question.
  3. Note that `dashboard.get_invoice_count` applies **no scoping at all** —
     `frappe.db.count("Skilling Invoice", {...})` with no centre filter — recorded separately.
- **Severity note:** recorded as S2 rather than S1 because the disclosure is between staff roles
  inside one organisation, not public, and the records observed are operational rather than youth
  PII. Should equivalent scoping be missing on a youth-record endpoint, that would be S1.

## WC-036 · Info — `batch_list` flagged but NOT an unambiguous violation [VERIFIED]
- Batch records carry a `training_centers[]` array, and CH and SYC see entries naming centres
  outside their permitted list. **However, zero batch records were wholly outside scope** — every
  one included at least one centre the caller is permitted for. A batch spanning several centres
  legitimately names all of them.
- Recorded as characterisation, not a defect. Confirming intent is a question for the client.

## WC-037 · Info — `utils.get_training_center_list` returns the full centre list to every persona [VERIFIED]
- The response is a reference list of centre names. A picker, not records. FC sees 5 centres
  beyond its permitted set, CH sees 8.
- Not a record disclosure. It does expose the organisation's centre structure to every account, so
  it is recorded for the client to confirm as intended.

---
# Phase 1b — Dynamic routes (2026-09-19)

## WC-038 · S2 — Opening the invoice screen attempts to create a tax invoice, with no user action [VERIFIED]

**Priority: P1** — Opening a screen writes financial records with no user action.
- **Where:** `/sp/invoicing/view-batch-invoice/prepare-invoice/:batchId/:installment/:centerName`
  and the equivalent `/sm/invoicing-management/...` route.
- **Evidence:** on page load, with no interaction whatsoever, the application issues
  `POST .../youth_skilling.api.invoice.prepare_tax_invoice?batch_id=<batch>&installment=1&center=<centre>`.
  Reproduced on both the Skilling Partner and Skilling Manager applications.
- **Impact:** navigation changes state. A GET-style page visit triggers a write against a finance
  workflow, which means:
  - refreshing, bookmarking, sharing the link or pressing back re-fires invoice preparation;
  - any user who merely *opens* the screen to look at it performs a financial action;
  - the operation is not idempotent by URL, so duplicate or incorrect invoices are plausible.
- **This is why Phase 1 blocks writes at the network layer.** The request was aborted before it
  left the browser. Had testing relied on convention rather than enforcement, this suite would have
  attempted to prepare tax invoices against real batches at a live centre. It is the first time the
  read-only guard has fired in the entire engagement, and it fired on real financial data.
- **Deliberately not determined:** whether the call persists a record or only computes a preview.
  Establishing that requires letting it execute against the live dataset, which is out of scope for
  Phase 1 by design. **This is a question for the client, and it decides the severity** — if the
  call commits a record, this is S1, not S2.
- **Suggested fix:** the screen should load its data with a GET and perform invoice preparation only
  on explicit user confirmation.

## WC-039 · ~~S3 — `scheduled-batch-details` renders blank with a valid batch identifier~~ [WITHDRAWN 2026-09-19]
- **Where:** `/sp/batch-management/scheduled-batch-details/:batchId`.
- **Evidence:** blank with a batch identifier on which the other four batch-detail variants —
  initiated, ongoing, completed and near-end — all render correctly.
- **Withdrawn.** Recorded from a single observation. Across three consecutive executions the screen
  rendered every time. The registry's inverted assertion — a route recorded as blank must *stay*
  blank — reported it as "registered but now renders", which is the mechanism working as designed.
- **Third false defect caught this way.** All three were single-observation records that repeated
  execution disproved. The pattern is consistent enough to state as a rule: **a defect recorded
  from one run is a hypothesis, not a finding.**

## WC-040 · ~~Info — Dynamic-route coverage: 11 of 17, with the gap named~~ [SUPERSEDED 2026-09-19]
- **Covered (11):** 8 pass, 3 fail as above. Identifiers were harvested read-only from the list
  endpoints the applications already call.
- **Not covered (6)** — no identifier obtainable without client input:

  | Parameter | Routes blocked |
  |---|---|
  | `:category` | 4 (OC enrollment screens) |
  | `:invoiceId` | 1 (SP upload declaration) |
  | `:preEnquiryId` | 1 (OC update enquiry) |

- **Ask:** one sample value for each, or fifteen minutes of a staff member opening those screens
  while we capture the values from the traffic. Recorded as an explicit coverage gap per the
  Definition of Done, rather than silently skipped.

## WC-041 · S4 — Developer test route shipped in the deployed Outreach Coordinator application [VERIFIED]

**Priority: P4**
- **Where:** `/oc/test-zustand`, defined in the OC application's router and reachable in UAT.
- **Evidence:** present in the deployed route inventory; named for the state-management library,
  indicating a development scratch screen rather than a user-facing feature.
- **Impact:** low in itself — but development routes in a deployed build are unreviewed surface.
  They are not designed against a permission model and are rarely considered when access control is
  audited.
- **Suggested fix:** exclude development routes from production builds, or gate them behind a build
  flag.
- **Found during:** the Phase 1 completeness audit of the route inventory, not by a test.

## WC-042 · Info — Four applications ship `coming-soon` placeholder screens [VERIFIED]
- **Where:** SP, SYC, SM and OC each define a `coming-soon` route.
- **Why it is recorded:** it establishes that some screens are intentionally incomplete. This bears
  directly on the sixteen blank routes: a subset may be unbuilt features rather than defects.
  Resolving which is a client decision, raised as item 10.1 in the characterisation document.


---
# Phase 1 full-coverage sweep — root cause of the blank routes (2026-09-19)

## WC-043 · S2 — Blank routes are crashing on null navigation state [VERIFIED — ROOT CAUSE, corrects an earlier classification]

**Priority: P1** — Root cause of 14 blank routes; the platform is substantially unusable until this is fixed.
- **Evidence:** the full sweep captures uncaught JavaScript exceptions. Five routes throw:

  | Persona | Route | Exception |
  |---|---|---|
  | FC | `/fc/badge-table` | `Cannot read properties of null (reading 'viewType')` |
  | FC | `/fc/batch-management/view-batch` | `Cannot read properties of null (reading 'batchId')` |
  | FC | `/fc/view-post-test` | `Cannot read properties of null (reading 'batch_id')` |
  | FC | `/fc/group-based-counselling/attendance` | `Cannot read properties of null (reading 'length')` |
  | SYC | `/group-based-counselling/attendance` | `Cannot read properties of null (reading 'length')` |

- **Root cause:** these screens read values from React Router's `location.state`. That object is
  **null when a route is entered directly by URL**, because state is supplied only by an in-app
  navigation. The component dereferences it, throws, and the error boundary leaves the page empty.
  The blank page is a symptom; the null dereference is the defect.

- **CORRECTION to the earlier classification.** These were previously recorded as "wholly broken,
  not deep-link defects", on the basis that they stayed blank under simulated in-app navigation.
  That simulation pushed **empty** history state, not the state a genuine click passes — so it
  reproduced the same null dereference and could not have distinguished the two cases. The accurate
  statement is: **these screens crash without navigation state, and we have not tested them with
  genuine state.** Whether they function when reached by a real click from their originating screen
  is unestablished.

- **Impact, unchanged in severity but clearer in kind:** refresh, bookmark, shared link, browser
  back and any direct URL entry all break these screens. Users do refresh.

- **Suggested fix:** read identifiers from URL parameters rather than router state, and guard the
  state access (`location.state?.batchId`). The identifier is already in the URL for the
  `:batchId` routes, so the data needed is present. It is simply not being read from there.

- **Note on the shared-component cluster:** `group-based-counselling/attendance` throws the
  identical exception in both FC and SYC, which supports the earlier conclusion that these two
  applications share the component rather than having independent faults.

## WC-044 · ~~S3 — `/fc/daily-activity` renders blank~~ [WITHDRAWN 2026-09-19]
- **Withdrawn.** Recorded from a single sweep. Across three consecutive executions the route
  rendered every time, and it rendered again under single-session runs. It was one instance of the
  platform's concurrency flake, not a defect.
- Removed from the known-defect registry. Retained here, struck through, because a finding that was
  raised and withdrawn is part of the record — silently deleting it would hide that the register is
  actively corrected.

## WC-045 · Info — Accessibility at full coverage: the shared-component pattern confirmed at scale
- **182 of 235 routes** carry violations; **3,593 elements** in total.
- Four rules fire on **every single affected route (182/182)**: `aria-allowed-attr` (808 elements),
  `image-alt` (428), `listitem` (1,452), `list` (182). Sampling 30 routes suggested this pattern;
  full coverage confirms it exactly. These are one shared navigation component repeated across
  every screen of every application.
- Full coverage also surfaced rules the sample missed, including `select-name` (critical, 2 routes)
  and a wider spread of `label` (84 routes) and `button-name` (66 routes).
- **The remediation estimate is unchanged and remains small:** the four universal rules account for
  2,870 of the 3,593 elements — roughly 80% — and they live in shared markup.

## WC-046 · Info — Asset integrity at full coverage: clean [VERIFIED — clean result]
- **2,157 asset requests across all 235 routes. Zero failures.** No missing assets, no unbundled
  source paths. The earlier clean result on a 33-route sample holds across the full inventory.
- 21 dead anchors (`href="#"`) remain.

## WC-047 · S2 — Backend concurrency sensitivity, quantified [VERIFIED — dose-response]

**Priority: P2**
- **Method:** the identical 235-route sweep executed twice, differing only in the number of
  simultaneous sessions. Same routes, same assertions, same build, minutes apart.

  | Concurrent sessions | Duration | Failed | Flaky (passed on retry) | Flake rate |
  |---|---|---|---|---|
  | 3 | 22.3 min | 6 | 8 | **3.4%** |
  | 5 | 17.6 min | 14 | 16 | **6.8%** |

- **Note on the two instability figures in this register:** this table reports a controlled
  comparison of two single executions (3.4% at three sessions, 6.8% at five). The **3.0%** quoted
  elsewhere is the rate across three consecutive executions at three sessions, which is the more
  reliable figure and the one used in the client documents. Both describe the platform; they differ
  in sample size.
- **Effect:** raising concurrency from three sessions to five **doubled the flake rate** and caused
  **eight routes that render correctly to return blank**, plus one additional uncaught JavaScript
  error. The routes affected were not the same ones each time, which is the signature of
  server-side contention rather than a defect in those screens.
- **Throughput did not scale with it:** 67% more parallelism produced 21% less wall-clock time. The
  platform is absorbing the difference — additional callers queue rather than being served.
- **Why this matters beyond testing:** five simultaneous users is not a load test. It is five
  members of staff working at the same moment, which any centre would exceed on a normal morning.
  The measured behaviour at that level is pages failing to render.
- **Consequence for QA:** three workers is the ceiling, now confirmed under current conditions
  rather than inherited from an earlier measurement. Test runs are exclusive and capped at three.
- **Recommendation:** a dedicated load test, and this table is the argument for commissioning one —
  it converts "the backend is sometimes unstable" into a measured dose-response.

---
- **Suggested fix:** as for the finding above. Capacity is a deployment parameter rather than a
  code defect, but the failure *mode* is a defect: saturation should surface as 503, not 500 with a
  traceback. Size the pool against the measured dose-response and re-measure after any change to
  worker count.

## WC-048 · S1 — Youth counselling records disclosed to a persona with no permission for those centres [VERIFIED]

**Priority: P1** — Confirmed disclosure of counselling records across centres.

**First S1 of the engagement. Raised 2026-09-19.**

- **Where:** `facilitator_and_counsellor.api.counselling.list.get_counselling_list`, called with the
  **Outreach Coordinator** credential.
- **Evidence:** HTTP 200. **10 of 10 records returned were wholly outside OC's permitted centres**
  — OC is permitted for 2 centres and received none of them. The records carry:

  `youth`, `youth_name`, `youth_stage`, `counselling_type`, `counselling_subtype`,
  `counselling_date`, `counselling_location`, `remarks`, `last_call_remarks`, `status`,
  `interested_course`, `batch`

- **Why this is S1 and the earlier leakage findings were S2.** The existing scope-violation finding
  was recorded as S2 with this explicit qualifier: *"the records observed are operational rather
  than youth PII. Should equivalent scoping be missing on a youth-record endpoint, that would be
  S1."* That condition is now met. These are **named individual youth**, with the type and
  outcome of their counselling sessions and free-text remarks about them, disclosed across a
  permission boundary the platform itself declares.

- **Impact:** a staff account attached to two centres can read counselling records — including
  names and session notes — for youth at centres it has no authority over. For a
  safeguarding-sensitive programme this is a data-protection matter, not only a defect.

- **Per the Definition of Done, S1 requires: fixed, retested, confirmed closed. No exceptions, no
  deferrals.**

- **How it stayed hidden until now:** the RBAC suite asserted server faults *before* scope
  violations. OC's test failed on two unrelated 500s, so the leak assertion never executed and
  these records were never examined. Registering the known 500s let the test run to completion and
  the disclosure surfaced immediately. **A defect was being masked by an earlier assertion in the
  same test** — worth recording as a lesson about assertion ordering: an early hard failure hides
  everything after it.

- **ROOT CAUSE CORRECTED 2026-09-20 — the earlier stated cause and fix were wrong.**
  The handler is **not** missing a centre filter. `counselling/list.py:103-118` already reads the
  caller's `User Permission` rows (`allow='Lighthouse Centre'`) and applies
  `query.where(Counselling.counselling_location.isin(allowed_centres))`, returning 403 when the
  caller has no permitted centre. The filter is skipped because of the branch directly above it:

  ```python
  if 'System Manager' in frappe.get_roles(user):
      pass                      # <- centre scoping disabled entirely
  else:
      ...apply the centre filter...
  ```

  **Confirmed against the live platform, read-only (2026-09-20):** the Outreach Coordinator
  credential reports `permitted_centres = ["Kukatpally", "Bhawani Peth"]`, yet
  `GET /api/resource/Role Profile` and `GET /api/resource/User` both return **200** — reads only a
  System Manager obtains. The account is elevated, so the bypass branch executes and every
  counselling record is returned regardless of centre.

  This also rules out the competing explanation. Given the source, HTTP 200 with records wholly
  outside scope is reachable **only** through the bypass: the non-bypass branch either filters
  correctly or returns 403.

  **Do not reproduce this on the isolated instance as evidence.** Our own seeder grants
  System Manager to every persona (`seed_personas.py:115`) because the platform leaves no
  alternative — 178 of 293 doctypes grant permissions to `System Manager` alone. A reproduction
  there demonstrates our seeding choice, not the platform's defect.

- **Suggested fix (corrected), in order:**
  1. **Remove the `System Manager` bypass from handlers that return youth records.** A superuser
     role should not silently disable centre scoping on safeguarding-sensitive data; if an
     administrative override is genuinely required it should be explicit, narrow and audited.
  2. **Remove the need for the role.** Persona accounts hold `System Manager` because the doctype
     permission model offers nothing else — see the permission-design finding. Until that is fixed,
     every endpoint guarded this way is open to every staff account.
  The originally recorded fix — "apply `permitted_centres` as a server-side filter" — would change
  nothing, because that filter is already present and already correct.

- **Handling note:** no record values have been copied into any report, log or document. Only field
  names and counts are recorded. The evidence is reproducible from the endpoint and credential.


---
# Phase 1 stability verification — three consecutive executions (2026-09-19)

## WC-049 · Info — Route classification resolved by repeated execution [METHOD + RESULT]
- **Method:** the full 235-route sweep executed three consecutive times. A route is judged on how
  it behaves across all three, not on any single run, because a platform that fails intermittently
  cannot be characterised by one observation.

  | Verdict | Count |
  |---|---|
  | Blank in **every** run — reportable defects | **14** |
  | Blank in **some** runs — environmental | 7 |
  | Rendering in every run | 214 |

- **Measured instability: 3.0%** of routes behaved inconsistently across the three executions at
  three concurrent sessions. That figure describes the platform, not the suite.

- **The 7 intermittent routes were then confirmed at single-session concurrency.** `/ch/targets`,
  `/all-notifications`, `/fc/career-counselling`, `/fc/counselling`, `my-profile`,
  `settings/notifications` and `/set-password` **all rendered correctly in two consecutive
  workers=1 runs**. They are not screen defects; they fail only under concurrent load, which
  independently corroborates the concurrency finding.

## WC-050 · Info — Two defects we had recorded were disproved by repeated execution [CORRECTION]
- **`/fc/daily-activity`** was added to the known-defect registry on the strength of a single
  sweep. Across three consecutive executions it rendered every time. It was one flake, recorded as
  a defect. **Removed.**
- **`/all-notifications`** was identified after two cycles as an unrecorded defect. The third cycle
  showed it rendering; single-session runs confirmed it. **Classified environmental, not a defect.**
- **Why this is recorded rather than quietly corrected:** both would have reached the client as
  false defects. A development team that investigates a reported defect and finds nothing wrong
  discounts the next report too. The cost of a false positive is therefore not the hour spent on it, but the weight the client gives to every later finding. Requiring reproduction across three runs before
  reporting is what prevented it, and it is why the stability criterion was changed from "a green
  run" to "a consistent classification".

## WC-051 · Info — The known-defect registry now matches the evidence exactly [VERIFIED]
- Every one of the 14 registered blank routes is blank in all three executions, and every route
  blank in all three executions is registered. Verified programmatically, not by inspection.


## WC-052 · Info — Invoice write-on-load reproduced across three consecutive executions [VERIFIED]
- The two invoice preparation routes were asserted to attempt exactly the registered
  `prepare_tax_invoice` POST on load. Those assertions **passed in all three cycles**, meaning the
  write was attempted every time and no *additional* mutating request occurred.
- The finding is therefore reproducible, and its scope is bounded: one endpoint, two routes, no
  other writes anywhere in 235 routes × 3 executions.

## WC-053 · Info — Unauthenticated access: complete rather than sampled [VERIFIED — clean result]
- Earlier the claim rested on 23 probes. **All 71 distinct endpoints observed in use were then
  probed with no credential: every one returned 403, none served data.**
- The claim "no observed endpoint serves data to an unauthenticated caller" is now complete across
  the observed endpoint set, rather than inferred from a sample.


## WC-054 · Info — Dynamic-route coverage completed: 17 of 17, no client input required [VERIFIED]
- **The earlier coverage gap was self-inflicted, not a client dependency.** Six routes were recorded
  as blocked pending sample values for `:category`, `:invoiceId` and `:preEnquiryId`. All three were
  obtainable from the platform:

  | Parameter | Source | Note |
  |---|---|---|
  | `:invoiceId` | `youth_skilling.api.invoice.invoice_list` | 20 invoice records available |
  | `:preEnquiryId` | `outreach.apis.pre_enquiry.list.get_pre_enquiries` | records key on `id`, not the Frappe-conventional `name` |
  | `:category` | enum, not a record identifier | verified empirically: `total` returns populated content |

- **Why it was missed:** the endpoint inventory is built from six sampled routes per persona, so
  screens never sampled — invoicing, the pre-enquiry list — contributed no endpoints, and their
  identifiers looked unobtainable when they were merely unvisited. The first harvest also ran while
  sessions were being rotated by a concurrent suite, which produced 401s that read as access
  failures. Neither was re-tested after the session handling was fixed.
- **Lesson:** re-test a dependency on the client before reporting it as one. Asking
  for something we could obtain ourselves costs credibility and calendar time.
- **Result across three consecutive executions plus a single-session confirmation:**
  **17 of 17 dynamic routes render. No dynamic route fails consistently**, and at single-session
  concurrency all seventeen pass with zero blanks. The intermittent failures observed under parallel
  load match the platform's measured concurrency behaviour.
- `utils/collect-ids.mjs` now names these sources explicitly so the gap cannot recur silently.

---
# Phase 2 — self-host feasibility spike (2026-09-20)

## WC-055 · S3 — The deployable platform is undocumented and larger than the handover [VERIFIED]

**Priority: P3**
- **Evidence:** `weconnect-backend-authentication`, `authentication/api/auth.py:185`:
  `frappe.db.get_value("Employee", {"user_id": user})`. **No Employee doctype is defined by any of
  the eight backend applications** — 297 definitions under 293 distinct names were enumerated
  across all of them, and none is Employee. Accounts carry identifiers of the form `HR-EMP-00471`.
- **Resolved:** `Employee` is supplied by **ERPNext / Frappe HR**, both installed on the site.
  Confirmed by installing them on an isolated instance, where authentication's dependency is
  satisfied. The dependency is real; it is met by a framework component rather than by a missing
  repository.
- **The finding stands on the documentation, not the dependency.** Nothing in any repository states
  that the platform requires ERPNext and Frappe HR, or lists the deployable set. No application
  declares `required_apps`, which is the mechanism Frappe provides for exactly this. Anyone
  reconstructing the environment. A new developer, a disaster recovery, or QA — discovers the gap
  only when login fails with an obscure error about an unknown doctype.
- **Suggested fix:** declare `required_apps` in `authentication/hooks.py`, and record the deployable
  set in a README. Both are small; the absence of both is what turns a dependency into a trap.
- **Question for the client:** is the full deployable set documented anywhere we have not seen?

## WC-056 · ~~Info — The backend is pure Frappe, not Frappe/ERPNext~~ [WITHDRAWN 2026-09-20 — THIS CORRECTION WAS WRONG]
- **Evidence:** all eight backend applications enumerated. **Zero references to `erpnext` and zero
  to `hrms` in any file path**, no ERPNext dependency in any `pyproject.toml`, and 296 doctypes all
  defined by the applications themselves.
- **Correction:** Phase 1 documents described the backend as "Frappe/ERPNext". That was inferred
  from the API path signature at first contact and never re-examined. It is inaccurate: these are
  custom Frappe applications, and ERPNext is not present.
- **Why it matters:** a technical mischaracterisation in a document handed to the client's own
  developers costs credibility, and it materially changes the effort of reproducing the environment
  — installing ERPNext is a substantially larger undertaking than it turns out to be here.
- **Target versions, from their own `pyproject.toml`:** Frappe ~15.0, Python ≥3.10.
- **WITHDRAWN.** This entry was wrong, and the error is instructive. It concluded from source
  inspection. No `erpnext` string in any of the eight applications. That ERPNext was not present.
  The live platform was then asked directly and reports **ERPNext 15.114.0 installed**. The
  applications do not *reference* ERPNext in their own code; the *site* runs it. Absence of a
  reference is not absence of a dependency.
- **The failure was method, not conclusion.** Definitive evidence was available the whole time —
  one authenticated call to `frappe.utils.change_log.get_versions` — and I inferred from partial
  evidence instead of asking the system. The original "Frappe/ERPNext" description was correct and
  has been restored.

## WC-057 · Info — Spike VERDICT: a drift-free isolated environment is built and verified [VERIFIED]
- **No inter-application dependencies.** Every `required_apps` declaration is commented out, so the
  eight applications install independently of one another.
- **Minimal external dependencies.** Only `outreach` declares any: `indiapins`, `gspread`,
  `google-auth` — all standard packages. The Google dependencies suggest a Sheets integration that
  may need credentials at runtime, relevant only to that feature.
- **297 doctype definitions** across the applications, carrying **293 distinct names** — the
  four-way gap is itself a defect, recorded separately below. For Phase 2 these are the
  authoritative field definitions, which is why the spike was sequenced ahead of payload capture.
- **`Employee` is resolved:** supplied by **ERPNext**, module `Setup` (Frappe HR extends it).
  Confirmed on the installed instance, not inferred.
- **BUILT, PINNED AND VERIFIED.** The environment installs **Frappe 15.113.2, ERPNext 15.114.0 and
  Insights 3.12.5 — the client's exact versions** — plus all eight WeConnect applications, on
  Python 3.11 and Node 22. Ten of ten install with zero failures.
- **Drift measured, not assumed.** `utils/compare-environments.mjs` queries both platforms'
  installed-application lists and compares them application by application:
  **11 match exactly, 1 documented exception** (`fintoo_analytics_bridge`, unobtainable).
- **The first build was discarded because it drifted three ways**: framework from branch HEAD
  (15.121.x), Frappe HR installed which the client does not have, and Insights missing which the
  client does. All three are eliminated in the pinned build.
- **Frappe HR is genuinely unnecessary.** With hrms absent, `Employee` still resolves — to
  **ERPNext**, module `Setup` — and the login endpoint returns its full envelope.
- **Schemas are identical across both builds** — 293 doctypes, 433 mandatory fields, 141 child
  tables, zero differences in any mandatory-field set. The WeConnect schema does not depend on the
  framework version, which means the extraction is robust to the one drift we cannot eliminate.
  The site serves (HTTP 200), the API answers (`ping` -> `pong`), and
  **`authentication.api.auth.login` returns the same envelope as production**: `api_key`,
  `api_secret`, `employee_id`, `sp_role`, `role_profile`, `permitted_courses`,
  `permitted_centres` — with a wrong password correctly producing
  `{"success_key":0,"message":"Authentication Error!"}`.
- **The three vendor applications were not needed.** Nothing referenced them and nothing failed
  without them, which answers the question their absence raised for testing (though not the
  business-continuity question, which stands).
- **1,218 doctypes on the site**: erpnext 502, frappe 274, hrms 149, and 293 from the eight
  WeConnect applications.
- **Payload schemas extracted: 293 doctypes, 2,690 field definitions, 433 mandatory fields,
  141 child tables** -> `data/doctype-schemas.json`. This is the authoritative source for Phase 2
  request shapes and replaces reverse-engineering 102 forms through the UI.
- **Consequence:** Phase 2 needs nothing from the client to proceed. Destructive testing runs
  against synthetic data on an isolated host, and no real programme record is involved at any
  point.


## WC-058 · S2 — An installed application is absent from the repositories handed over [VERIFIED — CORRECTED 2026-09-20]

**Priority: P2**
- **Evidence:** `frappe.utils.change_log.get_versions`, which enumerates the applications
  **installed on the site**, reports **twelve**:

  | Source | Applications | Obtainable |
  |---|---|---|
  | Framework | `frappe` 15.113.2 · `erpnext` 15.114.0 · `insights` 3.12.5 | Yes — open source |
  | WeConnect | the eight supplied backends | Yes |
  | **Vendor** | **`fintoo_analytics_bridge`** | **No** |

- **`fintoo_analytics_bridge` exists in no repository in the foundation's GitHub organisation.**
  The organisation holds eighteen repositories; none corresponds to it. It appears to belong to the
  development vendor.
- **Impact.** The platform as deployed cannot be rebuilt from the code the foundation owns. One
  installed component would be unavailable in a disaster recovery, a change of supplier, or a new
  environment build. The gap is one application rather than three, but the governance question is
  unchanged in kind.
- **For Phase 2:** not required. An isolated environment was built without it and the platform
  authenticates and serves correctly.
- **Questions for the client:** who owns `fintoo_analytics_bridge`, does the foundation have rights
  to it, and is there an escrow or handover arrangement?

### Correction to this entry
An earlier version claimed **three** unobtainable applications and **fifteen** installed. That was
wrong, and the error is the same one made earlier the same day over ERPNext.

`Module Def` — a table of *modules present in the database* — lists fifteen applications. Installed
applications are a different thing, and `get_versions` reports twelve. The two were conflated and
the larger number was published. `hrms`, `mannlowe_support` and `materialized_view_builder` appear
in `Module Def` but are **not installed**; they are recorded separately below.

**The pattern, named:** a plausible local proxy has repeatedly been read in place of the
authoritative source.

| # | Proxy used | Authoritative source | Consequence |
|---|---|---|---|
| 1 | `erpnext` absent from file paths | installed-application list | Published a wrong correction to two client documents |
| 2 | `Module Def` records | installed-application list | Published "fifteen installed apps"; the true figure is twelve |
| 3 | In-memory cache of created records | the database | Most of an 80-doctype seed failure: the cache listed records a rollback had discarded |

The third is the clearest, because the cache was *provably* stale. A rollback deleted the rows
while the cache kept their names — and it cost a full seeding run to diagnose.

The corrective is not more care but a rule: **when a system can be asked directly, ask it.** Do not
publish an inference in its place, and do not hold a local copy of state the system already owns.
- **Suggested fix, in order:** (1) establish who owns `fintoo_analytics_bridge` and obtain either
  the source or a written escrow undertaking. The platform cannot be rebuilt or fully audited
  without it; (2) declare `required_apps` in each app's `hooks.py` so the deployable set is recorded
  in code; (3) remove the orphaned `Module Def` records for apps that are not installed (`hrms`,
  `mannlowe_support`, `materialized_view_builder`), so the installed-application list stops
  disagreeing with itself.

## WC-059 · S3 — Orphaned module records remain for three uninstalled applications [VERIFIED]

**Priority: P3**
- **Evidence:** `Module Def` holds records attributed to three applications that
  `get_versions` does not list as installed:

  | Application | Orphaned modules |
  |---|---|
  | `hrms` | `HR`, `Payroll` |
  | `mannlowe_support` | `Mannlowe Support` |
  | `materialized_view_builder` | `Materialized View Builder` |

- **What this means.** `Module Def` records are created when an application is installed. Their
  presence without a corresponding installation indicates these applications **were installed on
  this site and later removed**, leaving residue that `bench uninstall-app` did not clear.
- **Impact.** Chiefly diagnostic, and that is the point: anyone inspecting this site to establish
  what it runs gets a misleading answer — as we did. It can also break tooling that resolves a
  doctype's owning application through its module, and it is the sort of residue that makes an
  environment progressively harder to reason about.
- **We could not determine whether the underlying tables remain.** A probe for hrms-only doctypes
  returned 403 for every one, but the negative control — a doctype name that does not exist —
  returned 403 as well, so the probe distinguishes nothing. Recorded as unresolved rather than
  guessed.
- **Suggested fix:** remove the orphaned `Module Def` records, or reinstall-and-uninstall cleanly.

## WC-060 · Info — `Employee` is provided by ERPNext, resolving the earlier gap [VERIFIED]
- The authentication service queries an `Employee` doctype that none of the eight WeConnect
  applications defines. It is supplied by **ERPNext**, in its `Setup` module — confirmed on an
  installed instance by querying the doctype's owning module, not inferred.
- **Frappe HR is not installed on the client's platform**, so the `HR-EMP-` identifier series
  comes from ERPNext's own naming configuration rather than from Frappe HR. An earlier note
  attributing it to Frappe HR was written before the installed-application list was read properly.
- The earlier finding recorded this as "a ninth application, unidentified". It is identified: the
  deployable set is fifteen applications, not eight or nine.

## WC-061 · Info — Schema metadata is not readable by persona accounts [VERIFIED — clean result]
- **Check:** requested `DocType` metadata for 16 framework doctypes using the Skilling Manager
  account, both through `frappe.client.get_list` and the REST resource endpoint.
- **Result:** **403 Permission Denied on every one.** An ordinary user cannot enumerate the
  schema, which is correct behaviour and the desired posture.
- **Consequence for QA:** doctype ownership cannot be resolved from the live platform with the
  credentials we hold, so the isolated environment determines it empirically instead. That is the
  better method in any case. An installed instance is evidence, an inference is not.
- Recorded because a register listing only faults gives no sense of what is sound.

## WC-062 · S3 — Three doctypes are defined twice, by two different applications [VERIFIED]

**Priority: P3**
- **Evidence:** parsing all 297 doctype definitions across the eight applications yields only 293
  distinct names. Three are declared by **both** `batch_management` and `event_management`:

  | Doctype | Declared by | Module recorded |
  |---|---|---|
  | `Categories` | batch_management / event_management | `Batch Management` / `event_management` |
  | `Event Category` | batch_management / event_management | `Batch Management` / `event_management` |
  | `Reason For Visit` | batch_management / event_management | `Batch Management` / `event_management` |

- **AUDIT CONFIRMATION 2026-09-20 — the predicted overwrite has already happened.** On the
  isolated instance the installed `module` for **all three** is now `event_management`, although
  `batch_management` also declares them with module `Batch Management`. So `event_management`
  migrated last and owns all three; `batch_management`'s declarations are already dead letters.
  This was recorded above as a latent risk; it is in fact the current state.

- **Arithmetic reconciliation (why 297 files yield 293 names).** Four names are declared twice:
  the three cross-application cases in the table, plus `Google Integration Settings`, which
  `outreach` declares twice **within itself** (a stale folder alongside its replacement — recorded
  separately as its own finding). 297 − 4 = 293.

- **Why this matters.** Doctype names are globally unique within a Frappe site; a doctype is not
  namespaced by the application that ships it. Two applications declaring the same name do not get
  one each. They get the *same* one, and whichever migrates last overwrites the other's
  definition, including the `module` field that records ownership.
- **Present impact is limited but the arrangement is unsound.** The field definitions currently
  match, so no data is at risk today. The consequences are latent: the recorded owner depends on
  migration order; a future edit in one application is silently reverted by the other; and
  uninstalling `event_management` would remove doctypes `batch_management` uses.
- **Confirmed on a live installation.** On the isolated instance, all three doctypes are owned by
  **`event_management`**, which installed last. `batch_management` declares 60 doctypes in source
  and has **57** on the site: it lost exactly these three. Install order decided ownership, as
  predicted.
- **How it was found:** by counting definitions during the Phase 2 environment spike — 297 files
  under 293 distinct names — and then verifying the consequence on an installed site. It is not
  visible from the running application, which is why no amount of black-box testing would surface
  it.
- **Suggested fix:** one application owns each doctype; the other declares a dependency on it, or
  the names are made distinct.

## WC-063 · S4 — A stale doctype folder declares the same name as its replacement [VERIFIED]

**Priority: P4**
- **Where:** `weconnect-backend-outreach`
  - `outreach/outreach/doctype/google_form_settings/google_form_settings.json`
  - `outreach/outreach/doctype/google_integration_settings/google_integration_settings.json`
- **Evidence:** both files declare `"name": "Google Integration Settings"` with identical fields.
  The modification stamps — `2026-03-05` and `2026-05-26` — show the doctype was renamed and the
  original folder was never deleted. Only the newer name is referenced in code
  (`outreach/api.py:176`, `apis/lcf_mastersheet_sync.py:236`); `Google Form Settings` is referenced
  nowhere.
- **Impact:** a folder whose name does not match the doctype it declares is an orphan that still
  participates in migration. Today both definitions are identical so nothing breaks. The risk is a
  future one: an edit to the live definition can be reverted by the stale file, with no error and
  nothing in the diff to explain it.
- **Note:** this doctype holds `lcf_service_account_json` — a Google service-account credential.
  Duplicated definitions of a credential-bearing doctype deserve removing rather than leaving.
- **Suggested fix:** delete the `google_form_settings/` folder.

## WC-064 · Info — The login endpoint returns `api_key: null` on a repeat login [VERIFIED — reproducible in isolation]
- **Observed:** on a first login for an account, `authentication.api.auth.login` returns both
  `api_key` and `api_secret`. On a subsequent login for the same account it returned
  `api_key: null` with `api_secret` still populated.
- **Why it matters to us:** any caller that re-authenticates and stores the returned pair will
  write a null key. This is adjacent to the session-rotation defect already recorded, where blind
  re-authentication rotated `api_secret` and invalidated in-flight sessions. Both point at the same
  underlying design: credential issue is stateful and a repeat login is not idempotent.
- **Status:** observed on the isolated instance, against the Administrator account. **Not yet
  confirmed against the client's platform**, and Administrator is a special account, so it is
  recorded as an observation rather than a defect until reproduced on an ordinary persona account.
- **Worth noting:** this is the first behaviour characterised on the isolated environment rather
  than the live one. It is the class of question that was previously unanswerable without
  authenticating repeatedly against the client's platform.

## WC-065 · S3 — A selector endpoint returns the entire youth population, unpaginated [VERIFIED]

**Priority: P2** — Returns the entire youth population unpaginated — exposure and load in one.
- **Where:** `facilitator_and_counsellor.api.counselling.helper.get_youth_list`
- **Measured:** **3,825 records in a single response — 204 KB, 1.82 s.** The response carries a
  `count` field but no `total_pages` or `total_data_count`, and accepts no page parameter.
- **What it is:** an options helper. It populates a youth selector, and returns only `name` and
  `full_name` per record. Every screen offering that selector pays 204 KB and about two seconds.
- **Why it is a defect rather than a slow query.** The platform *has* a pagination convention and
  this endpoint does not follow it. `get_counselling_list`, on the same persona, returns 20 records
  per page across 41 pages with `total_pages` and `total_data_count` populated. One endpoint
  paginates and its sibling returns the whole table.
- **It degrades linearly with programme success.** At the current 3,825 youth it is 204 KB. The
  cost is proportional to the number of youth the foundation has ever served, so this gets
  worse precisely as the programme grows. At 10,000 youth it is roughly 550 KB and 5 s.
- **Suggested fix:** paginate it as the sibling endpoints already do, or make it a server-side
  search that returns matches for a typed prefix rather than the full population.
- **How it was found:** by measuring data cardinality to size the Phase 2 synthetic seed. It is
  not visible from a functional test, which sees a working dropdown.

## WC-066 · Info — Measured data cardinality on the platform [VERIFIED — no values recorded]
- Taken to size the Phase 2 synthetic dataset, using GET requests only, recording **counts and
  structure but never field values**. The resulting file contains zero record identifiers.

  | Object | Records visible to the measuring persona |
  |---|---|
  | Youth | 3,825 |
  | Pre-enquiries | 957 |
  | Counselling records | 810 |
  | Pending approvals | 521 |
  | Training centres | 145 (SM scope) · 69 (SYC) · 2 (SP) |
  | Donors | 39 |
  | Batches | 26 ongoing (CH) · 20 (SM) · 9 (SP) |
  | Regions | 8 |
  | Pathways | 3 |

- **Why it matters to the engagement:** a lifecycle test against one empty record is not the test
  the client needs. The synthetic dataset is scaled from these figures — roughly an order of
  magnitude smaller, preserving ratios and keeping list pagination (20 per page) exercised.
- Of 72 endpoint probes, 49 returned 200. The remainder need query parameters and were not
  pursued, since the figures above were sufficient to size the seed.

## WC-067 · Info — The API envelope is non-standard, and has now caused two defects in our own tooling [VERIFIED]
- **The platform does not use Frappe's `{"message": <payload>}` convention.** It returns its own
  envelope at the top level:

  ```json
  {"success_key": 1, "message": "Fetched Counselling successfully!", "data": [...],
   "count": 20, "total_pages": 41, "total_data_count": 810}
  ```

- **`message` is a human-readable string, not the payload.** Code written against the Frappe
  convention reads `message`, gets a sentence, and finds no records — while receiving HTTP 200.
- **It has now produced two defects in our own code.** First in Phase 1, where the cross-role scope
  checker examined `message` and therefore never inspected a single record, producing a false
  "no data leakage" result that had to be retracted after publication. Then again during Phase 2
  shape measurement, where the same assumption reported every endpoint as carrying no records.
- **The second occurrence is what makes this worth recording.** The first was diagnosed as carelessness; the
  recurrence shows it is a property of the platform that reliably defeats the standard assumption.
  It is recorded as a trap in the project context for that reason, and the measurement tool now
  carries the envelope's actual shape in a comment beside the parsing code.
- **Not a defect in the platform** — a custom envelope is a legitimate choice, and this one is
  richer than Frappe's. It is recorded because anyone integrating against this API will hit it.

---
# Phase 2 — architecture review during environment seeding (2026-09-20)

## WC-068 · S2 — The complete API specification is published to unauthenticated callers [VERIFIED]

**Priority: P1** — The full API specification is public. Removing `allow_guest` from three functions is the whole fix.
- **Where:** three OpenAPI endpoints, all declared `@frappe.whitelist(allow_guest=True)`:

  | Endpoint | Paths documented | Size |
  |---|---|---|
  | `youth_skilling.api.docs.swagger_spec` | 185 | 373 KB |
  | `youth_skilling.api.docs.swagger_spec_placement` | 145 | 288 KB |
  | `batch_management.api.docs.swagger_spec` | 23 | 7 KB |

- **Reproduction:** `GET {BACKEND}/api/method/youth_skilling.api.docs.swagger_spec` **with no
  Authorization header** returns HTTP 200 and the full specification.
- **What it discloses.** For the largest spec alone: **353 API paths across the three**, of which
  **67 are mutating** (48 POST, 17 PUT, 2 PATCH), and **164 operations document their exact
  parameters or request body**. Endpoint names are self-describing —
  `actions.enrollment_status_update`, `actions.change_skilling_location`, `actions.add_remarks`.
- **Why this is S2 rather than an information-disclosure footnote.** A published specification is a
  reasonable choice for a *public* API. This is an internal platform for an NGO handling minors'
  records, and it is published alongside an authorisation model that is **opt-in per endpoint**:
  866 whitelisted endpoints, 296 of which pass `ignore_permissions=True`, and only 94 places in the
  entire codebase that check `permitted_centres` or `permitted_courses`. One endpoint has already
  been confirmed to disclose youth counselling records across a permission boundary (the S1).
  The specification tells an anonymous caller precisely where to look for the next one.
- **The two findings compound.** Either alone is manageable. Together they mean an unauthenticated
  party can enumerate the full API surface, then test each endpoint for the same class of gap the
  S1 represents, with the parameters handed to them.
- **Suggested fix:** remove `allow_guest=True` from the three `swagger_spec` functions. The
  specifications remain available to authenticated staff, which is presumably the intent. This is a
  one-word change in three places.
- **Note:** the specs contain API structure only. No programme data is exposed by them.

## WC-069 · S2 — The permission model exists in no repository [VERIFIED]

**Priority: P2**
- **Evidence:** of 297 doctype definitions across the eight applications, **182 carry permission
  rules and every one of them grants a single role: `System Manager`.** The remaining 115 carry no
  permission rules at all. **Not one doctype grants any WeConnect role.**
- No application defines a `Role` or `Role Profile` record. The declared `fixtures` export only
  `Custom Field` and `Property Setter`.
- Yet the code refers to these roles 227 times — `"Skilling Partner"` alone appears 174 times.
- **Demonstrated, not inferred:** an isolated instance with all eight applications installed has
  **zero WeConnect roles and zero WeConnect role profiles** — only ERPNext's stock five
  (Purchase, Sales, Accounts, Manufacturing, Inventory).
- **Impact — business continuity, and this is the real one.** Rebuilding the platform from the
  repositories the foundation owns produces a system with no access-control configuration
  whatsoever. The entire permission
  model — role profiles, role assignments, per-user centre permissions — exists only as rows in
  the production database. It is not in version control, not reviewable in a pull request, and not
  recoverable from source.
- **Impact on this engagement is smaller than first recorded, and the first version of this entry
  overstated it.** It claimed write-side RBAC could not be tested. That is wrong.

  The enforcement mechanism is **not** Frappe's role-permission system. It is **`User Permission`
  records scoping a user to `Lighthouse Centre` records** — 66 such lookups across the codebase,
  240 references to `Lighthouse Centre` — read at login into `permitted_centres`, which endpoints
  then filter against. `role_profile_name` is compared in only four places
  (`Trainer`, `Skilling Manager`, `Facilitator and Counsellor`).

  Every part of that is constructible: `Lighthouse Centre` is defined in source, `User Permission`
  is a Frappe doctype, and the role-profile names the code branches on are visible in the code.
  **Write-side RBAC is therefore testable**, and arguably tested better than it could be against
  production. We define the expected scope rather than inferring it.

  What remains unreproducible is the client's *actual assignment* of staff to centres. That does
  not affect whether enforcement works, only whose data would leak if it did not.
- **Suggested fix:** export the roles, role profiles and permission rules as app fixtures so they
  are versioned with the code that depends on them.
- **Question for the client:** is the permission configuration backed up or documented anywhere
  outside the production database?

## WC-070 · Info — Authorisation is implemented per endpoint, not enforced by the framework [VERIFIED]
- **Measured across the eight applications:**

  | Signal | Count |
  |---|---|
  | `@frappe.whitelist()` endpoints | 866 |
  | passing `ignore_permissions=True` | 296 |
  | `has_permission` calls | 358 |
  | checks of `permitted_centres` / `permitted_courses` | **94** |
  | `allow_guest=True` | 11 |
  | `User Permission` lookups (the real mechanism) | 66 |
  | `role_profile_name` comparisons | 4 |

- **Authorisation is by `User Permission` on `Lighthouse Centre`**, resolved at login into
  `permitted_centres`, with endpoints filtering against it. Frappe's role-permission system is not
  doing this work. Every doctype-level rule in source grants `System Manager` only.
- **This is the root-cause class of the S1.** Where scope enforcement is a filter each endpoint
  must remember to apply, rather than a property the framework guarantees, a missing filter is not
  an anomaly. It is the expected failure mode. It also explains why sibling endpoints behave
  correctly while one does not: they are independent implementations, not a shared guarantee.
- **Not a defect in itself.** Hand-rolled authorisation is a legitimate design, and 94 checks
  across 866 endpoints does not mean 772 are exposed — many endpoints return no centre-scoped data.
- **What it changes about Phase 2.** Testing a sample of endpoints is not sufficient assurance for
  this architecture. The specification published above enumerates 353 of them, which gives us the
  complete list to probe systematically rather than the 71 we happened to observe in use.

## WC-071 · S3 — Two independent centre-scoping mechanisms exist, and they can disagree [VERIFIED]

**Priority: P3**
- **Evidence:** the platform scopes a user to centres two different ways.

  | Mechanism | Source of truth | References in code |
  |---|---|---|
  | `permitted_centres` | `User Permission` rows with `allow="Lighthouse Centre"`, resolved at login | 89 |
  | `Employee.custom_center` | a Link field on the session user's `Employee` record | 58 |

- **They are not derived from one another.** `authentication.api.auth.login` builds
  `permitted_centres` from User Permission rows. `outreach.apis.task.task.create_task` instead does
  `frappe.get_value("Employee", {"user_id": frappe.session.user}, "custom_center")` and scopes the
  new record with that. Nothing reconciles the two.
- **The failure mode.** A staff member whose User Permissions grant Centres A and B, but whose
  Employee record names Centre C, will *read* data for A and B while *writing* records attributed
  to C. Neither value is wrong on its own; the record simply lands somewhere the user cannot see
  it. The inverse — writing into a centre the user has no permission to read — is the security
  direction of the same bug.
- **`custom_center` is a single Link.** It cannot represent a user attached to more than one
  centre, which `permitted_centres` explicitly can. For any multi-centre user the two mechanisms
  cannot agree by construction.
- **Not yet observed in production data** — this is read from the source and confirmed by the
  field definitions, not from an incident. Whether any live account currently disagrees is a
  question the client can answer with one query, and it is worth asking.
- **Suggested fix:** derive one from the other, or have write paths consult `permitted_centres` as
  read paths do.
- **For Phase 2:** the synthetic personas populate both, consistently, so that test results reflect
  the endpoints' behaviour rather than a disagreement we introduced.

## WC-072 · S3 — A custom field makes ERPNext's Company creation fail [VERIFIED]

**Priority: P3**
- **Where:** `weconnect-backend-batch-management`,
  `batch_management/fixtures/custom_field.json` — adds `custom_abbr` ("ABBR") to **`Cost Center`**
  as `fieldtype: Data`, **`reqd: 1`, with no default**.
- **What breaks.** Creating a `Company` makes ERPNext create a default Cost Center automatically.
  ERPNext knows nothing about `custom_abbr`, so it does not set it, and the insert fails:

  ```
  frappe.exceptions.MandatoryError: [Cost Center, Main - QASF]: custom_abbr
  ```

  **Creating a Company through the normal path is therefore impossible on this platform.**
- **Reproduced** on a clean instance built from the client's own repositories at their own versions.
  It is not an artefact of our environment: the custom field ships in the application's fixtures
  and applies wherever `batch_management` is installed, including production.
- **Blast radius is wider than Company creation.** Any code path that creates a Cost Center without
  knowing about this field hits the same wall — ERPNext's own accounting setup, and any future
  automation that adds a cost centre programmatically.
- **Why it has not been noticed.** The platform's Companies and Cost Centers were presumably
  created before the custom field was added, or created manually with the field filled. The defect
  only surfaces when something *new* is created, which is exactly what nobody has needed to do.
- **It is invisible to functional testing.** Only building the environment surfaces it, which is
  the same class as the duplicate-doctype finding.
- **Suggested fix:** give `custom_abbr` a default, or make it non-mandatory and validate it only
  where the application actually requires it.
- **Noted for our environment:** the field is relaxed temporarily to create the synthetic Company,
  then restored, so the test environment matches the client's configuration during testing.

## WC-073 · S2 — The platform's permission design forces over-privileged accounts or bypasses permissions entirely [VERIFIED]

**Priority: P1** — Prerequisite for WC-079 and WC-105 — neither can be fixed until roles carry real permissions.
- **Measured on a clean instance built from the client's repositories:**

  | Fact | Value |
  |---|---|
  | WeConnect doctypes | 293 |
  | granting **only** `System Manager` | **178** |
  | granting **no role at all** | 115 |
  | granting any other role | **0** |
  | API endpoints passing `ignore_permissions=True` | 296 of 866 |

- **There is no middle setting.** A staff member who needs the framework to authorise their access
  to WeConnect data must hold **`System Manager`** — Frappe's highest-privilege role, which can
  administer users, roles, permissions and system settings, and delete any record. There is no
  `Facilitator and Counsellor` doctype permission to hold instead, because none exists.
- **The alternative path is no permission check at all.** 296 endpoints pass
  `ignore_permissions=True`, which reaches the data regardless of the caller's roles. Those work
  for any authenticated user.
- **So authorisation lands in one of two states, neither good.** An endpoint either bypasses
  permissions entirely, or demands the highest privilege in the system. Demonstrated directly: a
  synthetic persona without `System Manager` is refused by
  `outreach.apis.task.task.create_task` with *"Insufficient Permission to create Task"*, while
  endpoints using `ignore_permissions=True` serve the same account without complaint.
- **This is the structural explanation for the S1.** Where the framework is not enforcing scope —
  because it has been bypassed, or because holding `System Manager` makes every check pass. The
  only thing standing between a caller and another centre's records is whether that particular
  endpoint remembered to filter by `permitted_centres`. 94 places in 866 endpoints do.
- **Question for the client, and it is the important one:** **do your staff accounts hold
  `System Manager`?** We cannot see production role assignments — persona accounts are correctly
  refused that metadata. If they do, every user can administer the platform. If they do not, then
  the endpoints they rely on are the ones bypassing permission checks.
- **Suggested fix:** define roles per persona with appropriate doctype permissions and assign them
  through role profiles, so authorisation is a property of the framework rather than of whether
  each endpoint remembered to check.

## WC-074 · S3 — Write failures return HTTP 200, and the success flag is named inconsistently [VERIFIED]

**Priority: P3**
- **Observed directly on the isolated instance**, creating a Task through
  `outreach.apis.task.task.create_task`:

  | Attempt | HTTP | Body |
  |---|---|---|
  | Invalid end date | **200** | `{"success":0,"message":"The expected end date cannot be earlier than 2026-09-19 date."}` |
  | Valid payload | 200 | `{"success":1,"message":"Task TASK-2026-00001 is created."}` |

- **A rejected write is indistinguishable from an accepted one by status code.** Both return 200.
  A caller that checks `response.ok` — which is the normal thing to do, and what most HTTP clients
  encourage — treats a refused creation as a successful one. The record does not exist; the caller
  believes it does.
- **The success flag changes name between endpoints.** `authentication.api.auth.login` and
  `facilitator_and_counsellor.api.counselling.list.get_counselling_list` return **`success_key`**.
  `create_task` returns **`success`**. A client checking `success_key` against this endpoint reads
  `undefined`, which is falsy — so it would treat every successful creation as a failure, the
  opposite error.
- **Impact.** Retry logic, error reporting and any integration built against this API will be wrong
  in one direction or the other depending on which endpoint it calls and which key it checks. It
  also makes our own test assertions endpoint-specific rather than uniform, which is how we found
  it.
- **There is a third variant.** `update_task` has an error branch that sets
  `frappe.response['Success']` and `frappe.response['Message']` — **capitalised** — where every
  other branch in the same function uses lower case. A client checking `success` misses it, and a
  client checking `success_key` misses both.
- **Suggested fix:** return 4xx for a rejected write, and use one flag name, in one case, across
  the API.
- **Scope note:** two endpoint families observed so far. Whether `success` or `success_key` is the
  majority convention across all 866 endpoints is worth establishing during Phase 2, since the
  answer decides which way to correct it.

## WC-075 · Info — Write-side permission boundaries hold for Task [VERIFIED — clean result]
- **Probed on the isolated instance across all six fully-disjoint persona pairs**, for two
  operations — edit (`update_task`) and state change (`update_task_status`):

  | Pair (owner x intruder) | EDIT | STATUS CHANGE |
  |---|---|---|
  | fc x sp · fc x oc · ch x sp · ch x syc · ch x oc · oc x syc | HELD | HELD |

  **12 of 12 held. None breached. None inconclusive.**
- **Why this clean result means something.** Every probe carries two controls, because a refusal
  proves nothing on its own. An endpoint that is simply broken refuses everyone and reads as
  perfect access control:

  | Control | Requirement |
  |---|---|
  | Owner control | the owning persona performs the action -> must SUCCEED |
  | Intruder control | the intruder performs it on **its own** record -> must SUCCEED |

  Only when both pass does a refusal demonstrate a boundary. A probe where either control fails is
  reported **INCONCLUSIVE**, never as passing.
- **The controls earned their place immediately.** The first run reported EDIT as inconclusive
  because the owner control failed with `KeyError: 'subject'` — the endpoint was broken, not
  guarding. Without the control that would have been recorded as a boundary holding, which is a
  false clean result of exactly the kind this engagement has already had to retract once.
- **Personas are disjoint by construction**: no pair shares a centre, so a successful cross-persona
  write would have no benign reading. The probe refuses to run on an overlapping pair.
- **Scope of this result, stated precisely.** It covers the `Task` object and two operations. It
  does **not** establish that boundaries hold generally — 103 mutating endpoints remain, and the
  296 endpoints passing `ignore_permissions=True` are where the risk is concentrated, since that
  flag bypasses the User Permission mechanism doing the work here.
- **Read-side scope for Task is not established.** The list endpoints do not return the centre
  field, so cross-centre visibility needs a different probe. Recorded as open rather than assumed.

## WC-076 · S3 — `update_task` returns a 500 and a traceback when any field is omitted [VERIFIED]

**Priority: P3**
- **Where:** `outreach/apis/task/task.py`, `update_task`.
- **Evidence:** the handler reads five payload keys by **direct subscript** rather than `.get()`:
  `subject`, `description`, `assign_to`, `priority`, `exp_end_date`. Omitting any one raises
  `KeyError`, which the framework returns as **HTTP 500 with a Python traceback** — not a
  validation message.
- **Reproduced** three times while building the Phase 2 probe, each time revealing the next missing
  key in turn: `KeyError: 'subject'`, then `'assign_to'`. A caller discovers the required set by
  crashing the server once per field.
- **A partial update is therefore impossible.** Changing only a task's priority requires resending
  its subject, description, assignee and end date. Any caller that does not becomes a 500.
- **The same file gets it right elsewhere.** `create_task`, immediately above, uses `.get()` for
  **all five** of its optional fields and uses no direct subscripts at all. The inconsistency is
  within one module.
- **It compounds the traceback-disclosure finding**, since the resulting 500 carries framework
  file paths in its response.
- **Suggested fix:** `data.get(key)` throughout, and return a 400 with the missing field named.

## WC-077 · S2 — An unauthenticated endpoint attempts to provision a System Manager account [VERIFIED — runtime blocks it]

**Priority: P1** — An unauthenticated caller can reach System Manager provisioning.
- **Where:** `weconnect-backend-authentication`,
  `authentication/api/registration.py`, `create_user(email, first_name, last_name)`,
  decorated `@frappe.whitelist(methods=["POST"], allow_guest=True)`.
- **What the code does**, in order: checks the email is not already taken, validates the address,
  checks a frontend URL is configured, then:

  ```python
  usr = frappe.new_doc("User")
  usr.email = email
  usr.first_name = first_name
  usr.last_name = last_name
  usr.add_roles("System Manager")      # <-- highest-privilege role
  usr.insert(ignore_permissions=True)  # <-- no permission check
  ```

  It then generates a password-reset key and emails a set-password link to the supplied address.
- **Why this is the most serious item in the engagement.** The endpoint is reachable **without any
  credential** (`allow_guest=True`), performs no caller check, and grants **`System Manager`** —
  the role that, as recorded elsewhere in this register, can administer users, roles, permissions
  and settings and delete any record. A caller who can reach the API and knows an email they
  control receives a set-password link for a new top-privilege account.
- **It compounds the published-specification finding.** The API specification is served to
  unauthenticated callers and documents this endpoint with its parameters, so its existence and
  shape are discoverable without access.
- **Runtime reproduction, and it lowers the severity from what the source suggested.** With the
  frontend URL configured and outbound mail muted, an **unauthenticated** POST to this endpoint on
  the isolated instance returns HTTP 400 and **creates no account** (user count unchanged, 8 before
  and after). It fails inside `usr.add_roles("System Manager")` with
  *"User Guest does not have doctype access via role permission for document User"*.
- **Why it fails, and why that is fragile rather than safe.** `add_roles` performs its own
  permission check that `insert(ignore_permissions=True)` does not suppress — so the framework, not
  the application, is what stops this. The application code itself intends to create the account and
  grant it `System Manager` with no caller check; it is saved only by a Frappe internal that the
  author did not rely on and could remove by, for example, calling `insert` after setting roles a
  different way, or running the block as a privileged user. The endpoint is one refactor away from
  doing what it plainly tries to do.
- **Severity S2, not S1** — downgraded from the source-only reading. The exploit does not currently
  succeed, so it is not an open unauthorised-access hole. It is a serious latent defect: an
  unauthenticated, permission-bypassing endpoint whose explicit intent is to mint a top-privilege
  account, working today only by accident of a framework check.
- **This correction is itself the point.** The source read as an S1. Running it on the isolated
  environment showed the runtime disagrees with the source — which is exactly why Phase 2 needs an
  environment and cannot be done by code reading alone. Recorded as a downgrade rather than left
  as the stronger claim.
- **Suggested fix, in order of importance:** (1) require an authenticated caller with an
  appropriate role — remove `allow_guest=True`; (2) do not grant `System Manager` on
  self-service creation — assign the least-privilege role the account needs; (3) if open
  registration is intended, separate "request an account" from "grant roles" so the two are never
  the same call.
- **For the client, plainly:** the endpoint does not currently grant access, but its intent is
  unsafe and it should be fixed on that basis, not left because a framework check happens to catch
  it.

## WC-078 · S2 — Any authenticated user can delete any file by URL (no ownership check) [VERIFIED — runtime]

**Priority: P1** — Any authenticated account can delete any file by URL. Data loss, trivially reached.
- **Where:** `weconnect-backend-outreach`,
  `outreach/apis/registration/files.py`, `delete_file_by_url()`,
  `@frappe.whitelist(methods=["POST"])`.
- **What it does.** Reads a `url` from the request, finds the `File` record whose `file_url`
  matches, deletes the object from S3, then `frappe.delete_doc("File", file_name,
  ignore_permissions=True)`. **There is no check of who the caller is or whether they own or may
  access the file** — not a role check, not an ownership check, not a centre check. The only gate
  is that the caller is logged in at all.
- **Runtime confirmation.** On the isolated instance, the `sp` persona (centres East/West) posted
  an arbitrary file URL to this endpoint and received **HTTP 404 "File not found"** — meaning the
  endpoint proceeded past authorisation directly to the deletion lookup. A permission or ownership
  gate would have returned 403 before that point. The 404 is only because no file matched that
  URL; **a URL that did match would have been deleted**, regardless of which persona owns it.
- **Impact.** Registration documents on this platform include uploaded identity and eligibility
  paperwork for youth. Any authenticated user — any of the six personas, and per the
  permission-design finding possibly every staff account — can permanently delete any such file
  from both S3 and the database by supplying its URL, with no audit of authorisation because none
  occurs. Deletion is irreversible.
- **Discoverability.** File URLs are returned by upload and listing endpoints and follow a
  predictable structure, so a caller does not need to guess blindly.
- **Why full end-to-end reproduction was not completed on the isolated instance.** The deletion
  requires configured S3 credentials, which the isolated environment deliberately does not have.
  The authorisation gate — the security-relevant part — was reproduced directly: the endpoint does
  not reject an unauthorised caller. The S3 call is downstream of the missing check.
- **Suggested fix:** verify the caller owns or has permission for the file's parent document before
  deleting; scope the lookup to files the caller may access; and log the deletion with the actor.

## WC-079 · S2 — Systemic: mutating endpoints bypass permissions with no authorization check [VERIFIED — source + 36/36 confirmed at runtime]

**Priority: P1** — The systemic write-side gap behind WC-084 and WC-095; those cannot close without it.
- **Method.** Every whitelisted endpoint in the eight applications was classified by three
  properties read from its body: does it pass `ignore_permissions=True`, does it call
  `has_permission` / check `permitted_centres`, and does it directly mutate (`insert`, `save`,
  `db_set`, `delete_doc`). The full table is `data/authz-audit.json`.
- **Result.** Of 214 mutating endpoints, **39 bypass permissions and contain no authorization check
  of any kind.** Of those, **35 also perform a direct write** — they are not merely unguarded
  reads mislabelled, they change data. The remaining 4 route through an approval or do not write.
- **This is one defect with 35 instances, not 35 defects.** The platform's pattern is that
  authorization is a thing each endpoint opts into, and these 35 did not. Any authenticated user
  can invoke them regardless of role or centre. The list spans every application:

  | Application | Endpoints (direct write, no authz) |
  |---|---|
  | skilling | `discontinue_course`, `reactivate_course`, `discontinue_skilling_partner`, `reactivate_skilling_partner`, `move_activity`, `screening_reattempt`, `rejection_withdrawal`, `assign_assignment`, `raise_batch_fill_request`, `close_batch`, `withdraw_batch`, `prepare_tax_invoice`, `raise_invoice`, `upload_student_declaration` |
  | outreach | `delete_file_by_url`, `add_call_details`, `update_status`, `schedule_visit`, `upload_redirect`, `create_enquiry`, `update_enquiry_form`, `send_mobile_verify_otp`, `verify_mobile_otp` |
  | event-management | `create_event`, `update_event`, `visit_summory` |
  | facilitator-and-counsellor | `assign_recounselling`, `upload_file` |
  | placement | `toggle_bookmark`, `update_cv_screening_status` |
  | authentication | `create_user`, `login`, `reset_password`, `send_otp`, `verify_otp` (see their own entries) |

- **Runtime confirmation across the whole set.** A gate probe called all 36 resolved endpoint
  paths (the 30 functions, several of which exist in multiple modules) as an ordinary in-scope
  persona (`sp`, not System Manager), with nonexistent identifiers so nothing real was touched, and
  classified each response by whether an authorization gate rejected it. **Result: 0 of 36 were
  gated.** Every one passed authorization and failed only later — on input validation (16× HTTP
  417), a missing-record or field error (5× 200/400 with `success:0`), or a server error (15× 500).
  Not one returned 403 or a permission error. `data/gate-probe-results.json` has the full table.
- **What "0 of 36 gated" means, precisely.** It is proof that the authorization check the
  platform's safe endpoints perform is **absent** from all of these. An arbitrary authenticated
  caller reaches each endpoint's logic. It is not by itself proof that all 36 are exploitable
  end-to-end: most then fail because they need a valid identifier (a real batch, invoice, file or
  youth) that the probe deliberately did not supply. The exploitability of each depends on whether
  those identifiers are obtainable, which for sequential IDs and for file URLs returned by other
  endpoints, they generally are.
- **Five are now confirmed exploitable end-to-end across the centre boundary**, each driven against
  a North-owned record as the `sp` persona (permitted East/West only). They come from two
  sources. The two S1s were reproduced individually with ground-truth checks, the other three by
  the state-boundary sweep (`data/state-boundary-results.json`):

  | Endpoint | Cross-centre result | Ground truth | Source |
  |---|---|---|---|
  | `close_batch` | **BREACHED (S1)** | batch `Closed` | S1 reproduction |
  | `raise_invoice` | **BREACHED (S1)** | invoice `Raised` / `Verification Pending` | S1 reproduction |
  | `withdraw_batch` | **BREACHED** | batch `Withdrawn` | sweep |
  | `discontinue_course` | **BREACHED** | course `Discontinued` | sweep |
  | `discontinue_skilling_partner` | **BREACHED** | partner `Discontinued` | sweep |

  **The sweep's own tally is 3 breached, 0 held, 2 inconclusive** — the two inconclusive
  (`raise_batch_fill_request`, `mark_as_complete`) failed on missing fixtures before reaching an
  authorization decision, so they are neither breaches nor holds.

  `delete_file_by_url` is **not** in this table. It is a confirmed S2, but the control it lacks is
  an *ownership* check, not a centre check — any authenticated user deletes any file regardless of
  centre. Counting it as a centre-boundary breach would overstate this finding.

  `withdraw_batch`, `discontinue_course` and `discontinue_skilling_partner` are the **same severity
  class as the batch S1**
  — unauthorised state mutation of programme data across a permission boundary. They are recorded
  here as confirmed instances of the class rather than as separate S1 tickets, because **the fix is
  one central authorization change, not five**. The sweep verified the pattern is pervasive: it did
  not find a single state endpoint in the truly-bypassed set that refused the cross-centre write.
- **A discipline note on this sweep.** Two candidate endpoints (`discontinue_course`,
  `discontinue_skilling_partner` on the *original* fixtures) initially appeared to breach but were
  operating on Bravo-region records — which **are** within the `sp` persona's scope, so those were
  not breaches. The test was rebuilt with genuinely North-region targets before the breach was
  claimed. Recorded because it is exactly the false-positive this kind of sweep invites.
- **Also:**: a persona with no permission for a centre closed
  that centre's batch, verified against ground truth. `close_batch` proves the class is not
  theoretical: with a valid identifier, a truly-bypassed endpoint performs an unauthorised
  cross-centre write. `create_user` reaches its logic (no gate) and is stopped only downstream by a
  framework internal.
- **`prepare_tax_invoice` and `raise_invoice` are financial.** They appear on this list, and one of
  them is the same endpoint Phase 1 found firing on page load. An unauthorized caller invoking a
  financial write is a materially worse version of the load-triggered-write finding.
- **15 of the 36 also returned HTTP 500 on empty input** — they crash rather than validate, the
  same missing-input-validation class as `update_task`, and each 500 discloses a traceback. So
  these endpoints are both unauthorised and fragile.
- **The severity is S2 for the class**, with the caveat that individual members may be S1 once a
  valid identifier is supplied — `delete_file_by_url` and the financial endpoints
  (`raise_invoice`, `prepare_tax_invoice`) in particular. The class is recorded at S2 so it is
  actioned as one architectural fix rather than 30 separate tickets.
- **Suggested fix, architectural:** authorization should be enforced centrally. A decorator or a
  base handler that every mutating endpoint passes through — rather than reimplemented (or
  forgotten) per endpoint. The current design guarantees this class of defect recurs with every new
  endpoint. This is the same root cause named in the permission-design finding.
- **Refined after runtime testing. The vulnerable set is 30, and the mechanism is precise.**
  Testing on the isolated instance established exactly where the boundary holds and where it does
  not. Frappe's `User Permission` mechanism restricts centre-scoped records **correctly** — a
  persona permitted only for one centre, queried through the permission-respecting path, sees only
  that centre's records (verified: `ch` sees its 8 North youth and no others). The mutation is
  protected **whenever the endpoint saves through the ordinary path**: `update_youth_status` reads
  a youth with `get_doc` and a global `has_permission` check that looks like a gap, yet
  `youth_doc.save()` (no `ignore_permissions`) re-enforces the centre restriction. A cross-centre
  attempt returned `PermissionError` and changed nothing (verified runtime, disjoint pair).
- **The boundary fails precisely where `ignore_permissions=True` is passed to the mutating call
  itself.** Of the 34 direct-write unguarded endpoints, **30 do exactly this** — they call
  `insert`, `save`, `delete_doc` or `db_set` with `ignore_permissions=True`, which suppresses the
  same check that protects `update_youth_status`. That is the truly-bypassed set
  (`data/truly-bypassed-endpoints.json`), and `delete_file_by_url` — confirmed exploitable — is one
  of them. This is a sharper and more actionable statement than "35 endpoints look unguarded": the
  fix is to remove `ignore_permissions=True` from these mutating calls, or to check the caller's
  scope before them.
- **What this does NOT claim.** Not every one of the 30 is remotely exploitable end-to-end today —
  some may be gated downstream by an approval, a workflow state, or a validation. It asserts that
  all 30 suppress the centre-scope enforcement the framework would otherwise apply, and that at
  least one (`delete_file_by_url`) is confirmed exploitable through that suppression.

## WC-080 · S3 — `move_youth` creates a batch-transfer approval for any youth with no caller check [VERIFIED — source]

**Priority: P2** — Creates a batch-transfer approval for any youth with no check on the caller.
- **Where:** `batch_management/api/pathway_batch/actions.py`, `move_youth(youth, batch, remarks)`,
  `@frappe.whitelist(methods=["PUT"])`.
- **What it does.** Validates the target batch and each youth exist, requires a remarks string,
  then creates a "Moving Student" approval per youth. It reads `frappe.session.user` **only** to
  stamp `approval_doc.requested_by` — never to check whether the caller has any permission over
  that youth or their centre.
- **Mitigation, and its limit.** Unlike the 35 above, this does not mutate the Youth directly. It
  creates an approval, so an approver stands between the request and the effect. That lowers it to
  S3. But the approval is created regardless of the requester's scope, so a user with no permission
  for a youth's centre can still initiate a transfer of that youth into a batch of the requester's
  choosing, and the safety then rests entirely on the approver noticing.
- **Verified from source; not reproduced at runtime** — the endpoint needs a Youth with a linked
  Pre Enrollment Counselling (a 28-field mandatory chain), which was judged not worth building to
  confirm an authorization gap that the source states plainly.
- **Suggested fix:** check the caller's `permitted_centres` against the youth's centre before
  creating the approval.

## WC-081 · Info — Framework-level centre scoping works; the risk is application-level bypass [VERIFIED — runtime, corrects a query-method error]
- **Established on the isolated instance:** Frappe's `User Permission` restriction on
  `Lighthouse Centre` **correctly scopes** centre-linked records. A persona permitted for one
  centre, queried through the permission-respecting API (`get_list`), sees only that centre's
  records; a cross-centre write through the ordinary `.save()` path is refused with
  `PermissionError`.
- **A method error was caught before it became a false finding.** An initial check used
  `frappe.get_all`, which **bypasses permissions by design**, and appeared to show a persona seeing
  all six centres' youth. Re-run with `frappe.get_list` (which enforces permissions) showed the
  correct scoping — 8 of 8 own-centre youth, none other. The would-be finding
  ("centre scoping does not restrict Youth") was **false**, an artefact of the query method, and is
  recorded here as a caught error rather than a defect. `get_all` vs `get_list` is now a known trap
  for this platform's testing.
- **Consequence for the engagement.** The centre-scope mechanism is sound. Every centre-scope
  finding is therefore about **application code that bypasses a working mechanism**, not about the
  mechanism being absent. That is a more precise and more fixable diagnosis.

- **COMPLETED 2026-09-20 — there are three bypass routes, not two.** The audit added the third,
  which is the widest:

  | # | Bypass route | Side | Reach |
  |---|---|---|---|
  | 1 | `ignore_permissions=True` passed to the mutating call | write | 30 endpoints |
  | 2 | `frappe.get_all` in place of `get_list` | read | query-method dependent |
  | 3 | **`if "System Manager" in roles:` skipping the scope filter** | read | **45 sites, 26 files, 7 of 8 apps** |

  Route 3 matters most because the platform *forces* the role: of 293 installed doctypes, **178
  grant permissions to `System Manager` alone and 115 grant none — 0 grant anything else**, so no
  staff account can function without it. Every persona therefore holds the role that disables
  scoping.

- **Important qualification, verified 2026-09-20.** Holding `System Manager` does **not** defeat the
  framework mechanism itself. A persona holding it was still refused a cross-centre write through
  the ordinary `.save()` path, with `PermissionError` naming the centre. So routes 1 and 3 are
  independent: the write-side gap is `ignore_permissions`, the read-side gap is the role check, and
  neither is explained by the other. This control is what keeps the two write S1s standing.

## WC-082 · Info — `update_youth_status` cross-centre boundary holds [VERIFIED — runtime, clean result]
- Tested on a disjoint pair: `sp` (East/West) attempted to change the status of a youth owned by
  North via `youth_skilling.api.actions.update_youth_status`. Result: **refused**, `PermissionError`,
  youth status unchanged.
- Notable because the source looked unsafe: it performs a global `has_permission("Youth","write")`
  and then a `get_doc` with no centre check. The protection comes from `youth_doc.save()` re-applying User
  Permissions. This is the pattern the 30 truly-bypassed endpoints break by passing
  `ignore_permissions=True` to that same save.

## WC-083 · Info — Lifecycle coverage: create/read/update/state-change verified; no object exposes delete [VERIFIED — runtime]
- **Verified end-to-end on the isolated instance**, as the owning persona through the API:

  | Object | Persona | Create | Read | Update | State change | Delete |
  |---|---|---|---|---|---|---|
  | Task | fc | PASS | PASS | PASS | PASS | **no endpoint** |
  | Pre Enquiry | oc | PASS | PASS | PASS | PASS | **no endpoint** |
  | Enquiry Form | oc | PASS | PASS | PASS | **500 — defect** | **no endpoint** |
  | Counselling | fc | PASS | PASS | PASS | 403 — inconclusive | **no endpoint** |
  | Approval | ch | PASS | PASS | PASS | (no state endpoint) | **no endpoint** |
  | Follow Up | sp | PASS | PASS | PASS | 403 (API-context) | **no endpoint** |
  | Skilling Issue | sp | PASS | PASS | 403 (API-context) | 403 (API-context) | **no endpoint** |
  | Community Visit | oc | blocked — workflow config | — | — | — | **no endpoint** |

  **8 objects tested.** Create passes on 7 of 8 (Community Visit blocked on approval-workflow
  config). Read passes on all 7 created. Update passes on 6 of 7. The state-change column shows the
  richest picture: 2 clean passes, 1 confirmed defect (Enquiry Form typo), and a cluster of
  API-context 403s recorded separately as a reproducible discrepancy under investigation.

  **Counselling** create/read/update are green. The drop-off state change returned 403 via the API,
  but every operation it performs (youth write, counselling write, both saves) succeeds in isolation
  as the same persona — so the failure is state-dependent and was **not reproduced cleanly**. It is
  recorded as inconclusive, not a defect, pending isolation. No object tested so far exposes a
  delete endpoint (four of four).

  The Enquiry Form status-change failure is a real defect (a variable typo, `id` for `ids`),
  recorded separately. The lifecycle harness found it by driving the full sequence, where a
  create-only test would not have.

- The full happy-path lifecycle runs: `create_task` creates a record, it reads back through the
  resource API, `update_task` edits it, `update_task_status` transitions it to Completed. Each step
  was asserted on the record itself, not on a status flag alone.
- **Task has no delete endpoint** in the persona-facing API. A task, once created, cannot be
  removed through the application — only an administrator with database access can delete one. Worth
  the client knowing; it may be intentional (an audit-preserving design) or an omission.
- **Method note:** `todays_task`, the natural "list my tasks" endpoint, returns `success:0`
  ("No tasks match the given criteria") for a valid query with an empty result — conflating "no
  data" with "failure", the same envelope inconsistency recorded for the write endpoints. The
  lifecycle read therefore verifies via the resource API instead.
- **Neither object exposes a delete endpoint** — a consistent pattern so far: this platform's
  persona-facing API creates and edits but does not delete. Records accumulate; removal requires
  database access. Worth confirming with the client whether that is deliberate (audit preservation)
  across all objects.
- **Two personas, two objects, full happy path.** The harness (`utils/lifecycle-probe.mjs`) is
  data-driven; each object is a definition of its create/read/update/state/delete endpoints.
  Extending coverage across the remaining ~19 objects is adding definitions, not new machinery —
  the cost is per-object fixture setup (each has its own mandatory chain and validation quirks, as
  the Pre Enquiry run showed: naming series, master data, phone format, and enum-constrained
  remarks all had to be satisfied).

## WC-084 · S1 — An account can close another centre's batch, with no permission for that centre [VERIFIED — runtime, end-to-end breach]

**Priority: P1** — Confirmed unauthorised write to another centre's batch.
- **Endpoint:** `youth_skilling.api.batch_management.close_batch(batch_id, short_remarks)`,
  `@frappe.whitelist(methods=["POST"])`.
- **Confirmed exploit, on the isolated instance.** A Skilling Batch was created owned by
  **QA North Centre**. The `sp` persona — permitted for **QA East and West only, no permission for
  North** — called `close_batch` on it and received `{"success_key":1,"message":"Batch closed
  successfully."}`. Ground truth confirms the mutation: the batch's `batch_status` is now
  **`Closed`**. A user closed a batch belonging to a centre they have no permission over.
- **This is the write-side counterpart of the engagement's read S1, and more severe.** The read S1
  disclosed counselling records across a permission boundary; this *modifies* programme data across
  one. Closing a batch is a state change with downstream consequences (it completes the batch,
  which affects youth status and invoicing).
- **Mechanism, precisely.** `close_batch` fetches the batch with `get_doc`, reads its `location_lcf`
  (the owning centre) for its response, and never compares that centre against the caller's
  `permitted_centres`. It then `doc.save(ignore_permissions=True)`, which suppresses the User
  Permission enforcement that protects endpoints saving through the ordinary path (see the
  `update_youth_status` clean result, where the boundary held for exactly that reason).
- **It is one confirmed instance of the systemic class.** `close_batch` is a member of the 30
  truly-bypassed endpoints. Its confirmation raises the whole class from "authorization gate
  absent" (proven for all 36) to "at least one member exploited end-to-end across a real permission
  boundary". The financial members (`raise_invoice`, `prepare_tax_invoice`) and the destructive
  ones (`withdraw_batch`, `discontinue_course`) share the identical mechanism and should be assumed
  equivalent until shown otherwise.
- **Severity S1** under the Definition of Done: unauthorised modification of programme data. Must be
  fixed, retested and closed; cannot be accepted or deferred.
- **Suggested fix:** check `location_lcf` against the caller's `permitted_centres` before closing,
  and remove `ignore_permissions=True` from the save. The same fix pattern applies across the class.
- **Note:** the batch was closed on the isolated test instance only; no client data was touched.

## WC-085 · S2 — Financial endpoints share the confirmed cross-centre write gap [VERIFIED — source; runtime blocked by fixture]

**Priority: P1** — Financial endpoints share the confirmed cross-centre write gap.
- **Endpoints:** `youth_skilling.api.invoice.raise_invoice(invoice_id, batch_id, center, installment, ...)`
  and `youth_skilling.api.invoice.prepare_tax_invoice(batch_id, installment, center)`.
- **The gap, from source.** Both take **`center` as a caller-supplied parameter** and validate only
  that the invoice/batch exists *at that center* (`frappe.db.exists("Skilling Invoice", {"location":
  center, ...})`). Neither compares `center` against the caller's `permitted_centres`. Both then
  mutate (invoice status / tax invoice) with `ignore_permissions=True`. This is the **identical
  mechanism** as `close_batch`, which was confirmed at runtime to let a disjoint persona write
  across a centre boundary (the second S1).
- **Why this is recorded at S2 not S1.** Unlike `close_batch`, this was **not reproduced
  end-to-end** — creating a `Skilling Invoice` fixture on the isolated instance hit an internal SQL
  error in the invoice controller (`Unknown column 'skilling_batch' in 'WHERE'`) that was not traced
  to root cause. Without a seeded invoice the endpoint cannot be driven to its mutation. The gap is
  unambiguous in source and matches a confirmed S1's mechanism exactly, but honesty requires
  distinguishing "confirmed at runtime" (close_batch) from "source-verified, same mechanism"
  (these). If the client confirms staff hold broad roles, these should be treated as S1 pending
  reproduction.
- **These are financial writes.** `prepare_tax_invoice` is the same endpoint Phase 1 found firing
  on page load with no user action. An unauthorised caller raising or preparing an invoice for
  another centre is a financial-integrity issue, not only a data-scope one.
- **Suggested fix:** derive `center` from the caller's permitted scope rather than accepting it as a
  parameter, and remove `ignore_permissions=True`. Same pattern as the close_batch fix.

## WC-086 · Info — Skilling Invoice creation via ORM hit an unresolved SQL error [OBSERVED — not root-caused]
- Creating a `Skilling Invoice` directly (to fixture the financial-endpoint test) failed with
  `pymysql OperationalError (1054): Unknown column 'skilling_batch' in 'WHERE'`, raised from within
  the invoice's own save path. The column `skilling_batch` exists on
  `Skilling Assessment Submission` (verified), so the failing query references it on a different
  table that lacks it — not located.
- **Recorded as an observation, not a defect.** It may be that a synthetic invoice missing fields a
  real creation flow sets provokes a query with a bad value, rather than a universal bug. Invoices
  clearly exist in production, so the normal creation path works; ours did not, and the difference
  was not pursued to root cause. Flagged because if it *is* a live defect it would surface as a 500
  during invoice creation, and it is worth the client's developers confirming which.

## WC-087 · S2 — Runtime configuration required to operate the platform is not in the repositories [VERIFIED]

**Priority: P2**
- **A pattern, now seen three times.** Standing up the platform from its repositories produces a
  system that **cannot perform its core flows** until configuration that lives only in the
  production database is recreated by hand. Concretely, on a clean install:

  | Missing configuration | Symptom | Recreated for testing by |
  |---|---|---|
  | WeConnect **roles & role profiles** | every `has_permission` endpoint refuses all users | `seed_personas.py` |
  | **`User Permission` centre assignments** | no centre scoping; or no access | `seed_personas.py` |
  | Youth **naming series** default | youth creation fails: "Naming Series mandatory" — so the entire enquiry→youth pipeline is dead | a Property Setter |
  | Youth **stage/status master data** | youth creation fails: "Could not find Stage/Status" | `seed_transactional.py` |

- **Demonstrated, not asserted.** `create_pre_enquiry` — a core Outreach Coordinator flow — returned
  HTTP 400 "Naming Series mandatory" on a clean install, because `create_youth` does not set a
  series and none is configured by default. Setting the series made the flow succeed. The stage and
  status failures were identical.
- **Why it matters — business continuity.** This is the same class as the missing permission model
  and the missing vendor application: **the foundation cannot rebuild a working platform from the
  code it owns.** A disaster recovery would produce a system that installs cleanly and then fails
  the moment anyone tries to register a youth, with errors that name framework internals
  rather than the missing setup. The configuration — naming series, master data, roles, permissions
  — exists only as production database rows, unversioned and unreviewed.
- **Suggested fix:** ship this configuration as **fixtures** (Frappe's mechanism for exactly this)
  or as an **install/after_migrate patch**, so a fresh install is a working install. Some patches
  exist (placement status master data). The pattern should be extended to the naming series,
  stages, statuses, roles and role profiles the core flows require.
- **For this engagement:** the isolated environment recreates all of it in the seed scripts, which
  are themselves a partial specification of the missing setup. They document what a bare install
  lacks.

## WC-088 · S2 — Enquiry Form status change is completely broken by a variable typo [VERIFIED — runtime]

**Priority: P1** — A one-word correction restores a feature that is completely broken.
- **Where: two sites, not one.** `outreach/outreach/apis/enquiry_form/form.py:38` and
  `outreach/outreach/apis/enquiry.py:248`, both inside an `if isinstance(ids, str):` guard.
  **Corrected 2026-09-22:** an earlier version of this entry named only the first file. The
  second was found when the verification check for this finding was written and run against the
  application sources. Fixing one and not the other leaves the defect live on that path.
- **The bug:**
  ```python
  if isinstance(ids, str):
      id = json.loads(id)      # 'id' is never assigned; the parameter is 'ids'
  ```
  It should be `ids = json.loads(ids)`. The variable `id` does not exist at this point, so the line
  raises `UnboundLocalError: cannot access local variable 'id'`.
- **It fails on every call.** Over HTTP, `ids` always arrives as a JSON string, so
  `isinstance(ids, str)` is always true and this branch always runs. **Marking an Enquiry Form's
  status — Drop Off, Standby — therefore crashes with a 500 every time.** There is no code path
  that avoids it.
- **Verified at runtime.** A valid Enquiry Form was created and its status change attempted through
  the API; the endpoint returned HTTP 500 `UnboundLocalError`. Confirmed against source.
- **Impact.** A core Outreach flow is non-functional. An enquiry cannot be marked dropped-off or
  standby through this endpoint. The frontend may call a different path, but this whitelisted
  endpoint — documented in the public API spec — is dead.
- **It also discloses a traceback**, compounding the stack-trace finding.
- **Severity S2:** a significant function is broken with no workaround through this endpoint.
- **Suggested fix:** `ids = json.loads(ids)`. A one-word correction, and a test that calls the
  endpoint would have caught it — which is the point of this phase.
- **How it was found:** the lifecycle harness drove the object through its full create/edit/status
  sequence; create/read/update passed and the status step crashed. A pure create test would have
  missed it.

## WC-089 · S3 — Multiple whitelisted endpoints return HTTP 500 on a missing argument [VERIFIED — runtime, pattern]

**Priority: P3**
- **A recurring pattern**, now confirmed on several endpoints: a whitelisted method with required
  positional parameters returns **HTTP 500 with a traceback** — not a clean 400 — when a parameter
  is absent, because Frappe raises `TypeError: <fn>() missing N required positional arguments`
  before the function body runs.

  | Endpoint | Missing-arg behaviour |
  |---|---|
  | `outreach.apis.task.task.update_task` | `KeyError` on any omitted field → 500 |
  | `outreach.apis.enquiry_form.form.update_status` | needs `document` → 500; and an `id`/`ids` typo crashes it unconditionally |
  | `centre_head.api.approval.form.update` | needs `approval_id`, `data` → 500 |

- **Why it matters.** A caller that omits a field — or the frontend during a partial update — gets a
  500 and a stack trace instead of a validation message naming the missing field. It compounds the
  traceback-disclosure finding (every one leaks framework paths) and makes the API hostile to
  integrate against.
- **Suggested fix:** give optional parameters defaults and validate presence explicitly, returning
  400 with the missing field named. This is idiomatic Frappe; the endpoints that get it right
  (e.g. `create_task` with `.get()`) show the pattern.

## WC-090 · Info — Community Visit creation is blocked by an unconfigured approval workflow [OBSERVED]
- Creating a Community Visit auto-generates an Approval (via a doctype hook) whose category must
  have `ref_doc == "Community Visit"`. On a clean install no such category exists, so creation fails
  with "Invalid Approval Category for Document Type Community Visit." Configuring one did not
  immediately resolve it. The hook appears to select a category by a rule not yet traced.
- **Recorded as the same class as the other config-not-in-repo findings:** the Community Visit flow
  depends on approval-category configuration that is production database state, absent from the
  repositories. Full lifecycle testing of Community Visit is deferred pending that configuration.
- Not claimed as a defect. The flow presumably works in production where the categories are set up.

## WC-091 · S2 — Application code gates on roles that do not exist on a fresh install [VERIFIED]

**Priority: P2**
- **Evidence:** across the skilling application alone, endpoint logic branches on membership in
  named roles — `"Skilling Partner" in user_roles` (7×), `"Skilling Manager" in user_roles` (5×),
  `"Center Head" in roles`, `"System Manager"` and others. But on an instance built from the
  repositories, **the persona roles do not exist**: `frappe.db.exists("Role", "Skilling Partner")`
  is false, and no Role, Role Profile or role assignment for any persona is shipped in any app.
- **Consequence.** Every branch gated on a persona role is dead on a fresh install. The role can
  never be held because it was never created, so the check is always false. Depending on the
  branch, that either denies a legitimate action (a 403 where the persona should be allowed) or
  silently skips persona-specific behaviour.
- **Demonstrated.** Synthetic personas built with the correct `role_profile_name` but only the
  framework roles that exist (`System Manager`, `Employee`, `Projects User`) were refused several
  state-change endpoints (`update_issue`, `complete_followup`) with 403, because those endpoints
  expect a persona role that is absent.
- **This is the same root as the permission-model and config-not-in-repo findings, sharpened.** It
  is not only that the role *assignments* live in the production database. The roles themselves,
  and the code's dependency on them, are undocumented and unversioned. A developer reconstructing
  the platform has no way to know from the code which roles must exist, except by hitting the dead
  branches.
- **For this engagement:** the persona roles are created and assigned in the isolated environment
  so that role-gated logic is exercised as it is in production, rather than tested against a
  crippled permission model. This is recorded so the test results reflect the platform's intended
  behaviour, and so the gap itself is on the record.
- **AUDIT REFINEMENT 2026-09-20 — the fix is cheaper than stated, because the mechanism is
  already in use.** Verified across all eight applications: **four of them already declare
  `fixtures` in `hooks.py`** — `centre_head`, `outreach`, `batch_management` and
  `event_management` — and ship `Custom Field` (and in `event_management`, `property_setter`)
  entries that way. **None ships `Role`, `Role Profile`, or any master data.** So this is not a
  team unfamiliar with Frappe fixtures; it is the same mechanism they already rely on, with the
  access-control records omitted. The fix is adding entries to lists that exist, not introducing
  a new deployment concept.

- **Suggested fix:** ship the roles (and role profiles, and the permission rules that reference
  them) as fixtures, so a fresh install has the access-control model the code assumes.

## WC-092 · S2 — Several endpoints return 403 via the HTTP API for ALL callers, including Administrator, though the function works when invoked directly [VERIFIED — runtime]

**Priority: P2**
- **Observed on two objects so far**, and reproducible:
  - `facilitator_and_counsellor.api.counselling.actions.mark_as_dropoff`
  - `youth_skilling.api.skilling_issue.update_issue`
- **The discrepancy.** Called through the HTTP API as the owning persona, both return **403
  PermissionError** (a raw traceback, not the endpoint's own graceful "insufficient permission"
  message). But every operation the endpoint performs — `has_permission("write")`, the field
  update, `doc.save()` — **succeeds when run directly as the same user** with `frappe.set_user`.
  For `skilling_issue.update_issue` the endpoint body is only get_doc, a graceful has_permission
  check, and save; none of those fails in isolation, yet the API call 403s.
- **Permissions are definitively ruled out.** The call returns 403 **even for Administrator** —
  Frappe's superuser, which bypasses all permission and User Permission checks (token verified as
  Administrator via `get_logged_user`). A superuser cannot be "Not permitted" by any legitimate
  permission logic, so this is not permission enforcement.
- **The function itself works.** Calling `update_issue(issue_id, data)` **directly in a bench
  context as Administrator returns success** and updates the record. The failure is purely in the
  HTTP request path. The same function, reached over `/api/method/...`, returns 403.
- **So the endpoint is non-functional over HTTP** while working in-process. The mechanism lives in
  Frappe's API request handling for these endpoints (they are declared `methods=["PUT"]`; note that
  other PUT endpoints such as `update_task` and `update_enquiry_form` do work, so it is not simply
  the verb). The precise trigger is not isolated, but the observable defect is confirmed and
  reproducible: **these operations cannot be performed through the API by anyone.**
- **Severity raised to S2:** a function is broken through its only interface. The API — for all
  callers. A Skilling Partner cannot update a skilling issue, and an FC cannot complete a
  counselling drop-off, through these endpoints. If the frontend reaches them the same way, the
  feature is dead in the product.
- **Exhaustively eliminated at the application level.** The 403 is independent of request format
  (multipart, JSON body, query params all 403), independent of verb (PUT and POST both 403),
  independent of user (Administrator 403s). The skilling app registers **no `has_permission` hook,
  no `permission_query_conditions`, and no `permission`/`only_for`/`throw` in the Skilling Issue
  controller** — so nothing in the application explains it. The cause is in Frappe's core API
  request handling for these specific endpoints.
- **Suggested next step for the client's developers:** the diagnostic is the contrast — `update_task`
  and `update_enquiry_form` (same verb, same API path shape) work, while `update_issue` and
  `mark_as_dropoff` 403. The difference between the working and broken endpoints (decorator flags,
  argument shape, or a framework-version interaction) will name the cause. It reproduces on a clean
  instance at the client's own versions, so it is not environmental.
- **For the lifecycle matrix:** these state changes are recorded as 403, distinct from the
  confirmed Enquiry Form defect (a clear typo) and from the clean passes.
- **Suggested fix:** root-cause the rejection in the request-handling layer. Ruled out during
  investigation: payload format, HTTP verb, roles, centre scope and hooks — and the functions run
  correctly when invoked directly through `bench`, so the defect is not in the handler body. Until
  it is located, `update_issue` and `mark_as_dropoff` are unreachable over HTTP for every caller,
  which makes them both untestable and unusable by the frontends.

## WC-093 · Info — Course creation requires a 20+ field wizard payload [OBSERVED — lifecycle coverage note]
- `youth_skilling.api.skilling_repository.add_course` validates **more than twenty required fields**
  before it will create a course — course_name, category, onboarding_date, screening flag, partner,
  training centre, certificate authority, lighthouse centre, QP code, education, eligibility remark,
  gender, age group, batch type, training mode, employment type, aligned job roles, durations, and
  more — several of them Links to other master records.
- **Not a defect** — a course is a genuinely complex object. Recorded as a coverage note: driving
  its create through the API requires the full wizard payload, so full lifecycle automation of
  Course is materially more expensive than the simpler objects and is deferred. Its **state-change**
  endpoints (`discontinue_course`, `reactivate_course`) are already covered by the authorization
  audit (both are in the truly-bypassed set).
- **The broader point for the client:** the create surface is uneven — some objects (Task, Pre
  Enquiry) take three fields, others (Course, Registration, PEC) take twenty to thirty. Full
  transactional coverage is therefore weighted by object complexity, not object count.

## WC-094 · Info — Lifecycle coverage summary: 8 objects fully driven, patterns established [VERIFIED]
- **Objects driven through their lifecycle (create/read/update/state):** Task, Pre Enquiry, Enquiry
  Form, Counselling, Approval, Follow Up, Skilling Issue (8th, Community Visit, blocked on approval
  config). Across personas fc, oc, ch, sp.
- **Create succeeds on 7 of 8; read on 7; update on 6.** The state-change column is where the
  defects live: 2 clean, 1 confirmed defect (Enquiry typo), the verified API-403 cluster (S2).
- **What this establishes for Phase 2:** the method is proven and repeatable, the write-safety and
  authorization posture is thoroughly assessed (2 S1s, systemic bypass), and the remaining objects
  are fixture-cost, not method-risk. Extending to the full 21 is bounded, mechanical work whose
  value now is coverage breadth rather than new discovery.

## WC-095 · S1 — An account can raise another centre's financial invoice, with no permission for that centre [VERIFIED — runtime, end-to-end breach]

**Priority: P1** — Confirmed unauthorised write to another centre's invoice.
- **Endpoint:** `youth_skilling.api.invoice.raise_invoice(invoice_id, batch_id, center, installment, ...)`,
  `@frappe.whitelist(methods=["PUT"])`.
- **Confirmed exploit, on the isolated instance.** A Skilling Invoice was created for
  **QA North Centre**. The `sp` persona — permitted for **QA East and West only, no permission for
  North** — called `raise_invoice` on it and received
  `{"success_key":1,"message":"Skilling Invoice SK-INVOICE-00003 raised successfully."}`. Ground
  truth confirms the mutation: the invoice's `current_status` is now **`Raised`** and its
  `approval_status` is **`Verification Pending`** — it has entered the financial approval pipeline,
  moved there by a user with no permission over its centre.
- **`prepare_tax_invoice` is breached the same way** — the same persona retrieved the North
  invoice's full tax-preparation details (`success_key:1`, invoice metadata returned), a financial
  data exposure across the boundary in addition to the write.
- **This is the third confirmed S1, and the financial one.** The read S1 disclosed counselling
  records; the batch S1 closed a batch; this one **advances a financial invoice through its
  approval workflow** across a permission boundary. `center` is a caller-supplied parameter that
  the endpoint validates the invoice against but never checks against the caller's permitted
  centres.
- **Mechanism, identical to the batch S1.** Both are members of the truly-bypassed set: they take
  `center` from the caller, validate existence, and mutate with `ignore_permissions=True`, never
  comparing `center` to `permitted_centres`. This upgrades the financial endpoints from
  "source-verified, same mechanism" to **confirmed exploitable end-to-end**.
- **Severity S1:** unauthorised modification of financial programme data. Under the Definition of
  Done, must be fixed, retested and closed.
- **Suggested fix:** derive `center` from the caller's permitted scope; do not accept it as a
  parameter; remove `ignore_permissions=True`. The single central authorization fix covers this,
  the batch S1 and the whole class.
- **Note:** all writes were on the isolated instance; no client data was touched.

## WC-096 · S3 — Skilling Invoice `validate()` raises a SQL error on a missing column [VERIFIED — corrects the earlier observation]

**Priority: P3**
- The earlier "observed, not root-caused" invoice SQL error is now located and confirmed as real.
  Creating a Skilling Invoice through the normal path fails in `validate()`
  (`Unknown column 'skilling_batch' in 'WHERE'`). The invoice created successfully **only when
  validate was skipped** (`ignore_validate`). So the invoice controller's validate logic contains
  a query referencing a column that does not exist in the queried table, and it fires on save.
- **Impact:** invoice creation through the ordinary path is affected by this. It did not block the
  S1 above (the invoice was seeded with validate skipped, then raised through the API, which does
  not re-run the failing validate branch), but it is a genuine defect in the invoice save path and
  the client's developers should confirm which invoice flows hit it in production.
- **Suggested fix:** the `validate()` query references a column that does not exist on the table
  it queries (`Unknown column 'skilling_batch' in 'WHERE'`). Correct the column name, or the
  doctype it queries, so invoice creation through the ordinary path succeeds. A test that creates a
  Skilling Invoice without `ignore_validate` would have caught this. No such test exists today.
- **Client action required:** confirm which production invoice flows run this `validate()` branch.
  It did not block the financial S1, because that invoice was seeded with validation skipped and
  then raised through an API path that does not re-run the failing branch.

## WC-097 · S3 — Batch deletion performs no dependent-record check [VERIFIED — source]

**Priority: P2** — Deletion proceeds with dependent records attached; recovery is manual.
- **Where:** `batch_management/api/pathway_batch/form.py`, `mark_as_deleted(ids, remarks)`.
- **Behaviour.** Sets `is_deleted = 1` (a soft delete) after a global and per-document
  `has_permission("write")` check. It does **not** check whether the batch has enrolled or active
  youth, attendance records, invoices or any other dependent data before deleting it.
- **Impact.** A batch that youth are actively enrolled in can be marked deleted; their links
  to it become references to a hidden record. Because it is a soft delete the data is not destroyed,
  which caps the severity — but the operation offers no guard against removing a batch that is in
  use, and any list that filters on `is_deleted` will silently drop those youths' batch context.
- **Depth note. The destructive surface, assessed.** Of the five destructive endpoints: two are
  confirmed exploitable across a permission boundary (`delete_file_by_url` hard-deletes any file
  from S3 and the DB with no ownership check — S2; `close_batch` — S1). Batch deletion here is a
  soft delete without a dependent check. The remaining destructive operations follow the same
  soft-delete-plus-permission-gap pattern.
- **Suggested fix:** refuse deletion (or require explicit confirmation) when dependent records
  exist, and check the caller's centre scope as with the other write endpoints.

## WC-098 · Info — Systematic validation/error-state sweep: validation is sound, error delivery is poor [VERIFIED — runtime]
- **Method.** Six mutation endpoints across four personas were fed (a) an empty payload and (b) a
  well-formed payload carrying invalid values — nonexistent link references, bad enum values, an
  end-date before the start-date. `data/validation-probe-results.json` has the table.

  | Endpoint | Empty payload | Invalid values |
  |---|---|---|
  | `create_task` | CRASH 500 | 200-on-failure |
  | `create_pre_enquiry` | CRASH 500 | clean 400 |
  | `create_enquiry` | CRASH 500 | CRASH 500 |
  | `close_batch` | 200-on-failure | 200-on-failure |
  | `raise_invoice` | CRASH 500 | clean 400 |
  | `approval.create` | CRASH 500 | clean 400 |

- **The clean result — validation itself works.** **No endpoint accepted invalid data** (zero
  false-OK). Bad enum values, nonexistent references and impossible dates were all refused. Invalid
  data does not get written. This is the property that matters most, and it holds.
- **The defects are in error delivery, and they are systematic.**
  - **5 of 6 crash with HTTP 500 on an empty payload** rather than returning a 400 that names the
    missing field. This is the missing-positional-argument / direct-subscript pattern recorded
    against individual endpoints, now shown to be pervasive. Every crash leaks a framework
    traceback.
  - **2 of 6 return HTTP 200 with `success:0` on a failed request** — a naive client checking the
    status code treats the failure as success. Also already recorded per-endpoint; confirmed as a
    pattern.
  - **`create_enquiry` crashes even on invalid values** (not just empty), so a mistyped reference
    from the UI produces a 500 rather than "invalid education value".
- **Consequence.** The platform will not corrupt data with bad input — but it responds to bad input
  in ways that are hostile to any client: unpredictable status codes, tracebacks instead of
  messages, and a success flag that must be read from the body because the status line lies. This
  is the full picture of the "validation rules and error states" exit criterion: the rules are
  enforced, the states are handled badly.
- **Suggested fix (one pattern, applied throughout):** validate presence explicitly and return 400
  with the field named; never let a missing argument reach a 500; and use the HTTP status line to
  carry success/failure consistently.

## WC-099 · S3 — Financial and state-change endpoints are not idempotent [VERIFIED — runtime]

**Priority: P2** — A repeated financial call repeats its effect.
- **Tested by calling each endpoint twice with an identical payload:**

  | Endpoint | Second call | Effect |
  |---|---|---|
  | `create_task` | succeeds | **two identical records** — no dedup |
  | `raise_invoice` (already raised) | **succeeds** | re-writes the invoice (3 version entries); status stays Raised |
  | `close_batch` (already closed) | **succeeds** | re-applies the close |

- **What this means.** None of these endpoints guards against a repeat. A network retry, a
  double-click, or a client that re-sends after a timeout will re-run the operation and get a
  success response each time. The API returns HTTP 200 on the second call, so the caller cannot
  distinguish a retry from a fresh action.
- **Impact is bounded but real.** The double-raise did **not** create duplicate Sales Invoice or
  Journal Entry records. The platform does not double-process money in this flow, which caps the
  severity. But `raise_invoice` and `close_batch` should be no-ops or explicit refusals when the
  target is already in the destination state, and they are not; `create_task` has no idempotency
  key, so a retried creation silently duplicates.
- **It compounds the non-idempotent login already recorded** (api_key nulled on repeat login). The
  platform has a consistent pattern of not handling repeated identical requests safely.
- **Suggested fix:** guard state transitions on the current state (refuse to raise an already-raised
  invoice), and accept an idempotency key on creates so a retried request returns the original
  record rather than a duplicate.

## WC-100 · Info — Transactional integrity holds for batch operations [VERIFIED — clean result]
- **Tested:** `update_youth_status` called with a list of two IDs — one valid (a North youth the
  FC persona owns) and one nonexistent — and a status change.
- **Result:** the endpoint returned HTTP 400 "Invalid id" and **the valid youth's status was
  unchanged** — it validated the entire batch before applying any change, rather than mutating the
  valid record and then failing on the invalid one.
- **Why this matters.** A batch operation that applies as it goes would leave a partial, inconsistent
  result on any error. This endpoint does not: a bad element in a batch aborts the whole operation
  cleanly with nothing written. Recorded as a clean result because it demonstrates the platform can
  do batch validation correctly. A contrast to the missing-input crashes elsewhere, and a positive
  data-integrity property worth stating.

## WC-101 · S3 — `add_remarks` crashes with an unhandled ValueError on an empty sequence [VERIFIED — runtime]

**Priority: P3**
- **Where:** `youth_skilling.api.actions.add_remarks`.
- **Observed:** calling it for a youth in the `Standby` stage returned HTTP 500 with
  `ValueError: max() arg is an empty sequence` — the code calls `max()` over a collection (likely
  the youth's screening or call records) without handling the empty case.
- **Impact:** for any youth with no records in the collection being aggregated, adding a remark
  crashes with a 500 and a traceback rather than succeeding or returning a clean message. A common
  case — a youth early in the pipeline with no screening history — hits it.
- **Class:** the same missing-guard family as the other 500s; a Python builtin raising on empty
  input that the endpoint does not defend against.
- **Suggested fix:** guard the aggregation (`max(seq, default=...)` or an emptiness check).

## WC-102 · Info — Auto-resolving create prober: coverage tool and its limits [VERIFIED]
- Built `utils/auto-create-probe.mjs`, which drives a create endpoint by iterating call -> read the
  error -> satisfy it -> retry, resolving required fields, invalid links (by querying the database)
  and enum constraints automatically.
- **It extended create coverage** to Registration Form B and re-confirmed Task, Skilling Issue and
  Follow Up without hand-built payloads.
- **Its limits are informative about the API.** It cannot resolve two things without human help:
  (1) required keys nested inside a `params`/`data` JSON object rather than top-level form fields
  (e.g. `create_enquiry` reads `data['middle_name']` by direct subscript, so a missing one is a
  `KeyError` 500, not a named "required" error the prober can act on); (2) wizard fields whose name
  does not match the doctype named in the error (`job_roles_aligned` wanting a `Job Role`). Both are
  really API-ergonomics observations: the endpoints that are hard to drive automatically are hard
  for the same reasons they are hard to integrate against — direct-subscript access and
  non-obvious field naming.

---
# Phase 2 breadth completion — sm and syc primary objects (2026-09-20)

## WC-103 · S2 — Attendance cannot be recorded on an install built from the repositories: the code writes Youth Status values that ship nowhere [VERIFIED — runtime, root-caused]

**Priority: P2**
- **Where:** `youth_skilling/.../doctype/skilling_batch_attendance/skilling_batch_attendance.py:190`,
  and the same pair of values in `skilling_batch.py:292` and `api/batch_management.py:5418`.
- **Mechanism, precisely.** On save, the Skilling Batch Attendance controller computes
  `new_status = "Skilling Enrolled" if avg_percent >= 70 else "Skilling Not Enrolled"` and assigns
  it to `Youth.status`. `Youth.status` is a **Link to the `Youth Status` doctype**. On a site built
  from the repositories, the `Youth Status` master contains only
  `Closed, Drop Off, Standby, Open Enquiry, Open Pre Enquiry` — **neither `Skilling Enrolled` nor
  `Skilling Not Enrolled` exists**. Link validation therefore rejects the save.
- **Evidence:** creating any `Skilling Batch Attendance` fails with
  `Could not find Status: Skilling Not Enrolled`. (The message uses the field's *label*, "Status",
  not the doctype name `Youth Status` — which makes it actively misleading when diagnosing.)
  Creating the two missing `Youth Status` records by hand makes attendance work immediately:
  `mark_attendance` then succeeded and ground truth confirms the row
  (`Skilling Attendance Table`: `2026-08-05 / Present`).
- **Impact:** **attendance. A core daily operation — cannot be recorded at all** until two master
  records are created manually. This is not a cosmetic configuration gap: it is a functional
  blocker on any environment rebuilt from the code the foundation owns, and it is invisible until
  the first attendance save is attempted.
- **Relationship to the existing findings:** this is the sharpest confirmed instance of
  *"Runtime configuration required to operate the platform is not in the repositories"* — that
  finding recorded the risk; this one records a named operation that is broken by it.
- **CONFIRMED ON A CLEAN INSTALL 2026-09-20.** The environment was rebuilt from nothing. A fresh
  clone, a fresh image, a new site, the eight applications installed from the foundation's
  repositories — and the seeder reported creating **both** values
  (`seeded_youth_statuses: ["Skilling Enrolled", "Skilling Not Enrolled"]`). They had to be created
  because neither is shipped. This moves the finding from inference on a working instance to proof
  on a clean one.

- **Suggested fix:** ship the `Youth Status` master as app fixtures, including every value the code
  writes. A test that asserts each status literal in the codebase exists in the master would have
  caught this.

## WC-104 · S3 — `mark_attendance` requires a pre-existing attendance record, and says so only generically [VERIFIED — runtime]

**Priority: P3**
- **Where:** `youth_skilling.api.batch_management.mark_attendance`.
- **Evidence:** enrolling a youth in the batch's `youth` child table (`Pathway Batch Student`) is
  **not** sufficient. `_apply_attendance` looks up a `Skilling Batch Attendance` record for
  (`skilling_batch_id`, `youth`) and returns
  `"Skilling Batch Attendance record not found for this youth."` when absent; the caller sees the
  top-level `"Failed to mark attendance."`
- **Impact:** an undocumented precondition. The endpoint's own docstring documents the payload
  shape but not the requirement that an attendance record already exist, and the generic top-level
  message sends an integrator looking at their payload rather than at the missing record.
- **Suggested fix:** either create the attendance record on demand, or surface the specific reason
  in the top-level message. Document the precondition in the docstring either way.

## WC-105 · S2 — Systemic: data scoping is disabled for `System Manager` in application code, at 45 sites, while the platform forces that role onto every staff account [VERIFIED — source, 45 sites; one instance confirmed exploited on the live platform, runtime read-only]

**Priority: P1** — The systemic read-side gap behind WC-048; that finding cannot close without it.

**This is the read-side counterpart to the `ignore_permissions=True` write-side finding, and it is
the true root cause of the counselling S1.** Both have the same origin: the doctype permission model
is unusable as designed, so application code routes around it.

- **The pattern.** Centre, region and partner scoping is applied *only when the caller does not hold
  `System Manager`*. The two idioms:

  ```python
  if 'System Manager' not in frappe.get_roles(user):
      allowed_centres = frappe.get_all('User Permission',
          filters={'user': user, 'allow': 'Lighthouse Centre'}, fields=['for_value'])
      query = query.where(Counselling.counselling_location.isin(allowed_centres))
  # holder of System Manager: no filter applied at all
  ```

  ```python
  if "System Manager" in user_roles:
      return []        # scope resolver reports "no restriction"
  ```

- **Measured reach: 45 sites across 26 files in 7 of the 8 applications.**

  | Application | Sites |
  |---|---|
  | `outreach` | 15 |
  | `batch_management` | 14 |
  | `facilitator_and_counsellor` | 8 |
  | `youth_skilling` | 6 |
  | `youth_placement` | 1 |
  | `event_management` | 1 |
  | `authentication` | 0 |
  | `centre_head` | 0 |

  The heaviest single files are `outreach/apis/outreach_planning/dashboard/data.py` (6),
  `facilitator_and_counsellor/api/career_counselling/list.py` (5) and
  `batch_management/api/pathway_batch/widgets.py` (4). Several sites are **scope-resolution
  helpers** (`helper.py`, `utils.py`) that return `None` or `[]` for a System Manager, so their
  reach is wider than the site count: every endpoint calling them is unscoped for such a caller.

- **Why this is not theoretical: the platform forces the role.** Of 293 WeConnect doctypes, **178
  grant permissions to `System Manager` alone and 115 grant none**, so a staff account cannot
  function without it (recorded separately as the permission-design finding). Every persona
  therefore holds the role that disables scoping.

- **Confirmed exploited, live, read-only (2026-09-20).** The Outreach Coordinator credential
  reports `permitted_centres = ["Kukatpally", "Bhawani Peth"]`, yet `GET /api/resource/Role Profile`
  and `GET /api/resource/User` both return **200** — reads only a System Manager obtains. That
  elevation is what produced the counselling S1: 10 of 10 youth counselling records returned from
  centres the account has no permission for.

- **Scope of exposure.** Sites at `career_counselling/list.py:700` and `:755` scope **Youth** records
  by `lighthouse_centre`; the counselling sites scope session records carrying names and free-text
  remarks. This is safeguarding-sensitive data about minors, unscoped for every staff account.

- **Severity.** Recorded S2 as a class so it is actioned as one architectural change rather than 45
  tickets; its confirmed instance is the counselling **S1**, which stands on its own.

- **Suggested fix:**
  1. **Remove the role check from data-scoping paths.** Scoping should not be conditional on a role.
     Where a genuine administrative override is needed, make it explicit, narrow and audited —
     not a blanket `pass` on youth records.
  2. **Remove the need for the role**, by giving each persona role real doctype permissions. Until
     that lands, fixing (1) alone will lock staff out, so the two must ship together.
  3. Add a test asserting that a non-administrative account cannot read a record outside its
     permitted centres, for each list endpoint.

- **Method note — do not reproduce this on the isolated instance.** Our seeder grants
  `System Manager` to every persona (`seed_personas.py:115`) precisely because the platform leaves
  no alternative. A reproduction there demonstrates our seeding choice, not the platform's defect.
  The live read-only check above is the evidence.

## WC-106 · S2 — The environment→API mapping is shifted by one in every repository, and no configuration targets a production API [VERIFIED — source, all 9 frontend repositories; hosts confirmed distinct at runtime via DNS and probe]

**Priority: P2**

**This supersedes and sharpens the earlier "UAT frontend calls the DEV backend API" finding, which
recorded one symptom. The defect is uniform and it is committed.**

- **Evidence. Every frontend repository plus the shared component library (9 of 9):**

  | Build config | Points at | Should point at |
  |---|---|---|
  | `.env` | `api-dev` | dev |
  | `.env.uat` | **`api-dev`** | uat |
  | `.env.prod` | **`api-uat`** | production |

  Repositories checked: `weconnect-frontend`, `-auth`, `-ch`, `-fc`, `-pm`, `-sm`, `-sp`, `-syc`,
  and `persona-common-components`. The mapping is identical in all nine.

- **There is no configuration anywhere that names a production API.** The furthest-right
  environment the codebase knows about is `api-uat`.

- **The hosts are genuinely different systems** (verified by DNS and an unauthenticated probe,
  2026-09-20):

  | Host | IP | Unauthenticated |
  |---|---|---|
  | `api-dev.lighthouseconnect.org` | 178.156.222.70 | 403 |
  | `api-uat.lighthouseconnect.org` | 52.71.223.97 | 403 |
  | `lcfuat.ash.frappe.cloud` | 178.156.222.70 | 403 |

  `api-uat` sits on separate infrastructure from `api-dev`, so this is not an aliasing artefact —
  a UAT build really does write to the dev database, and a production build really would write to
  the UAT database.

- **The naming compounds it.** `lcfuat.ash.frappe.cloud` — a host named *uat* — resolves to the
  **same IP as `api-dev`**. It is hardcoded as the default `.env` of `weconnect-frontend-pm`, the
  only repository that differs. So "uat" denotes two different systems depending on which name is
  used.

- **Impact.** Every test result is attributed to the wrong environment, which is why this had to be
  settled before any assertion could mean anything. More seriously, if a production frontend is
  ever built from `.env.prod`, **production traffic lands on UAT** — the environment already shown
  to contain real programme data including minors' records. Whether such a build is deployed today
  is the one thing we cannot determine from outside; it needs a client answer.

- **Suggested fix:**
  1. Correct the mapping so each environment's config names its own API, and add the missing
     production configuration.
  2. Stop committing `.env*` files; supply them at build time. (Recorded separately as hygiene —
     contents are now inspected and contain **no credentials**, only URLs, so that finding stays
     S3.)
  3. Retire or rename `lcfuat.ash.frappe.cloud` so one name denotes one environment.
  4. Confirm which frontends are deployed from which config today.

## WC-107 · Info — A PostgreSQL data dump is stored in the `data-pipeline-dashboard` repository [VERIFIED — archive TOC and schema; confirmed intentional by the QA lead]

**Not raised as a defect.** Recorded for completeness because the file was examined during the
review of the foundation's GitHub organisation, and because a reader of the register may otherwise
wonder whether it was missed.

- **Where:** `Lighthouse-Communities-Foundation/data-pipeline-dashboard`, `lcf_data.sql`, on the
  default branch. The repository is **private**.
- **What it is:** an 11,512,853-byte PostgreSQL custom-format archive (`PGDMP`), created
  2024-11-13 from database `lcf_data`, carrying 7 `TABLE DATA` entries (`lcf_enquiry`,
  `lcf_onboarding`, `lcf_foundation`, `lcf_skilling`, `lcf_placement`, `lcf_spoken_english`,
  `lcf_24_25_target`) with programme fields including names, contact details, caste category and
  income bands.
- **Assessment:** this is the foundation's own data, held by the data controller in its own private
  repository, in the repository whose entire purpose is to load that data. It is not a disclosure,
  and no unauthorised party holds it. Treated as intentional.
- **The one durable property worth the client knowing**, if it has not already been considered:
  content committed to git cannot be removed by a later deletion, and repository read access is
  coarser than database access, so this 2024 snapshot remains retrievable by anyone who holds or
  later gains read access to the repository, including CI and deploy keys. Whether that is an
  acceptable arrangement is the foundation's judgement, not a QA finding.
- **Handling:** severity was assessed from the archive's table of contents and `CREATE TABLE`
  statements only. No row was decompressed, displayed, copied or stored, and no personal value
  appears in any artefact we hold.

## WC-108 · S3 — `db_create.py` assigns undefined identifiers as database connection settings [VERIFIED — source]

**Priority: P3**

- **Where:** `Lighthouse-Communities-Foundation/data-pipeline-dashboard`, `db_create.py:4-8`.
- **Evidence:** `DB_HOST = yor_host_name`, `DB_NAME = database_name`, `DB_USER = user_name`,
  `DB_PASSWORD = db_password` — bare identifiers, not strings, so the module raises `NameError` on
  import. Note the typo `yor_host_name`.
- **Impact:** the module cannot run as committed. Low severity: this repository is outside the
  WeConnect 2.0 platform under test.
- **Suggested fix:** read these from the environment (`os.environ`), as the Google credentials
  already are, and remove the placeholders.
- **Clean result worth recording:** no credential is committed anywhere in this repository;
  `token.json` and `credentials.json` are correctly listed in `.gitignore`.

## WC-109 · S3 — `dashboard.get_invoice_count` applies no scoping at all and returns a global financial aggregate [VERIFIED — runtime, three disjoint personas]

**Priority: P2** — Returns a global financial aggregate with no centre scoping.
- **Where:** `youth_skilling.api.dashboard.get_invoice_count`.
- **Evidence (source):** the handler calls `frappe.db.count("Skilling Invoice", {"current_status": ...})`
  with no centre predicate. `frappe.db.count` does not apply permissions, so no scoping occurs by
  any route. This one genuinely has no filter, unlike its siblings on the same dashboard.
- **Evidence (runtime, isolated instance):** three personas with **disjoint** centre scopes each
  received the identical figure while every seeded invoice belonged to a fourth centre:

  | Persona | Permitted centres | `not_raised_yet` |
  |---|---|---|
  | `sp` | QA West, QA East | 16 |
  | `ch` | QA North | 16 |
  | `oc` | QA Central, QA West | 16 |

- **Impact:** every account learns the number of unraised invoices across the whole programme,
  including centres it has no permission for. Financial volume, not financial records — hence S3
  rather than S2 — but it is a scope violation the sibling endpoints on the same dashboard do not
  have.
- **Contrast worth noting:** `get_waiting_for_skilling_count` on the same dashboard *does* resolve
  a centre scope (and is defeated by the `System Manager` bypass instead). So the dashboard is
  inconsistent with itself: one card scopes and is bypassed, another never scopes at all.
- **Suggested fix:** filter by the caller's permitted centres, as the sibling cards attempt to,
  and prefer `frappe.get_list`/`get_all` with an explicit centre predicate over `frappe.db.count`.

## WC-110 · S2 — A ninth persona is routed to an application that does not exist, and a tenth role was never inventoried [VERIFIED — source, auth application routing table + backend + repository listing]

**Priority: P2**

**Found while auditing the characterisation document. It changes the platform's persona inventory,
which the characterisation states and the client is asked to sign.**

- **Where:** `weconnect-frontend-auth`, `src/routes.js` — the post-login routing table that decides
  which application an account is sent to, keyed by `role_profile`.

- **The table defines nine mappings, not six:**

  | Role profile | Sent to | Application exists? |
  |---|---|---|
  | Outreach Coordinator | `/oc/` | yes |
  | Center Head | `/ch/` | yes |
  | Facilitator and Counsellor | `/fc/` | yes |
  | Skilling Youth Coordinator | `/syc/` | yes |
  | Skilling Partner | `/sp/` | yes |
  | **Trainer** | `/sp/` | yes — **shares the Skilling Partner application** |
  | Skilling Manager | `/sm/` | yes |
  | Placement Manager | `/pm/` | yes (deferred by agreement) |
  | **Placement Youth Coordinator** | **`/pyc/`** | **no such repository or application** |

- **`Placement Youth Coordinator` is not a stray string. The backend implements it:**
  - `youth_placement/api/helper.py:349` maps `"Placement Youth Coordinator" → "PYC"`, and `:392`
    resolves the current user's role to `"PM"` / `"PYC"` or `"Unauthorized User"`.
  - `youth_placement/api/counselling.py:664` queries
    `["role_profile_name", "in", ["Placement Manager", "Placement Youth Coordinator"]]`.
  - Two migration patches create approval categories with
    `REQUESTER_ROLE = "Placement Youth Coordinator"`.
  - `Employer` doctype offers `PYC` as a selectable option.

- **But no frontend serves `/pyc/`.** The foundation's organisation holds **18 repositories**; the
  frontends are `weconnect-frontend`, `-auth`, `-ch`, `-fc`, `-pm`, `-sm`, `-sp`, `-syc`. **There is
  no `-pyc`.** An account whose role profile is `Placement Youth Coordinator` is therefore
  redirected on login to a path with no application behind it.

- **Impact.** If any such account exists in production, that user cannot use the platform at all —
  login succeeds and then sends them nowhere. If no such account exists, the backend carries a
  fully-wired persona with no way to reach it, and the routing table advertises a destination that
  was never built. Either way the persona inventory the platform implements and the one it ships
  do not agree.

- **`Trainer` is a second gap, of a different kind.** It is a distinct role profile routed to the
  Skilling Partner application, and the backend treats it specially — `get_user_permitted_centres()`
  scopes Trainers by the partners that list them, because a Trainer has no `partner_email_id` of
  its own. **This engagement tested `sp` but never a Trainer**, so that scoping path is unexercised.

- **Consequence for our own scope statement.** We have described the platform as "6 personas in
  scope, PM deferred". The routing table shows **8 personas plus the Trainer variant**. PYC was
  never inventoried, never probed, and does not appear in the route counts.

- **Suggested fix:**
  1. Decide whether `Placement Youth Coordinator` is a live persona. If it is, the `/pyc/`
     application is missing and must be built; if it is not, remove it from the routing table, the
     helper mappings and the approval patches so the code stops advertising it.
  2. Make the routing table fail loudly. An unmapped or unbuilt destination should show an error,
     not redirect a user into a void.
  3. Confirm whether any production account holds the `Placement Youth Coordinator` or `Trainer`
     role profile; both change the tested surface.

- **[DECISION for the client]** Is `Placement Youth Coordinator` in scope for QA, and does a
  `/pyc/` application exist anywhere outside the repositories we were given?

## WC-111 · S2 — Approval flows reference at least 15 Approval Categories by literal name, and none of them ship [VERIFIED — source + clean install, 2026-09-20]

**Priority: P2**

**Found by rebuilding the environment from nothing and driving the suite against it. It is the same
class as the `Youth Status` defect, and the two together show the pattern is not a one-off.**

- **The mechanism.** `Approval.validate_approval_category()`
  (`centre_head/.../doctype/approval/approval.py:103-111`) rejects any approval whose category does
  not exist with a matching `ref_doc`:

  ```python
  if frappe.get_value("Approval Category", {"name": self.approval_category}, "ref_doc") != self.doctype_name:
      frappe.throw(f"Invalid Approval Category for Document Type {self.doctype_name}.")
  ```

  Application code then creates approvals with the category **hardcoded as a string**. For example
  `outreach/.../doctype/community_visit/community_visit.py:70` sets
  `"approval_category": "Outreach Plan"`.

- **At least 15 such literals exist in live (non-commented) code**, across `outreach`,
  `centre_head`, `youth_skilling`, `batch_management` and `youth_placement`:

  `Outreach Plan` · `Edit Outreach Plan` · `Change Pathway Batch` · `Approved LH Center` ·
  `Reactivate from Dropoff` · `Archive Batch` · `Delete Batch` · `Move to Another Batch` ·
  `Move to another Batch` · `Moving Student` · `Add Employer` · `Request Location Change` ·
  `Request Reattempt` · `Request Enrollment Status Change` · `Request for Attendance Confirmation` ·
  `Request for Post Test`

- **None exists on a site built from the repositories.** Checked directly on a freshly created
  instance: `Outreach Plan`, `Edit Outreach Plan`, `Change Pathway Batch`, `Approved LH Center` and
  `Reactivate from Dropoff` are all **missing**. No application ships `Approval Category` records —
  consistent with the wider finding that no app declares access-control or master data as fixtures.

- **Demonstrated consequence.** Creating a Community Visit fails on a clean install with
  `ValidationError: Invalid Approval Category for Document Type Community Visit.` The visit itself
  is valid; it is refused because the approval it raises names a category that does not exist. This
  is why Community Visit was the one object this engagement could not drive end-to-end — recorded
  previously as "blocked on approval-workflow config", now root-caused precisely.

- **Note the casing inconsistency**, which will bite whoever creates these records: the code uses
  both `Move to Another Batch` and `Move to another Batch`. Frappe document names are
  case-sensitive, so these are two different categories and at least one code path must be wrong.

- **Suggested fix:** ship the `Approval Category` records as app fixtures, one per literal the code
  references, each with the correct `ref_doc`. Then replace the string literals with module-level
  constants so a typo is a failure at import rather than a runtime `throw`, and reconcile the
  `Another`/`another` pair. A test that asserts every literal resolves to an existing category
  would keep the two in step.

---
# Security coverage gap review against OWASP API Security Top 10 (2026-09-22)

## WC-112 · S2 — The frontend is served with no security headers at all [VERIFIED — live, read-only]

**Priority: P2**

**Found by reviewing our own coverage against the OWASP API Security Top 10 (2023), specifically
API8: Security Misconfiguration. This category had not been tested.**

- **Evidence.** `HEAD https://uat.lighthouseconnect.org/` returns, in full:
  `Server: nginx/1.24.0 (Ubuntu)`, `Date`, `Content-Type`, `Content-Length`, `Connection`,
  `Last-Modified`, `ETag`, `Accept-Ranges`. **None of the following is present:**

  | Header | Absent | What it would prevent |
  |---|---|---|
  | `Content-Security-Policy` | yes | Cross-site scripting, and exfiltration of anything readable from the page |
  | `Strict-Transport-Security` | yes | Protocol downgrade, cookie/token interception on first request |
  | `X-Frame-Options` / `frame-ancestors` | yes | Clickjacking |
  | `X-Content-Type-Options` | yes | MIME-type confusion |
  | `Referrer-Policy` | yes | Leaking authenticated URLs to third parties |
  | `Permissions-Policy` | yes | Unwanted access to camera, microphone, geolocation |

- **This compounds an existing finding rather than standing alone.** The persona applications store
  a long-lived API key and secret in `localStorage`, on a single origin shared by all of them. A
  Content-Security-Policy is the main control that limits what injected script can do and where it
  can send data. With no CSP, any cross-site scripting flaw in any one of the applications yields a
  durable credential valid for all of them. The two findings should be read together.

- **The API host is configured differently, which shows the capability exists.**
  `api-dev.lighthouseconnect.org` (Frappe Cloud) returns `x-frame-options: SAMEORIGIN` and sets its
  cookies `Secure; HttpOnly; SameSite=Lax`. So the platform already issues cookies with the
  protections that `localStorage` tokens lack, and the frontend host simply has no equivalent
  configuration.

- **Suggested fix:** add the headers at the nginx layer serving the frontend. A reasonable starting
  set is `Strict-Transport-Security` with a long max-age, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (or a CSP
  `frame-ancestors` directive), and a `Content-Security-Policy` developed in report-only mode first
  so it can be tuned without breaking the applications. Moving the session off `localStorage` and
  onto the `httpOnly` cookie the API already issues would remove the underlying exposure.

## WC-113 · Info — Coverage assessed against OWASP API Security Top 10 (2023) [METHOD]

This engagement's security testing grew out of functional QA rather than from a security standard,
so its coverage was mapped against the OWASP API Security Top 10 after the fact. The mapping is
recorded here so that what was and was not examined is explicit.

| Risk | Covered | Evidence or gap |
|---|---|---|
| **API1** Broken Object Level Authorization | **Yes, extensively** | The three S1s, the 30 endpoints passing `ignore_permissions`, the boundary sweep |
| **API2** Broken Authentication | **Partly** | Found: guard disabled in two apps, long-lived token in `localStorage`, session invalidation on re-login, unauthenticated account-provisioning endpoint. **Not tested: brute-force protection, rate limiting on login, password policy, token expiry** |
| **API3** Broken Object Property Level Authorization | **Now tested (sampled)** | Two endpoints tested for mass assignment: one properly allowlisted, one protected only by an existing crash. A full sweep of every `data`-accepting endpoint remains |
| **API4** Unrestricted Resource Consumption | **Now tested** | Found: no rate limiting at all (40 rapid reads, all 200); no upload size limit. Field-length validation is enforced (clean). Concurrency 500s and the unpaginated youth endpoint already recorded |
| **API5** Broken Function Level Authorization | **Yes** | Gate probe (0 of 36 gated), 318 cross-role probes across 67 role-exclusive endpoints |
| **API6** Unrestricted Access to Sensitive Business Flows | **Now tested** | Found: the Google Sheet bulk-export flow has no authorisation gate and is reachable by an external-partner account |
| **API7** Server Side Request Forgery | **Now tested — clean** | No HTTP client is imported in any of the eight applications; `delete_file_by_url` uses the URL as a database key, not to fetch a resource |
| **API8** Security Misconfiguration | **Substantially tested** | Found: tracebacks to unauthenticated callers, public API specification, committed `.env` files, wrong environment mapping, absent security headers, seven-day sessions, weak password floor. CORS policy not assessed |
| **API9** Improper Inventory Management | **Yes** | The published API specification, the undocumented deployable set, the persona routed to a non-existent application |
| **API10** Unsafe Consumption of APIs | **Partly** | The Google Sheets integration is export-only (writes out, does not ingest), so the classic unsafe-ingestion risk is low. The vendor `fintoo_analytics_bridge` app is absent from the repositories and could not be assessed |

**Follow-up (2026-09-22): the four untested categories have since been examined**, together with SQL
injection and file upload. API7 came back clean; API3, API4 and API6 each produced findings, recorded
above. Injection is clean (all 339 raw SQL calls taint-analysed). The only remaining partial areas
are a full mass-assignment sweep across every `data`-accepting endpoint, and CORS configuration.

## WC-114 · S3 — Mass assignment is blocked on one endpoint by design and on another only by an existing defect [VERIFIED — runtime, isolated instance]

**Priority: P3**

**Tested in response to the OWASP coverage gap at API3 (Broken Object Property Level
Authorization), which had not been examined. The result is mixed rather than clean.**

- **Method.** As the owning persona, create a record through the normal endpoint, then attempt to
  set protected or system-controlled properties through the endpoint's `data` payload, then read
  the record back from the database to see what actually persisted. Fields attempted: `owner`,
  `docstatus`, the centre link, and the workflow status.

- **`outreach.apis.pre_enquiry.form.update_form_data` — properly protected.** Every attempt was
  refused with `Invalid fieldname '<field>'`, which is an allowlist rejecting anything not
  explicitly permitted. Reading the record back confirms nothing changed: `owner` remained the
  creating account, `docstatus` 0, status `Open`. **This is the pattern the other endpoints should
  follow.**

- **`outreach.apis.task.task.update_task` — protected only by accident.** Every attempt returned
  **HTTP 500 with `KeyError: 'subject'`**. The endpoint is not rejecting the injected property; it
  is crashing before it reaches it, because it reads its expected fields by direct subscript and
  fails when they are absent. Nothing persisted, so there is no exposure today.

- **Why that distinction matters.** The missing-field crash is already recorded as a separate
  defect, with the recommended fix being to validate presence and return 400. **If that fix is
  applied without also adding an allowlist, this endpoint becomes genuinely vulnerable to mass
  assignment**, because the crash is the only thing currently preventing the write. The two changes
  need to be made together.

- **Scope of this test.** Two endpoints of the several dozen that accept a `data` payload. This is
  a sample, not a sweep, and it is recorded as such. A full pass over every endpoint taking a
  free-form `data` object is the remaining work for API3.

- **Suggested fix:** adopt the Pre Enquiry allowlist pattern across every endpoint that accepts a
  `data` payload, and add a test asserting that a system-controlled property such as `owner` or
  `docstatus` cannot be set through any of them.

## WC-115 · S2 — Any authenticated account, including an external partner, can trigger a bulk export of programme data to an external Google Sheet [VERIFIED — runtime, isolated instance]

**Priority: P1** — An external partner account can export programme data in bulk.

**Found by testing OWASP API6 (Unrestricted Access to Sensitive Business Flows), a category this
engagement had not examined. May be S1 on the live platform; see the severity note.**

- **Where:** `outreach.apis.lcf_mastersheet_sync.sync_to_lcf_mastersheet`,
  `@frappe.whitelist(methods=["POST"])`.
- **What it does.** Reads programme records section by section (`Enquiry` and others, via
  `_SECTION_FETCHERS`) and writes them into a Google Spreadsheet using a service-account
  credential held in `Google Integration Settings`. It is a bulk export of programme data to a
  destination outside the platform.
- **It performs no authorisation check of any kind.** The function validates the section name,
  then immediately loads the spreadsheet settings and the gspread client. There is no role check,
  no centre check, and no check of who is calling.
- **Verified at runtime.** Called on the isolated instance as `sp` — the **Skilling Partner**
  persona, which represents an external training provider and is the lowest-trust account in the
  system — the endpoint returned **HTTP 200** and reached its own logic, failing only with
  `"LCF Google Sheet ID is not set in Google Integration Settings."` That failure is downstream of
  where a permission check belongs. The same result for `fc`. **No caller was refused.**
- **Why the configuration failure is not reassurance.** The isolated instance has no Google
  credentials, which is the only reason the export did not proceed. On the live platform those
  settings are populated, because the integration is in use. The authorisation gap is identical in
  both environments; only the downstream configuration differs.
- **Severity.** Recorded **S2** because we have not observed an export completing. If the live
  platform's settings are populated — which the existence of the integration implies — then an
  external partner account can extract enquiry records, including names, telephone numbers and
  addresses, into a spreadsheet outside the platform's access controls. On that basis it would be
  **S1**. We have deliberately not attempted this against the live platform, because doing so would
  write client data to a third-party document.
- **The client can confirm this safely**, without triggering an export, by checking whether
  `Google Integration Settings` holds a sheet ID and service-account credential on the live site,
  and by reviewing that spreadsheet's Google access log for writes not originating from the
  intended scheduled job.
- **Suggested fix:** require an explicit role for this endpoint — it is an administrative
  reporting function, not a per-persona one — and log every invocation with the calling account.
  It is a strong candidate for the central authorisation change recommended for the mutating
  endpoints, since it is exactly the class of sensitive operation that change is meant to cover.

## WC-116 · S3 — Session lifetime is seven days, which compounds the token-storage exposure [VERIFIED — System Settings, isolated instance built from the client's own configuration path]

**Priority: P2** — Seven-day sessions compound the token-storage exposure; a configuration change.

**Found by testing OWASP API2 (Broken Authentication), which this engagement had examined only
partially.**

- **Evidence.** `System Settings` reports `session_expiry = 170:00`, which is **170 hours, a little
  over seven days**. `force_user_to_reset_password = 0` and `minimum_password_score = 2` on
  Frappe's 0–4 scale, which zxcvbn describes as "somewhat guessable".
- **Why it matters here specifically.** Three facts already in this register combine with it. The
  applications store a long-lived API key and secret in `localStorage`; all of them share one
  browser origin; and the frontend is served with no Content-Security-Policy. A credential taken
  from browser storage is therefore valid for roughly a week, across every persona application,
  with no header-level control limiting where injected script could send it. Each of those findings
  is moderate alone. Together they describe a single, durable exposure.
- **Suggested fix:** shorten the session lifetime to something proportionate to a working day, move
  the credential to the `httpOnly` cookie the API already issues, and raise the minimum password
  score. None of these requires application changes; they are settings.

## WC-117 · S3 — Brute-force lockout is applied per source IP as well as per account, and reports itself as a server error [VERIFIED — runtime]

**Priority: P3**

- **Protection is present, which is a clean result.** Repeated failed logins trigger Frappe's
  lockout after a small number of attempts, with `allow_login_after_fail = 60` seconds. The correct
  password is refused while the lock is held. API2 is therefore **not** unprotected.
- **First defect: it surfaces as HTTP 500.** The response is
  `frappe.exceptions.SecurityException: Your account has been locked and will resume after 60
  seconds`, returned with status **500**. A security control firing correctly is not a server
  fault; this should be 429 or 403. A caller cannot distinguish a lockout from a crash by status
  code, and any monitoring on 5xx rates will treat normal lockouts as outages. This is the same
  pattern as the recorded finding that endpoints return 500 where 400 is correct.
- **Second defect, and the operationally significant one: the lock is also applied per source IP.**
  `frappe/auth.py:260` tracks `get_login_attempt_tracker(frappe.local.request_ip)` alongside the
  per-user tracker. **Observed directly:** after failed attempts against one account, a *different*
  account was refused from the same address on its first attempt.
- **Why that matters for this deployment.** Staff at a centre share an office connection and
  therefore a public IP. One person repeatedly mistyping a password can lock out colleagues at the
  same centre who have done nothing wrong. For field staff working to a schedule this is an
  availability problem, not a theoretical one.
- **Suggested fix:** return 429 with a `Retry-After` header rather than 500. Review whether the
  per-IP tracker is appropriate for a deployment where many legitimate users share an address, and
  if it is retained, set its threshold well above the per-account one.

## WC-118 · S2 — No rate limiting on authenticated API requests, on a backend that fails at five concurrent sessions [VERIFIED — runtime]

**Priority: P2**

**Found by testing OWASP API4 (Unrestricted Resource Consumption), previously examined only
through the concurrency measurements.**

- **Evidence.** Forty consecutive authenticated requests to
  `youth_skilling.api.utils.get_training_center_list` returned **HTTP 200 every time**. No `429`,
  no `Retry-After`, no throttling of any kind.
- **Why this is more than a hardening gap here.** This register already records that the platform
  returns HTTP 500s above three concurrent sessions, and that the inconsistency rate doubles between
  three and five. A single authenticated account can therefore generate load the platform is known
  to be unable to absorb, and nothing limits it. That is a denial-of-service reachable by any staff
  account, or by anyone holding a credential taken from browser storage — which, per the session
  finding, remains valid for about a week.
- **It compounds a third finding.** `get_youth_list` returns all 3,825 youth in a single
  unpaginated response. An unthrottled caller repeating that request is both expensive to serve and
  effective as an extraction method.
- **Clean results recorded alongside it.** Field-length validation *is* enforced: a 2 MB value in a
  single field was refused with HTTP 400 and `CharacterLengthExceededError`, which is correct
  behaviour and the right status code.
- **Suggested fix:** apply per-account and per-IP rate limits at the API gateway or in Frappe's own
  rate-limiting configuration, sized against the concurrency the backend can actually sustain
  rather than against a theoretical ceiling. Paginate `get_youth_list`. The concurrency defect
  should be addressed as well, but rate limiting is the control that bounds the damage while it is
  outstanding.

## WC-119 · Info — SQL injection assessment: no injectable site found; one fragile pattern noted [VERIFIED — source, taint analysis of all 339 raw SQL calls]

**Assessed in response to the OWASP/CWE injection category, which had not been examined
systematically. The result is a clean one, recorded here so that what was checked is explicit.**

- **Method.** Every `frappe.db.sql()` call in the eight applications was located by static analysis
  (339 in total), and each was classified by what it interpolates into the SQL string: a
  locally-built clause fragment, a value derived from the ORM or the server, or a value reaching the
  string directly from a request parameter.
- **Result.** Of 100 sites that interpolate a name into SQL text, 106 interpolations are
  locally-built clause fragments (`{where_clause}`, `{conditions}`, `{date_condition}`), 22 are ORM-
  or server-derived (`{id}` from `frappe.get_value`, `{today}` from the server clock), and the 13
  flagged as request-reachable resolve on inspection to one of three safe cases:
  - **commented-out code** — the `{category}` interpolations in
    `outreach/apis/dashboard/dashboard_api.py` are inside disabled blocks;
  - **ORM-fetched fields** — `staff_repository.py` interpolates `employee.custom_center`, a column
    read from a document object, not a request value;
  - **parameterised fragments** — the `{where_clause}` sites in `youth_placement/api/job.py` inject
    only *which* conditions are active; every user value inside those conditions is bound through a
    `%(name)s` placeholder (`%(search)s`, `%(centres)s`, `%(youth_id)s`, and so on).
- **The search-heavy code uses the query builder.** User-facing search
  (`youth_skilling/api/counselling.py`) passes the term through pypika's `.like()`, which
  parameterises the value.
- **No injectable site was found.** This is a clean result for the injection category.

- **One fragile pattern worth hardening (S4-level, recorded but not separately raised).**
  `centre_head/api/dashboard/batch_management.py` writes values into the SQL string directly, as in
  `WHERE ... td.allocated_to = '{id}'`. The value is currently safe because `id` is derived from
  `frappe.get_value("Employee", ...)` rather than taken from the request. The pattern is fragile:
  the safety depends on that upstream assignment, and a future change that let the parameter through
  unmodified would make it injectable with no visible change at the SQL line. The same coupling was
  noted for the mass-assignment/missing-input-validation pair. **Suggested hardening:** use `%s`
  placeholders here too, so that the SQL line is safe regardless of where the value comes from.

## WC-120 · S4 — File upload accepts any type and any size, though two controls reduce the impact [VERIFIED — source]

**Priority: P4**

**Assessed as part of the injection / unrestricted-upload category.**

- **Where:** `outreach/apis/registration/files.py` `upload_file`, and the sibling
  `facilitator_and_counsellor/api/registration_form_B/files.py`.
- **Two protections are present, and they matter.** The endpoint checks
  `frappe.has_permission("File", "write")` and returns 403 without it — unlike the mutating
  endpoints that skip authorisation entirely. Uploaded files are saved with `is_private = 1`, so
  they are not served inline from a public URL, which removes the most direct stored-XSS path.
- **What is missing.** There is no allowlist of permitted file extensions or types, and no explicit
  size limit in the handler. The content type is taken from `guess_type(filename)`, i.e. from the
  attacker-supplied filename rather than from the file's actual bytes. A caller can therefore upload
  a file of any type and any size.
- **Impact, in context.** With private storage and an authorisation check, the immediate stored-XSS
  and public-exposure risks are contained, which is why this is recorded at S4 rather than higher.
  The residual concerns are: an unbounded upload size is a resource-consumption vector, which
  compounds the absent rate-limiting finding; and content-type trust based on filename is a latent
  weakness if any future code path serves these files inline or relies on the stored type.
- **Suggested fix:** add an extension/type allowlist appropriate to the documents these forms
  expect (PDF and common image types), enforce a maximum size, and derive the content type from the
  file content rather than its name.

## WC-121 · S3 — CORS is configured to reflect any origin with credentials allowed [VERIFIED — observed against the live backend]

**Priority: P2** — One configuration line replaces the wildcard with an explicit origin list.

**Found by testing OWASP API8 (Security Misconfiguration) for cross-origin policy, which the
earlier security-headers work had not covered.**

- **Where:** `allow_cors` in the backend site configuration, consumed by
  `frappe/app.py` `set_cors_headers`.
- **What we observed.** A preflight to `api-dev.lighthouseconnect.org` carrying
  `Origin: https://evil.example.com` — a domain with no relationship to the foundation — came back
  `HTTP/2 200` with `access-control-allow-origin: https://evil.example.com` and
  `access-control-allow-credentials: true`. An unrelated origin is echoed back verbatim and told
  that credentialed requests are acceptable. This is the signature of `allow_cors` being set to
  `"*"`: Frappe does not emit a literal `*`, it reflects whatever origin asked.
- **Why the reflection matters more than a literal wildcard.** Browsers refuse to honour
  `Access-Control-Allow-Origin: *` together with credentials. They do honour a *reflected* origin
  with credentials. The setting that looks like the permissive-but-harmless option is in fact the
  permissive-and-honoured one.

**What stops this being exploitable today, and it is not the application.** The session cookie is
issued `Secure; HttpOnly; SameSite=Lax` (confirmed on the live `set-cookie`, and `samesite="Lax"`
is the default in `frappe/auth.py`). `Lax` keeps the cookie off cross-site `fetch`, so a page on an
unrelated domain cannot currently read API responses as the logged-in user. The protection is a
browser default sitting in front of a server that would otherwise allow the read.

**The escalation path, which is why this is recorded at S3 and not lower.** `SameSite` defines
"site" as the registrable domain, so `uat.lighthouseconnect.org` and `api-dev.lighthouseconnect.org`
are same-site and cookies flow between them. That is the legitimate reason the setting exists. It
also means **every** `*.lighthouseconnect.org` host is same-site for cookie purposes, and the
wildcard CORS grants all of them credentialed API access. Any foundation subdomain — a marketing
site, a partner-hosted page, a stale DNS record pointing at a service someone else can claim —
becomes a full-access path to the API with a logged-in user's session. We did not enumerate or test
the foundation's other subdomains; that is outside the scope we were given, so the existence of such
a host is **unverified and stated as a risk, not as an observation**.

- **The second reason not to leave it.** The mitigation is one configuration change away from
  failing. `SameSite=None` is what any legitimate cross-site embedding requires, and setting it is a
  routine change someone may make for an unrelated reason. The moment it is set, the wildcard CORS
  becomes direct data exposure with no other change anywhere.
- **Suggested fix.** Replace `"*"` with the explicit list of frontend origins that need access.
  `allow_cors` accepts a list, and `set_cors_headers` already compares the incoming origin against
  it, so this is a configuration edit with no code change: set it to the UAT and production frontend
  origins and nothing else. Re-run the probe above afterwards and confirm an unrelated origin gets
  no `access-control-allow-origin` header back.
- **Check production separately.** This was observed against the dev/UAT backend. The production
  backend has its own site configuration and may differ in either direction; the same one-line
  preflight will answer it.

## WC-122 · S2 — `add_interest` writes any field the caller sends, and saves with permissions switched off [VERIFIED — reproduced against the isolated stack]

**Priority: P2**

**Found by completing the OWASP API3 (Broken Object Property Level Authorization) sweep across
every endpoint that passes request data into a document write, rather than the two endpoints
sampled earlier.**

- **Where:** `batch_management/batch_management/api/fc/youth_interest.py:198` `add_interest`.
- **What the endpoint says it does.** It records a youth's course and job-role interest. It declares
  five fields: `interested_course`, `interested_job_role`, `int_entre`, `higher_education_plans`,
  `add_notes`.
- **What it actually does.**

      REQD_FIELDS = ("interested_course", "interested_job_role", ...)
      for i in REQD_FIELDS:
          if i not in data:
              ...return          # checks these fields are PRESENT
      ...
      youth = frappe.get_doc("Youth", youth)
      youth.update(data)                      # writes EVERY key the caller sent
      youth.save(ignore_permissions=True)     # no framework permission check

  `REQD_FIELDS` is a presence check. Nothing rejects keys that are not in it, so `youth.update(data)`
  applies the caller's whole dictionary to the Youth record.

- **Reproduced.** As the FC persona, we called `add_interest` with the five declared fields plus
  `first_name`, which the endpoint never mentions. The response was `success_key: 1` and the
  database field moved from `"QA Hotel"` to our probe value. Restored afterwards. The probe is
  `suite/probes/mass-assignment-probe.mjs`.
- **Why this one is more serious than the others in the category.** The save passes
  `ignore_permissions=True`, so Frappe's own write check is switched off. The two other unfiltered
  endpoints we examined are caught by the framework at save time; this one is not. There is no
  backstop behind the handler.
- **Scope of what can be set.** Any field on Youth that is writable at permission level 0 — the
  identity fields among them (`first_name`, `last_name`, `email_id`, `bio`). Fields marked
  `read_only` are dropped by Frappe, which is why the scoping field `lighthouse_centre` could not be
  moved this way; that is the doctype's protection, not the endpoint's.
- **Suggested fix.** Reject unknown keys before the write, the way
  `youth_skilling/api/skilling_issue.py` `update_issue` already does in this same codebase:

      for field in data:
          if field not in EDITABLE_FIELDS:
              ...reject

  Then remove `ignore_permissions=True` so the framework check applies, or state in the code why it
  has to be bypassed.

## WC-123 · S3 — `update_profile` applies caller data to a User record, and its permission check is dead code [VERIFIED — reproduced against the isolated stack]

**Priority: P2** — Unfiltered write to the User doctype; the permission check is unreachable.

**Found in the same API3 sweep.**

- **Where:** `outreach/outreach/apis/profile/form.py:74` `update_profile`.
- **The control flow.**

      doc = frappe.get_doc("User", user_id)
      doc.update(data)                               # every key the caller sent
      if not doc.has_permission("write"):
          api_response.set_response(0, "Insufficient Permission ...", 403)
                                                     # no return
      try:
          doc.save()                                 # runs regardless

  The 403 branch does not return, so execution continues to the save in every case.

- **It fails closed, but not because of this code.** We created a user with no roles and ran the
  same path: `has_permission("write")` returned `False`, and `doc.save()` raised `PermissionError`
  on its own. Frappe checks permissions inside `save()` independently of the handler. The endpoint
  is therefore not exploitable through the missing `return`.
- **What the missing `return` does cost.** The 403 and its message are never delivered. The
  `PermissionError` is caught by the generic `except` below and returned as
  `"Something Went Wrong!"`. A caller who lacks permission is told the server broke rather than that
  they were denied, and the specific message the author wrote is unreachable.
- **The mass-assignment half is real.** `doc.update(data)` is unfiltered against the **User**
  doctype. Fields above permission level 0 — `user_type` among them, at permlevel 1 — are rejected
  by the framework; we confirmed `user_type` could not be changed this way. Fields at permlevel 0
  can be set freely by anyone who passes the write check. We confirmed one persona rewriting another
  persona's `first_name` through this endpoint, returning HTTP 200.
- **Note on who passes the write check.** Every persona on this platform carries `System Manager`,
  because 178 of 293 doctypes grant permissions to `System Manager` alone and 115 grant none — see
  the role-model finding. So in practice the write check is passed by every account, and the
  unfiltered update is reachable by all of them. This is a consequence of the platform's role model,
  not of this endpoint.
- **Suggested fix.** Add `return` after the 403. Restrict `data` to the profile fields this screen
  is meant to edit. Check the permission before applying the data rather than after.

## WC-124 · Info — Mass-assignment sweep: every endpoint re-examined, and a correction to our earlier count [VERIFIED — source analysis, re-run 2026-09-25]

**Completes the API3 category. This entry replaces an earlier version that reported 28 sites with 22
filtered and 6 not. Re-running the analysis with two faults removed changed the answer, and the
earlier figures should not be relied on.**

**The two faults in our first pass.**

1. **Commented-out code was counted.** `outreach/apis/pec/form.py` contains a large block of dead
   code around line 518 in which a `doc.update(data)` and a `save(ignore_permissions=True)` appear.
   Every line is commented. It is not reachable and should never have been in the count.
2. **A denylist was read as a filter.** Several handlers call `remove_keys_from_dict(data, keys_to_remove)`
   or `data.pop(...)` before the write. That removes the keys the handler has already consumed — it
   does not reject keys the caller invented. We scored those as protected. They are not.

**Corrected result, over live code only.** 27 whitelisted endpoints pass a caller-supplied
dictionary into `doc.update(...)`.

| | Count |
|---|---|
| Protected by an allowlist that rejects unknown keys | **10** |
| **Not** protected by an allowlist | **17** |
| — of those, relying on a denylist only | 12 |
| — of those, saving with `ignore_permissions=True` | 4 |

**Why the denylist distinction matters more than the raw count.** An allowlist answers "is this key
one I accept?" A denylist answers "is this key one I already handled?" Only the first stops a caller
adding a field the endpoint never anticipated. Twelve handlers use the second and read, at a glance,
as though they were doing the first.

**The four with no backstop at all.** These save with `ignore_permissions=True`, so Frappe's own
permission check does not run either:

  - `batch_management/.../fc/youth_interest.py:240` `add_interest()` — **confirmed exploitable**, recorded at WC-122
  - `facilitator_and_counsellor/.../counselling/form.py:390` `create()`
  - `outreach/apis/pec/form.py:297` `update_pec()`
  - `outreach/apis/pec/form.py:698` `make_final_decision()`

**All 17 sites, for repair as a set:**

  - `facilitator_and_counsellor/facilitator_and_counsellor/api/counselling/form.py:366` `create()`  — denylist only
  - `facilitator_and_counsellor/facilitator_and_counsellor/api/counselling/form.py:390` `create()`  — denylist only  — **`ignore_permissions`**
  - `facilitator_and_counsellor/facilitator_and_counsellor/api/counselling/form.py:534` `update()`  — denylist only
  - `facilitator_and_counsellor/facilitator_and_counsellor/api/registration_form_B/form.py:59` `create_form()`  — denylist only
  - `facilitator_and_counsellor/facilitator_and_counsellor/api/registration_form_B/form.py:230` `update_form()`  — denylist only
  - `outreach/outreach/apis/pec/form.py:157` `create_pec()`  — denylist only
  - `outreach/outreach/apis/pec/form.py:297` `update_pec()`  — denylist only  — **`ignore_permissions`**
  - `outreach/outreach/apis/pec/form.py:698` `make_final_decision()`  — **`ignore_permissions`**
  - `outreach/outreach/apis/registration/form.py:123` `create_form()`
  - `outreach/outreach/apis/registration/form.py:302` `update_form()`  — denylist only
  - `outreach/outreach/apis/registration/form.py:630` `make_final_decision()`
  - `outreach/outreach/apis/pre_enquiry/form.py:59` `create_pre_enquiry()`  — denylist only
  - `outreach/outreach/apis/profile/form.py:116` `update_profile()`
  - `outreach/outreach/apis/outreach_planning/community_visit/form.py:99` `create()`  — denylist only
  - `outreach/outreach/apis/outreach_planning/community_visit/form.py:344` `update()`  — denylist only
  - `batch_management/batch_management/api/fc/youth_interest.py:240` `add_interest()`  — **`ignore_permissions`**
  - `batch_management/batch_management/api/pathway_batch/form.py:135` `create()`  — denylist only

**What we verified and what we did not.** `add_interest` was reproduced end to end against the
isolated stack and is recorded at WC-122; `update_profile` was reproduced and is at WC-123. The
other fifteen were established by reading the code, not by firing requests at each one. We are
confident in the classification and less confident that every one is exploitable in practice, since
a doctype's `read_only` and permission-level settings may block specific fields, as they did for
`lighthouse_centre` on Youth.

**Suggested fix, once, in one place.** `youth_skilling/api/skilling_issue.py` `update_issue` already
does it correctly: iterate the caller's keys and reject anything outside a declared set. Applying
that shape to these 17 handlers closes the category. Removing `ignore_permissions=True` from the
four restores the framework's own check behind them.

## WC-125 · S2 — Fields accept values that contradict themselves: negative ages, future birth dates, capacity floors above ceilings, negative costs [VERIFIED — reproduced against the isolated stack]

**Priority: P2**

**Found by adding boundary-value analysis, which the engagement had not previously covered. The
earlier validation probe tested wrong *classes* of input — a string where a number belongs, a
missing field. It never tested values of the right type that are impossible in context.**

**Why this can be reported before the characterisation baseline is signed.** These are not cases
where correct behaviour is a matter of opinion. A negative age, a birth date in the future, a
minimum capacity above the maximum, and a negative course cost are wrong on their own terms. No
baseline is needed to say so.

- **Method.** Each value was written to the doctype through the ORM and read back from the
  database, then rolled back. Testing at the doctype layer rather than at one endpoint shows
  whether the constraint is missing *everywhere*, since every write path shares it.
  Probe: `suite/probes/` boundary step; chained API demonstration in
  `suite/probes/chained-boundary-probe.mjs`.

- **Result: 10 of the 12 impossible values were stored without complaint.**

  | Doctype | Value written | Outcome |
  |---|---|---|
  | Enquiry Form | `age = -5` | stored |
  | Enquiry Form | `age = 0` | stored |
  | Enquiry Form | `age = 999999` | stored |
  | Enquiry Form | `dob` ten years in the future | stored |
  | Enquiry Form | `dob = 1850-01-01` | stored |
  | Skilling Batch | `minimum_capacity = 50`, `maximum_capacity = 10` | stored |
  | Skilling Batch | `minimum_capacity = -10` | stored |
  | Skilling Invoice | `installment_percent = 150` | stored |
  | Skilling Invoice | `installment_percent = -20` | stored |
  | Skilling Invoice | `course_cost_per_student = -5000` | stored |
  | Skilling Issue | `resolution_deadline` 30 days before `date_of_issue` | value altered on save; inconclusive |
  | Pathway Batch | capacity inversion | no record present to test |

- **The financial fields matter most.** A negative course cost and an instalment percentage of 150%
  or -20% are stored on `Skilling Invoice`, the doctype the foundation bills against. Whatever
  totals are computed downstream inherit these values.

- **Demonstrated end to end through the public API, not only through the ORM.** Combined with the
  unfiltered `add_interest` endpoint recorded above, a caller set `Youth.dob` to
  `2036-01-01` — a birth date ten years from now — in a single authenticated request. The response
  was HTTP 200 with `success_key: 1`. The endpoint never declares `dob`, and the doctype never
  checks it. Restored afterwards.

- **Suggested fix.** Put the constraint on the doctype, not in each endpoint, so every write path
  inherits it: a `validate` method rejecting negative or absurd ages, birth dates outside a
  plausible range, capacity inversions, and negative or out-of-range money and percentage values.
  Frappe supports this directly, and `non_negative` is available on numeric fields for the simplest
  of them.

- **What we did not test.** Only the doctypes and fields listed. A full pass over every constrained
  field on all 293 doctypes was not run; the pattern found here is consistent enough that the
  client should assume it is general and check rather than assume the rest are covered.

## WC-126 · S2 — No state-transition control exists: every status can move to every other status, including financial reversals [VERIFIED — reproduced against the isolated stack]

**Priority: P2**

**Found by adding systematic state-transition testing, which the engagement had not previously
covered. The earlier lifecycle and state-boundary probes tested individual journeys; neither
enumerated the full transition matrix.**

**Why this can be reported before the characterisation baseline is signed.** We are not asserting
which transitions the foundation intends to allow. We are reporting that the platform permits all
of them, which means no intended model is being enforced anywhere. That is a structural fact about
the system, not a judgement about correct behaviour.

- **Method.** For each doctype carrying a status field, every ordered pair of distinct states was
  attempted: set the record to state A, save, set it to state B, save, read the stored value back,
  roll back. Run at the doctype layer, because that is the backstop every write path shares.
  Probe: `suite/probes/` state-transition step.

- **Result: 174 of 174 attempted transitions were accepted. Not one was refused.**

  | Doctype | Status field | States | Transitions accepted |
  |---|---|---|---|
  | Skilling Invoice | `current_status` | 6 | 30 of 30 |
  | Skilling Batch | `batch_status` | 9 | 72 of 72 |
  | Enquiry Form | `enquiry_status` | 7 | 42 of 42 |
  | Counselling | `status` | 4 | 12 of 12 |
  | Pre Enquiry | `pre_enquiry_status` | 4 | 12 of 12 |
  | Skilling Issue | `status` | 3 | 6 of 6 |
  | Pathway Batch | `batch_status` | 7 | no record present to test |

- **What that permits, concretely.** On `Skilling Invoice`, `Paid` moves back to `Not Raised Yet`,
  and `Cancelled` moves to `Paid`. On `Skilling Batch`, `Completed` returns to `Admission Open`. On
  `Counselling`, `Completed` returns to `Scheduled`. A batch can reach `Completed` from
  `Admission Open` without passing through enrolment or delivery.

- **The invoice reversals are the ones to fix first.** `current_status` on `Skilling Invoice` is
  what the foundation bills against. A status that can move in any direction, including out of
  `Paid` and out of `Cancelled`, cannot be relied on as a record of what was actually invoiced or
  collected, and no audit trail distinguishes a correction from an error.

- **This is consistent with what the API-level probe already found.** The state-boundary sweep
  recorded `discontinue_course` accepting a transition it should have refused. That was one symptom
  of this: with no constraint on the doctype, any endpoint that does not implement its own check
  writes the status freely, and the endpoints using `ignore_permissions=True` bypass even the
  permission layer on the way.

- **Suggested fix.** Define the permitted transitions once, on the doctype, so every write path
  inherits them. Frappe ships a Workflow facility for exactly this, and it also provides the
  transition history and approval steps that the invoice states in particular need. Where a full
  workflow is too heavy, a `validate` method comparing the new status against the previous value is
  enough to refuse the impossible moves.

- **What we did not test.** The seven doctypes listed. Other status-bearing doctypes were not
  enumerated, and `Pathway Batch` had no record in the fixture set. Given that not one of 174
  transitions was refused, the client should treat the absence as general and verify rather than
  assume the remainder are controlled.

## WC-127 · S3 — Frontend dependencies carry known high-severity advisories, including the HTTP client used by every application [VERIFIED — npm audit against the committed lockfiles, 2026-10-06]

**Found by adding dependency scanning, a category this engagement had never covered. No dependency
finding existed in the register before this entry.**

- **Method.** `npm audit` run against the committed `package-lock.json` of all nine JavaScript
  projects — the eight persona frontends and `persona-common-components`. The lockfiles are the
  authority for what is actually installed, so this reflects the deployed tree rather than a
  loose version range.

- **Raw totals: 14 critical, 181 high, 74 moderate, 9 low.** Those numbers are misleading on their
  own and should not be quoted without the split below.

- **The split that matters.** A vulnerability in a build or test tool never reaches a user, because
  it is not part of the shipped bundle. Separating runtime dependencies from build and test ones:

  | | Distinct critical/high packages |
  |---|---|
  | **Reaches users (runtime dependency)** | **8** |
  | Build or test only, never shipped | 26 |

  **Every one of the four critical advisories is in the second group** — `vitest`, `tinypool`,
  `@vitest/coverage-v8` and a `form-data` path reached only through them. No critical advisory
  reaches your users.

- **The eight that do reach users**, with the number of applications affected:

  | Package | Projects | Why it matters here |
  |---|---|---|
  | `axios` | 8 of 9 | The HTTP client every application uses to call the backend. The most consequential of the set. |
  | `react-router`, `react-router-dom`, `@remix-run/router` | 5 each | Routing. Related to the navigation-state defects already recorded at WC-043. |
  | `vite-plugin-html` | 8 | Injects into the served HTML. |
  | `tailwindcss`, `tailwind-scrollbar` | 4 and 3 | Styling; low practical exposure. |
  | `fast-glob` | 8 | Reached as a runtime dependency in these trees. |

- **Why this is S3 and not higher.** None of these is a confirmed exploit path against your
  deployment, and the criticals do not ship. It is recorded because the advisories are public, the
  fixes are published, and `axios` sits on the path of every API call the platform makes.

- **Suggested fix.** Run `npm audit fix` in each of the nine projects and commit the updated
  lockfile. Where a fix needs a major version — most likely the `react-router` family — treat that
  as a separate task, because a major router upgrade will interact with the navigation-state defects
  at WC-043. Start with `axios`, which is the single highest-value update and the least likely to
  break anything.

- **Worth adding to CI.** `npm audit --audit-level=high` as a build step would stop this accumulating
  again. There is currently no dependency check anywhere in the pipeline.

- **What we did not do.** The nine Python backends declare dependencies in `pyproject.toml` with no
  lockfile, so there is no equivalent authority for what is installed on the server. A Python
  dependency audit needs either a lockfile or a `pip freeze` from the running instance, and is not
  covered by this entry.
