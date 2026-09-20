# WeConnect 2.0 QA — BrowserStack Recommendation

**Version:** 1.2 · **Date:** 2026-09-25
**Purpose:** what to buy for Phase 3 cross-browser testing, and what not to

---

## The answer

**Buy the smallest paid Automate tier that gives 3–5 parallel sessions**, with enough session
minutes for the cadence you want. Run the curated subset of ~25 routes across the matrix, not all
235.

**Do not buy more parallel sessions.** That is what these plans are priced on and it is the
instinctive upgrade, but it would be wasted money here: we measured it, and going from three
sessions to five doubled inconsistent results and turned eight working routes blank, for only 21%
less wall-clock time. The limit is your backend, not the tool. Fix the concurrency behaviour first
and extra parallelism becomes worth paying for.

Everything below is the working behind that.

---

The account supplied is on the **Free** plan, which covers roughly one single-browser pass and
nothing further. Phase 3 needs capacity. Rather than "upgrade the plan", here is what the
measurements actually require.

**Cost per execution**, derived from our own timings (mean 15.3s per route across 260 measured
executions, plus 30% for remote latency):

| Scope | Per browser configuration | Across a 5-configuration matrix |
|---|---|---|
| All 235 routes | ~78 session-minutes | **~390 session-minutes** |
| Curated subset (~25 routes: authentication, one dashboard per persona, all known-defective routes) | ~11 session-minutes | **~55 session-minutes** |

**What to buy:**

- **Session minutes** sufficient for the intended cadence. A full-matrix pass costs roughly 400
  minutes; the curated subset roughly 55. If Phase 3 runs the matrix weekly with retests after
  fixes, budget on the order of 8–10 executions.
- **Three to five parallel sessions — no more.**

**What not to buy, and this is the important part.** BrowserStack plans are priced largely on
parallel sessions, and the natural instinct is to buy more to go faster. **It would be wasted
money here.** We measured it directly: raising concurrency from three sessions to five doubled the
rate of inconsistent results and turned eight correctly-rendering routes blank, while delivering
only 21% less wall-clock time. The constraint is your own API's behaviour under concurrent load,
not the testing tool. **Additional parallel sessions cannot be used until the backend concurrency
issue is addressed.**

That ordering matters: fix the concurrency behaviour first, then higher parallelism becomes
purchasable capacity rather than wasted spend. Until then, three to five sessions is the ceiling
worth paying for.

**Our recommendation:** the smallest paid **Automate** tier offering 3–5 parallel sessions with
sufficient minutes for the agreed cadence, and cross-browser execution against the curated subset
rather than the full route set. Full-matrix execution of all 235 routes on every configuration is
available if wanted, but it multiplies cost without proportionate risk reduction — the defects we
found are overwhelmingly in shared components, which the subset exercises.

## Before buying anything: how much can be done without BrowserStack

The honest answer is **most of it**, and we would rather establish that before recommending spend.

Playwright ships the three browser engines that matter — **Chromium** (Chrome, Edge), **Firefox**,
and **WebKit** (the engine behind Safari). They are already installed and running here at no
cost. It also provides device emulation covering viewport, user agent, touch input and pixel
density. Adding all three engines plus mobile profiles to the existing suite is roughly an hour of
configuration, not a purchase.

**What that does not give you**, and where BrowserStack is genuinely the only option:

- **Real iOS Safari.** Desktop WebKit is close but not identical; iOS Safari has its own rendering
  and input behaviour. For a platform used by field staff on phones, this is the meaningful gap.
- **Real Android devices** rather than emulated ones, for actual GPU rendering, fonts and memory limits.
- **Specific browser versions** your users may still be running.
- **Windows rendering** — scrollbars, font smoothing and form controls differ from macOS, and all of
  our testing to date has been on macOS.

**There is also evidence that cross-browser risk here is lower than typical.** Every defect found in
Phase 1 is browser-agnostic: null dereferences, server-side authorisation bypassed by a role check,
accessibility markup, API contract mismatches, backend concurrency. None of these would behave differently in Firefox than
in Chrome. This does not prove the platform is safe across browsers, since we have not yet looked
for layout or CSS defects. It does mean the risk is worth **measuring before you spend against
it**.

**Our recommendation is a sequence, not a purchase:**

1. **Add the three engines and mobile emulation locally.** One hour, no cost. Run the curated
   subset across all of them.
2. **If that finds nothing**, the platform is probably rendering-agnostic and real-device testing is
   a lower priority than it first appears.
3. **Use the existing free allowance for one real-device pass.** The curated subset costs roughly
   **55 session-minutes across a five-configuration matrix**, which fits inside the free Automate
   allowance. A first real-device run may therefore cost nothing at all.
4. **Buy Automate only if** steps 1–3 surface real-device-specific defects, or if you want
   cross-browser execution running continuously in CI rather than as a one-off exercise.

That ordering spends your money on evidence rather than assumption. It is also the honest answer to
"do we need BrowserStack": **not to begin with, and possibly not at all** — but if real-device
coverage is wanted as a standing capability, Automate is the product, and nothing else on their
catalogue is required.

## Which BrowserStack products are actually required

BrowserStack sells a dozen products and they are not all relevant here. WeConnect 2.0 is a
**responsive web application**, not a native mobile app, which rules several out immediately.

| Product | Needed? | Reasoning |
|---|---|---|
| **Automate** | **Buy this one** | Runs our Playwright suite unchanged against real desktop and mobile *browsers*. This is the only paid product Phase 3 requires. |
| **Bug Capture** | Free tier is sufficient | Useful for the manual exploratory passes — annotated screenshots with console and network context. Already available on the current account. |
| **Live** | Optional, low priority | Manual interactive browsing on real devices. Helpful for investigating a specific defect on a specific browser; not required for the automated matrix. |
| **App Automate** | **Not needed** | For **native** mobile applications (`.apk`/`.ipa`). WeConnect is a web app. Mobile *browser* coverage is part of Automate. |
| **App Live** | **Not needed** | Same reason — native apps only. |
| **Percy** (visual regression) | **Not needed** | Playwright has visual comparison built in (`toHaveScreenshot`) and runs it locally at no cost. Percy adds cloud baselines and a review workflow, which is convenience rather than capability. |
| **Test Observability** | **Not needed** | Flake detection and failure analytics. We have already built this: the three-execution verdict aggregation and the known-defect registry do the same job, tuned to this platform. |
| **Accessibility Testing** | **Not needed for the automated portion** | We already run axe-core across all 235 routes at no cost. Their product would help with the manual 60–70% of WCAG that automation cannot reach — worth revisiting only if manual accessibility assessment is later brought into scope. |
| **Test Management** | **Not needed** | Test case and run management. The findings register and the suite itself serve this purpose. |
| **Low Code Automation** | **Not needed** | For teams without engineering capacity to write tests. We have the tests. |

**Summary: one paid product — Automate.** Everything else is either already covered by tooling that
costs nothing, irrelevant to a web application, or a convenience layer over something we have built.

*Product names and packaging change; please confirm the current tiers at the point of purchase. The
requirement to state to a salesperson is: **Automate, 3–5 parallel sessions, web browsers including
real mobile browsers, approximately N session-minutes per month** — where N follows from the
cadence you choose and the costings above.*

