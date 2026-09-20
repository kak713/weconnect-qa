# WeConnect 2.0 QA — Definition of Done

**Version:** 1.4 · **Date:** 2026-09-25
**Status:** proposed — for client acceptance

---

## Why this document exists

"QA complete" is an opinion unless it is written down as criteria both sides can check. This
document converts it into a set of measurable gates. Every item below is either objectively true
or objectively false at any moment; none of them depend on anyone's judgement of how much effort
has been spent.

It exists for three reasons:

1. **It makes completion provable.** Each phase has an exit condition that can be evidenced by an
   artefact, not asserted.
2. **It makes scope changes visible.** Anything not listed here is out of scope by definition. New
   requests are welcome; they are additions to this document, agreed before they are started.
3. **It protects both parties.** The client knows exactly what they are receiving. QA knows exactly
   what it is accountable for, and neither side discovers a different expectation at the end.

---

## 1. Severity and priority

Severity describes **impact on users and data**. Priority describes **how soon it should be
fixed**. They are separate judgements, and the standard practice in software testing is to record
both, because they do not always agree: a spelling mistake on the login page is low severity and
high priority, while a data-corruption bug in a screen nobody uses is the reverse.

### Severity

These levels follow the conventional scale used in the testing industry (as defined by the ISTQB
glossary), so that a developer reading "S2" here reads it as they would anywhere else.

| Level | Definition | Examples from this engagement |
|---|---|---|
| **S1 — Blocker** | Data loss or corruption, unauthorised data exposure, or a core journey that cannot be completed by any means | Youth counselling records readable by an account with no permission for those centres |
| **S2 — Critical** | A security control is missing or ineffective, or key business logic fails. Continued correct operation depends on it being fixed | Thirty endpoints that change data with no authorisation check; any authenticated account able to trigger a bulk export of programme data |
| **S3 — Major** | A significant function behaves incorrectly, but a practical workaround exists or the impact is bounded | Routes rendering blank; brute-force lockout reported as a server error |
| **S4 — Minor** | Presentation, wording, or hygiene, with no functional consequence | Broken grammar in error messages; committed `.env` files |
| **Info** | Characterisation, context, or a recorded clean result | "Every endpoint observed in use refuses an unauthenticated caller" |

**A note on an earlier version of this document.** Until 2026-09-22 this table used the labels
Blocker, Major, Minor and Cosmetic for S1 to S4. That skipped "Critical" and shifted every level
down by one against the conventional scale, which meant our S2 findings read as less severe than
intended to anyone using the standard definitions. The labels above correct that. **No finding has
been re-triaged**: the definitions and the assignments are unchanged, only the names.

### Priority

| Level | Meaning |
|---|---|
| **P1 — Immediate** | Work should start now; it is unsafe or unusable to leave as it is |
| **P2 — Next** | Fix in the current cycle of work |
| **P3 — Scheduled** | Fix when the surrounding area is next touched |
| **P4 — Opportunistic** | Worth doing, no particular urgency |

Priority is the client's judgement rather than ours, because it depends on how the platform is
actually used and on what else the development team is committed to. Where this register suggests a
priority, it is a recommendation offered for review, not an assignment.

## 2. Resolution policy by severity

| Severity | Required for completion |
|---|---|
| S1 | Fixed, retested, and confirmed closed. No exceptions, no deferrals. |
| S2 | Fixed and retested, **or** formally accepted in writing by the client with a stated reason |
| S3 | Fixed, **or** accepted in writing, **or** scheduled with an owner and a date |
| S4 | Logged and triaged. Fixing is at the client's discretion |

**Formal acceptance means a written record naming the finding, the decision, and the person
accepting it.** A defect that is accepted is closed rather than outstanding, but it is closed on the
record. This protects the client as much as QA: it prevents a known issue resurfacing later as a
surprise, and it means the final report reflects decisions rather than omissions.

## 3. Phase exit criteria

A phase is complete when **every** line in its section is true.

### Phase 1 — Read-only automation

- [ ] Every in-scope static route is covered by reachability, asset-integrity and accessibility checks
- [ ] Every role-exclusive API endpoint observed in use has been probed for cross-role read access
- [ ] Unauthenticated access is verified as refused across **every** endpoint observed in use
- [ ] Dynamic routes are either covered with valid identifiers, or listed as deferred with a reason
- [ ] Read-only invariant demonstrated: zero write attempts escaped the network guard in the final run
- [ ] All findings triaged into the register with severity, evidence, and reproduction steps
- [ ] Suite executed **three consecutive times**, and every route's classification is **consistent
      across all three** — a defect is reported only where it reproduces in every run
- [ ] Routes behaving inconsistently are **quantified and attributed**, not silently retried away

### Phase 2 — Transactional automation

- [ ] An isolated environment with synthetic data exists and is documented
- [ ] **The environment matches the platform's installed application set and versions, and every
      remaining divergence is stated** — see §3a
- [ ] No test in this phase touches live programme data; demonstrated, not asserted
- [ ] Create, edit and delete flows are automated for each in-scope persona's primary objects
- [ ] Validation rules, permission boundaries and error states are exercised, not only success paths
- [ ] Data is left in a known state after each run (teardown or reset is part of the suite)

### Phase 3 — Cross-browser and CI

- [ ] The agreed browser and device matrix executes and passes, or its failures are logged as findings
- [ ] Suite runs in CI on a defined trigger, with results visible to the client
- [ ] Execution is repeatable by the client's own team from documented instructions

### Engagement closure

- [ ] Every S1 and S2 is fixed-and-retested or formally accepted
- [ ] Characterisation document signed off — this is the accepted behavioural baseline
- [ ] Final test-closure report delivered, mapping every in-scope area to its tests and results
- [ ] Automation suite handed over with documentation sufficient for the client's team to run and extend it
- [ ] Client sign-off on the closure report

## 3a. Environment fidelity, and why it is an exit criterion

A test environment that differs from the platform produces results that do not transfer. A defect
found there may not exist in production; a defect in production may not appear there. Neither
failure is visible from the test results themselves, which is what makes divergence dangerous rather
than merely untidy.

The standard is therefore explicit: **the isolated environment installs the same applications at the
same versions as the platform, and any divergence that cannot be eliminated is written down rather
than absorbed.**

In practice this required three corrections to our own first build:

| Divergence | Resolution |
|---|---|
| Framework built from branch HEAD (Frappe 15.121.0, ERPNext 15.121.3) | Pinned to the platform's exact versions: **Frappe 15.113.2, ERPNext 15.114.0** |
| Frappe HR installed, which the platform does not have | Removed |
| Insights absent, which the platform has | Added at **3.12.5** |

**One divergence cannot be eliminated and is stated instead.** All eight WeConnect applications
report version `0.0.1`, so the commit deployed to the platform cannot be determined from outside it.
Our environment is built from the `dev` branch head of each repository, and those commit hashes are
recorded. If you can tell us which commits are deployed, we will pin to them; until then this is a
known and documented difference rather than a hidden one.

**`fintoo_analytics_bridge` is also absent**, because it is not available to us. Nothing in the
eight applications references it and the platform authenticates and serves correctly without it, so
it is not believed to affect the surface under test. It is still a difference, and it is recorded
here as one.

## 4. What "covered" means

Coverage is claimed in layers, and each layer is stated explicitly rather than folded into a single
percentage. A number without its layer is meaningless.

| Layer | Question it answers | Current state |
|---|---|---|
| **Reachability** | Does the route load and render without erroring? | Complete |
| **Access control** | Can the wrong role read this? Can an anonymous visitor? | Complete |
| **Accessibility** | Does it meet WCAG 2.1 AA, so far as automation detects? | Complete |
| **Asset integrity** | Do all referenced assets and links resolve? | Complete |
| **API contract** | Do responses hold their shape, and do errors behave correctly? | Complete |
| **Functional correctness** | Does the feature do the right thing with the right data? | **Requires the signed characterisation baseline** |

**We will not claim functional correctness without an agreed baseline.** With no specification, a
test that asserts current behaviour only proves the application still does what it did before,
including anything defective, which then becomes the expected result. A suite in that state gives
false assurance. That is why the characterisation sign-off is treated as a dependency rather than
as paperwork.

## 5. Explicitly out of scope

Stated so that absence is never mistaken for oversight:

- Google OAuth sign-in — cannot be reliably automated; Google actively blocks automated sign-in
- Manual accessibility assessment (keyboard traversal, screen-reader semantics, focus order) — the
  automated baseline detects roughly 30–40% of WCAG issues and is not a substitute
- Load and performance testing — recommended separately on the evidence gathered in Phase 1
- Penetration testing — the security findings here are a by-product of functional QA, not an audit
- The Placement Manager application, while under development
- Any environment other than the one agreed as the QA target

## 5a. Why the stability criterion is a consistency standard, not a flake threshold

An earlier version of this document required a flake rate below 2%. That criterion was written
before the platform had been measured, and measurement showed it to be the wrong test.

The platform's behaviour is itself inconsistent under concurrency. The same route renders in one
execution and returns blank in the next, with no change to the application or the test. Measured
directly across three consecutive full executions: **3.0% of routes behaved inconsistently at three
concurrent sessions, and 6.8% at five** (the latter from a controlled comparison run).
A test suite cannot be more stable than the system it observes, so a flake threshold would have
measured the platform's stability while appearing to measure ours.

The replacement is a **stricter** standard, not a looser one.

A single execution cannot classify a route on a platform that fails intermittently: the route
renders once and is blank once, and both observations are true. Repeated execution resolves it:

| Behaviour across three runs | Classification |
|---|---|
| Fails in **every** run | A defect. Reported to the development team with confidence. |
| Fails in **some** runs | Environmental. Not reported as a screen defect; it is evidence of the concurrency behaviour already recorded as a finding. |
| Passes in **every** run | Clean. |

This requires that we can reproduce a defect before reporting it to a developer, and it equally
guards against the opposite mistake of dismissing a real defect as noise. A green run proves a suite
passed once. A consistent classification across runs proves the suite's conclusions are stable —
which is the property the client actually needs from it.

The inconsistency rate is reported as a measured characteristic of the environment, because that is
what it describes. It is the evidence base for the load test recommended in the findings register.

## 6. Quality bar for the deliverable itself

The suite is a product handed to the client, and is held to the same standard as the code it tests:

- **Deterministic.** Failures indicate defects, not timing. Flake is treated as a defect in the suite.
- **Traceable.** Every reported number is reproducible from a recorded run and a stored artefact.
- **Maintainable.** Route inventories and endpoint lists are generated from source, not transcribed,
  so the suite tracks the application as it changes instead of decaying.
- **Honest.** Known defects are annotated so the suite stays green and meaningful; a permanently red
  suite is ignored, and an ignored suite protects nothing.
- **Safe by construction.** Read-only phases cannot write, enforced at the network layer rather than
  by convention.
- **Self-verified.** Every check is proven to detect the condition it reports, using controls where
  the answer is known in advance. A check that cannot be made to fail is not evidence of anything,
  and a clean result is only meaningful once the instrument producing it has been validated.

## 7. Acceptance

The client is asked to confirm:

1. The severity definitions and resolution policy in §1 and §2
2. The phase exit criteria in §3
3. The scope exclusions in §5
4. That the characterisation document, once signed, is the behavioural baseline against which
   functional correctness is judged

Once confirmed, this document is the completion standard for the engagement, and "done" is no
longer a matter of opinion on either side.
