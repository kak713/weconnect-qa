#!/usr/bin/env node
/**
 * Compare the isolated test environment against the client's platform, application by
 * application and version by version.
 *
 * A test environment that differs from the platform produces results that do not transfer: a
 * defect found here may not exist there, and vice versa. Neither failure is visible from the test
 * results themselves, which is what makes divergence dangerous rather than untidy. This script
 * makes the comparison explicit and repeatable rather than a claim made once.
 *
 * Reads only version metadata from both sides. No records are touched.
 *
 * Usage: node utils/compare-environments.mjs
 */
import "dotenv/config";

const PROD = process.env.BACKEND_URL.replace(/\/api\/method$/, "");
const LOCAL = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const LOCAL_HOST_HEADER = process.env.TEST_SITE || "qa.localhost";

/** Applications we cannot obtain, and therefore expect to be absent locally. */
const UNOBTAINABLE = new Set(["fintoo_analytics_bridge"]);

async function versionsFrom(base, headers) {
  const r = await fetch(`${base}/api/method/frappe.utils.change_log.get_versions`, { headers });
  if (!r.ok) throw new Error(`${base} -> HTTP ${r.status}`);
  const m = JSON.parse(await r.text()).message ?? {};
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.version ?? "?"]));
}

// The isolated instance issues its own credentials; there is nothing to configure and nothing
// to store. Logging in through the platform's own endpoint also re-proves, on every comparison,
// that the endpoint behaves the same way here as it does there.
async function localAuth() {
  const body = new FormData();
  body.set("usr", "Administrator");
  body.set("pwd", process.env.TEST_ADMIN_PWD ?? "qa_admin_local");
  const r = await fetch(`${LOCAL}/api/method/authentication.api.auth.login`, {
    method: "POST", body, headers: { Host: LOCAL_HOST_HEADER },
  });
  if (!r.ok) throw new Error(`local login -> HTTP ${r.status}`);
  const m = JSON.parse(await r.text()).message ?? {};
  // Prefer a token pair; fall back to the session id. The login endpoint returns `api_key: null`
  // on a repeat login for an account whose key already exists, so a token pair is not guaranteed.
  if (m.api_key && m.api_secret) {
    return { Host: LOCAL_HOST_HEADER, Authorization: `token ${m.api_key}:${m.api_secret}` };
  }
  if (m.sid) return { Host: LOCAL_HOST_HEADER, Cookie: `sid=${m.sid}` };
  throw new Error(`local login returned no usable credential: ${JSON.stringify(m).slice(0, 160)}`);
}

/**
 * The live platform needs one real read-only credential. It is read from the environment and
 * never stored: set LIVE_USER and LIVE_PWD in .env. Only `get_versions` is called, which reads
 * nothing but the installed application list.
 */
async function prodAuth() {
  const usr = process.env.LIVE_USER, pwd = process.env.LIVE_PWD;
  if (!usr || !pwd) {
    throw new Error("LIVE_USER and LIVE_PWD are not set — see suite/.env.example. " +
      "They are needed only to read the live platform's version list.");
  }
  const body = new FormData();
  body.set("usr", usr);
  body.set("pwd", pwd);
  const r = await fetch(`${PROD}/api/method/authentication.api.auth.login`, { method: "POST", body });
  if (!r.ok) throw new Error(`live login -> HTTP ${r.status}`);
  const m = JSON.parse(await r.text()).message ?? {};
  if (m.api_key && m.api_secret) return { Authorization: `token ${m.api_key}:${m.api_secret}` };
  if (m.sid) return { Cookie: `sid=${m.sid}` };
  throw new Error("live login returned no usable credential");
}

const prod = await versionsFrom(PROD, await prodAuth());
const local = await versionsFrom(LOCAL, await localAuth());

const apps = [...new Set([...Object.keys(prod), ...Object.keys(local)])].sort();
const rows = [];
let drift = 0, expected = 0;

for (const app of apps) {
  const p = prod[app], l = local[app];
  let state;
  if (p && l && p === l) state = "match";
  else if (p && l) { state = `VERSION DRIFT (platform ${p}, local ${l})`; drift++; }
  else if (p && !l) {
    if (UNOBTAINABLE.has(app)) { state = "absent locally — unobtainable, documented"; expected++; }
    else { state = "MISSING LOCALLY"; drift++; }
  } else { state = "EXTRA LOCALLY — not on the platform"; drift++; }
  rows.push([app, p ?? "—", l ?? "—", state]);
}

const w = (i) => Math.max(...rows.map((r) => String(r[i]).length));
const [w0, w1, w2] = [w(0), w(1), w(2)];
console.log(`${"application".padEnd(w0)}  ${"platform".padEnd(w1)}  ${"local".padEnd(w2)}  state`);
for (const r of rows) {
  console.log(`${r[0].padEnd(w0)}  ${String(r[1]).padEnd(w1)}  ${String(r[2]).padEnd(w2)}  ${r[3]}`);
}
console.log();
console.log(drift === 0
  ? `NO DRIFT. ${rows.length - expected} applications match; ${expected} documented exception(s).`
  : `${drift} DIVERGENCE(S) — each must be eliminated or documented in the Definition of Done §3a.`);
process.exit(drift === 0 ? 0 : 1);
