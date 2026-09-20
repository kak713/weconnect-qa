/**
 * Mass-assignment probe (OWASP API3 — Broken Object Property Level Authorization).
 *
 * Source analysis found 28 whitelisted endpoints that pass a caller-supplied dict into a document
 * write. This probe confirms, against the isolated stack and synthetic fixtures only, whether the
 * two that have no field allowlist actually let a caller set fields the endpoint never advertises.
 *
 * Writes here are destructive by design and are the reason this probe is restricted to the
 * disposable environment. It must never be pointed at a live site.
 */
import { BASE, HOST, fixtures, login } from "./_config.mjs";

const fx = fixtures();
const BACKEND = process.env.TEST_BACKEND_CONTAINER || "weconnect-qa-backend-1";

async function call(session, method, body) {
  const r = await fetch(`${BASE}/api/method/${method}`, {
    method: "PUT",
    headers: { Host: HOST, Authorization: session.auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let j = null;
  const t = await r.text();
  try { j = JSON.parse(t); } catch { /* non-JSON body */ }
  return { status: r.status, body: j ?? t.slice(0, 200) };
}

/** Ground truth straight from the database, not from an API read that may itself be scoped. */
async function dbField(doctype, name, field) {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync("docker", [
    "exec", "-w", "/home/frappe/frappe-bench/sites", BACKEND,
    "/home/frappe/frappe-bench/env/bin/python", "/tmp/getfield.py", HOST, doctype, name, field,
  ], { encoding: "utf8" });
  return out.trim().split("\n").pop().trim();
}

const results = [];

// ── 1. add_interest: Youth.update(data) then save(ignore_permissions=True) ──────────
{
  const youth = fx.north_youth;
  // `first_name` is writable, permlevel 0, and is NOT one of the fields the endpoint declares.
  const before = await dbField("Youth", youth, "first_name");
  const sent = "MASSASSIGN-PROBE";

  const fc = await login("fc");
  const res = await call(fc, "batch_management.api.fc.youth_interest.add_interest", {
    youth,
    data: {
      // the five fields the endpoint documents as required, with values it will accept
      interested_course: "QA-Course Master-Charlie-0002",
      interested_job_role: "QA-Job Role-Charlie-0002",
      int_entre: 0, higher_education_plans: "No", add_notes: "QA mass-assignment probe",
      // a field it never declares
      first_name: sent,
    },
  });
  const after = await dbField("Youth", youth, "first_name");
  const ok = res.body?.message?.success_key ?? res.body?.success_key;
  results.push({
    endpoint: "add_interest", doctype: "Youth", field: "first_name",
    http: `${res.status}/key=${ok}`, before, sent, after,
    accepted: after === sent && before !== sent,
  });
}

// ── 2. update_profile: User.update(data), permission checked but not returned on ─────────────
{
  const oc = await login("oc");
  const uid = "qa.oc@qa-synthetic.invalid";
  const before = await dbField("User", uid, "user_type");
  const sent = before === "System User" ? "Website User" : "System User";

  const res = await call(oc, "outreach.apis.profile.form.update_profile", {
    user_id: uid,
    data: { first_name: "QA", user_type: sent },
  });
  const after = await dbField("User", uid, "user_type");
  results.push({
    endpoint: "update_profile (self)", doctype: "User", field: "user_type",
    http: res.status, before, sent, after, accepted: after === sent && before !== sent,
  });

  // the same call aimed at a different persona's account, to test the missing `return`
  const other = "qa.fc@qa-synthetic.invalid";
  const oBefore = await dbField("User", other, "first_name");
  const oRes = await call(oc, "outreach.apis.profile.form.update_profile", {
    user_id: other, data: { first_name: "QA-CROSS-PERSONA-PROBE" },
  });
  const oAfter = await dbField("User", other, "first_name");
  results.push({
    endpoint: "update_profile (another user)", doctype: "User", field: "first_name",
    http: oRes.status, before: oBefore, sent: "QA-CROSS-PERSONA-PROBE", after: oAfter,
    accepted: oAfter === "QA-CROSS-PERSONA-PROBE" && oBefore !== "QA-CROSS-PERSONA-PROBE",
  });
}

for (const r of results) {
  console.log(
    `  ${r.accepted ? "ACCEPTED " : "rejected "} ${r.endpoint.padEnd(30)} ` +
    `${r.doctype}.${r.field.padEnd(18)} HTTP ${r.http}  ${JSON.stringify(r.before)} -> ${JSON.stringify(r.after)}`,
  );
}
const n = results.filter((r) => r.accepted).length;
console.log(`\n  ${n} of ${results.length} undeclared writes accepted`);
