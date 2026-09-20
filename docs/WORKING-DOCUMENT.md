# WeConnect 2.0 — QA Engagement Working Document

**Client:** Lighthouse Communities Foundation · **Platform:** WeConnect 2.0 (UAT)
**Version:** 1.41 · **Last updated:** 2026-09-25 · **Status:** live — updated as work completes

> This is the working document: the single running record of the engagement. Phase reports
> presented to the client are cut from it. Every figure here is traceable to an artefact in the
> QA repository. No number appears in this document that was not produced by a recorded run.

**Change log is at the end (§12).** When this document updates, §12 says exactly what moved,
so the shared copy can be patched section by section rather than re-pasted.

---

## 1. Executive summary

WeConnect 2.0 is the Lighthouse Communities Foundation's youth-skilling platform. It arrived
with **no automated tests and no functional specification**. This engagement establishes a
complete, maintainable QA automation suite and a documented quality baseline.

To date we have mapped the entire platform (7 applications, 298 routes), built an automated
read-only test suite covering the 6 in-scope personas across **six test categories**, executed it
against the live UAT environment three consecutive times, and logged **49 verified findings** —
one of them an S1 — before writing a single line of feature testing beyond navigation.

The platform is substantially larger than a single web application, and the test approach was
chosen accordingly: route inventories are read from each application's router rather than
discovered by clicking. On the Facilitator & Counsellor app this is the difference between
**4 routes visible in the navigation menu and 56 routes that actually exist** — a UI-driven
test effort would have covered roughly 7% of that application while appearing complete.

## 2. System architecture

The platform is a **micro-frontend / microservice system**, not a single application:

- **7 persona web applications** (React 18, React Router v6, Zustand, Vite), one deployment per
  role, each served under its own URL prefix on `uat.lighthouseconnect.org`.
- **8 WeConnect backend services** on a **Frappe 15 + ERPNext 15** (Python) platform at
  `api-dev.lighthouseconnect.org`, alongside Insights and one vendor application.
- **Authentication:** Frappe API key/secret pair, issued at login, stored client-side in
  `localStorage`; every request carries `Authorization: token <key>:<secret>`.
- **Permissions:** the login response declares each account's `permitted_centres` and
  `permitted_courses`. This is the platform's own statement of what an account may see, and it
  is what the access-control tests assert against.

This structure is why a six-month estimate was reasonable: it is six-plus applications sharing
one platform, each with its own screens, permissions and data flows.

## 3. Scope and coverage

| Persona | Role | URL prefix | Routes | Credentials | Status |
|---|---|---|---|---|---|
| FC | Facilitator & Counsellor | `/fc/` | 56 | ✓ | In scope |
| SYC | Skilling Youth Coordinator | `/syc/` | 50 | ✓ | In scope |
| OC | Outreach Coordinator | `/oc/` | 46 | ✓ | In scope |
| SM | Skilling Manager | `/sm/` | 42 | ✓ | In scope |
| SP | Skilling Partner | `/sp/` | 36 | ✓ | In scope |
| CH | Center Head | `/ch/` | 22 | ✓ | In scope |
| PM | Placement Manager | `/pm/` | 46 | — | **Deferred — under development** |

*Graph 1 — Coverage by persona*

**6 personas in active scope, 252 routes.** The Placement Manager application is still under
development; it is deliberately excluded until feature-complete, because defects raised against
an in-flight build are obsolete before they can be actioned. Its route inventory is already
captured, so it re-enters scope without re-work.

Of the 252 in-scope routes, **235 are static** and directly addressable; the remaining **17 are
dynamic**, requiring record identifiers (`/batch-details/:batchId` and similar). All 17 are now
covered. The identifiers were harvested read-only from the platform's own list endpoints.

## 4. Methodology

QA runs in disciplined phases against defined exit criteria:

1. **Characterization** — no specification exists, so observed behaviour is documented and
   signed off by the client, becoming the acceptance baseline.
2. **Phase 1 — read-only automation** — navigation, render, console, API status, accessibility
   and access-control checks. Writes are **physically blocked at the network layer**, so testing
   is safe against the live dataset.
3. **Phase 2 — transactional automation** — create/edit/delete flows against an **isolated
   synthetic dataset**, so real youth records are never touched.
4. **Phase 3 — cross-browser and device execution** on BrowserStack, plus CI integration.

**Data-protection stance:** UAT contains real programme data, including records relating to
minors. Phase 1 cannot write to it by design. Phase 2 uses synthetic data only.

## 5. Test architecture

Established once, reused by every subsequent test category:

- **Authentication** is performed once per persona through the login API; the resulting session
  is saved and injected into the browser. No test performs a UI login, which also removes the
  Google OAuth path — unautomatable by design — from the critical path.
- **The read-only guarantee is enforced, not assumed.** Every mutating request
  (POST/PUT/PATCH/DELETE) to the platform is aborted at the network layer before it leaves the
  browser. The suite records every attempt, and the recording itself is verified by control. Across
  all runs, **no mutating request reached the platform** — and the guard did fire, blocking a
  financial write the invoice screen issues on page load.
- **Diagnostics per test** — console errors and failed network responses are captured for every
  route, so "the page rendered" is always accompanied by "and nothing errored".
- **One test project per persona**, bound to that persona's own session, so no test can
  accidentally exercise one role's routes with another role's credentials.

Concurrency is deliberately limited to three parallel sessions, and **suite runs are exclusive** —
two suites at once would present the platform with six sessions, which is the condition that
produces spurious failures (§7). This was demonstrated during development: a suite run alongside
another produced four failures on routes that passed when run alone.

Authentication also **reuses a valid session rather than re-authenticating**, because logging in
rotates the credential and invalidates the previous session (a recorded finding). Re-authenticating
blindly would corrupt any run already in progress.

**Known defects are registered rather than tolerated.** `data/known-defects.json` lists every
accepted failure with the finding it belongs to, and each is asserted as its *expected symptom*
rather than skipped. A route recorded as blank must still be blank, so if it starts rendering the
suite fails and the entry is retired. A route that begins failing in a *new* way is therefore not
absorbed by its own annotation. The purpose is a suite that stays green while real defects remain
open, because a permanently red suite cannot show a regression: nobody notices a seventeenth
failure among sixteen.

Accessibility debt is handled the same way but by count: a per-route baseline records what is
currently true, and the suite fails only on a rule that is new to a route or an element count that
has grown. Improvements are reported so the baseline can be tightened.

## 6. Phase 1 — categories and status

| # | Category | Status |
|---|---|---|
| 1 | Reachability smoke. Every static route loads, renders, no 5xx, no uncaught error, no write | **Complete** |
| 2 | Access control — RBAC read-leakage and auth-guard regression | **Complete** |
| 3 | Asset and link integrity | **Complete** |
| 4 | Accessibility baseline (axe-core, WCAG 2.1 AA) | **Complete** |
| 5 | API contract checks | **Complete** |
| 6 | Dynamic-route coverage (Phase 1b) | **Complete** — 17 of 17 covered |

## 7. Phase 1 baseline results — reachability

Every static route across the 6 in-scope personas was loaded under authentication and checked
for: render, no crash, no server (5xx) error, no uncaught JavaScript error, and no attempted
write. Figures are from **three consecutive full executions**, with each route classified by how it
behaved across all three rather than by any single run (§7i).

- Routes exercised: **235**, in every execution
- Render in every execution: **214**
- Render in some executions: **7** — environmental, confirmed rendering at single-session concurrency
- **Blank in every execution: 14 — the confirmed defects**
- Read-only invariant: **held** — no mutating request reached the platform

| Persona | Confirmed blank | Notes |
|---|---|---|
| CH | 0 | Clean |
| SM | 0 | Clean |
| OC | 0 | Clean |
| SP | 1 | `attendance-tracking` |
| SYC | 4 | Blank on direct load; `curriculum` data API returns 500 |
| FC | 9 | Blank on direct load |
| **Total** | **14 of 235** | 221 render; 7 of those only intermittently |

*Graph 2 — Reachability pass/fail by persona*

**A shared-component defect, not sixteen separate ones.** Two routes —
`group-based-counselling/attendance` and `group-based-assign-youth-status` — fail *identically*
in both FC and SYC. Two independently deployed applications failing on the same two route names
indicates a shared component or a shared route-state contract rather than coincidence. One fix
is likely to clear four of the fourteen failures. The root cause supports this: five of the blank
routes throw an identical class of uncaught exception. A null dereference on React Router
navigation state — and `group-based-counselling/attendance` throws the *same* exception in both
applications.

**Backend stability under concurrency.** At six parallel sessions, data endpoints returned
HTTP 500 widely; serialized, the same endpoints return 200. Even at the reduced three parallel
sessions, **3.0% of routes behaved inconsistently across three executions**, and at five sessions
that doubled to 6.8% while eight correctly-rendering routes returned blank. Three
concurrent sessions is a trivial load for a platform used by centre staff across multiple
locations. This is the clearest quantified symptom available and supports a dedicated load test.

**Interpretation of "reachable".** The current check confirms a route loads and renders content
without erroring. It does not yet confirm the content is *correct* — a page displaying wrong data
would pass. Deeper per-route assertions require the signed characterisation baseline (§4), and are
scheduled accordingly. This is stated explicitly so the coverage figures are not read as
"the platform works".

## 7a. Access-control results — RBAC read-leakage

Each persona application was observed to establish which backend endpoints it legitimately
calls; **71 distinct backend methods** were observed in use, of which 67 request signatures proved
exclusive to a single persona. Every one was then replayed using
each *other* persona's credential, byte-identical apart from the authorization header, so the
credential is the only variable. **318 probes. All read-only.**

> **Correction, 2026-09-19.** An earlier version of this section reported no cross-persona data
> leakage. That result was produced by a defective check and has been **retracted**. The checker
> inspected the wrong part of the response envelope and never examined a single record. It has been
> corrected, verified against controls where the answer was known in advance (§7g), and re-run.
> The corrected result is below.

**Cross-persona data leakage is present on three endpoints.**

Each persona's declared `permitted_centres` was compared against the records it actually received.
A record counts as a violation only when it carries **no** centre the caller is permitted for. A
record spanning several centres, one of which the caller owns, is excluded as arguable. Reproduced
across every recorded query variant.

| Endpoint | Caller | Records wholly outside scope |
|---|---|---|
| `approval.approval_list` | SP | **5 of 5** |
| `get_waiting_for_skilling_count` | CH | 2 of 3 |
| `get_waiting_for_skilling_count` | SYC | 2 of 3 |
| `get_waiting_for_skilling_count` | FC | 1 of 3 |
| `centre_head…get_approvals` | SP | 3 of 10 (one query variant) |

The platform publishes each account's permitted centres at login and then serves data outside them.
The approvals case is the most serious: every record returned to the Skilling Partner account
belonged to centres outside its scope, and approval records carry workflow detail including
location and transfer destination.

**This is the failure mode the endpoint-authorisation finding predicted.** Because most endpoints
are callable by every persona, the only control separating roles was each endpoint scoping its own
data. These are endpoints where that scoping is absent. The fix is a server-side filter on the
caller's permitted centres. The endpoints that scope correctly show the intended pattern.

**One clean result does stand**, and it has been verified with a control proving the check would
notice data being served (§7g): **unauthenticated access is refused.** Every one of the **71
distinct endpoints observed in use** was probed with no credential — **all 71 returned 403, none
served data**. This is exhaustive across the observed endpoint set rather than sampled. The
disabled frontend route-guard therefore exposes no data, because the backend refuses anonymous
callers.

**Two defects were found behind that clean result:**

1. **[S2] Server stack traces are disclosed to authenticated users.** Two screening endpoints
   return HTTP 500 with a full Python traceback, including server filesystem paths, to the
   lowest-privileged persona. The underlying error is a `NameError` — a code defect on a
   role-dependent path, not a permission denial; the same endpoint returns 42 KB of data
   successfully to a different persona. Framework debug output should never reach a client in a
   deployed environment.

2. **[S3] Endpoint authorization is inconsistent.** Offered other roles' exclusive endpoints,
   personas were refused between **0% and 29%** of the time:

   | Caller | Readable | Refused | Refusal rate |
   |---|---|---|---|
   | OC | 48 | 0 | 0% |
   | CH | 36 | 3 | 8% |
   | FC | 45 | 7 | 13% |
   | SYC | 45 | 9 | 16% |
   | SM | 33 | 11 | 24% |
   | SP | 33 | 14 | 29% |

   Most endpoints do scope their results to the caller's permitted centres, which is why the
   leakage above is confined to a handful rather than being universal. That is also the concern:
   per-endpoint scoping is the *only* control separating roles, so an endpoint written
   without it is immediately reachable by every persona. The endpoints listed above are exactly
   that case.
   Access was also observed to vary with query parameters on one endpoint, which means the
   decision is not a property of the caller alone.

**Method note.** A first pass reported six leakage violations. All six failed verification —
centre names appear inside batch codes and community names, and a locality inside a longer
string is not evidence of disclosure. The detector was rewritten to require a field's value to
*be* an out-of-scope centre, and the suite re-run. A later pass found the opposite error in the same
check. It was reading the wrong response envelope and never examining a record at all, which is
what produced the retracted clean result. Both corrections are recorded because together they are
what make the current figures worth relying on.

## 7b. Access control — authentication guard

A session-less visitor was sent to a deep authenticated route in every persona application, with
the backend's answers recorded.

| Application | Session-less visitor | Backend calls | Verdict |
|---|---|---|---|
| SP · SYC · SM · OC | redirected to the login page | 0 | Correct |
| **FC** | left on the route, empty shell | 4, all refused | **Defect** |
| **CH** | left on the route, empty shell | 3, all refused | **Defect** |

**This corrects an earlier assumption.** The disabled route-guard was expected to be copy-pasted
across all six applications. It is not — four behave correctly, and only FC and CH are affected.
Scoping the defect properly matters: it is the difference between a platform-wide security
concern and a two-file fix.

**Mechanism, established by experiment.** The axios interceptor redirects on HTTP **401** only.
A session-less request is answered **403**, which it does not handle, so the redirect never fires.
Seeding an *invalid* credential produces a 401 and the application **does** redirect correctly —
which proves the interceptor works and only its status coverage is wrong.

**Suggested fix:** treat 403 like 401 in the response interceptor of the FC and CH applications.
The other four already do the right thing and serve as the reference implementation.

**No data is exposed in either case** — the backend refused every call (§7a).

## 7c. Accessibility baseline — WCAG 2.1 AA

**All 235 routes scanned** with axe-core. 182 carry violations; 53 are clean.
**Roughly 3,550 affected elements** in total. Blank routes were excluded. Those are reachability
defects, not accessibility ones.

| Rule | Impact | Routes affected | Elements |
|---|---|---|---|
| `aria-allowed-attr` | critical | **182 / 182** | 808 |
| `image-alt` | critical | **182 / 182** | 428 |
| `listitem` | serious | **182 / 182** | 1,452 |
| `list` | serious | **182 / 182** | 182 |
| `color-contrast` | serious | 113 | 314 |
| `label` | critical | 84 | 137 |
| `button-name` | critical | 66 | 172 |
| `scrollable-region-focusable` | serious | 24 | 27 |
| `aria-prohibited-attr` | serious | 18 | 36 |
| `svg-img-alt` | serious | 9 | 24 |
| `select-name` | critical | 2 | 13 |

**The distribution is the finding, and full coverage confirms it exactly.** Four rules fire on
**every one of the 182 affected routes**, accounting for roughly 80% of the elements. These are
not 182 pages of independent mistakes. They are the shared navigation and layout component,
repeated. The practical consequence is that a screen-reader user cannot identify navigation items,
cannot operate icon-only buttons, and meets malformed list structure on every page: the platform
is effectively unusable without sight. For a foundation delivering public-benefit programmes that
carries procurement and funding exposure alongside the usability cost.

**The remediation is far smaller than the headline number.** Because the violations are
concentrated in shared components, a handful of corrections — list markup, alt text on navigation
icons, accessible names on icon-only buttons, removal of disallowed ARIA attributes — clears the
large majority of the roughly 3,550 affected elements.

**Coverage caveat, stated deliberately:** axe-core detects roughly 30–40% of WCAG issues. Every
item above is a real defect, but a clean automated run would not demonstrate accessibility.
Keyboard traversal, focus order and screen-reader semantics need a manual pass that is not
currently in scope.

## 7d. Asset and link integrity — clean

**All 235 routes**, plus the shared authentication application. **Roughly 2,200 asset requests,
zero failures.** No missing assets, no source-tree paths that escaped the bundler, and
every internal link resolves to a route defined in the application's own router.

A previously logged defect. A `/src/` asset path requested by the built login page — **no longer
reproduces**, and is recorded as not-reproducible pending one confirmation before final reporting.
Retesting earlier findings is part of the method, not an afterthought.

Twenty-one dead anchors (`href="#"`) remain, including "Forgot Password?" on the login page. Individually
cosmetic; that particular one matters more, because it is the only password-recovery route a
locked-out user can see.

## 7e. API contract

Contract checks assert the *shape and behaviour* of responses independently of the data in them.
They are what catch a backend change that silently breaks every application consuming it.

**Two defects found, both of the kind manual testing does not surface:**

1. **[S3] `permitted_courses` changes type by account.** FC, SP and SM receive an array; CH, SYC
   and OC receive the string `"NA"`. A client calling `.map()` or `.length` on this field behaves
   differently depending on who logged in. `"NA".length` is 2, so a simple count reports two
   courses where there are none. A wrong answer returned silently is harder to detect than a crash,
   because nothing signals that anything went wrong. `permitted_centres` is correctly an array for
   every account and shows the intended pattern.

2. **[S3] Logging in silently terminates the previous session.** `api_secret` is regenerated on
   every login and the previous one immediately returns 401. A staff member who signs in on a
   desktop is signed out on their phone, and lands on the login screen mid-task with no
   explanation. Field staff moving between devices will meet this routinely. Whether
   single-session-only is intended is a question for the client; either way it should be signalled
   rather than silent.

**And it escalated an existing finding.** The stack-trace disclosure reported in §7a is not limited
to two endpoints: **56 traceback-bearing error responses** were found, and they are **401s**. A
request carrying an invalid credential. No valid session required at all — returns a Python
traceback naming framework source files. This is the platform's standard error envelope, meaning
traceback rendering is enabled site-wide in a deployed environment. That reframes it from an
endpoint bug to a **single configuration change that resolves all 56 instances**.

## 7f. Blank routes — classified

The routes failing on direct load were each loaded directly, then reached again by client-side
navigation from the working application root.

**14 render nothing by either path**, and those 14 are the set confirmed blank in all three
executions (§7i). They are broken screens rather than deep-link defects, which removes an entire
line of investigation for the development team.

Two routes originally in this set — `/syc/coming-soon` and `/sp/post-test-assessments` — were
subsequently shown to render, and are classified environmental rather than defective.

*Stated limitation:* client-side navigation was simulated without route state. A screen requiring
state passed by a specific originating page would also appear blank here. The conclusion "these
screens do not render unaided" is firm; "no navigation path renders them" is not claimed. The root
cause established later (§7 — a null dereference on navigation state) is consistent with both.

## 7g. How we know the checks themselves are correct

A test suite is an instrument, and an instrument that reads zero because it is broken looks
identical to one that reads zero because there is nothing to find. Several results in this document
are clean results — "no writes escaped", "no data served to anonymous callers", "no broken assets".
Each of those would appear exactly the same if the detection behind it had silently failed.

During this engagement three checks were found to be reporting the wrong answer. None were caught
by reviewing the code; each was caught by noticing an implausible result and constructing a case
where the answer was already known. That experience is the basis for the practice below.

**Every check is now given a case where the defect definitely exists, and must report it.**
A check that cannot be made to fail is not checking anything. Each is also given a clean case and
must stay silent. Where a real flaw was previously found, a control reproduces it exactly, so the
same mistake cannot return unnoticed.

**36 verification checks, currently all passing**, covering:

| Check under test | Proven to detect | Proven to ignore |
|---|---|---|
| Cross-role data scoping | An out-of-scope centre in either response envelope, including JSON nested inside a string | A centre name appearing inside a longer string, e.g. a batch code |
| Read-only guard | A mutating request to the platform — and that it is *recorded*, not silently dropped | Requests to third-party hosts, which must never be intercepted |
| Blank-page detection | A page whose application root is empty | A page that has rendered content |
| Accessibility scanning | The exact rules reported against the platform, on markup that violates them | — |
| Broken-asset detection | A reference to an asset that does not exist | — |
| Unauthenticated access | Data being served on a 200 response | — |
| URL construction | The platform's legitimately doubled route prefix | — |
| Dynamic-route resolution | A missing identifier, reported rather than invented | — |

These run against local fixtures and synthesised responses. **Nothing in this verification contacts
the platform**, because an instrument cannot be validated using the system it is meant to measure.

**What this does not cover, stated plainly:** the endpoint inventory is built from a sample of
routes per application, so an endpoint never exercised by those routes was never probed. Identifier
harvesting relies on field-naming conventions. These are coverage limits rather than correctness
limits, and they are recorded here so the scope of the assurance is not overstated.

## 7h. Dynamic routes — and the finding that justified the read-only design

Detail screens were reached using real record identifiers harvested read-only from the list
endpoints the applications already call. **All 17 dynamic routes covered; all 17 render at
single-session concurrency, and none fails consistently under parallel load.**

**A finding that would not have surfaced any other way came from this run.** Opening the invoice
preparation screen causes the application to issue, with no user action at all:

`POST .../youth_skilling.api.invoice.prepare_tax_invoice?batch_id=…&installment=1&center=…`

Navigation performs a financial write. Refreshing, bookmarking, sharing the link or pressing the
back button re-fires it; any user who merely opens the screen to look at it performs a financial
action. Reproduced on both the Skilling Partner and Skilling Manager applications.

**The request never reached the server.** Phase 1 blocks mutating requests at the network layer
rather than relying on testers avoiding them, and this is the first time in the engagement that
guard has fired. Without it, this suite would have attempted to prepare tax invoices against real
batches at a live centre. The safety measure was not precautionary theatre; it was load-bearing.

We have deliberately **not** established whether that call persists a record or only computes a
preview, because determining it requires letting it execute against live financial data. That
question is for the client, and it decides the severity: if the call commits a record, this becomes
a **second** S1 alongside the counselling-records disclosure (§8).

**A coverage gap we reported, then closed ourselves.** Six routes were recorded as blocked pending
sample values for `:category`, `:invoiceId` and `:preEnquiryId`. Re-examined, all three proved
obtainable from the platform: invoice identifiers from the invoice list, pre-enquiry identifiers
from a list endpoint that keys records on `id` rather than the conventional `name`, and `:category`
as an enum rather than a record identifier at all.

The gap existed because the endpoint inventory is built from six sampled routes per persona, so
screens never sampled contributed no endpoints and their identifiers appeared unobtainable when
they were merely unvisited — compounded by an early harvest that ran while a concurrent suite was
rotating sessions, producing 401s that read as access failures. Neither was re-tested after the
session handling was fixed.

**Re-test a dependency on the client before reporting it as one.** Asking for something we could
have obtained ourselves costs both credibility and calendar time.

## 7i. Stability verification — three consecutive executions

The full 235-route sweep was executed three consecutive times. Each route is classified by how it
behaved across all three, because a platform that fails intermittently cannot be characterised by a
single observation.

| Verdict | Routes |
|---|---|
| Blank in **every** execution — reportable defects | **14** |
| Blank in **some** executions — environmental | 7 |
| Rendering in every execution | 214 |
| **Measured instability** | **3.0%** |

The seven inconsistent routes were then re-tested at **single-session concurrency** and **all seven
rendered correctly, twice**. They are not defects in those screens; they fail only under concurrent
load — independent corroboration of the concurrency finding from a different direction.

**This process removed three false defects before they reached you.** Each had been recorded from a
single observation, and each rendered correctly in all three executions. All three would have been
reported. A development team that investigates a reported defect and finds nothing wrong will
discount the next report as well. The cost of a false positive is therefore not the hour spent on
it, but the weight the client gives to everything else in the register.

Every defect in this report reproduces in three consecutive executions.

## 8. Findings register

**49 findings logged:** **1 × S1** · 15 × S2 · 9 × S3 · 6 × S4 · 18 informational. Three further findings were raised and subsequently **withdrawn** after repeated execution disproved them; they remain in the register, struck through, as part of the record.
The complete register, with evidence and reproduction detail, is maintained alongside the suite.

*Graph 3 — Findings by severity*

Highlights:

- **[S1] Youth counselling records disclosed across a permission boundary.** An Outreach
  Coordinator account receives counselling records for centres it has no permission over — ten of
  ten outside scope, each carrying a youth's name, session type and free-text remarks.
  Reproduced in three consecutive verifications. First recorded as a missing server-side filter;
  corrected on 2026-09-20 to the actual cause, which is that the handler's filter is skipped for
  any caller holding `System Manager`, a role every staff account must hold.
- **[S2] Authentication route-guard disabled in two applications.** FC and CH leave a session-less
  visitor on the route instead of redirecting; SP, SYC, SM and OC behave correctly. *No data
  exposure* — the backend refuses unauthenticated calls, verified across all 71 endpoints — but
  logged-out users reach broken empty pages instead of a login screen (§7b).
- **[S2] UAT frontend calls the DEV backend.** The UAT site communicates with `api-dev`, so
  testing UAT may not exercise the release candidate. Requires client confirmation.
- **[S2] Long-lived API secret in `localStorage`.** Frappe API key/secret pairs are long-lived
  credentials, not short session tokens. Cross-site scripting anywhere on the domain would
  exfiltrate a permanent credential.
- **[S2] Shared-origin credential store.** All 7 persona applications share one browser origin
  and therefore one `localStorage`; one persona's tokens are readable by another persona's
  application. Key collisions between personas were observed in practice.
- **[S2] Fourteen routes render blank on direct load**, confirmed in three consecutive executions,
  including the shared-component cluster described in §7. Root cause: a null dereference on React
  Router navigation state.
- **[S2] Backend instability under modest concurrency** (§7).
- **[S2] Server stack traces returned in the standard error envelope** to callers with no valid credential — 56 instances, one configuration change (§7e).
- **[S2] Systematic WCAG violations in shared navigation** — 182 of 235 routes affected, roughly 3,500 elements, with four rules accounting for about 80% (§7c).
- **[S3] Inconsistent endpoint authorization**, 0–29% refusal across roles (§7a).
- **[S3] Outreach Coordinator account returns an empty role profile**; committed `.env.prod`;
  dead "Forgot Password" link; password field missing `autocomplete`.

## 9. Constraints and decisions on record

| Date | Decision / constraint | Rationale |
|---|---|---|
| 2026-09-18 | **Phase 1 performs zero writes**, enforced at the network layer | UAT holds real programme data including minors' records |
| 2026-09-18 | **Concurrency capped at 3 parallel sessions** | Higher concurrency produces server-side 500s and false failures |
| 2026-09-18 | **PM deferred** until feature-complete | Defects against an in-flight build are obsolete before they can be actioned |
| 2026-09-18 | **Defects are reported, not fixed by QA** | Independence of the QA function; fixing and certifying the same code removes the assurance value |
| 2026-09-18 | **BrowserStack account is on the Free plan** | Verified via the BrowserStack API. Capacity implications in §10 |
| 2026-09-19 | **All findings delivered together at Phase 1 closure**, rather than in waves as they are found | Client decision. A single organised delivery is easier to receive and act on than several partial ones. Consequence: the S1 is open in the interim, and the closure report leads with it so it cannot be missed in a register of forty-nine findings |

## 10. Open items requiring client input

1. **Data-processing agreement / NDA.** QA holds standing access to real programme data
   relating to minors. This should be documented before Phase 2.
2. **Definition of done and deliverable list.** Specifically: does "complete" mean defects
   *found*, or *found, fixed and retested*? The second makes the development team's fix cadence
   the determining factor in the schedule.
3. **Environment mapping.** Is the UAT frontend calling the DEV API intentional?
4. **BrowserStack capacity.** The supplied account is on the **Free** Automate plan
   (5 parallel sessions). Measured from our own execution timings — mean 15.3s per route,
   median 12.7s, across 260 executions, plus 1.3× for remote latency:

   | Scope | Session-minutes |
   |---|---|
   | Full 235-route pass, one browser configuration | ~78 |
   | Five configurations (a standard matrix) | ~390 |
   | Curated subset (~25 routes), five configurations | ~55 |

   **A purchase may not be needed at all.** Playwright runs Chromium, Firefox and WebKit locally at
   no cost, which covers the three major engines; the free allowance is then best spent on what only
   BrowserStack provides — real iOS Safari and real Android — against the curated subset, at roughly
   22 session-minutes. The full recommendation, including which of BrowserStack's products are
   required (one) and why additional parallel sessions would be wasted spend, is in the separate
   **BrowserStack Recommendation**.
5. **Test data provision for Phase 2** — a synthetic dataset, a resettable environment, or a
   defined set of safe records.

## 11. Next steps

**Phase 1 is closed.** All eight exit criteria are met and the deliverables are prepared. The work
below is Phase 2 and the client decisions that gate it.

1. **Client delivery** — the five Phase 1 documents, the findings register and the charts, issued
   together rather than in waves (§9, decision of 2026-09-19).
2. **Phase 2 environment** — the feasibility spike is running; §13 records it as it proceeds.
3. **Payload schemas** — from the isolated instance if the spike succeeds, from captured requests
   if it does not (§13.2).
4. **Lifecycle automation** — create, edit, state-change and delete across the 21 business objects.
5. **BrowserStack integration proof** (Phase 3) — one persona, five routes, two configurations,
   to validate the pipeline before committing the free allowance to it.

## 13. Phase 2 — transactional automation

### 13.1 The safety model is inverted, and that is the central risk

Phase 1 was safe by construction: every mutating request was aborted at the network layer, so no
amount of test error could damage data. Phase 2 removes that guarantee deliberately — its purpose
is to write. The replacement guarantee is therefore structural rather than procedural:

> Mutating requests are permitted to the isolated test host and refused to every other host,
> enforced in the fixture by host allowlist before any test runs.

Three properties, each verified by control in [utils/write-guard.js](../utils/write-guard.js):

| Property | Meaning |
|---|---|
| **Default-deny** | An unrecognised host is refused. An unset or mistyped `TEST_HOST` fails closed, not open. |
| **Production named explicitly** | The platform's hosts are refused *before* the allowlist is consulted, so no configuration — including a mistake in `.env` — can open a path to their data. |
| **No per-test override** | There is no flag a test can set to write elsewhere. Changing the target is a configuration change, not something done while debugging. |

The self-verification suite grew from 36 controls to **46** to cover this. One control exists
because of a defect found during the build: the allow path originally used `url.includes(host)`,
which would have permitted `https://elsewhere.example/?ref=localhost:8080` — a URL that *contains*
the allowlisted host without being it. Deny paths may fail closed on a substring; an allow path may
not. It now parses the URL.

### 13.2 Write surface

Analysis of the frontend API layer identified **814 endpoint references across the six in-scope
applications** — references rather than distinct endpoints, because shared operations such as
`create_task` appear in three of them. Among these, **106 distinct endpoints were write candidates**
by operation name, of which **103 are confirmed mutating** and span 21 business objects. The other
three (`get_reg_form_b_data`, `approved_by_list`, `follow_up.get_list`) are reads whose operation
names implied a write; classification removed them, which is what the classification step is for.

Per application: FC 194 references (35 write candidates) · SM 172 (38) · OC 138 (31) ·
SP 109 (27) · SYC 106 (16) · CH 95 (18).

| Class | Endpoints | Meaning |
|---|---|---|
| DESTRUCTIVE | 5 | Deletes a record |
| CREATE | 34 | Creates a record |
| STATE | 34 | Changes status, approval or assignment |
| MUTATE | 23 | Edits an existing record |
| UNVERIFIED | 7 | Classification not established from source alone |

Request shapes are not extractable from the frontend: its API layer takes an opaque `payload` from
the calling component. There are two routes to them, and the order matters:

1. **From the backend schema.** Frappe is schema-driven. Every DocType carries an authoritative
   field definition. On an isolated instance these are readable directly: complete, exact, and one
   query rather than one reverse-engineered form per object.
2. **From blocked requests.** With no backend available, a form is opened, filled with synthetic
   values and submitted; the Phase 1 guard aborts the request before it leaves the browser and
   records its shape. Safe and accurate, but per-form — 102 endpoints of UI automation.

**The feasibility spike therefore runs first**, because its outcome decides whether route 2 is
needed at all. This resequenced the design written earlier the same day.

### 13.3 Feasibility spike. The platform is larger than the handover

The spike's first question was what the environment must contain. Asked directly —
`frappe.utils.change_log.get_versions`, which is the authoritative list of applications **installed
on the site** — the platform reports **twelve**, not the eight whose repositories we hold:

| Source | Applications | Obtainable |
|---|---|---|
| Framework | `frappe` 15.113.2, `erpnext` 15.114.0, `insights` 3.12.5 | Yes — open source |
| WeConnect | the eight supplied backends | Yes |
| Vendor | `fintoo_analytics_bridge` | **No** |

`fintoo_analytics_bridge` exists in none of the eighteen repositories in the foundation's GitHub
organisation. This is recorded as a finding in its own right (S2): **the platform as deployed
cannot be rebuilt in full from the code the foundation owns.** That matters beyond testing. It is
a business-continuity question about disaster recovery and vendor dependency, and it is worth
answering regardless of what QA needs.

Three further applications — `hrms`, `mannlowe_support` and `materialized_view_builder` — hold
**module records in the database but are not installed**, residue from a previous installation that
was never cleared. That is a defect in its own right (S3), and it is also how this section came to
be wrong in an earlier version: `Module Def` was read as though it were the installed-application
list. Module records describe what the database remembers; only `get_versions` describes what the
site runs.

For the spike specifically, the question is narrower: are they *required*? Source analysis says no.
The eight applications define **293 doctypes** and reference **19** they do not define; all nineteen
are Frappe core or ERPNext/HR doctypes (`Employee`, `Designation`, `Cost Center`, `Fiscal Year`,
`Task`, `Location`, `Industry Type`, and Frappe's own `User`, `Role`, `File`, `ToDo` and others).
**No source reference to `fintoo_analytics_bridge`, or to any of the three uninstalled
applications, exists** in any of the eight.

No application declares `required_apps`, so they install independently; only `outreach` carries
external dependencies (`indiapins`, `gspread`, `google-auth`), all standard packages.

### 13.4 Spike verdict: the environment is built, and Phase 2 is unblocked

**The isolated environment exists, matches the platform, and works.** Ten of ten applications
installed with no failures, pinned to the platform's exact versions:

| Layer | Versions installed | Platform runs |
|---|---|---|
| Framework | Frappe 15.113.2 · ERPNext 15.114.0 · Insights 3.12.5 | identical |
| Runtime | Python 3.11 · Node 22 | matching the official v15 image |
| WeConnect | all eight backend applications | identical set |

**Drift is measured, not asserted.** [utils/compare-environments.mjs](../utils/compare-environments.mjs)
queries the installed-application list on both sides and compares them application by application:

```
NO DRIFT. 11 applications match; 1 documented exception.
```

The exception is `fintoo_analytics_bridge`, which is not available to us. It is recorded in the
Definition of Done §3a rather than absorbed silently.

**The first build was discarded because it drifted three ways** — framework at branch HEAD, Frappe
HR installed that the platform does not have, and Insights missing that it does. Two of those three
were our own additions. Finding them required reading the installed-application list properly, which
is also what exposed the miscount described in §13.6.

Verified end to end rather than assumed:

| Check | Result |
|---|---|
| Version drift | **None** — 11 of 11 obtainable applications match exactly |
| Site serves | HTTP 200 |
| API answers | `ping` -> `pong` |
| **WeConnect login** | **Returns the production envelope** — `employee_id`, `sp_role`, `role_profile`, `permitted_courses`, `permitted_centres` |
| Wrong password | `{"success_key":0,"message":"Authentication Error!"}` — matches production |
| `Employee` resolves without Frappe HR | Yes — supplied by ERPNext, module `Setup` |
| Doctypes on site | 1,100 |
| Schemas identical across both builds | **293 doctypes, 433 mandatory fields, zero differences** |

Three consequences follow.

**The vendor application is not required for testing.** Nothing referenced `fintoo_analytics_bridge`
and nothing failed without it. That resolves the question its absence raised for Phase 2. It does
not resolve the business-continuity question, which is about the foundation's position rather than
ours and stands unchanged.

**`Employee` comes from ERPNext**, module `Setup` — established by querying an installed instance
rather than inferring from a naming series, and confirmed again on a build with Frappe HR absent.

**The payload problem is solved.** `data/doctype-schemas.json` now holds **293 doctypes, 2,690 field
definitions, 433 mandatory fields and 141 child tables**, read directly from the schema. This is
what the resequencing in §13.2 was for: had the spike run after payload capture, we would have spent
days reverse-engineering 102 forms to obtain a worse version of this file.

**Phase 2 requires nothing further from the client to proceed.** Destructive testing runs against
synthetic data on an isolated host; no real programme record is involved at any point, which is the
guarantee the write guard enforces structurally.

### 13.5 The duplicate-doctype defect, confirmed on a live installation

The source analysis predicted that `Categories`, `Event Category` and `Reason For Visit` — each
declared by both `batch_management` and `event_management` — would resolve to whichever application
migrated last. On the installed site all three are owned by **`event_management`**, and
`batch_management` holds **57** doctypes against the **60** it declares. It lost exactly those
three. The prediction and the observation agree, which is what moves this from a code-reading
observation to a verified defect.

### 13.6 A correction, recorded

Midway through the spike I concluded from source inspection. No `erpnext` string in any of the
eight applications. That the platform was pure Frappe, and edited that correction into six files
including two client documents. The live platform then reported **ERPNext 15.114.0 installed**. The
applications do not *reference* ERPNext; the site runs it, and absence of a reference is not absence
of a dependency.

The original description was correct and has been restored. The failure was method rather than
conclusion: definitive evidence was available throughout — one authenticated call to
`frappe.utils.change_log.get_versions` — and inference from partial evidence was used instead of
asking the system. The withdrawn entry remains in the findings register, struck through.

### 13.7 A clean result worth recording

Attempting to read DocType metadata with a persona account returns **403 Permission Denied**. The
schema is not introspectable by an ordinary user, which is correct behaviour and a positive security
result — recorded because a register that lists only faults gives no sense of what is sound.

## 12. Change log

| Version | Date | Changes |
|---|---|---|
| 1.41 | 2026-09-25 | **Repository found public and made private; mass-assignment analysis corrected; verification extended to every P1; permission model drafted.** **The repository was public from 20 September until today — five days — and GitHub records 157 clones from 75 unique sources.** Made private; the findings register, API and HTML page now return 404 anonymously. A full-history scan of 38,456 lines found no credentials, keys or tokens, and `.env` was never committed; what was exposed is the findings themselves, live hostnames and the reproduction scripts. **WC-124 rewritten after finding two faults in our own analysis:** commented-out code was counted as live, and a denylist (`remove_keys_from_dict`, `data.pop`) was scored as a filter when it only strips keys the handler already consumed. Corrected result over live code: 27 whitelisted sites, 10 allowlisted, **17 not** — 12 relying on a denylist alone and 4 saving with `ignore_permissions=True`. The earlier 28/22/6 figures should not be relied on. **`verify/` extended from 11 findings to 23, covering all 17 P1 items.** Four draft checks gave false passes before correction — three used guessed endpoint or handler names (`create_user`, `delete_file_by_url`, `raise_invoice`'s `center` parameter) and one counted on-disk doctype JSON without deduplicating the three doctypes defined twice by two apps, reporting 182 where the database says 178. The corrected check now reproduces the database exactly: 293 doctypes, 178 System-Manager-only, 115 none, 0 other. WC-077 moved from a live probe to a source check, because the endpoint is POST-only and POSTing would create a user on a live system. **New deliverable: PERMISSION-MODEL-PROPOSAL.md**, a draft matrix derived from the endpoints each persona's application demonstrably calls. Notes that only 176 of 293 doctypes need entries, since 117 are child tables that inherit from their parents. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.40 | 2026-09-25 | **Every client-facing document corrected and re-dated, the client already holding the repository.** **TIMELINE was materially wrong** — dated 20 September, it still listed Phase 2 as 7–11 days of remaining work and carried two client decisions that testing had already resolved. Rewritten from the current position: Phases 1 and 2 complete, Phase 3 the only QA work left, three decisions outstanding rather than six, and a note that cross-browser and CI can start now because they assert observed symptoms rather than correctness. 1,312 -> 740 words. **BROWSERSTACK** was a recommendation document whose recommendation sat at line 41; the answer — smallest paid Automate tier, 3–5 parallel sessions, curated subset, and do not buy more parallelism — now opens it, with the working below. Both closure reports re-dated and their three S1s tagged with register identifiers (WC-048, WC-084, WC-095) so they cross-reference. Repo README gains a **Start here** block and the missing `verify/` row; docs README describes the characterisation's Part 1 split. All documents re-dated 25 September and versions bumped. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.39 | 2026-09-22 | **Documents restructured to put the action first.** The characterisation was doing two jobs for two readers — a decision request and a reference baseline — and conflating them meant a reader waded through 4,900 words to discover they had two decisions to make. It is now Part 1, the ask and the sign-off in **670 words**, followed by the baseline clearly marked as reference. Section 12 was deleted as redundant once Part 1 stated the same answers with their file and line evidence; the 'why this document exists' prose was cut by half. Total 4,923 -> 4,170 words, and the part that must be read before signing is 670. The engagement report had the same fault, with 'What we need from you' as section 6 of 7: an **In brief** block now opens it — what we found, the four quick wins with their identifiers, and the one thing we need — so the engagement is legible in 150 words. Still six pages, no overfull boxes. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.38 | 2026-09-22 | **Characterisation document restructured so its real ask is visible, and the sign-off corrected.** The document had a structural fault: a reader met sixteen open-looking `[DECISION]` markers between lines 61 and 358 and only learned at line 384 that two of them were theirs. Each marker is now tagged in place — *we answered this; please confirm* (7), *narrowed* (6), *this one genuinely needs you* (2) — and an orienting note sits before section 2 so the position is known before reading. The sign-off table was contradicting section 12 by demanding "decisions provided for all 15 items"; it now has three separate rows for the seven to confirm, the six to acknowledge and the two to answer. TIMELINE and the Phase 1 closure report carried the same stale framing and were reworded. Accounting verified: 7 + 6 + 2 = 15, consistent across the front note, section 12 and the sign-off. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.37 | 2026-09-22 | **Two of the four "client only" decisions answered by investigating rather than asking; the genuine count is two.** 5.7 settled: organisation-wide visibility of the centre list is required by the platform's own design — `Change Training Location` is a first-class `Counselling` category handled at `youth_skilling/api/counselling.py:580`, and staff cannot move a youth between locations without seeing centres outside their own. The data is centre names, not youth information. 5.9 settled as to intent: six persona role profiles exist, `auth.py` compares `role_profile_name` against them, routing dispatches on it, and 45 correct centre-scoping filters are present — the per-persona scaffolding is complete and only the doctype permission rules were never authored, so `System Manager` is a consequence rather than a choice. Writing the 293-doctype matrix remains a design deliverable we should draft rather than a question we should ask. 3.2.2 narrowed to its contractual core by querying the live platform read-only: `fintoo_analytics_bridge` declares one module and zero doctypes, has no scheduled jobs, exposes no resolvable API method, is referenced by no captured frontend call, and the isolated rebuild runs without it — it appears inert on that environment, leaving only rights and escrow, which no testing can reach. 9.1 stands as genuinely undecidable from code, reducible to an anomaly shortlist. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.36 | 2026-09-22 | **The fifteen characterisation decisions re-examined; five answered from the code and data, six narrowed, four left as genuinely the client's.** We had been asking the client questions we could answer ourselves. Settled: `"NA"` is a deliberate sentinel written at `auth.py:392,394` (5.3); the empty Outreach Coordinator `role_profile` is a configuration gap, since `auth.py:393` passes the stored value through unmodified and a correctly configured account returns it (5.4); `api_secret` regeneration on every login is WeConnect's own code at `auth.py:64-76` and looks unintended, because the adjacent `api_key` is guarded by `if not` and `api_secret` is not (4.5); `/coming-soon` is a single destination route in five applications and `test-zustand` one route in OC, not per-screen markers (6.6); and the blank routes are null dereferences, not unbuilt features (10.1). **Correction to 10.2:** the entry claimed the record identifier was 'already present' in the URL for most affected routes. Cross-checking all 13 blank routes against the route table showed none is dynamic — only 17 routes platform-wide carry a `:param`, and no blank route is among them. Deep-linking is therefore a routing change, not a read-from-URL change, and the earlier wording would have led the client to under-size the work. New section 12 in the characterisation sets out which decisions are settled, narrowed or theirs; sign-off renumbered to 13. Report and README reframed so the client sees four real questions rather than fifteen. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.35 | 2026-09-22 | **Findings given stable identifiers and priorities, and a verification suite added.** All 126 register entries now carry an identifier (`WC-001`–`WC-126`) that does not change if severity or ordering does; 119 are active. All 79 defects carry a priority from P1 to P4 (17 P1, 32 P2, 22 P3, 8 P4); informational entries carry none. Priority weighs fix cost against the cost of leaving it, so it diverges from severity in both directions: four P1s are minutes of work, while the authorisation rebuild is P1 because the three S1s cannot close without it. New `verify/` tool re-checks findings against any environment and reports which are fixed — read-only HTTP checks safe against production, source checks needing only a checkout, and write-based probes it deliberately refuses to run itself. A check that cannot run reports an error, never a pass. **Writing the checks corrected two of our own entries:** WC-088's typo exists at two sites (`enquiry_form/form.py:38` and `enquiry.py:248`), not the one we recorded, and three draft checks gave false passes before being fixed or removed — the state-transition check was removed outright because no source heuristic can answer it. The report gains a Where to start section naming the four quick wins and grouping the remaining P1s; now six pages. Register unchanged at 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.34 | 2026-09-22 | **The four remaining coverage gaps closed: cross-origin policy, mass assignment, boundary values and state transitions.** CORS on the live backend reflects any origin, including an unrelated domain, with credentials allowed; the session cookie's `SameSite=Lax` is what currently prevents exploitation, and every `*.lighthouseconnect.org` host is same-site and therefore permitted (S3). Mass assignment swept across the whole API surface rather than two samples: 28 endpoints pass a request dictionary into a document write, 22 filter first, and of the six that do not, `add_interest` was confirmed writing an undeclared field onto a Youth record and saving with `ignore_permissions=True` (S2), while `update_profile` was confirmed unfiltered against the User doctype with its permission check unreachable after a missing `return` (S3). Boundary-value analysis found 10 of 12 self-contradictory values stored without complaint — negative age, future date of birth, capacity floor above ceiling, negative course cost, instalment percentages of 150% and -20% — and the chain was demonstrated end to end through the public API (S2). State-transition testing found no transition control of any kind: 174 of 174 attempted status changes accepted across six doctypes, including `Paid` to `Not Raised Yet` and `Cancelled` to `Paid` on invoices (S2). The engagement report gains a third structural cause, that the doctypes define no rules of their own, alongside the two authorisation causes. New probes: `mass-assignment-probe.mjs`, `chained-boundary-probe.mjs`, plus boundary and state-transition steps. Register 113 -> 119 active (3 S1, 37 S2, 31 S3, 8 S4, 40 Info). |
| 1.33 | 2026-09-22 | **Security coverage completed against the OWASP API Security Top 10, and the severity scale aligned to ISTQB.** Mapped our testing to all ten OWASP API risks; four had never been examined. Testing the gaps produced six findings: no security headers on the frontend (S2); any authenticated account, including an external partner, can trigger a bulk export of programme data to Google Sheets (S2); no rate limiting on authenticated requests (S2); seven-day sessions and a weak password floor (S3); brute-force lockout applied per source IP and reported as HTTP 500 (S3); mass assignment blocked on one endpoint by design and on another only by an existing crash (S3). Two clean results verified rather than assumed: SSRF (no HTTP client imported anywhere) and SQL injection (all 339 raw SQL calls taint-analysed; user values are parameterised or ORM-derived). File upload has no type or size limit but is mitigated by private storage and an authz check (S4). Severity labels corrected S2->Critical, S3->Major, S4->Minor to match the conventional ISTQB scale, with no finding re-triaged; a separate priority dimension (P1-P4) added to the Definition of Done. Three consecutive Phase 1 re-sweeps against live: no registered defect fixed, no regression (16/10/8 failures across runs, all consistent failures already in the register); intermittency measured at ~11.5% against the recorded 3.0%. Register 104 -> 113 active (3 S1, 34 S2, 29 S3, 8 S4, 39 Info). |
| 1.32 | 2026-09-20 | **Full re-audit of the register, and a correction to our own scoring.** Two findings had root causes that were wrong in the same way. Each recommended adding a filter the code already has; both corrected against source (`counselling/list.py:103`, `api/helper.py:69-74`, `api/approval.py:74`). Established the read-side systemic cause: data scoping is disabled for `System Manager` at **45 sites across 26 files in 7 of 8 apps**, while **178 of 293 doctypes grant that role alone and 115 grant none — none grants anything else**, so every staff account must hold it. Verified the two write S1s are unaffected: a `System Manager` holder is still refused a cross-centre write on the ordinary `.save()` path. Audited the foundation's GitHub beyond the platform: found the environment→API mapping **shifted by one in all 9 repositories** with no production configuration, and a ninth role profile (`Placement Youth Coordinator`) routed to `/pyc/`, **an application that does not exist**. Re-derived the `318` probe figure from retained artifacts (295 authenticated + 23 unauthenticated; closes exactly). Added a fix to every S1-S4 finding that lacked one (25 of them). **Corrected our own scoring:** the Phase 2 closure report scored 9 exit criteria when the Definition of Done defines **6** — 'destructive operations' was never an agreed criterion. The report now maps to the agreed six, with destructive testing reported as additional work and excluded from the score. Register 98 -> 104 active (3 S1, 31 S2, 26 S3, 7 S4, 37 Info). |
| 1.31 | 2026-09-20 | **Phase 2 complete — all nine exit criteria met.** Breadth closed: lifecycle create/read/update/state driven for the Skilling Manager and Skilling Youth Coordinator primary objects (Course, Skilling Partner, Batch Attendance, Youth Status), taking coverage to **12 business objects across all six in-scope personas**. Every state change verified against the database: `course_status`/`partner_status` = `Discontinued`, `Youth.status` = `Standby`, attendance row written. Two new findings — **S2**: attendance cannot be recorded on an install built from the repositories, because the attendance controller writes two `Youth.status` values that exist in no shipped master, so every save is rejected by link validation; **S3**: `mark_attendance` requires a pre-existing attendance record and reports the failure only generically. Handover repo review also found and fixed two packaging defects that would have broken the client's first run — `seed.sh` called an unimportable `fixtures.*` module path, and `"type": "module"` made the CommonJS write-guard unloadable by all nine probes. Register 96 -> 98 active (3 S1, 28 S2, 24 S3, 7 S4, 36 Info). |
| 1.30 | 2026-09-20 | **Phase 2 depth complete.** THIRD S1 confirmed end-to-end: cross-centre **financial** write — `sp` (no permission for North) raised a North invoice into the approval pipeline (`Raised`/`Verification Pending`), ground-truth verified. All 5 destructive endpoints assessed (2 S1, 1 S2, 1 S3). Systematic validation/error-state sweep (6 endpoints): no invalid data accepted (clean), but 5/6 crash 500 on empty input and 2/6 return 200-on-failure. DoD depth criteria — validation, permission boundaries, error states, destructive ops — now all met. Register 90 -> 92 active (3 S1). |
| 1.29 | 2026-09-20 | Phase 2 breadth extended to **8 objects** (Task, Pre Enquiry, Enquiry Form, Counselling, Approval, Follow Up, Skilling Issue, Community Visit) across fc/oc/ch/sp personas; create passes on 7, read on 7, update on 6. New findings: **code gates on roles that don't exist on a fresh install (S2)**; **several endpoints (`update_issue`, `mark_as_dropoff`) return 403 via HTTP for all callers including Administrator while working in bench (S2)** — every app-level cause eliminated; a **500-on-missing-argument pattern (S3)** across update endpoints; Community Visit blocked on approval-workflow config. Register 84 -> 86 active. Phase 2 self-review written (PHASE-2-REVIEW.md) correcting completion to ~35-40%. |
| 1.28 | 2026-09-20 | Phase 2 write testing deepened. **Second S1 confirmed end-to-end:** a persona with no permission for a centre closed that centre's batch (`close_batch`), verified against ground truth. Authorization-gate probe: **0/36 truly-bypassed endpoints gated**. Financial endpoints (`raise_invoice`/`prepare_tax_invoice`) source-verified to share the same gap (runtime blocked by invoice fixture). Lifecycle matrix extended: Task and Pre Enquiry both green through create/read/update/state-change; no object exposes delete. New S2: runtime config (roles, naming series, master data) required to operate the platform is absent from the repositories. Register 74 -> 80 active (2 S1). |
| 1.27 | 2026-09-20 | Phase 2 write testing began. Persona accounts built on the isolated instance with disjoint centre scopes; write-side RBAC boundaries for Task tested across all six disjoint pairs — **12/12 held**, each with owner+intruder controls so a broken endpoint cannot read as secure. Systematic authorization audit of mutating endpoints: 40 bypass permissions and check nothing. Two runtime-verified defects from that list — `delete_file_by_url` (any authenticated user deletes any file, no ownership check, **S2**) and `create_user` (unauthenticated endpoint attempts to grant System Manager; blocked at runtime by a framework check, **S2** — downgraded from a source-only S1 read after the environment disagreed with the source). Register 68 -> 72 active. |
| 1.26 | 2026-09-20 | **Environment drift eliminated and verified.** Rebuilt pinned to Frappe 15.113.2, ERPNext 15.114.0 and Insights 3.12.5 — the platform's exact versions — on Python 3.11 / Node 22, without Frappe HR. A comparison tool now measures drift application by application rather than asserting it: **11 match, 1 documented exception**. Schemas re-extracted and proved identical to the earlier build (293 doctypes, 433 mandatory fields, zero differences), so the extraction is robust to the one drift that cannot be eliminated. Environment fidelity added as a Phase 2 exit criterion (Definition of Done §3a). |
| 1.25 | 2026-09-20 | **Installed-application count corrected from fifteen to twelve, and the unobtainable set from three applications to one.** `Module Def` lists modules present in the database; `get_versions` lists applications installed on the site. The two were conflated and the larger figure published, including in two client documents. `hrms`, `mannlowe_support` and `materialized_view_builder` are **not installed** — they hold orphaned module records, now recorded as a separate defect. Frappe HR being absent also means the `HR-EMP-` series comes from ERPNext, not from Frappe HR. This is the second instance in one day of an inference being published where the system could have been asked directly; the rule adopted is recorded in the findings register. Environment rebuilt pinned to the client's exact versions. |
| 1.24 | 2026-09-20 | **Phase 2 feasibility spike succeeded.** An isolated stack — Frappe 15.121.0, ERPNext 15.121.3, Frappe HR 15.64.1 and all eight WeConnect applications — installs cleanly and serves: login returns the production envelope. ~~The three vendor applications proved unnecessary for testing.~~ *(corrected in 1.25: one vendor application, not three.)* 293 doctype schemas extracted (2,690 field definitions), which solves the Phase 2 payload problem without touching the client's platform. The duplicate-doctype defect was confirmed on the live installation. Phase 2 now needs nothing from the client to proceed. |
| 1.23 | 2026-09-20 | Phase 2 opened (§13). Write-safety harness built and verified — self-verification 36 → 46 controls. Write surface analysed: 814 endpoint references across six applications, 106 distinct write candidates, 103 confirmed mutating across 21 objects. ~~Feasibility spike established that the platform runs fifteen applications, not eight; three are vendor-owned and absent.~~ *(corrected in 1.25: twelve installed, one vendor application absent.)* A correction made earlier in the day — that the backend was pure Frappe — was itself wrong and has been withdrawn; ERPNext 15.114.0 is installed. §11 next steps rewritten, having still listed completed Phase 1 work. |
| 1.12 | 2026-09-19 | Stability criterion raised: repeated execution is now used to make each route's *classification* deterministic, rather than to obtain a single green run. A defect is reported only where it reproduces in every execution; inconsistent routes are quantified and attributed to the platform's measured concurrency behaviour rather than retried away. Definition of Done amended to v1.1 with the reasoning. Concurrency sensitivity quantified as a dose-response: 3.4% inconsistency at three concurrent sessions, 6.8% at five. *(The 3.4% was from a partial cycle; the completed three-cycle measurement gives 3.0% — 7 intermittent routes of 235 — which is the figure used throughout the current text.)* |
| 1.11 | 2026-09-19 | Full-coverage sweep complete: all 235 routes now carry reachability, asset-integrity and accessibility checks in a single 22-minute pass, replacing the earlier 13% samples. **Root cause of the blank routes established** — uncaught null dereferences on React Router navigation state — which corrects the earlier "wholly broken" classification and makes the fix specific. Accessibility at full coverage: 182 affected routes, 3,593 elements, with four shared-component rules accounting for 80%. Asset integrity clean across 2,157 requests. Findings register 40 → 44. |
| 1.10 | 2026-09-19 | Characterisation document issued for sign-off. Completeness audit of Phase 1 found two gaps in our own work: the unified sweep had dropped the uncaught-JavaScript-error assertion carried by the suite it replaced, and the self-verification suite was being collected by the main configuration. Both corrected. Two findings added from the audit: a developer test route in the deployed OC application, and `coming-soon` placeholders confirming some screens are intentionally incomplete. Findings register 38 → 40. |
| 1.9 | 2026-09-19 | Known-defect registry introduced: the suite can now stay green while open defects remain, so a regression is visible. Defects are asserted as their expected symptom rather than skipped. Accessibility gated against a per-route baseline. Authentication reuses valid sessions. Self-verification extended to 34 controls, now covering the annotation and baseline logic itself. |
| 1.8 | 2026-09-19 | Dynamic-route coverage complete (§7h): 11 of 17 covered, 6 blocked on client-supplied identifiers. Invoice preparation screen found to issue a financial POST on page load with no user action — blocked by the read-only guard, which fired for the first time. Findings register 35 → 38. Phase 1 test build complete. |
| 1.7 | 2026-09-19 | **§7a corrected and a previously reported clean result retracted.** The cross-role scope checker was inspecting the wrong response envelope and never examined a record. Corrected, control-verified, re-run: cross-persona data leakage confirmed on three endpoints, including one where every record returned to a persona was outside its scope. Findings register 33 → 35. |
| 1.6 | 2026-09-19 | Self-verification suite added (§7g): 27 controls proving each check detects the condition it reports and ignores the conditions it should. Read-only guard and unauthenticated-access checks proven to fire, so their clean results are meaningful. Read-only policy extracted as a named, directly testable function. |
| 1.5 | 2026-09-19 | Asset/link integrity complete (§7d): 373 asset requests, zero failures; one earlier finding no longer reproduces. API contract complete (§7e): two new S3 defects, and the stack-trace finding escalated — 56 instances, reproducible with no valid credential, resolvable by one configuration change. Blank routes classified (§7f): 14 wholly broken, 2 not reproducing. Definition of Done issued as a separate deliverable. Findings register 28 → 33. Phase 1 categories 3 and 5 marked complete. |
| 1.4 | 2026-09-19 | Auth-guard regression complete (§7b): defect scoped to FC and CH only, correcting the earlier platform-wide assumption; mechanism and one-line fix identified. Accessibility baseline complete (§7c): 30 routes, 63 critical / 65 serious, concentrated in shared navigation. Findings register 24 → 28. Phase 1 categories 2 and 4 marked complete. |
| 1.3 | 2026-09-18 | RBAC read-leakage complete (§7a): 318 probes, no cross-persona data leakage, unauthenticated access refused on all 23 probes. Two new defects — S2 stack-trace disclosure, S3 inconsistent endpoint authorization. Findings register 21 → 24. Phase 1 category 2 marked complete. |
| 1.2 | 2026-09-18 | Reachability figures replaced with single-run verified results (219/235, 93.2%; 16 persistent failures; 9 retries) superseding the earlier stitched 214/235. Shared-component defect cluster added (§7). PM reclassified from "awaiting credentials" to "deferred — under development" (§3, §9). SP notes corrected: `approvals` renders and is an API-contract defect, not a blank page. BrowserStack capacity constraint added with measured costings (§10.4). Test architecture section added (§5). Phase 1 category status table added (§6). Constraints register added (§9). |
| 1.1 | 2026-09-18 | Phase 1 baseline, findings register, three graphs. |
| 1.0 | 2026-09-18 | Project foundation, architecture, scope, methodology. |
