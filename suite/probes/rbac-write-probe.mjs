#!/usr/bin/env node
/**
 * Probe write-side permission boundaries between personas on the isolated instance.
 *
 * Phase 1 established that an account can READ counselling records for centres it has no
 * permission over. It could not ask the more serious question — whether that account can EDIT or
 * DELETE them — because Phase 1 blocked every write. This asks it.
 *
 * THE DESIGN POINT, and the reason this is not just "call it and see it fail":
 *
 *     A refusal only demonstrates a boundary if the SAME call succeeds for the owner.
 *
 * An endpoint that is simply broken refuses everyone, and reads as a perfect access control. Every
 * probe therefore carries two controls:
 *
 *     OWNER CONTROL      the owning persona performs the action -> must SUCCEED.
 *                        If it fails, the probe is INCONCLUSIVE, not passing.
 *     INTRUDER CONTROL   the intruding persona performs the action on its OWN record
 *                        -> must SUCCEED. If it fails, the intruder simply cannot act at all and
 *                        a refusal on the owner's record proves nothing.
 *
 * Only when both controls succeed does a refusal mean the boundary held, or an acceptance mean it
 * was breached.
 *
 * Personas are chosen from FULLY DISJOINT centre pairs, so a successful cross-persona write has no
 * benign reading.
 *
 * Safety: every request is routed through the Phase 2 write guard, which permits mutating requests
 * only to the allowlisted isolated host and refuses the client's platform outright.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { login as sharedLogin } from "./_config.mjs";

const require_ = createRequire(import.meta.url);
const { evaluate } = require_("./write-guard.cjs");

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";
const PASSWORD = process.env.TEST_PERSONA_PWD || "QA-synthetic-pw-2026";
const DOMAIN = "qa-synthetic.invalid";

/** Issue a request, refusing outright anything the write guard does not permit. */
async function call(method, endpoint, { auth, form } = {}) {
  const url = `${BASE}/api/method/${endpoint}`;
  const verdict = evaluate(url, method);
  if (!verdict.allow) throw new Error(`write guard refused: ${verdict.reason}`);
  const headers = { Host: HOST };
  if (auth) headers.Authorization = auth;
  const r = await fetch(url, { method, headers, body: form });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: r.status, text, json };
}

/**
 * Did the call succeed? The platform returns HTTP 200 for rejected writes, and names the flag
 * `success` on some endpoints and `success_key` on others — both recorded as defects. Success is
 * therefore judged on the body, checking both names, never on the status code alone.
 */
function succeeded({ status, json }) {
  if (status >= 400) return false;
  if (!json) return false;
  const payload = json.message && typeof json.message === "object" ? json.message : json;
  const flag = payload.success ?? payload.success_key;
  if (flag !== undefined) return Number(flag) === 1;
  return status === 200;
}

/**
 * Delegates to the shared login, which caches one session per persona. This probe logs every
 * persona in and then walks every disjoint pair, so a per-call login would re-authenticate the
 * same account dozens of times — and the platform regenerates `api_secret` on each login,
 * invalidating the previous one. Caching is what keeps the sweep stable.
 */
async function login(key) {
  return sharedLogin(key);
}

/* ------------------------------------------------------------------ Task */

async function createTask(persona, title) {
  const form = new FormData();
  form.set("data", JSON.stringify({
    title, description: "Phase 2 boundary probe", priority: "Low", status: "Open",
    exp_start_date: "2026-10-01", exp_end_date: "2026-10-31",
  }));
  const res = await call("POST", "outreach.apis.task.task.create_task", { auth: persona.auth, form });
  const name = /TASK-[0-9-]+/.exec(res.json?.message ?? res.text)?.[0] ?? null;
  return { ok: succeeded(res), name, res };
}

async function updateTask(persona, name, subject) {
  // The payload must be COMPLETE. `update_task` reads `data['subject']`, `data['exp_end_date']`
  // and `data['priority']` by direct dict access rather than `.get()`, so omitting any of them
  // raises KeyError and returns a 500 with a traceback rather than a validation message. Recorded
  // as a defect; sending everything here so the probe measures the permission boundary rather
  // than that defect.
  const form = new FormData();
  form.set("name", name);
  // All five keys `update_task` reads by direct subscript: subject, description, assign_to,
  // priority, exp_end_date. Omitting any one raises KeyError.
  form.set("data", JSON.stringify({
    subject, description: "modified by boundary probe", assign_to: "",
    priority: "Low", exp_end_date: "2026-11-30",
  }));
  const res = await call("PUT", "outreach.apis.task.task.update_task", { auth: persona.auth, form });
  return { ok: succeeded(res), res };
}

async function updateTaskStatus(persona, name, status) {
  const form = new FormData();
  form.set("name", name);
  form.set("status", status);
  const res = await call("PUT", "outreach.apis.task.task.update_task_status", { auth: persona.auth, form });
  return { ok: succeeded(res), res };
}

/* --------------------------------------------------------------- reporting */

const results = [];
function record(probe, outcome, detail) {
  results.push({ probe, outcome, detail });
  const mark = { HELD: "HELD    ", BREACHED: "BREACHED", INCONCLUSIVE: "INCONCL." }[outcome];
  console.log(`  ${mark}  ${probe}`);
  if (detail) console.log(`            ${detail}`);
}

/* -------------------------------------------------------------------- run */

/**
 * With no arguments, sweep every fully disjoint persona pair. With two, test just that pair:
 *   node probes/rbac-write-probe.mjs fc sp
 */
const PERSONAS = ["fc", "ch", "sp", "syc", "sm", "oc"];

async function runPair(OWNER, INTRUDER) {
  const owner = await login(OWNER);
    const intruder = await login(INTRUDER);

  const shared = owner.centres.filter((c) => intruder.centres.includes(c));
  console.log(`\n  owner    ${owner.key}: ${owner.centres.join(", ") || "(none)"}`);
  console.log(`  intruder ${intruder.key}: ${intruder.centres.join(", ") || "(none)"}`);
  console.log(`  overlap  ${shared.length ? shared.join(", ") : "NONE — fully disjoint"}\n`);
  if (shared.length) {
    console.log("  REFUSING: these personas share a centre, so a successful cross-write would be");
    console.log("  legitimate and the probe could prove nothing. Choose a disjoint pair.\n");
    return;
  }

  // The owner's record, and the intruder's own record for its control.
  const ownerTask = await createTask(owner, `QA Owner Task ${Date.now()}`);
  const intruderTask = await createTask(intruder, `QA Intruder Task ${Date.now()}`);

  if (!ownerTask.ok || !ownerTask.name) {
    record("setup: owner can create a task", "INCONCLUSIVE",
           `create failed: ${ownerTask.res.text.slice(0, 140)}`);
  } else if (!intruderTask.ok || !intruderTask.name) {
    record("setup: intruder can create a task", "INCONCLUSIVE",
           `create failed: ${intruderTask.res.text.slice(0, 140)}`);
  } else {
    console.log(`  owner task:    ${ownerTask.name}`);
    console.log(`  intruder task: ${intruderTask.name}\n`);

    for (const [label, action] of [
      ["EDIT", (p, n) => updateTask(p, n, `QA edited by ${p.key}`)],
      ["STATUS CHANGE", (p, n) => updateTaskStatus(p, n, "Completed")],
    ]) {
      const ownerControl = await action(owner, ownerTask.name);
      const intruderControl = await action(intruder, intruderTask.name);

      if (!ownerControl.ok) {
        record(`${label}: ${intruder.key} on ${owner.key}'s task`, "INCONCLUSIVE",
               `owner control failed — the endpoint refuses its own owner, so a refusal proves nothing. ${ownerControl.res.text.slice(0, 120)}`);
        continue;
      }
      if (!intruderControl.ok) {
        record(`${label}: ${intruder.key} on ${owner.key}'s task`, "INCONCLUSIVE",
               `intruder control failed — ${intruder.key} cannot perform this action even on its own record. ${intruderControl.res.text.slice(0, 120)}`);
        continue;
      }

      const attempt = await action(intruder, ownerTask.name);
      record(
        `${label}: ${intruder.key} on ${owner.key}'s task`,
        attempt.ok ? "BREACHED" : "HELD",
        attempt.ok
          ? `${intruder.key} (${intruder.centres.join("/")}) modified a record owned by ${owner.key} (${owner.centres.join("/")})`
          : `refused: ${(attempt.res.json?.message ?? attempt.res.text).toString().slice(0, 110)}`,
      );
    }
  }

}

const argPair = process.argv.slice(2, 4);
if (argPair.length === 2) {
  await runPair(argPair[0], argPair[1]);
} else {
  const scopes = {};
  for (const k of PERSONAS) scopes[k] = (await login(k)).centres;
  const seen = new Set();
  for (const a of PERSONAS) for (const b of PERSONAS) {
    if (a === b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    if (scopes[a].some((c) => scopes[b].includes(c))) continue; // overlapping — proves nothing
    seen.add(key);
    await runPair(a, b);
  }
}

const breached = results.filter((r) => r.outcome === "BREACHED").length;
const inconclusive = results.filter((r) => r.outcome === "INCONCLUSIVE").length;
const held = results.filter((r) => r.outcome === "HELD").length;
console.log(`\n  ${held} held, ${breached} breached, ${inconclusive} inconclusive` +
            `  (${held + breached + inconclusive} checks across disjoint persona pairs)`);
process.exit(breached ? 1 : 0);
