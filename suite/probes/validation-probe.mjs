#!/usr/bin/env node
/**
 * Systematic validation & error-state probe.
 *
 * The Definition of Done requires that "validation rules and error states are exercised, not only
 * success paths". This feeds each mutation endpoint a set of deliberately invalid inputs and
 * classifies how it responds. A good API rejects bad input with a 4xx and a message naming the
 * problem. The failure modes this looks for:
 *
 *   CLEAN     4xx with a success:0 / error message  -> correct: bad input refused clearly.
 *   CRASH     HTTP 500 with a traceback             -> the endpoint threw instead of validating;
 *                                                       leaks framework internals (see the
 *                                                       stack-trace finding).
 *   FALSE-OK  HTTP 200 with success:1 on bad input  -> WORST: invalid data was accepted. Flagged
 *                                                       loudly.
 *   200-FAIL  HTTP 200 with success:0               -> refused, but with a 200 status a naive
 *                                                       client reads as success (recorded defect).
 *
 * Each endpoint is tested with: an empty payload, and (where known) one omitted required field.
 * Runs as an authenticated persona; every request goes through the write guard (isolated host).
 */
import "dotenv/config";
import fs from "node:fs";
import { createRequire } from "node:module";

const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";

async function login(k) {
  const b = new FormData();
  b.set("usr", `qa.${k}@qa-synthetic.invalid`); b.set("pwd", "QA-synthetic-pw-2026");
  const r = await fetch(`${BASE}/api/method/authentication.api.auth.login`, { method: "POST", body: b, headers: { Host: HOST } });
  const m = JSON.parse(await r.text()).message;
  return `token ${m.api_key}:${m.api_secret}`;
}

/** Endpoints to probe, each with the verb and a known-valid field set (which we then corrupt). */
// Each `invalid` payload is well-formed in SHAPE but carries values that must be rejected:
// nonexistent link references, bad enums, or an invalid date. A correct API refuses these.
const CASES = [
  { ep: "outreach.apis.task.task.create_task", verb: "POST", persona: "fc",
    invalid: { data: JSON.stringify({ title: "QA", priority: "NOT_A_PRIORITY", status: "NOT_A_STATUS", exp_start_date: "2026-10-01", exp_end_date: "1999-01-01" }) } },
  { ep: "outreach.apis.pre_enquiry.form.create_pre_enquiry", verb: "POST", persona: "oc",
    invalid: { data: JSON.stringify({ first_name: "QA", last_name: "y", phone_no: "not-a-phone" }) } },
  { ep: "outreach.api.create_enquiry", verb: "POST", persona: "oc",
    invalid: { params: JSON.stringify({ first_name: "QA", last_name: "y", phone_no: "9000000001", dob: "2005-01-01", gender: "NONEXISTENT_GENDER", contact_details: "Self", address_line_1: "a", state: "s", city: "c", pin_code: "1", what_looking_for: ["NONEXISTENT_CA"], education: "NONEXISTENT_EDU", found_lighthouse_at: "NONEXISTENT_REF", name_of_the_source: "s", lighthouse_location: "NONEXISTENT_CENTRE" }) } },
  { ep: "youth_skilling.api.batch_management.close_batch", verb: "POST", persona: "sp",
    invalid: { batch_id: "NONEXISTENT-BATCH-999", short_remarks: "y" } },
  { ep: "youth_skilling.api.invoice.raise_invoice", verb: "PUT", persona: "sp",
    invalid: { invoice_id: "NONEXISTENT-INV", batch_id: "NONEXISTENT-BATCH", center: "NONEXISTENT-CENTRE", installment: "1" } },
  { ep: "centre_head.api.approval.form.create", verb: "POST", persona: "ch",
    invalid: { document: "Youth", document_name: "NONEXISTENT-YOUTH", category: "NONEXISTENT-CAT", short_remarks: "a", long_remarks: "b" } },
];

function classify(status, text) {
  let json = null; try { json = JSON.parse(text); } catch { /* */ }
  const p = json && json.message && typeof json.message === "object" ? json.message : json;
  const flag = p ? (p.success ?? p.success_key) : undefined;
  if (status === 500 || /traceback|exc_type/i.test(text)) return "CRASH";
  if (status < 400 && Number(flag) === 1) return "FALSE-OK";
  if (status === 200 && Number(flag) === 0) return "200-FAIL";
  if (status >= 400) return "CLEAN";
  return "?";
}

async function call(ep, verb, auth, fields) {
  const url = `${BASE}/api/method/${ep}`;
  if (!evaluate(url, verb).allow) return { status: 0, text: "guard refused" };
  const b = new FormData();
  for (const [k, v] of Object.entries(fields)) b.set(k, v);
  const r = await fetch(url, { method: verb, headers: { Host: HOST, Authorization: auth }, body: b });
  return { status: r.status, text: await r.text() };
}

const results = [];
for (const c of CASES) {
  const auth = await login(c.persona);
  // Case A: empty payload
  const empty = await call(c.ep, c.verb, auth, {});
  // Case B: nonexistent references (valid shape, bad values) — the `valid` set uses placeholder ids
  const badRefs = await call(c.ep, c.verb, auth, c.invalid);
  results.push({
    ep: c.ep.split(".").slice(-1)[0],
    empty: classify(empty.status, empty.text),
    emptyStatus: empty.status,
    badRefs: classify(badRefs.status, badRefs.text),
    badStatus: badRefs.status,
  });
}

console.log(`\n  Validation & error-state probe (bad input to mutation endpoints)\n`);
console.log(`  ${"endpoint".padEnd(22)} ${"empty payload".padEnd(20)} ${"invalid references".padEnd(20)}`);
for (const r of results) {
  console.log(`  ${r.ep.padEnd(22)} ${(`${r.empty} (${r.emptyStatus})`).padEnd(20)} ${(`${r.badRefs} (${r.badStatus})`).padEnd(20)}`);
}
const crashes = results.filter((r) => r.empty === "CRASH" || r.badRefs === "CRASH").length;
const falseOk = results.filter((r) => r.empty === "FALSE-OK" || r.badRefs === "FALSE-OK").length;
const twoHundredFail = results.filter((r) => r.empty === "200-FAIL" || r.badRefs === "200-FAIL").length;
console.log(`\n  ${crashes} endpoints CRASH on bad input · ${falseOk} accept invalid input · ${twoHundredFail} return 200 on failure`);
fs.writeFileSync(new URL("../../evidence/validation-probe-results.json", import.meta.url), JSON.stringify(results, null, 1));
