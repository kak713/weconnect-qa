# WeConnect 2.0 — Characterisation of Observed Behaviour

**Version:** 1.8 · **Date:** 2026-09-25
**Status:** for client review and sign-off
**Environment observed:** `uat.lighthouseconnect.org` → `api-dev.lighthouseconnect.org`

---

## Part 1 — What we need from you

**Two decisions, and a page of confirmations. Ten minutes, not an afternoon.**

This document marks fifteen decisions. We went back through them and answered what we could from
your own code and data, because we should not be asking you questions we can answer ourselves.

### The two that need you

| # | Question |
|---|---|
| **3.2.2** | Is there an escrow or handover arrangement for `fintoo_analytics_bridge`? It is installed, the source is in none of your repositories, and it appears to belong to your development vendor. On the dev environment it looks inert — one module, no doctypes, no scheduled jobs, and our rebuild runs without it. We need to know whether you hold rights to it, and whether production depends on it in a way dev does not show. |
| **9.1** | Does each role have the right screens? Section 9 lists the screens per persona. Code can tell us a screen exists and who can reach it; it cannot tell us whether a Facilitator should be assigning youth status. If a full review is too much, say so and we will send you a shortlist of the ones that look anomalous instead. |

### The seven we answered — tell us if we have any of them wrong

| # | Our answer |
|---|---|
| 4.5 | Single-session-only is **your code and looks unintended**. `auth.py:64-76` regenerates `api_secret` on every login, while the adjacent `api_key` is guarded by `if not`. We think the guard was meant to cover both. |
| 5.3 | `"NA"` is a **deliberate sentinel**, written at `auth.py:392` and `:394`. We recommend `[]` instead, because a string changes the field's type. |
| 5.4 | The empty Outreach Coordinator `role_profile` is a **configuration gap, not a code defect**. Assign the profile to that account. |
| 5.7 | Organisation-wide visibility of the centre list is **required by your own workflow** — `Change Training Location` is a counselling category, and staff cannot move a youth without seeing other centres. |
| 5.9 | The intended model is **evidently role-based per persona**; the scaffolding is all there and only the doctype permission rules were never written. `System Manager` is a consequence, not a choice. We would like to draft the permission matrix for you to correct. |
| 6.6 | `test-zustand` is a **development route that should not ship**. |
| 10.1 | The blank routes are **defects, not unbuilt features** — they throw on a null dereference. |

### The six that are now a smaller question — confirm the intent

**3.1.1** Is `Placement Youth Coordinator` a live role? · **3.5** Does a production API exist that is
absent from all configuration? · **5.1.1** Which is authoritative, `permitted_centres` or
`User Permission`? · **5.8** Is sharing a batch across centres a real operating pattern? ·
**8.4** How many staff do you expect working at once? · **10.2** Do you want deep-linking, knowing it
means adding a URL parameter to each affected route?

### Sign-off

| | |
|---|---|
| Sections 3–9 confirmed as intended behaviour, except where corrected | ☐ |
| The **seven** decisions we answered (4.5, 5.3, 5.4, 5.7, 5.9, 6.6, 10.1) reviewed and confirmed, or corrected | ☐ |
| The **six** narrowed decisions (3.1.1, 3.5, 5.1.1, 5.8, 8.4, 10.2) confirmed | ☐ |
| The **two** remaining decisions answered: 3.2.2 escrow or handover, and 9.1 screen inventory | ☐ |
| Acknowledged that Section 10 is excluded from the baseline and tracked as defects | ☐ |

**Name:** ________________  **Role:** ________________  **Date:** ____________

On sign-off this document becomes the acceptance baseline for WeConnect 2.0. Functional tests will
be written against it, and any later change to the behaviour recorded here is a change to the
specification rather than a defect in the tests.


---

**Everything below is the reference baseline** — what we observed the platform doing, section by
section. It is what the functional tests will be written against, and what the decisions above
relate to. You do not need to read it end to end to sign; consult it where you want to check us.

---

## Part 2 — Why this document exists

*Background. Read it if you want to know why we are asking.*

WeConnect 2.0 has no functional specification. An automated test has to assert something, and with
no specification, every assertion is a guess at what the platform is supposed to do. Where a guess
is wrong, the defect becomes the expected result: the suite goes green and reports success while the
defect stays in place. A suite in that state is worse than none, because it gives false assurance.

This document avoids that. It records what the platform **actually does**, from observation rather
than assumption. Once you confirm it, it becomes the **acceptance baseline** that the functional
tests are written against.

**Signing does not accept the defects we found.** Section 10 lists behaviour already classified as
defective. It is excluded from the baseline and tracked in the findings register.

## 2. Basis of observation

| | |
|---|---|
| **Method** | Automated observation of the running platform, plus reading route and API definitions from the application source |
| **Accounts used** | One per persona: FC, CH, SP, SYC, SM, OC |
| **Coverage** | 235 static routes, 17 dynamic routes, 71 distinct backend methods, 318 cross-role probes |
| **Period** | 18–19 September 2026 |
| **Constraint** | All observation was read-only. Mutating requests were blocked at the network layer, so no behaviour requiring a write has been observed. Those behaviours are Phase 2. |

Everything below is traceable to a recorded run. Where we are uncertain, the document says so
rather than presenting inference as fact.

## 3. Platform structure

**3.1** The platform is **eight separate web applications**, not one. Each is a React single-page
application (React Router v6, Zustand, Vite), deployed independently and served under its own URL
prefix on a single host. Seven are persona applications (`/fc/`, `/ch/`, `/sp/`, `/syc/`, `/sm/`,
`/oc/`, `/pm/`); the eighth is the **authentication application**, deployed at the site root, which
serves `/authentication/login`, `/authentication/forget-password`, `/set-password` and the Google
callback. The authentication application also holds the post-login routing table that decides which
persona application an account is sent to — see 3.1.1.

**3.1.1 [DECISION — narrowed; a smaller question than it was] The routing table defines nine role mappings, not six.** From
`weconnect-frontend-auth/src/routes.js`, login dispatches on `role_profile`:

| Role profile | Sent to | Application exists |
|---|---|---|
| Outreach Coordinator · Center Head · Facilitator and Counsellor · Skilling Youth Coordinator · Skilling Partner · Skilling Manager | `/oc/` `/ch/` `/fc/` `/syc/` `/sp/` `/sm/` | yes |
| **Trainer** | `/sp/` | yes — shares the Skilling Partner application |
| Placement Manager | `/pm/` | yes (deferred from QA scope by agreement) |
| **Placement Youth Coordinator** | **`/pyc/`** | **no — no such repository or application** |

`Placement Youth Coordinator` is implemented in the backend (`youth_placement/api/helper.py`
maps it to `PYC`; `api/counselling.py` queries for it; two migration patches name it as a requester
role), yet no application serves `/pyc/`. **Is this persona live, and if so where is its
application?** `Trainer` is a second, separate question: it is a distinct role profile with its own
scoping path in `get_user_permitted_centres()`, and it was **not** exercised by this engagement.

**3.2** Eight WeConnect backend services run on **Frappe with ERPNext and Insights**:
`authentication`, `youth_skilling`, `centre_head`, `facilitator_and_counsellor`, `outreach`,
`batch_management`, `youth_placement`, `event_management`. Target versions, from the applications'
own configuration: **Frappe ~15.0, Python ≥3.10**. Between them they define **297 doctypes under 293 distinct names** — three names are declared by
two applications each, which is recorded as a defect in the findings register.

**3.2.1 The deployable platform is twelve applications, not eight.** Asked directly, the platform
reports the following as installed:

| Source | Applications |
|---|---|
| Framework | `frappe` 15.113.2 · `erpnext` 15.114.0 · `insights` 3.12.5 |
| WeConnect | the eight listed above |
| **Not in any repository supplied to us** | **`fintoo_analytics_bridge`** |

**3.2.2 [DECISION — this one genuinely needs you]** `fintoo_analytics_bridge` exists in none of the eighteen repositories in the
foundation's GitHub organisation, and appears to belong to the development vendor. The platform as
deployed therefore cannot be rebuilt in full from the code the foundation owns. **Who owns it, does
the foundation hold rights to it, and is there an escrow or handover arrangement?** This is a
business-continuity question, independent of testing.

**3.2.3** Three further applications — `hrms`, `mannlowe_support` and `materialized_view_builder` —
have module records in the database but are **not installed**. Their presence indicates they were
installed at some point and removed without clearing the residue. Recorded as a defect; the
practical consequence is that the database misreports what the site runs.

**3.2.4** `Employee`, which the authentication service depends on, is supplied by **ERPNext**
(module `Setup`). Frappe HR is not installed, so the `HR-EMP-` identifier series comes from
ERPNext's naming configuration.

**3.3** All eight applications share **one browser origin**, and therefore one `localStorage`.
Storage keys are not namespaced per application. We have observed keys written by one persona's
application present in another's session.

**3.4** Each application performs a **version check on load** against a key named for itself
(`fcAppVersion`, `ocAppVersion`, and so on) and reloads itself when the stored value is absent or
stale. This reload is part of normal start-up.

**3.5 [DECISION — narrowed; a smaller question than it was]** **The environment→API mapping is shifted by one, in every repository.** Verified
across all nine frontend repositories plus the shared component library: `.env.uat` points at
**`api-dev`**, and `.env.prod` points at **`api-uat`**. **No configuration anywhere names a
production API.** The hosts are genuinely separate systems — `api-dev` and `api-uat` resolve to
different infrastructure — so a UAT build really does read and write the dev database, and a
production build would read and write the UAT one. A further naming collision compounds it:
`lcfuat.ash.frappe.cloud`, hard-coded as the default `.env` of `weconnect-frontend-pm`, resolves to
the **same address as `api-dev`**, so "uat" denotes two different systems depending on which name is
used. **Is this mapping intended, which configuration is each deployed frontend built from, and
where is the production API?**

## 4. Authentication and session behaviour

**4.1** Login is `POST authentication.api.auth.login` with form fields `usr` and `pwd`. It returns
an **API key and secret pair**, not a session token, together with the account's profile and
permissions.

**4.2** The key and secret are stored in `localStorage`. Every subsequent request carries
`Authorization: token <key>:<secret>`.

**4.3** A **"Continue with Google"** option is present on the login screen. Google actively blocks
automated sign-in, so this path cannot be covered by automation. It is excluded from scope by
necessity rather than choice.

**4.4** Requests without a credential receive **403**. Requests with an *invalid* credential receive
**401**. The applications redirect to the login page on 401 only.

**4.5 [DECISION — we answered this; please confirm]** Logging in **regenerates `api_secret` and immediately invalidates the previous
one**. The platform therefore supports one active session per account: signing in on a second
device silently signs the first out mid-task. Is single-session-only intended? If so, the user
should be told rather than simply being returned to the login screen.

## 5. Authorisation model

**5.1** The login response declares each account's permissions directly: `role_profile`,
`permitted_centres`, `permitted_courses`, and `sp_role`. This is the platform's own statement of
what an account may see, and it is what our access-control testing asserts against.

**5.1.1 [DECISION — narrowed; a smaller question than it was] There are two centre-scoping mechanisms and they are not the same one.** Login
publishes `permitted_centres`, while the server-side filters read `User Permission` records where
`allow = "Lighthouse Centre"`. Nothing keeps the two in step, so an account can be told it is
permitted for one set of centres while the data it receives is scoped by another. **Which is
authoritative?** Until that is answered, "correctly scoped" has two possible meanings, and any
assertion we write has to choose one.

**5.2** Observed permission scope per account:

| Persona | Role profile | Permitted centres | Permitted courses |
|---|---|---|---|
| FC | Facilitator and Counsellor | 5 | 3 |
| CH | Center Head | 2 | `"NA"` |
| SP | Skilling Partner | 26 | 2 |
| SYC | Skilling Youth Coordinator | 15 | `"NA"` |
| SM | Skilling Manager | 57 | 11 |
| OC | *(empty)* | 2 | `"NA"` |

**5.3 [DECISION — we answered this; please confirm]** `permitted_courses` is an **array for three accounts and the string `"NA"` for
the other three**. A client reading this field behaves differently depending on who signed in. Is
`"NA"` an intended sentinel? We would expect an empty array.

**5.4 [DECISION — we answered this; please confirm]** The **Outreach Coordinator account returns an empty `role_profile`** while every
other account returns a populated one. **Re-confirmed on the live platform on 2026-09-20**, so this
is not a transient observation. It matters more than it appears: `authentication/api/auth.py`
compares `role_profile_name` directly against the persona profile names, and the routing table in
3.1.1 dispatches on `role_profile` — so an account with an empty value fails every such comparison
and has no defined destination after login. Is this intended configuration?

**5.5** Authorisation is enforced **server-side**. Unauthenticated callers are refused without
exception across every endpoint sampled. The client-side route guard does not perform this role.

**5.6** Endpoint-level role separation is **inconsistent**: offered endpoints belonging to other
personas, accounts were refused between 0% and 29% of the time. Where access is granted, most
endpoints scope their data to the caller's permitted centres. Section 10 records the endpoints
where that scoping is absent.

**5.7 [DECISION — we answered this; please confirm]** `youth_skilling.api.utils.get_training_center_list` returns the **full list of
training centres to every persona**, including centres outside the caller's permitted set. This
appears to be reference data for a picker rather than record disclosure. Is organisation-wide
visibility of the centre list intended?

**5.8 [DECISION — narrowed; a smaller question than it was]** Batch records carry a `training_centers` array naming **several centres**, and
callers permitted for one centre see the others named. No batch was returned to an account
permitted for none of its centres. Is a batch legitimately shared across centres?

**5.9 [DECISION — we answered this; please confirm] Data scoping is disabled for any account holding `System Manager`, and the
permission model forces every staff account to hold it.** This is the single most consequential
fact about the platform's authorisation model, and it has two halves, both measured:

- **The permission model offers no alternative.** Of the **293 doctypes** the WeConnect applications
  install, **178 grant permissions to `System Manager` alone**, **115 grant none at all**, and
  **none grants anything else**. There is no role-based permission model to use, so a working staff
  account must hold `System Manager`.
- **Application code then treats that role as "no restriction".** At **45 sites across 26 files in
  7 of the 8 applications**, centre, region and partner scoping is applied *only when the caller
  does not hold the role* — either `if "System Manager" not in roles:` around the filter, or a
  scope resolver that returns `None` / `[]` for such a caller. Several of those sites are shared
  helpers, so the reach is wider than the site count.

The consequence is that the scoping described elsewhere in this section is, for real accounts,
frequently not applied at all. **Confirmed on the live platform, read-only:** the Outreach
Coordinator credential reports two permitted centres yet successfully reads `/api/resource/User`
and `/api/resource/Role Profile` — reads only a `System Manager` obtains.

**This is a [DECISION — we answered this; please confirm] and not merely a defect** because the remedy is not a code change alone: the
doctype permission model has to be designed before the role can be withdrawn, or every staff account
loses access. **Is the intended model role-based permissions per persona, and is `System Manager` on
staff accounts an accepted interim state or an error?**

**5.10** The framework's own mechanism is **sound** and should not be confused with the above. A
cross-centre write through the ordinary `.save()` path is refused with `PermissionError` naming the
centre, **even for an account holding `System Manager`**. Every scope failure we record is
application code bypassing a working mechanism, by one of three routes: `ignore_permissions=True`
on a write, `frappe.get_all` in place of `get_list` on a read, or the role check in 5.9.

## 6. Routing and navigation

**6.1** Each persona application is served under a base path — `/fc/`, `/ch/`, `/sp/`, `/syc/`,
`/sm/`, `/oc/` and `/pm/` (the last deferred from QA scope by agreement). The Outreach Coordinator
application is served at **`/oc/`**, not at the site root; the **root is the authentication
application**. The routing table additionally dispatches to `/pyc/`, for which no application
exists — see 3.1.1.

**6.2** The FC and CH applications define route paths that **already include their own prefix**, so
their real URLs contain it twice — `/fc/fc/all-batches`. This matches the links the applications
themselves render, so it is consistent, if unusual.

**6.3** The navigation menu exposes a **small fraction of each application's routes**. The
Facilitator & Counsellor application renders **4 items in its sidebar and defines 56 routes**. The
remaining screens are reachable only by deep link or by in-application navigation.

**6.4** Navigation to detail screens is performed **programmatically**, not through anchor
elements, so those destinations are not discoverable from the rendered page.

**6.5** Four applications (SP, SYC, SM, OC) ship a **`coming-soon`** placeholder route.

**6.6 [DECISION — we answered this; please confirm]** The OC application ships a route named **`test-zustand`** — by its name a
developer test screen for the state library. Should a development route be present in a deployed
application?

## 7. API response conventions

**7.1** The platform uses **two different response envelopes**:

- Frappe's default, where the payload is under `message`;
- an application-specific form: `{ success_key, message: "<human-readable status>", data: [...], count }`,
  where `message` is a status *string* and the records are under `data`.

**7.2** Consumers must therefore inspect both shapes. This is a genuine source of defects: our own
scope-checking inspected `message` alone and missed records entirely until corrected.

**7.3** Nested payloads are sometimes **JSON encoded inside a JSON string**, requiring more than one
parse to reach the data.

## 8. Error behaviour

**8.1** A missing credential returns **403**; an invalid credential returns **401**; a missing
endpoint returns **404**. Some permission failures return **500**.

**8.2** Error responses include `exception`, `exc_type` and `exc` fields. Section 10 records what
those fields currently contain.

**8.3** The platform returns **HTTP 500 under modest concurrency**. Above three simultaneous
sessions, data endpoints fail widely; serialised, the same endpoints succeed. Roughly 4% of route
loads require a retry even at three sessions.

**8.4 [DECISION — narrowed; a smaller question than it was]** Is three concurrent sessions representative of expected production load? Centre
staff working simultaneously across multiple locations would exceed it substantially.

## 9. Functional surface by persona

The screens each role has, grouped by functional area. This is the inventory against which
functional test coverage will be planned, and the place to tell us if a role is missing a capability
it should have.

**Facilitator & Counsellor — 56 routes.** Counselling (general, family, career, group-based),
youth status assignment, batch management and attendance, tasks, assessments, badges, job
applications, feedback, profile and settings.

**Centre Head — 22 routes.** Targets (individual, person-wise, centre), approvals, staff
monitoring, batch management, budget profile, tasks, profile and settings.

**Skilling Partner — 36 routes.** Batch management (7 screens by batch state), invoicing
(4 screens including preparation and declaration upload), screening (schedule, test, written test),
assessments (pre-test, post-test), assignments, curriculum, achievements and badges, approvals,
attendance tracking, feedback, profile and settings.

**Skilling Youth Coordinator — 50 routes.** Counselling (general, family, job-readiness,
career, group-based), batch management, targets, waiting-for-skilling and waiting-for-placement
queues, assessments and assignments, curriculum, skilling repository, partner and course detail
views, calling screens, approvals, profile and settings.

**Skilling Manager — 42 routes.** Batch management, invoicing management, targets, budget planning
and budget, approvals, issue management, skilling partner and course administration (add,
discontinue, view), certificates, batch audit reporting, assessments and assignments, profile and
settings.

**Outreach Coordinator — 46 routes.** Enrolment (14 screens: pre-enquiry, enquiry, counselling,
registration), outreach planning and visit documentation, community mapping, batch management,
repository, tasks, notifications, profile and settings.

**9.1 [DECISION — this one genuinely needs you]** Is each inventory complete for its role, and is any screen listed here one the
role should *not* have?

## 10. Excluded from this baseline — behaviour classified as defective

The following is **not** part of the accepted baseline. It is recorded in the findings register with
evidence and suggested fixes, and confirming this document does not accept any of it as intended.

- **[S1] Youth counselling records readable by an account with no permission for those centres.**
  Ten of ten records returned were outside scope, each carrying a youth's name alongside
  counselling type, outcome and free-text remarks. Reproduced in three consecutive verifications.
  Under the Definition of Done an S1 must be fixed, retested and confirmed closed
- Fourteen routes that render no content — reproduced in three consecutive executions. Five are
  confirmed to be **throwing uncaught JavaScript exceptions**: they read navigation state that is
  null when a route is entered directly by URL, so refresh, bookmark, shared link and browser-back
  all break them
- A financial `POST` issued by the invoice preparation screen on page load, with no user action
- Records returned to three further personas for centres entirely outside their permitted scope
- Python tracebacks, including framework file paths, returned in the standard error envelope to
  callers with no valid credential
- An authentication route-guard that leaves logged-out visitors on the page in two applications
- WCAG 2.1 AA violations on 182 of 235 routes, across roughly 3,500 elements, concentrated in a
  shared navigation component — four rules account for about 80% of them
- Long-lived API credentials stored in `localStorage` on an origin shared by all eight applications
- **Data scoping disabled for `System Manager` at 45 sites across 26 files in 7 of the 8
  applications** — the cause of the counselling S1 above, and characterised at 5.9. The scoping
  code exists and is correct; it is skipped for any caller holding the role, which the permission
  model forces every staff account to hold
- **The environment→API mapping is shifted by one in every repository**, with no configuration
  naming a production API — characterised at 3.5
- **A role profile (`Placement Youth Coordinator`) routed to an application that does not exist** —
  characterised at 3.1.1

**Phase 2 additions.** This document records read-only observation, so the write-side defects found
in Phase 2 are not listed above. They are in the findings register and include two further **S1**
breaches confirmed end-to-end against the database — an account raising another centre's financial
invoice, and closing another centre's batch — together with the systemic write-side cause: 30
mutating endpoints that pass `ignore_permissions=True` and perform no authorisation check.

**10.1 [DECISION — we answered this; please confirm]** Among the blank routes, are any **unbuilt features** rather than defects? Four
applications ship `coming-soon` placeholders, so some screens may be intentionally incomplete.
Telling us which changes their classification from defect to not-yet-implemented.

**10.2 [DECISION — narrowed; a smaller question than it was]** Several screens obtain their record identifier from **navigation state rather
than the URL**, and fail when entered directly. Is deep-linking to these screens — by bookmark,
shared link or refresh — intended to work?

**Corrected 2026-09-22.** An earlier version of this item said the identifier "is already present"
in the URL for most of these routes, implying the fix was to read what was already there. That was
wrong. We cross-checked all 13 blank routes against the route table: **none of them is a dynamic
route** — none carries a `:param` segment. Only 17 routes in the whole platform do, and no blank
route is among them. The identifier has nowhere to live in the URL today. So if deep-linking is
intended, the fix is to add a parameter to each route and update every in-app link that navigates
to it, which is a larger change than the earlier wording suggested. We would rather tell you that
now than have you size the work from an incorrect note.

## 11. Known limits of this characterisation

Stated so that the baseline's scope is not overstated:

- **No write behaviour has been observed.** Everything requiring a create, edit or delete is
  unobserved and belongs to Phase 2.
- **Interaction states are not covered.** Screens were observed in their landing state; tabs,
  modals, filters, pagination and form validation were not exercised.
- **Data correctness is not assessed.** We have observed that screens render and which endpoints
  they call, not whether the values shown are right.
- **One browser.** Desktop Chrome only; responsive and cross-browser behaviour is Phase 3.
