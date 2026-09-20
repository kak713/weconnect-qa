// Shared configuration for the probes. Reads the environment and the fixtures manifest that the
// seeder writes, so no record id is hardcoded.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
export const HOST = process.env.TEST_SITE || "qa.localhost";
export const PWD = process.env.TEST_PERSONA_PWD || "QA-synthetic-pw-2026";

/** The fixtures manifest written by fixtures/seed_transactional.py. */
export function fixtures() {
  const p = path.join(here, "..", "fixtures.json");
  if (!fs.existsSync(p)) {
    throw new Error("fixtures.json not found — run `npm run seed` first.");
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Log a persona in, once.
 *
 * The platform regenerates `api_secret` on every login and invalidates the previous one, so
 * logging the same account in repeatedly races against itself: the save behind the regeneration
 * fails with `TimestampMismatchError`, and a credential handed back by a superseded login is
 * rejected with 401 when used. Both were observed against a freshly built instance.
 *
 * Sessions are therefore cached per persona for the life of the process, and a failed attempt is
 * retried with backoff. This is a workaround for the platform's behaviour, not a fix for it — the
 * behaviour itself is recorded in the findings register.
 */
const sessions = new Map();

export async function login(key, { retries = 3 } = {}) {
  if (sessions.has(key)) return sessions.get(key);

  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const b = new FormData();
      b.set("usr", `qa.${key}@qa-synthetic.invalid`);
      b.set("pwd", PWD);
      const r = await fetch(`${BASE}/api/method/authentication.api.auth.login`,
        { method: "POST", body: b, headers: { Host: HOST } });
      const m = JSON.parse(await r.text()).message;
      if (!m?.api_key || !m?.api_secret) {
        lastErr = new Error(`login for ${key} returned no credential: ${JSON.stringify(m).slice(0, 160)}`);
        continue;
      }
      const session = { auth: `token ${m.api_key}:${m.api_secret}`, centres: m.permitted_centres ?? [], key };
      sessions.set(key, session);
      return session;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`login failed for ${key}`);
}
