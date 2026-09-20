// @ts-check
/**
 * Phase 2 write guard — the inverse of the Phase 1 read-only guard, and the control that makes
 * transactional testing safe.
 *
 * Phase 1 was safe because it refused every mutating request. Phase 2 must permit them, so the
 * guarantee has to come from somewhere else:
 *
 *   Mutating requests are permitted ONLY to an explicitly allowlisted isolated test host.
 *   Every other host is refused, including the production platform.
 *
 * Three properties, each deliberate:
 *
 *   DEFAULT-DENY      an unrecognised host is refused. A mistyped or unset TEST_HOST fails closed.
 *   NO PER-TEST OVERRIDE  there is no flag a test can set to write elsewhere. Changing the target
 *                     is a configuration change, not something done while debugging.
 *   VERIFIED          proven by control in the self-verification suite — a write aimed at the
 *                     production host must be refused — and those controls run before every
 *                     execution, as they do for the Phase 1 guard.
 *
 * The production hosts are named explicitly rather than inferred, so that a write aimed at them is
 * not merely unrecognised but recognised-and-refused, and can be reported as an attempt.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Hosts that must never receive a mutating request from this suite, under any configuration. */
const FORBIDDEN_HOSTS = [
  "uat.lighthouseconnect.org",
  "api-dev.lighthouseconnect.org",
  "lighthouseconnect.org",
];

/** @returns {string|null} the configured isolated test host, or null when none is set. */
function testHost() {
  const h = (process.env.TEST_HOST || "").trim();
  return h.length ? h.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
}

/**
 * Decide whether a request may proceed.
 * @returns {{allow: boolean, reason: string}}
 */
function evaluate(url, method, host = testHost()) {
  const m = String(method).toUpperCase();
  if (!MUTATING.has(m)) return { allow: true, reason: "non-mutating" };

  const forbidden = FORBIDDEN_HOSTS.find((h) => url.includes(h));
  if (forbidden) {
    return { allow: false, reason: `REFUSED: mutating ${m} aimed at production host ${forbidden}` };
  }
  if (!host) {
    return { allow: false, reason: `REFUSED: mutating ${m} with no TEST_HOST configured (default-deny)` };
  }
  // The allow decision parses the URL rather than substring-matching it. A substring check would
  // permit `https://elsewhere.example/?ref=localhost:8080`, which contains the allowlisted host
  // without being it. Deny paths may fail closed on a substring; the allow path may not.
  let actual;
  try {
    actual = new URL(url).host;
  } catch {
    return { allow: false, reason: `REFUSED: mutating ${m} to an unparseable URL (default-deny)` };
  }
  if (actual !== host) {
    return { allow: false, reason: `REFUSED: mutating ${m} to host ${actual}, outside the allowlist (expected ${host})` };
  }
  return { allow: true, reason: `permitted: mutating ${m} to isolated host ${host}` };
}

module.exports = { evaluate, testHost, FORBIDDEN_HOSTS, MUTATING };
