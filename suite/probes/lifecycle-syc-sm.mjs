/**
 * Lifecycle coverage for the Skilling Manager (sm) and Skilling Youth Coordinator (syc).
 *
 * Drives create -> read -> update -> state-change as the OWNING persona, which answers
 * "does this persona's primary object work at all". Cross-boundary behaviour is a separate
 * question, covered by state-boundary-sweep.mjs.
 *
 * Every record id comes from the fixtures manifest; nothing is hardcoded.
 * Every mutating call passes through write-guard.cjs, which refuses any host but the isolated stack.
 *
 * Run:  npm run probe:lifecycle-syc-sm
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { BASE, HOST, login, fixtures } from "./_config.mjs";

const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const F = fixtures();

const courseFields = (name) => ({
  step: "1", course_name: name, course_category: F.course_category,
  onboarding_date: "2026-07-01", course_type: "Free", screening_test_required: "No",
  skilling_partner: F.skilling_partner, center: F.training_center,
  certificate_issuing_authority: F.cert_authority, lighthouse_centre: F.north_centre,
  equivalent_qp_code: "QA-QP-001", education: F.education,
  eligibility_remark: "QA eligibility", gender: "All", age_group: "18-25",
  type_of_batch: "Regional", mode_of_training: "Offline",
  employment_type: "Employment Linked", job_roles_aligned: F.job_role,
  course_duration_months: "3", course_duration_hours: "360",
  total_theory_hours: "120", total_practical_hours: "180", total_ojt_hours: "60",
  min_batch_strength: "10", max_batch_strength: "30",
  number_of_employees: "5", average_salary_from_employer: "0",
});

const partnerFields = (name) => ({
  step: "1", skilling_partner_name: name, partner_name: name,
  partner_email_id: "qa.partner@qa-synthetic.invalid", region: F.region,
  lighthouse_centre: F.north_centre, nsdc_affiliated: "No",
  tds_nil_lower_deduction_applicable: "No", pan_number: "AAAPL1234C",
  mou_start_date: "2026-07-01", mou_end_date: "2027-06-30",
  head_office: "QA Head Office", partner_type: "External",
  organisation_type: "Limited Liability Partnership", mode_of_training: "Online",
  spoc_first_name: "QA", spoc_last_name: "SPOC",
  spoc_mobile_number: "9000088888", spoc_email: "qa.spoc@qa-synthetic.invalid",
  spoc_location: "QA SPOC Location",
});

async function call(auth, method, path, fields, resource = false) {
  const url = resource
    ? `${BASE}/api/resource/${encodeURIComponent(path)}/${encodeURIComponent(fields)}`
    : `${BASE}/api/method/${path}`;
  const v = evaluate(url, method);
  if (!v.allow) return { ok: false, status: 0, text: `guard refused: ${v.reason}` };

  const opts = { method, headers: { Host: HOST, Authorization: auth } };
  if (method === "GET") {
    const qs = new URLSearchParams();
    if (!resource) for (const [k, val] of Object.entries(fields || {}))
      qs.set(k, typeof val === "string" ? val : JSON.stringify(val));
    const q = qs.toString();
    const r = await fetch(q ? `${url}?${q}` : url, opts);
    return { ok: r.status < 400, status: r.status, text: await r.text() };
  }
  const b = new FormData();
  for (const [k, val] of Object.entries(fields || {}))
    b.set(k, typeof val === "string" ? val : JSON.stringify(val));
  opts.body = b;
  const r = await fetch(url, opts);
  const text = await r.text();
  // Some endpoints answer HTTP 200 with success_key:0 on failure — a recorded finding.
  let flagged = false;
  try {
    const j = JSON.parse(text);
    const p = j.message && typeof j.message === "object" ? j.message : j;
    flagged = (p.success ?? p.success_key) === 0;
  } catch { /* non-JSON body */ }
  return { ok: r.status < 400 && !flagged, status: r.status, text };
}

const verdict = (r) => (r.ok ? "PASS" : `FAIL(${r.status})`);
const idFrom = (text, key) => {
  try {
    const j = JSON.parse(text);
    return j.data?.[key] ?? j.message?.data?.[key] ?? null;
  } catch { return null; }
};
const reason = (r) => {
  try {
    const j = JSON.parse(r.text);
    const p = j.message && typeof j.message === "object" ? j.message : j;
    return String(p.message ?? j.exception ?? "").slice(0, 120);
  } catch { return String(r.text).slice(0, 120); }
};

const NA = (why) => ({ verdict: `N/A (${why})`, ok: true, status: 0, text: "" });

async function course(auth) {
  const steps = {}, name = `QA Course ${Date.now()}`;
  const c = await call(auth, "POST", "youth_skilling.api.skilling_repository.add_course", courseFields(name));
  steps.create = { ...c, verdict: verdict(c) };
  const id = idFrom(c.text, "course_id");
  if (!id) return { steps, id: null };
  const r = await call(auth, "GET", "Course", id, true);
  steps.read = { ...r, verdict: verdict(r) };
  const u = await call(auth, "PUT", "youth_skilling.api.skilling_repository.edit_course",
    { ...courseFields(`${name} Edited`), course_id: id });
  steps.update = { ...u, verdict: verdict(u) };
  const s = await call(auth, "POST", "youth_skilling.api.skilling_repository.discontinue_course",
    { course_id: id, discontinue_date: "2026-08-01", remarks: "QA lifecycle" });
  steps.stateChange = { ...s, verdict: verdict(s) };
  return { steps, id };
}

async function partner(auth) {
  const steps = {}, name = `QA Partner ${Date.now()}`;
  const c = await call(auth, "POST", "youth_skilling.api.skilling_repository.add_skilling_partner", partnerFields(name));
  steps.create = { ...c, verdict: verdict(c) };
  const id = idFrom(c.text, "skilling_partner_id");
  if (!id) return { steps, id: null };
  const r = await call(auth, "GET", "Skilling Partner", id, true);
  steps.read = { ...r, verdict: verdict(r) };
  const u = await call(auth, "PUT", "youth_skilling.api.skilling_repository.edit_skilling_partner",
    { ...partnerFields(`${name} Edited`), skilling_partner_id: id });
  steps.update = { ...u, verdict: verdict(u) };
  const s = await call(auth, "POST", "youth_skilling.api.skilling_repository.discontinue_skilling_partner",
    { partner_id: id, discontinue_date: "2026-08-01", remarks: "QA lifecycle" });
  steps.stateChange = { ...s, verdict: verdict(s) };
  return { steps, id };
}

async function attendance(auth) {
  const steps = { create: NA("marked, not created"), update: NA("no update endpoint") };
  const r = await call(auth, "GET", "youth_skilling.api.batch_management.batch_attendance", { batch_id: F.east_batch });
  steps.read = { ...r, verdict: verdict(r) };
  const s = await call(auth, "POST", "youth_skilling.api.batch_management.mark_attendance",
    { skilling_batch_id: F.east_batch, youth_id: F.east_youth, attendance: { "2026-08-05": "Present" } });
  steps.stateChange = { ...s, verdict: verdict(s) };
  return { steps, id: F.east_batch };
}

/**
 * `update_youth_status` refuses a youth already in a terminal status, and this probe puts one
 * there. Rather than depend on seed ordering, pick a youth the caller can still move — falling
 * back to the manifest's if the query yields nothing.
 */
async function pickMovableYouth(auth) {
  const filters = encodeURIComponent(JSON.stringify([["status", "not in", ["Standby", "Drop Off", "Closed"]]]));
  const url = `${BASE}/api/resource/Youth?filters=${filters}&limit_page_length=1`;
  try {
    const r = await fetch(url, { headers: { Host: HOST, Authorization: auth } });
    const rows = JSON.parse(await r.text()).data ?? [];
    return rows[0]?.name ?? F.south_youth;
  } catch { return F.south_youth; }
}

async function youthStatus(auth) {
  const steps = { create: NA("created via enquiry"), update: NA("state change = update") };
  const youth = await pickMovableYouth(auth);
  const r = await call(auth, "GET", "Youth", youth, true);
  steps.read = { ...r, verdict: verdict(r) };
  const s = await call(auth, "PUT", "youth_skilling.api.actions.update_youth_status",
    { ids: [youth], data: { status: "Standby", remarks: "QA lifecycle" } });
  steps.stateChange = { ...s, verdict: verdict(s) };
  return { steps, id: youth };
}

const OBJECTS = [
  ["Course", "sm", course],
  ["Skilling Partner", "sm", partner],
  ["Batch Attendance", "syc", attendance],
  ["Youth Status", "syc", youthStatus],
];

const auths = {}, results = [];
for (const [object, persona, fn] of OBJECTS) {
  auths[persona] ??= (await login(persona)).auth;
  let out;
  try { out = await fn(auths[persona]); }
  catch (e) { out = { steps: { create: { verdict: "ERROR", ok: false, status: 0, text: e.message } }, id: null }; }
  results.push({ object, persona, id: out.id, steps: out.steps });
}

const COLS = ["create", "read", "update", "stateChange"];
console.log("\n  Lifecycle coverage — sm and syc primary objects (owning persona, happy path)\n");
console.log("  " + "OBJECT".padEnd(20) + "PERSONA".padEnd(9) + COLS.map(c => c.toUpperCase().padEnd(30)).join(""));
for (const r of results)
  console.log("  " + r.object.padEnd(20) + r.persona.padEnd(9) +
    COLS.map(c => String(r.steps[c]?.verdict ?? "—").padEnd(30)).join(""));

let failed = 0;
console.log("\n  Failures:");
for (const r of results) for (const c of COLS) {
  const s = r.steps[c];
  if (s && !s.ok) { failed++; console.log(`    ${r.object} / ${c}: HTTP ${s.status} — ${reason(s)}`); }
}
if (!failed) console.log("    none");

writeFileSync(new URL("../../evidence/lifecycle-coverage-syc-sm.json", import.meta.url),
  JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
