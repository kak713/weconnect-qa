# WeConnect 2.0 — Retest Evidence Pack

Reproducible evidence for each disputed finding. Source paths are current `dev`. Runtime items ran
on an isolated stack rebuilt from current source with synthetic data; no live or real data was
written. Live items are read-only against `api-dev`.

---

## Reported "Fixed" — still present

### WC-084 (S1) — cross-centre batch close
- **Their note:** "close_batch now checks centre/partner scope via `user_can_access_centre`."
- **Source:** `weconnect-backend-skilling/youth_skilling/api/batch_management.py:7897` — `close_batch`
  spans lines 7897–8056. `user_can_access_centre` does not exist anywhere in the file. The function
  ends in `doc.save(ignore_permissions=True)` (line 8029) with no centre or permission check.
- **Runtime:** logged in as the Skilling Partner persona (permitted East and West only), then:
  ```
  POST /api/method/youth_skilling.api.batch_management.close_batch
  {"batch_id":"<a North-centre batch>","short_remarks":"Batch is filled"}
  -> {"success_key":1,"message":"Batch closed successfully."}
  ```
  An account with no permission for North closed a North batch.

### WC-128 — reset OTP logged to the browser console
- **Their note:** "Removed reset-payload console.log… production build strips console."
- **Deployed bundle:** `https://uat.lighthouseconnect.org/auth/` → the main JS bundle contains
  `console.log("OTP Generation Response: ", n)` and logs the email and OTP in the forget-password
  flow (11 `console.*` calls survive). The console strip applies to the OC build, not the auth app,
  which is where the reset flow runs.

### WC-126 — no state-transition control
- **Runtime (`state_transition_probe.py`):** Skilling Invoice `current_status` 30/30 transitions
  accepted; Skilling Batch `batch_status` 72/72 accepted. Every status can move to every other,
  including final states.

### WC-123 — cross-user write via update_profile
- **Runtime (`mass-assignment-probe.mjs`):** `update_profile` on another user's record returned
  HTTP 200 and changed `User.first_name`. No active permission check.

### WC-078 — delete any file by URL
- **Source:** `weconnect-backend-outreach/outreach/apis/registration/files.py:463` —
  `delete_file_by_url` resolves a `File` from the URL and deletes it with no owner / `session.user`
  / `has_permission` check.

### WC-080 — move_youth with no caller check
- **Source:** `move_youth` creates a batch-transfer approval with no `has_permission` / caller check.

### WC-077 — unauthenticated System Manager provisioning
- **Source:** `weconnect-backend-authentication` — `create_user` still carries `allow_guest` and
  assigns `System Manager`.

### WC-088 — enquiry status typo
- **Source:** `id = json.loads(id)` at `outreach/apis/enquiry.py` and
  `outreach/apis/enquiry_form/form.py`.

### WC-089 / WC-101 — 500 on bad input
- **Runtime:** `youth_skilling.api.actions.add_remarks` with `{}` → HTTP 500,
  `TypeError: add_remarks() missing 2 required positional arguments`. The validation probe found
  four endpoints returning 500 on malformed input instead of 400.

### WC-074 — 200 on failure
- **Runtime:** `close_batch` returns HTTP 200 with `success_key: 0` on a failed call.

### WC-043 — null-navigation blank routes
- **Source:** only 2 of 9 frontend apps define a React error boundary; a null-state crash blanks the
  whole screen in the other 7.

---

## "Not a Bug" — disputed

### WC-115 — bulk export by any account (marked both "Valid Bug" and "Not a Bug")
- **Source:** `weconnect-backend-outreach/outreach/apis/lcf_mastersheet_sync.py` —
  `sync_to_lcf_mastersheet` validates the section name, then exports programme records to a Google
  Spreadsheet, with no role / centre / caller check. Not run live (it exports real data).

### WC-079 / WC-073 / WC-035 — systemic permission bypass
- **Source:** 326 `ignore_permissions=True` sites across the eight backends. 178 of 293 doctypes
  grant only `System Manager` and 115 grant nothing (WC-073), so the bypass is the only thing that
  lets accounts work — and it is the root cause of WC-084 and the residual in WC-095/WC-048.

### WC-013 — API secret in localStorage
- **Source:** `localStorage.setItem` writes the API secret at 18 sites across the frontend apps.

### WC-004 — committed env files
- **Source:** 28 `.env` files committed across the repositories.

### WC-109 — unscoped global invoice total
- **Runtime (prior):** `dashboard.get_invoice_count` returns the same organisation-wide total to
  three disjoint persona accounts.

### WC-121 / WC-112 / WC-023 — live on api-dev (config accepted, closure disputed)
- **Live (`node verify/run.mjs`):** CORS reflects any origin with credentials; no security headers;
  Python traceback in the error body. All still present on `api-dev` on 4 November.

---

## New findings

### WC-140 (S2) — hardcoded staff credentials and PII in source
- **Source:** `App.jsx` in `weconnect-frontend` (OC), `-ch`, `-fc`, `-sp`, `-syc`, `-pyc` each hardcode
  an `api_key` / `api_secret` pair and a real staff `sid`, `email`, `full_name` and `employee_id`
  (e.g. `a real vendor email (OC)`, `api_key = "<api_key redacted>"`). A Frappe key/secret pair is a
  working credential. These were not used to authenticate.

### WC-141 (S3) — accessibility
- **Fresh axe (deployed OC app):** a button with no accessible name (WCAG 4.1.2), and a scrollable
  region that cannot take keyboard focus (WCAG 2.1.1).

### WC-027 / WC-028 — WCAG, by axe on the deployed OC app
- **WC-027 (nav): fixed** — 0 `list` / `listitem` violations across three authenticated pages.
- **WC-028 (contrast): present** — 2 `color-contrast` violations on the dashboard, 5 on the planning
  screen.

---

## How to re-run

- Live read-only checks: `node verify/run.mjs` (against `api-dev`).
- Write-side reproductions: rebuild the isolated stack (`environment/up.sh`), seed
  (`suite/seed.sh`), then the reproductions in `reproductions/` and probes in `suite/probes/`.
- Source citations are file-and-line against the current `dev` branch of each repository.
