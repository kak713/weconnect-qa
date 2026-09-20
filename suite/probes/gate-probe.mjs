#!/usr/bin/env node
/**
 * Probe the authorization gate of each "truly bypassed" mutating endpoint.
 *
 * These endpoints were identified by source analysis as passing `ignore_permissions=True` to their
 * mutating call and performing no `has_permission` or centre check. This asks, at runtime, a single
 * question of each: **when an ordinary authenticated persona calls it, does an authorization gate
 * reject the call before it acts?**
 *
 * The call is made with EMPTY or nonexistent identifiers, so nothing real is mutated. The response
 * is classified by what it reveals about the gate:
 *
 *   GATE       403, PermissionError, or an explicit "insufficient permission" message
 *              -> authorization is enforced. The endpoint is safe on this axis.
 *   NO GATE    a validation error ("field required"), "not found", or a server error
 *              -> the call passed authorization and failed later, on data. No gate stood between
 *                 an arbitrary caller and the endpoint's logic.
 *   EXECUTED   HTTP 200 with success -> the endpoint ran to completion. Flagged loudly; the run
 *              stops and reports it for manual review (should not happen with empty input, but if
 *              it does it is the most serious outcome).
 *
 * NO GATE is not by itself proof of a remotely exploitable hole — the endpoint may be gated
 * downstream by a workflow or by data that a real attacker could not supply. It IS proof that the
 * authorization check the platform's safe endpoints perform is absent here, which is the finding.
 *
 * Every request goes through the Phase 2 write guard (isolated host only).
 */
import "dotenv/config";
import fs from "node:fs";
import { createRequire } from "node:module";

const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";

import { fileURLToPath } from "node:url"; import path from "node:path";
const _here = path.dirname(fileURLToPath(import.meta.url));
const targets = JSON.parse(fs.readFileSync(path.join(_here, "endpoint-targets.json"), "utf8"));

async function login(key) {
  const b = new FormData();
  b.set("usr", `qa.${key}@qa-synthetic.invalid`);
  b.set("pwd", "QA-synthetic-pw-2026");
  const r = await fetch(`${BASE}/api/method/authentication.api.auth.login`, { method: "POST", body: b, headers: { Host: HOST } });
  const m = JSON.parse(await r.text()).message;
  return `token ${m.api_key}:${m.api_secret}`;
}

function classify(status, text) {
  const t = text.toLowerCase();
  if (/permissionerror|insufficient permission|not permitted|not allowed to/.test(t)) return "GATE";
  if (status === 403) return "GATE";
  // a JSON success flag of 1 means it executed
  try {
    const j = JSON.parse(text);
    const p = j.message && typeof j.message === "object" ? j.message : j;
    if (Number(p.success ?? p.success_key) === 1) return "EXECUTED";
  } catch { /* not json */ }
  return "NO GATE"; // validation error, not-found, or server error: it ran past authz
}

const auth = await login("sp"); // an ordinary in-scope persona, not System Manager-only
const results = [];

for (const t of targets) {
  const method = t.methods.includes("PUT") ? "PUT" : "POST";
  const url = `${BASE}/api/method/${t.path}`;
  const v = evaluate(url, method);
  if (!v.allow) { results.push({ ...t, outcome: "GUARD-REFUSED" }); continue; }
  // Empty-ish body: nonexistent identifiers only, so nothing real can be touched.
  const b = new FormData();
  b.set("name", "QA-NONEXISTENT-000");
  b.set("id", "QA-NONEXISTENT-000");
  b.set("url", "/private/files/qa-nonexistent.txt");
  let status = 0, text = "";
  try {
    const r = await fetch(url, { method, headers: { Host: HOST, Authorization: auth }, body: b });
    status = r.status; text = await r.text();
  } catch (e) { text = String(e); }
  const outcome = classify(status, text);
  results.push({ ...t, status, outcome, snippet: text.slice(0, 90).replace(/\s+/g, " ") });
  await new Promise((x) => setTimeout(x, 250));
}

const by = { GATE: [], "NO GATE": [], EXECUTED: [], "GUARD-REFUSED": [] };
for (const r of results) (by[r.outcome] ||= []).push(r);

console.log(`\n  Probed ${results.length} endpoints as persona 'sp' (in-scope, not admin)\n`);
for (const label of ["EXECUTED", "NO GATE", "GATE", "GUARD-REFUSED"]) {
  const rows = by[label] || [];
  if (!rows.length) continue;
  console.log(`  ── ${label} (${rows.length}) ──`);
  for (const r of rows) console.log(`     ${String(r.status).padStart(3)} ${r.path.split(".").slice(-2).join(".")}`);
  console.log();
}
const gate = (by.GATE || []).length, nogate = (by["NO GATE"] || []).length, exec = (by.EXECUTED || []).length;
console.log(`  ${gate} gated, ${nogate} NO gate, ${exec} executed`);
fs.writeFileSync(new URL("../../evidence/gate-probe-results.json", import.meta.url), JSON.stringify(results, null, 1));
