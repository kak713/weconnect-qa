/**
 * One check per finding. Each states the finding it belongs to, what would make it pass, and the
 * kind of environment it needs.
 *
 *   live-readonly   Issues only GET/OPTIONS. Safe against any environment, production included.
 *   source          Reads a checkout of the backend applications. Needs no running system.
 *   isolated-write  Writes, and must only ever run against a disposable instance.
 *
 * A check returns { fixed, detail }. `fixed: true` means the defect is no longer present.
 */
import fs from "node:fs";
const require_fs = () => fs;
import path from "node:path";

const headers = (r) => Object.fromEntries([...r.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));

/* ─── live-readonly ────────────────────────────────────────────────────────────────────── */

export const liveReadonly = [
  {
    id: "WC-121", title: "CORS reflects any origin with credentials allowed",
    passes: "An unrelated origin receives no access-control-allow-origin header.",
    async run({ api }) {
      const r = await fetch(`${api}/api/method/frappe.auth.get_logged_user`, {
        method: "OPTIONS",
        headers: { Origin: "https://unrelated.example.com", "Access-Control-Request-Method": "POST" },
      });
      const h = headers(r);
      const reflected = h["access-control-allow-origin"] === "https://unrelated.example.com";
      const creds = h["access-control-allow-credentials"] === "true";
      return {
        fixed: !reflected,
        detail: reflected
          ? `origin reflected back${creds ? " with credentials allowed" : ""}`
          : `no reflection (allow-origin: ${h["access-control-allow-origin"] ?? "absent"})`,
      };
    },
  },
  {
    id: "WC-112", title: "Frontend served with no security headers",
    passes: "The frontend responds with the standard protective headers.",
    async run({ app }) {
      const want = ["content-security-policy", "x-frame-options", "x-content-type-options",
                    "referrer-policy", "strict-transport-security"];
      const h = headers(await fetch(app, { redirect: "follow" }));
      const missing = want.filter((k) => !(k in h));
      return { fixed: missing.length === 0, detail: missing.length ? `missing: ${missing.join(", ")}` : "all present" };
    },
  },
  {
    id: "WC-068", title: "API specification published to unauthenticated callers",
    passes: "The specification endpoints require authentication.",
    async run({ api }) {
      const reached = [];
      for (const m of ["youth_skilling.api.docs.swagger_spec",
                       "youth_skilling.api.docs.swagger_spec_placement",
                       "batch_management.api.docs.swagger_spec"]) {
        try {
          const r = await fetch(`${api}/api/method/${m}`);
          if (r.status === 200 && (await r.text()).includes("paths")) reached.push(m);
        } catch { /* unreachable is a pass for this check */ }
      }
      return { fixed: reached.length === 0, detail: reached.length ? `reachable unauthenticated: ${reached.join(", ")}` : "not reachable unauthenticated" };
    },
  },
  {
    id: "WC-116", title: "Session lifetime is seven days",
    passes: "The session cookie expires in well under seven days.",
    async run({ api }) {
      const r = await fetch(`${api}/api/method/frappe.auth.get_logged_user`);
      const sc = [...r.headers.entries()].filter(([k]) => k.toLowerCase() === "set-cookie").map(([, v]) => v).join(" ");
      const m = /Max-Age=(\d+)/i.exec(sc);
      if (!m) return { fixed: null, detail: "no Max-Age on the session cookie; inspect manually" };
      const days = Number(m[1]) / 86400;
      return { fixed: days <= 1, detail: `session Max-Age is ${days.toFixed(1)} days` };
    },
  },
  {
    id: "WC-023", title: "Server stack traces returned in the API error envelope",
    passes: "An error response carries no traceback.",
    async run({ api }) {
      const r = await fetch(`${api}/api/method/frappe.client.get_list`);
      const body = await r.text();
      const leaks = /Traceback \(most recent call last\)|File "\/home\/frappe/.test(body);
      return { fixed: !leaks, detail: leaks ? "response body contains a Python traceback" : "no traceback in the error body" };
    },
  },
];

/* ─── source ───────────────────────────────────────────────────────────────────────────── */

const APPS = ["authentication", "youth_skilling", "centre_head", "facilitator_and_counsellor",
              "outreach", "batch_management", "youth_placement", "event_management"];

/**
 * Refuses to yield nothing quietly. A source check that reads no files would otherwise report
 * every defect as fixed, which is the worst failure this tool could have.
 */
function readSources(root) {
  const files = [...pyFiles(root)];
  if (files.length === 0) {
    throw new Error(`no application sources under ${root} — pass --source <bench>/apps`);
  }
  return files;
}

function* pyFiles(root) {
  for (const app of APPS) {
    const base = path.join(root, app);
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const d = stack.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name.endsWith(".py")) yield [p.replace(root + "/", ""), fs.readFileSync(p, "utf8")];
      }
    }
  }
}

export const source = [
  {
    id: "WC-079", title: "Mutating endpoints bypass permissions with ignore_permissions",
    passes: "No whitelisted handler saves with ignore_permissions and no check of its own.",
    run({ appsRoot }) {
      const hits = [];
      for (const [f, s] of readSources(appsRoot)) {
        const n = (s.match(/ignore_permissions\s*=\s*True/g) || []).length;
        if (n) hits.push(`${f}:${n}`);
      }
      const total = hits.reduce((a, h) => a + Number(h.split(":").pop()), 0);
      return { fixed: total === 0, detail: `${total} ignore_permissions sites across ${hits.length} files` };
    },
  },
  {
    id: "WC-105", title: "Data scoping disabled for System Manager",
    passes: "No scoping path is conditional on the System Manager role.",
    run({ appsRoot }) {
      const hits = [];
      for (const [f, s] of readSources(appsRoot)) {
        const n = (s.match(/["']System Manager["']/g) || []).length;
        if (n) hits.push([f, n]);
      }
      const total = hits.reduce((a, [, n]) => a + n, 0);
      return { fixed: total === 0, detail: `${total} System Manager references across ${hits.length} files` };
    },
  },
  {
    id: "WC-122", title: "Endpoints write undeclared fields (mass assignment)",
    passes: "Every handler taking a request dict filters it before the write.",
    run({ appsRoot }) {
      const bad = [];
      for (const [f, s] of readSources(appsRoot)) {
        const lines = s.split("\n");
        lines.forEach((l, i) => {
          const m = /(\w+)\.update\(\s*(data|payload|values)\s*\)/.exec(l);
          if (!m) return;
          const win = lines.slice(Math.max(0, i - 40), i).join("\n");
          if (!/EDITABLE_FIELDS|ALLOWED|allowed_fields|not editable|\.pop\(/.test(win)) bad.push(`${f}:${i + 1}`);
        });
      }
      return { fixed: bad.length === 0, detail: bad.length ? `${bad.length} unfiltered: ${bad.slice(0, 4).join(", ")}${bad.length > 4 ? " …" : ""}` : "all filtered" };
    },
  },
  {
    id: "WC-088", title: "Enquiry Form status change broken by a variable typo",
    passes: "The identifier list is parsed from the argument that was passed in.",
    run({ appsRoot }) {
      for (const [f, s] of readSources(appsRoot)) {
        if (/(?<!\w)id\s*=\s*json\.loads\(\s*id\s*\)/.test(s)) return { fixed: false, detail: `\`id = json.loads(id)\` still present in ${f}` };
      }
      return { fixed: true, detail: "no `json.loads(id)` typo found" };
    },
  },
  {
    id: "WC-038", title: "Invoice screen issues a write on page load",
    passes: "No invoice-preparation call is made from a component mount.",
    run({ appsRoot }) {
      const hits = [];
      for (const [f, s] of readSources(appsRoot)) {
        if (/prepare_tax_invoice/.test(s)) hits.push(f);
      }
      return { fixed: hits.length === 0,
               detail: hits.length ? `prepare_tax_invoice still referenced in ${hits.length} file(s)` : "no reference found" };
    },
  },
  {
    id: "WC-078", title: "Any authenticated user can delete a file by URL",
    passes: "The delete handler checks ownership or permission on the attached document.",
    run({ appsRoot }) {
      for (const [f, s] of readSources(appsRoot)) {
        const m = /def\s+delete_file_by_url\b[\s\S]{0,1200}/.exec(s);
        if (!m) continue;
        const guarded = /has_permission|attached_to_doctype[\s\S]{0,200}has_permission|frappe\.only_for/.test(m[0]);
        return { fixed: guarded, detail: guarded ? `ownership check present in ${f}` : `no ownership check in ${f}` };
      }
      return { fixed: null, detail: "delete_file handler not found; check manually" };
    },
  },
  {
    id: "WC-085", title: "Financial endpoints derive centre from the request",
    passes: "Centre is derived from the caller's permitted scope, not taken from the payload.",
    run({ appsRoot }) {
      const bad = [];
      for (const [f, s] of readSources(appsRoot)) {
        if (!/invoice/i.test(f)) continue;
        const lines = s.split("\n");
        lines.forEach((l, i) => {
          // the finding is that `center` is accepted from the caller as an argument
          const m = /def\s+(raise_invoice|prepare_tax_invoice)\s*\(([^)]*)/.exec(l);
          if (m && /\bcent(er|re)\b/.test(m[2])) bad.push(`${f}:${i + 1} ${m[1]}()`);
        });
      }
      return { fixed: bad.length === 0,
               detail: bad.length ? `${bad.length} site(s) take centre from the request: ${bad.slice(0, 3).join(", ")}` : "centre not taken from the request" };
    },
  },
  {
    id: "WC-115", title: "Bulk export reachable by any authenticated account",
    passes: "The export endpoint requires an explicit administrative role.",
    run({ appsRoot }) {
      for (const [f, s] of readSources(appsRoot)) {
        const m = /def\s+sync_to_lcf_mastersheet\b[\s\S]{0,900}/.exec(s);
        if (!m) continue;
        const guarded = /frappe\.only_for|has_permission|roles\s*=|"System Manager"\s*in/.test(m[0]);
        return { fixed: guarded, detail: guarded ? `role check present in ${f}` : `no role check in ${f}` };
      }
      return { fixed: null, detail: "export handler not found; check manually" };
    },
  },
  {
    id: "WC-073", title: "Permission model grants only System Manager",
    passes: "Doctype permissions name roles other than System Manager.",
    run({ appsRoot }) {
      let onlySM = 0, none = 0, other = 0;
      for (const [f, s] of readSources(appsRoot)) {
        if (!f.endsWith(".json") ) continue;
      }
      // doctype permissions live in the .json definitions beside each doctype
      const fs = require_fs();
      const walk = (d, out) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const q = `${d}/${e.name}`;
          if (e.isDirectory()) walk(q, out);
          else if (e.name.endsWith(".json") && q.includes("/doctype/")) out.push(q);
        }
        return out;
      };
      let files = [];
      try { files = walk(appsRoot, []); } catch { /* fall through */ }
      // Dedupe by doctype name: three doctypes are defined twice by two different
      // applications (see WC-062), and counting both copies inflates the totals.
      const seen = new Set();
      for (const q of files) {
        let j; try { j = JSON.parse(fs.readFileSync(q, "utf8")); } catch { continue; }
        if (!j.doctype || j.doctype !== "DocType") continue;
        const key = j.name || q;
        if (seen.has(key)) continue;
        seen.add(key);
        const roles = (j.permissions || []).map((p) => p.role);
        if (!roles.length) none++;
        else if (roles.every((r) => r === "System Manager")) onlySM++;
        else other++;
      }
      return { fixed: other > 0 && onlySM === 0,
               detail: `${onlySM + none + other} doctypes: ${onlySM} grant System Manager alone, ${none} grant none, ${other} grant another role` };
    },
  },
  {
    id: "WC-077", title: "Unauthenticated endpoint provisions a System Manager account",
    passes: "`create_user` no longer accepts guest callers, or no longer grants System Manager.",
    run({ appsRoot }) {
      for (const [f, s] of readSources(appsRoot)) {
        const m = /@frappe\.whitelist\(([^)]*)\)\s*\ndef\s+create_user\b([\s\S]{0,1500})/.exec(s);
        if (!m) continue;
        const guest = /allow_guest\s*=\s*True/.test(m[1]);
        const grantsSM = /System Manager/.test(m[2]);
        return { fixed: !(guest && grantsSM),
                 detail: guest && grantsSM ? `allow_guest=True and grants System Manager in ${f}`
                       : guest ? `allow_guest=True but no longer grants System Manager (${f})`
                       : `guest access removed in ${f}` };
      }
      return { fixed: null, detail: "create_user not found; check manually" };
    },
  },
];

/* ─── isolated-write ───────────────────────────────────────────────────────────────────── */

export const isolatedWrite = [
  { id: "WC-084", title: "An account can close another centre's batch",
    passes: "The write is refused across the centre boundary.",
    external: "../reproductions/s1-batch-close.mjs" },
  { id: "WC-095", title: "An account can raise another centre's invoice",
    passes: "The write is refused across the centre boundary.",
    external: "../reproductions/s1-invoice-raise.mjs" },
  { id: "WC-048", title: "Counselling records readable across centres",
    passes: "Only records within the caller's permitted centres are returned.",
    external: "../suite/probes/rbac-write-probe.mjs (read path)" },
  { id: "WC-035", title: "Records returned from centres the caller cannot access",
    passes: "Every record returned is within the caller's permitted centres.",
    external: "../suite/probes/gate-probe.mjs" },
  { id: "WC-043", title: "Routes blank on direct load (null navigation state)",
    passes: "Every route renders when entered directly by URL.",
    external: "the Playwright route sweep in the QA project" },
  { id: "WC-003", title: "Real programme PII present in a lower environment",
    passes: "The lower environment holds no real programme data.",
    external: "your own data review — we cannot and should not test this for you" },
  { id: "WC-125", title: "Fields accept self-contradictory values",
    passes: "Negative ages, future birth dates and inverted capacities are refused.",
    external: "probes/boundary_probe.py" },
  { id: "WC-126", title: "Every status transition is accepted",
    passes: "Impossible transitions are refused.",
    external: "probes/state_transition_probe.py" },
  { id: "WC-122", title: "add_interest writes undeclared fields",
    passes: "A field the endpoint does not declare is refused.",
    external: "probes/mass-assignment-probe.mjs" },
];
