# WeConnect 2.0 — Phase 1 Closure Report

**Date:** 2026-09-25 · **Version:** 1.8
**Environment:** `uat.lighthouseconnect.org` → `api-dev.lighthouseconnect.org`
**Phase 1 scope:** read-only automated testing across six persona applications

---

## 1. One item requires attention before anything else

**An Outreach Coordinator account can read youth counselling records for centres it has no
permission over.** (`WC-048`) Ten of ten records returned were outside its permitted centres. The records
carry youth names, counselling type and outcome, session dates, and free-text remarks.

This is classified **S1 — the only S1 found in Phase 1** (read-only testing). Phase 2's
transactional testing has since confirmed **two further S1s** — an account raising another centre's
invoice (`WC-095`), and closing another centre's batch (`WC-084`) — recorded in §9 and detailed in the Phase 2 Closure
Report. All three share one architectural cause. Under the agreed Definition of Done, each S1
requires fix, retest and confirmed closure; none can be accepted or deferred.

**Cause, corrected 2026-09-20.** This was first recorded as a missing server-side filter on
`facilitator_and_counsellor.api.counselling.list.get_counselling_list`. That was wrong, and the
correction matters because it changes the remedy. The handler already reads the caller's permitted
centres and filters correctly on them. The filter is never reached, because the line above it
returns early for any caller holding the `System Manager` role. Staff accounts hold that role
because the permission model gives them no working alternative: of the 293 doctypes the platform
installs, 178 grant permissions to `System Manager` and no other role, and the remaining 115 grant
none at all. Adding a filter would therefore change nothing. The role check has to be removed from
the scoping code, and that can only be done together with giving each role real permissions on the
doctypes. The same pattern appears at 45 places across 26 files in seven of the eight
applications.

No record values have been copied into this report, the findings register, or any log. Only field
names and counts are recorded.

**Also warranting immediate action, independently of any phase boundary:**

- The API returns Python tracebacks, including framework file paths, to callers with **no valid
  credential**. 56 instances. One configuration change resolves all of them.
- Opening the invoice preparation screen issues a **financial POST with no user action**. Whether
  it commits a record is unestablished, because determining that requires letting it run against
  live financial data. If it commits, this is a second S1.

## 2. What was delivered

| | |
|---|---|
| Automated test suites | 6, covering reachability, access control, asset integrity, accessibility, API contract, dynamic routes |
| Static routes tested | **235 of 235** in scope |
| Dynamic routes tested | **17 of 17** — all identifiers harvested from the platform, none required from you |
| API endpoints probed | 71 distinct backend methods (90 including query variants), with 318 cross-role access probes |
| Findings | **49**, each with evidence, severity, reproduction and a suggested fix |
| Route sweep execution time | **22 minutes** for all 235 routes (complete suite, all categories: ~45 minutes) |
| Mutating requests reaching the platform | **zero** — every POST/PUT/PATCH/DELETE aborted at the network layer, not left to convention |

The suite is handed over as a working asset. Your team can run it (`npm run sweep`), extend it, and
put it in CI. It is not a snapshot of one afternoon's testing.

## 3. Findings

**49 findings from Phase 1: 1 × S1 · 15 × S2 · 9 × S3 · 6 × S4 · 18 informational.** (The full
engagement register, including Phase 2, now stands at 119 findings with 3 S1s — see §9 and the
Phase 2 Closure Report.)

Those are Phase 1's. The register delivered alongside this report holds **56**, because Phase 2 has
already begun and its environment spike has raised seven more. They are summarised in §9 so that the
counts reconcile and nothing arrives unexplained.

Three further findings were raised during the engagement and **withdrawn** when repeated execution
disproved them. They remain in the register, struck through, rather than deleted. A register that
shows its own corrections is more trustworthy than one that appears never to have been wrong.

The informational entries include three *clean* results, which are areas verified as working, because a
report that only lists faults gives no sense of what is sound.

### The findings that matter most

**Security and data protection**

- **[S1]** Youth counselling records disclosed across a permission boundary (§1). Reproduced in three consecutive verifications: ten of ten records outside scope, every one carrying a youth's name.
- **[S2]** Three further endpoints return records belonging entirely to centres the caller is not
  permitted for, including one where *every* record returned to a persona was out of scope.
- **[S2]** Python tracebacks returned in the standard error envelope to unauthenticated callers.
- **[S2]** Long-lived API credentials stored in browser storage on an origin shared by all seven
  applications, so one application's tokens are readable by another's code.
- **[S2]** The authentication route-guard is disabled in the FC and CH applications. Logged-out
  visitors reach broken pages instead of the login screen. **Four applications behave correctly**,
  so this is a two-file fix, not a platform-wide problem.

**Function**

- **[S2]** Fourteen routes render nothing. The root cause is identified: they read navigation state
  that is null on direct entry, so the component throws. Refresh, bookmark, shared link and browser
  back all break them. The fix is to read the identifier from the URL, where for most of these
  routes it is already present.
- **[S2]** The invoice preparation screen performs a financial write on page load (§1).

**Platform stability**

- **[S2]** The API returns errors under modest concurrency. Measured as a dose-response: **3.0% of
  routes behave inconsistently at three concurrent sessions, 6.8% at five.** Throughput does not
  scale with load, because additional callers queue. Five simultaneous sessions is not a load test; it is
  five members of staff working at the same moment.

**Accessibility**

- **[S2]** 182 of 235 routes carry WCAG 2.1 AA violations, across roughly 3,500 elements. **Four rules
  account for roughly 80% of them and fire on every affected route** — they live in one shared
  navigation component. The headline number is large; the remediation is not.

## 4. Why these findings can be relied on

Two practices sit behind every number in this report.

**Every defect reproduces in three consecutive executions.** A platform that fails intermittently
cannot be characterised by a single run: the same route renders once and is blank the next, and
both observations are true. Routes are therefore classified by consistency across three full
executions. A defect is reported only where it reproduces every time, and routes that fail only
sometimes are attributed to the platform's concurrency behaviour rather than reported as broken
screens.

This removed **three** defects from this report before it reached you. Each had been recorded from a
single observation, and each rendered correctly in all three executions. All three would otherwise
have been reported. A development team that investigates a reported defect and finds nothing
wrong rightly discounts the next one, so the cost of a false positive is not one wasted hour but the
credibility of every other finding here.

The rule this produced is now applied throughout: **a defect recorded from one run is a hypothesis,
not a finding.**

**The tests themselves are verified.** Thirty-six controls feed each check a case where the defect
definitely exists and a case where it does not, proving each detects what it claims and ignores
what it should. This matters most for the clean results: "no writes escaped", "no broken assets",
"unauthenticated access refused" would each look identical if the detection behind them were simply
broken. Those controls run inside every execution, so the instruments are re-proven each time, and
they run against local fixtures, because an instrument cannot be validated using the system it
measures.

Three defects in our own tooling were found this way during the engagement, each of which had
produced a plausible but wrong result. They are recorded in the findings register alongside the
platform's defects. (Phase 2 has since added ten more controls, covering the write guard that
replaces Phase 1's read-only enforcement — 46 in total.)

## 5. Coverage, stated plainly

**What Phase 1 establishes:** every in-scope route loads and renders; **every one of the 71 distinct
backend methods observed in use refuses an unauthenticated caller** — probed exhaustively, not sampled;
role separation behaves as recorded; assets and links resolve; accessibility measured against
WCAG 2.1 AA; API responses hold their contracted shape.

**On the read-only guarantee, precisely stated:** no mutating HTTP request (POST, PUT, PATCH,
DELETE) reached the platform at any point. The guard aborts them in the browser and records every
attempt, and the recording itself is verified by control. What cannot be asserted with the same
certainty is that no *GET* had a side effect, since a server may change state on a read if it
chooses to. The evidence says it does not: of the 71 methods observed in use none is named as a
mutation, and the one operation known to write, invoice preparation, correctly uses POST, which
shows the platform follows the convention. We state the guarantee as what was enforced rather than
as an absolute.

**What Phase 1 does not establish, and why:**

- **Functional correctness.** We verify that screens render and which endpoints they call, not whether
  the values shown are right. Asserting correctness requires an agreed definition of correct, which
  is what the characterisation document exists to establish. Writing assertions against current
  behaviour without it would enshrine today's defects as tomorrow's expected values.
- **Write behaviour.** Nothing requiring a create, edit or delete has been exercised. Phase 1
  blocks writes by design; this is Phase 2.
- **Interaction states.** Screens were observed in their landing state. Tabs, modals, filters,
  pagination and form validation were not exercised.
- **Cross-browser and responsive behaviour.** Desktop Chrome only. Phase 3.

Accessibility coverage is automated only. Axe-core detects roughly 30–40% of WCAG issues; every
item reported is real, but a clean automated scan would not demonstrate accessibility.

## 6. What we need from you

| # | Item | Effort |
|---|---|---|
| 1 | Sign off the **characterisation document** — it becomes the acceptance baseline and unblocks functional testing | One review |
| 2 | Work through the decisions in that document. We answered **seven** from your code and data and narrowed **six**; **two** need you — escrow for `fintoo_analytics_bridge` (3.2.2) and the per-role screen inventory (9.1) | Part of the same review |
| 3 | Confirm whether the invoice screen's POST **commits a record** — this decides S1 or S2 | One answer |
| 4 | Decide **BrowserStack capacity** — a specific recommendation is in §6a, including what *not* to buy | One decision |
| 5 | Confirm whether **UAT calling the DEV API** is intended | One answer |

Items 1 and 2 are the critical path. Nothing in Phase 2 can assert correctness without them.

**The Phase 2 test environment is no longer a decision you need to make.** It was on this list
until we established whether we could build one ourselves. We can, and have: an isolated instance
running Frappe, ERPNext, Frappe HR and all eight of your backend applications, which authenticates
and returns the same response envelope as your platform. Destructive testing will run there against
synthetic data, so no real programme record, and no record belonging to a youth, is
involved at any stage.

## 6a. BrowserStack

The supplied account is on the **Free** plan. Phase 3 needs cross-browser coverage, but a purchase
may not be required: Playwright runs Chromium, Firefox and WebKit locally at no cost, covering the
three major engines. The free allowance is then best spent on what only BrowserStack provides —
real iOS Safari and real Android, against a curated route subset, at roughly 22 session-minutes.

If a paid plan is later justified, **Automate is the only product needed**; the other eleven are
either irrelevant to a web application or duplicate tooling we already have. Additional parallel
sessions would be wasted spend until the backend concurrency issue is resolved.

Full costings, the product-by-product assessment and the recommended sequence are in the separate
**BrowserStack Recommendation**.

## 7. Phase 1 exit criteria

| Criterion | Status |
|---|---|
| Every in-scope static route covered by reachability, asset-integrity and accessibility | **Met** — 235 of 235 |
| Every role-exclusive endpoint probed for cross-role read access | **Met** — 90 endpoints, 318 probes |
| Unauthenticated access verified as refused | **Met** — all 71 endpoints observed in use, probed exhaustively, all refused |
| Dynamic routes covered, or deferred with a reason | **Met** — 17 of 17 covered |
| Read-only invariant demonstrated | **Met** — no mutating request reached the platform; the guard blocked a live financial write |
| All findings triaged with severity, evidence and reproduction | **Met** — 49 findings |
| Classification consistent across three consecutive executions | **Met** |
| Inconsistent routes quantified and attributed | **Met** — 3.0%, attributed and independently corroborated |

**Phase 1 is complete.** Every in-scope route, static and dynamic, is covered, and no coverage
item remains outstanding.

## 8. Recommended next steps

1. **Fix the S1.** One endpoint, one missing filter, a pattern that already exists in your codebase.
2. **Disable client-facing tracebacks.** One configuration change, 56 instances resolved.
3. **Sign off the characterisation document**, which unblocks all functional testing.
4. **Commission a load test.** The concurrency measurements in this report are the evidence for it.
5. **Consider the vendor application** (§9) — a governance question about what the
   foundation can rebuild without its development vendor, worth an answer independently of QA.

## 9. Findings raised since Phase 1 closed

Phase 2 began before this report was delivered, and its first step, establishing whether an
isolated test environment can be built, has already produced findings. They are listed here rather
than held back, so that the register and this report agree.

**One of them is not a testing matter and should be read by someone other than the development
team.**

**[S2] The platform cannot be rebuilt in full from the repositories the foundation owns.** Asked
directly, the platform reports **twelve installed applications**. Eight are the WeConnect backends
whose repositories we hold. Three are open-source framework components (Frappe 15.113.2,
ERPNext 15.114.0, Insights 3.12.5). **One — `fintoo_analytics_bridge` — is in none of the eighteen
repositories in your GitHub organisation**, and appears to belong to the development vendor.

Nothing is wrong with a vendor shipping its own components. The question is what happens if you
need it and the vendor is not available: a disaster recovery, a change of supplier, or simply a new
developer standing up an environment. We would suggest establishing who owns it, what rights the
foundation has to it, and whether an escrow or handover arrangement exists. It is a governance
question, not a defect, and it is worth an answer independently of this engagement.

**[S3] Three applications left module records behind when they were removed.** `hrms`,
`mannlowe_support` and `materialized_view_builder` are not installed, but the database still holds
module records attributing objects to them. The practical consequence is that the database
misreports what the site runs. It misled us at first, and it would mislead anyone else auditing the
environment. The fix is to clear the orphaned records.

**[S3] Three doctypes are defined twice, by two different applications.** `Categories`,
`Event Category` and `Reason For Visit` are each declared by both `batch_management` and
`event_management`. In Frappe a doctype name is global rather than namespaced to the application
that ships it. The two declarations therefore refer to the same object rather than to one each,
and whichever application migrates last overwrites the other's definition. The field definitions currently match, so nothing
is at risk today; the consequences are latent. Ownership depends on migration order, an edit made in
one application can be silently reverted by the other, and removing `event_management` would take
doctypes `batch_management` relies on with it.

**[S3] The `Employee` doctype used at login is supplied by ERPNext**, not by any WeConnect
application, and is not declared as a dependency anywhere. This resolves an earlier observation that
authentication depended on something absent from the handover: the dependency is real and satisfied
by a framework component, but nothing records it. Declaring `required_apps` in
`authentication/hooks.py` would turn a silent trap into an explicit requirement.

**[S4] A stale doctype folder duplicates its replacement.** In `outreach`, both
`google_form_settings/` and `google_integration_settings/` declare the doctype
`Google Integration Settings` with identical fields; the timestamps show a rename where the original
folder was never deleted. It holds a Google service-account credential. Deleting the stale folder is
the whole fix.

**[S2] Your complete API specification is readable without logging in.** Three `swagger_spec`
endpoints are declared `allow_guest=True` and return HTTP 200 to a caller with no credentials,
publishing **353 API paths** in machine-readable form, including **67 mutating operations**, with
their parameters documented. The endpoint names are self-describing: `enrollment_status_update`,
`change_skilling_location`, `add_remarks`.

A published specification is a reasonable choice for a public API. This is an internal platform
holding minors' records, and the specification sits alongside an authorisation model **applied per
endpoint rather than enforced by the framework** — 866 whitelisted endpoints, 296 of which bypass
permission checks explicitly, and 94 places in the entire codebase that check which centres a caller
may see. One endpoint has already been confirmed to leak counselling records across that boundary
(the S1 in §1).

The two compound. The specification tells an anonymous caller exactly where to look for the next
S1, and hands them the parameters to try. **The fix is removing one argument in three places**, and
the specifications remain available to authenticated staff, which is presumably the intent.

**[S2] Your permission model exists in no repository.** Of 297 doctype definitions across the eight
applications, 182 carry permission rules and **every one grants a single role — `System Manager`**.
None grants any WeConnect role, and no application defines a Role or Role Profile. We proved the
consequence rather than asserting it: an instance built from your repositories has **zero WeConnect
roles**. Access control exists only as rows in the production database, not in version control and not
reviewable in a pull request, not recoverable from source. If that database were lost, the code
could be restored and the permission model could not.

This does not obstruct our testing: the mechanism is `User Permission` records scoping staff to
`Lighthouse Centre`, and both of those we can construct. We raise it because it is a gap in what the
foundation can rebuild, which is the same question the missing vendor application raises.

**[S1] A third data-integrity blocker, and it is financial: an account can raise another centre's
invoice.** Proved end-to-end on the isolated copy: a user permitted for two centres, with no
permission for a third, raised a Skilling Invoice belonging to that third centre. The API returned
success and the invoice moved into the approval pipeline (`Raised`, `Verification Pending`). This
advances financial programme data through its workflow across a permission boundary. Same
architectural cause as the batch blocker below. Under the Definition of Done, an S1.

**[S1] A second data-integrity blocker: an account can close another centre's batch.** We
built an isolated copy of your platform and proved this end-to-end: a user account permitted for two
centres, with no permission for a third, closed a batch belonging to that third centre. The API
returned success and the batch's status changed to Closed. This is the write-side twin of the
counselling-record exposure in §1, and more serious: it *changes* programme data across a permission
boundary rather than only reading it. Closing a batch completes it and has downstream effects on
youth status and invoicing. Under the Definition of Done this is an S1 — it must be fixed, retested
and closed. The cause is the same architectural gap described next.

**[S2, systemic] 35 write endpoints can be invoked by any logged-in user regardless of role or
centre.** We classified every one of your API's write endpoints by whether it checks the caller's
permission. 39 skip the check entirely and 35 of those go on to change data, spanning every
application, and including financial writes (`raise_invoice`, `prepare_tax_invoice`) and
destructive ones (`delete_file_by_url`). Two we confirmed live on the isolated environment; the
rest are unambiguous in the code. This is one architectural gap, not 35 separate bugs: your
platform treats authorization as something each endpoint opts into, and these did not. The fix is
also architectural: authorization should be enforced in one place that every write passes through.
It is the
same root cause behind the counselling-record exposure in §1. We would put this at the top of the
security work alongside that S1.

**Four informational entries**, including a clean result: persona accounts are refused DocType
metadata with a 403, so the schema is not enumerable by an ordinary user. That is the correct
posture and is recorded as such.

**How these were found matters.** None is visible from the running application. They came from
reading the applications as a deployable unit while establishing whether we could stand one up —
which is a different question from whether the software works, and it surfaces a different class of
problem.
