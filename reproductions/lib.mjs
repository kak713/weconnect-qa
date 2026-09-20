// Shared helpers for the S1 reproductions.
//
// Deliberately dependency-free: these scripts must run against a remediated build with nothing
// installed but Node. Configuration comes from the environment, with defaults matching the
// isolated stack in environment/compose.yaml:
//
//   TEST_BASE_URL     default http://127.0.0.1:8080
//   TEST_SITE         default qa.localhost
//   TEST_PERSONA_PWD  default QA-synthetic-pw-2026

export const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
export const HOST = process.env.TEST_SITE || "qa.localhost";
const PWD = process.env.TEST_PERSONA_PWD || "QA-synthetic-pw-2026";

export async function login(key) {
  const b = new FormData();
  b.set("usr", `qa.${key}@qa-synthetic.invalid`);
  b.set("pwd", PWD);
  const r = await fetch(`${BASE}/api/method/authentication.api.auth.login`, { method: "POST", body: b, headers: { Host: HOST } });
  const m = JSON.parse(await r.text()).message;
  if (!m.api_secret) throw new Error(`login failed for ${key}`);
  return { auth: `token ${m.api_key}:${m.api_secret}`, centres: m.permitted_centres ?? [] };
}

export async function callMethod(endpoint, method, auth, fields) {
  const b = new FormData();
  for (const [k, v] of Object.entries(fields)) b.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const r = await fetch(`${BASE}/api/method/${endpoint}`, { method, headers: { Host: HOST, Authorization: auth }, body: b });
  const text = await r.text();
  let succeeded = false;
  try {
    const j = JSON.parse(text);
    const p = j.message && typeof j.message === "object" ? j.message : j;
    succeeded = Number(p.success ?? p.success_key) === 1;
  } catch { /* */ }
  return { status: r.status, text, succeeded };
}

export function report(name, breached, detail) {
  const line = breached ? "BREACH — the boundary did NOT hold" : "HELD — the boundary held";
  console.log(`\n  ${name}\n  ${line}\n  ${detail}\n`);
  process.exit(breached ? 1 : 0);
}
