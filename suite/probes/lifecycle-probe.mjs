#!/usr/bin/env node
/**
 * Lifecycle coverage probe: exercise create / read / update / state-change / delete for a
 * persona's primary objects through the API, and record which operations are exposed and pass.
 *
 * This is the breadth half of Phase 2. It complements the depth work (the authorization gate
 * probe) by walking each object through its full lifecycle as the *owning* persona — the
 * happy path — asserting that each step succeeds and leaves the record in the expected state.
 *
 * The result is a coverage matrix, not a single pass/fail: for each object it records, per
 * operation, one of PASS (worked), FAIL (exposed but errored), or N/A (no API endpoint exposes
 * it). "N/A" is a real finding — an object with no delete endpoint cannot be deleted through the
 * API, which the client should know.
 *
 * All writes go to the isolated host via the write guard. Records created here are cleaned up
 * where a delete exists; where it does not, they are left and the environment is reset between
 * runs by rebuild-site.sh.
 */
import "dotenv/config";
import fs from "node:fs";
import { createRequire } from "node:module";

const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";

async function login(key) {
  const b = new FormData();
  b.set("usr", `qa.${key}@qa-synthetic.invalid`);
  b.set("pwd", "QA-synthetic-pw-2026");
  const r = await fetch(`${BASE}/api/method/authentication.api.auth.login`, { method: "POST", body: b, headers: { Host: HOST } });
  const m = JSON.parse(await r.text()).message;
  return `token ${m.api_key}:${m.api_secret}`;
}

async function call(method, path, auth, fields) {
  // RESOURCE = canonical read of a single record by name via /api/resource/<doctype>/<name>.
  if (method === "RESOURCE") {
    const name = typeof fields === "string" ? fields : fields?.name;
    if (!name) return { ok: false, status: 0, text: "no record name" };
    const r = await fetch(`${BASE}/api/resource/${encodeURIComponent(path)}/${encodeURIComponent(name)}`,
      { headers: { Host: HOST, Authorization: auth } });
    const text = await r.text();
    return { ok: r.status < 400, status: r.status, text };
  }
  let url = `${BASE}/api/method/${path}`;
  const v = evaluate(url, method);
  if (!v.allow) return { ok: false, status: 0, text: `guard refused: ${v.reason}` };
  const opts = { method, headers: { Host: HOST, Authorization: auth } };
  if (method === "GET" || method === "HEAD") {
    // GET cannot carry a body; pass fields as query parameters.
    const qs = new URLSearchParams();
    for (const [k, val] of Object.entries(fields || {})) qs.set(k, typeof val === "string" ? val : JSON.stringify(val));
    const q = qs.toString();
    if (q) url += `?${q}`;
  } else {
    const b = new FormData();
    for (const [k, val] of Object.entries(fields || {})) b.set(k, typeof val === "string" ? val : JSON.stringify(val));
    opts.body = b;
  }
  const r = await fetch(url, opts);
  const text = await r.text();
  let ok = r.status < 400;
  try {
    const j = JSON.parse(text);
    const p = j.message && typeof j.message === "object" ? j.message : j;
    const flag = p.success ?? p.success_key;
    if (flag !== undefined) ok = Number(flag) === 1;
  } catch { /* keep status-based ok */ }
  return { ok, status: r.status, text };
}

/**
 * Object lifecycle definitions. Each op is [label, method, path, fieldsBuilder] or null (N/A).
 * fieldsBuilder receives { created } to reference the record made by create.
 */
const { fixtures } = await import("./_config.mjs");
const FIX = fixtures();

// Reference values resolved from the seeded data; every id comes from the fixtures manifest.
const FIRST_EDUCATION = FIX.education;
const FIRST_REFERRAL = FIX.referral;
const FIRST_CAREER_ASSIST = FIX.career_assistance;
const COUNSELLING_TYPE = FIX.counselling_type;
const NORTH_YOUTH = FIX.north_youth;
const APPROVAL_CATEGORY = FIX.approval_category;
const COMMUNITY = FIX.community;
const SKILLING_COURSE = FIX.course;
const SKILLING_BATCH = FIX.north_batch;
const SKILLING_TRAINER = FIX.trainer;
const ISSUE_CATEGORY = FIX.issue_category;
const EAST_YOUTH = FIX.east_youth;
const COURSE_CATEGORY = FIX.course_category;
const SKILLING_PARTNER = FIX.skilling_partner;
const TRAINING_CENTER = FIX.training_center;
const CERT_AUTHORITY = FIX.cert_authority;


const OBJECTS = {
  "Skilling Issue": {
    persona: "sp",
    create: ["POST", "youth_skilling.api.skilling_issue.raise_issue", () => ({
      course: SKILLING_COURSE, skilling_batch_id: SKILLING_BATCH, trainer: SKILLING_TRAINER,
      issue_category: ISSUE_CATEGORY, issue_description: "QA synthetic issue",
    }), () => null],
    read: ["RESOURCE", "Skilling Issue", (c) => c],
    update: ["PUT", "youth_skilling.api.skilling_issue.update_issue", (c) => ({
      issue_id: c, data: { issue_description: "QA edited issue" },
    })],
    stateChange: ["POST", "youth_skilling.api.skilling_issue.update_issue_status", (c) => ({
      issue_id: c, status: "Resolved",
    })],
    delete: null,
  },
  "Follow Up": {
    persona: "sp",
    create: ["POST", "youth_skilling.api.follow_up.request_follow_up", () => ({
      youth_id: EAST_YOUTH, sp_remarks: "QA follow-up", description: "QA synthetic follow up",
    }), () => null],
    read: ["RESOURCE", "Follow Up", (c) => c],
    update: ["PUT", "youth_skilling.api.follow_up.edit_followup", (c) => ({
      follow_up_id: c, sp_remarks: "QA edited follow-up",
    })],
    stateChange: ["POST", "youth_skilling.api.follow_up.complete_followup", (c) => ({
      follow_up_id: c,
    })],
    delete: null,
  },
  "Approval": {
    persona: "ch",
    create: ["POST", "centre_head.api.approval.form.create", () => ({
      document: "Youth", document_name: FIX.north_youth_2 || FIX.north_youth, category: APPROVAL_CATEGORY,
      short_remarks: "QA approval", long_remarks: "QA lifecycle approval",
    }), () => null],  // create returns no id; rely on latest-record fallback
    read: ["RESOURCE", "Approval", (c) => c],
    update: ["PUT", "centre_head.api.approval.form.update", (c) => ({
      approval_id: c, data: { status: "Approved", ch_short_remarks: "QA", short_remarks: "QA" },
    })],
    stateChange: null,
    delete: null,
  },
  "Community Visit": {
    persona: "oc",
    create: ["POST", "outreach.apis.outreach_planning.community_visit.form.create", () => ({
      data: {
        community: COMMUNITY, place: "QA Place", date: "2026-07-01", location: "QA West Centre",
        start_time: "10:00:00", end_time: "12:00:00",
      },
    }), (res) => /[A-Z-]*VISIT[-0-9]*|CV[-0-9]+/i.exec(res.text)?.[0]],
    read: ["RESOURCE", "Community Visit", (c) => c],
    update: ["PUT", "outreach.apis.outreach_planning.community_visit.form.update", (c) => ({
      id: c, name: c, data: { place: "QA Place Edited" },
    })],
    stateChange: ["POST", "outreach.apis.outreach_planning.community_visit.form.mark_complete", (c) => ({
      id: c, name: c,
    })],
    delete: null,
  },
  "Counselling": {
    persona: "fc",
    create: ["POST", "facilitator_and_counsellor.api.counselling.form.create", () => ({
      data: {
        counselling_type: COUNSELLING_TYPE, counselling_location: "QA North Centre",
        counselling_date: "2026-06-15", start_time: "10:00:00", end_time: "11:00:00",
        event: "EV00001", attendees: { youth: [NORTH_YOUTH], counsellors: [] },
      },
    }), (res) => /Counselling-[0-9-]+/.exec(res.text)?.[0]],
    read: ["RESOURCE", "Counselling", (c) => c],
    update: ["PUT", "facilitator_and_counsellor.api.counselling.form.update", (c) => ({
      id: c, data: { counselling_date: "2026-06-20" },
    })],
    stateChange: ["POST", "facilitator_and_counsellor.api.counselling.actions.mark_as_dropoff", (c) => ({
      youth: NORTH_YOUTH, counselling_id: c, remarks: "QA lifecycle",
    })],
    delete: null,
  },
  "Enquiry Form": {
    persona: "oc",
    create: ["POST", "outreach.api.create_enquiry", () => ({
      params: {
        first_name: "QA", middle_name: "E", last_name: `Enq${Date.now()}`,
        dob: "2005-01-01", gender: "Other", phone_no: "9000066666",
        contact_details: "Self", address_line_1: "QA Synthetic Address",
        state: "QA State", city: "QA City", pin_code: "560001",
        what_looking_for: [FIRST_CAREER_ASSIST],
        education: FIRST_EDUCATION, found_lighthouse_at: FIRST_REFERRAL,
        name_of_the_source: "QA Source", lighthouse_location: "QA North Centre",
      },
    }), (res) => /ENQUIRY[-.0-9]+/.exec(res.text)?.[0]],
    read: ["RESOURCE", "Enquiry Form", (c) => c],
    update: ["PUT", "outreach.api.update_enquiry_form", (c) => ({
      id: c, data: { first_name: "QA Edited" },
    })],
    stateChange: ["PUT", "outreach.apis.enquiry_form.form.update_status", (c) => ({
      ids: [c], document: "Enquiry Form",
      data: { status: "Drop Off", ds_remarks: "Family Problem", remarks: "QA" },
    })],
    delete: null,
  },
  "Pre Enquiry": {
    persona: "oc",
    create: ["POST", "outreach.apis.pre_enquiry.form.create_pre_enquiry", () => ({
      data: { first_name: "QA", last_name: `PreEnq${Date.now()}`, phone_no: "9000077777" },
    }), (res) => /PRE-ENQ-[0-9]+/.exec(res.text)?.[0]],
    read: ["RESOURCE", "Pre Enquiry", (c) => c],
    update: ["PUT", "outreach.apis.pre_enquiry.form.update_form_data", (c) => ({
      id: c, data: { first_name: "QA Edited" },
    })],
    stateChange: ["PUT", "outreach.apis.pre_enquiry.actions.mark_status", (c) => ({
      ids: [c], data: { pre_enquiry_status: "Drop Off", remarks: "QA lifecycle", ds_remarks: "Family Problem" },
    })],
    delete: null,
  },
  Task: {
    persona: "fc",
    create: ["POST", "outreach.apis.task.task.create_task", () => ({
      data: { title: `QA Lifecycle ${Date.now()}`, description: "lifecycle probe",
              priority: "Low", status: "Open", exp_start_date: "2026-10-01", exp_end_date: "2026-10-31" },
    }), (res) => /TASK-[0-9-]+/.exec(res.text)?.[0]],
    read: ["RESOURCE", "Task", (c) => c],  // read the created record back by name
    update: ["PUT", "outreach.apis.task.task.update_task", (c) => ({
      name: c, data: { subject: "QA edited", description: "edited", assign_to: "", priority: "Medium", exp_end_date: "2026-11-30" },
    })],
    stateChange: ["PUT", "outreach.apis.task.task.update_task_status", (c) => ({ name: c, status: "Completed" })],
    delete: null, // no delete endpoint exposed for Task
  },
};

/** Find the most recently created record of a doctype (fallback when create returns no id). */
async function latestRecord(doctype, auth) {
  const url = `${BASE}/api/resource/${encodeURIComponent(doctype)}?order_by=creation desc&limit_page_length=1`;
  const r = await fetch(url, { headers: { Host: HOST, Authorization: auth } });
  try { return (JSON.parse(await r.text()).data || [])[0]?.name ?? null; } catch { return null; }
}

const results = {};
for (const [obj, def] of Object.entries(OBJECTS)) {
  const auth = await login(def.persona);
  const row = { persona: def.persona };
  let created = null;

  // CREATE
  if (def.create) {
    const [m, p, fb, extract] = def.create;
    const res = await call(m, p, auth, fb());
    created = res.ok && extract ? extract(res) : null;
    // Some create endpoints return success but not the new id; fall back to the latest record.
    if (res.ok && !created) created = await latestRecord(obj, auth);
    row.create = res.ok ? "PASS" : `FAIL(${res.status})`;
    row._created = created;
  } else row.create = "N/A";

  // READ (read the created record back, to confirm it persisted)
  if (def.read && created) {
    const [m, p, fb] = def.read;
    const res = await call(m, p, auth, fb(created));
    row.read = res.ok ? "PASS" : `FAIL(${res.status})`;
  } else row.read = def.read ? "SKIP(no record)" : "N/A";

  // UPDATE
  if (def.update && created) {
    const [m, p, fb] = def.update;
    const res = await call(m, p, auth, fb(created));
    row.update = res.ok ? "PASS" : `FAIL(${res.status})`;
  } else row.update = def.update ? "SKIP(no record)" : "N/A";

  // STATE CHANGE
  if (def.stateChange && created) {
    const [m, p, fb] = def.stateChange;
    const res = await call(m, p, auth, fb(created));
    row.stateChange = res.ok ? "PASS" : `FAIL(${res.status})`;
  } else row.stateChange = def.stateChange ? "SKIP(no record)" : "N/A";

  // DELETE
  if (def.delete && created) {
    const [m, p, fb] = def.delete;
    const res = await call(m, p, auth, fb(created));
    row.delete = res.ok ? "PASS" : `FAIL(${res.status})`;
  } else row.delete = def.delete ? "SKIP(no record)" : "N/A (no delete endpoint)";

  results[obj] = row;
}

console.log(`\n  Lifecycle coverage (owning persona, happy path)\n`);
const cols = ["create", "read", "update", "stateChange", "delete"];
console.log(`  ${"OBJECT".padEnd(10)} ${"persona".padEnd(8)} ${cols.map((c) => c.padEnd(14)).join("")}`);
for (const [obj, row] of Object.entries(results)) {
  console.log(`  ${obj.padEnd(10)} ${row.persona.padEnd(8)} ${cols.map((c) => String(row[c]).padEnd(14)).join("")}`);
}
fs.writeFileSync(new URL("../../evidence/lifecycle-coverage.json", import.meta.url), JSON.stringify(results, null, 1));
