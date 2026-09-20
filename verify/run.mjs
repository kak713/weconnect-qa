#!/usr/bin/env node
/**
 * Re-checks findings against a running system or a source checkout, and reports which are fixed.
 *
 *   node run.mjs                              the safe checks: read-only HTTP and source reading
 *   node run.mjs --only WC-121,WC-088         just these findings
 *   node run.mjs --source /path/to/apps       point the source checks at a bench apps directory
 *   node run.mjs --api https://... --app https://...
 *
 * Nothing here writes. The write-based probes are listed at the end and are run separately,
 * against a disposable instance only.
 */
import { liveReadonly, source, isolatedWrite } from "./checks.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

const api = arg("--api", process.env.BACKEND_URL?.replace(/\/api\/method\/?$/, "") || "https://api-dev.lighthouseconnect.org");
const app = arg("--app", process.env.BASE_URL || "https://uat.lighthouseconnect.org");
const appsRoot = arg("--source", process.env.APPS_ROOT || "");
const only = (arg("--only", "") || "").split(",").filter(Boolean);

const want = (c) => !only.length || only.includes(c.id);
const pad = (s, n) => String(s).padEnd(n);

let pass = 0, fail = 0, skip = 0;
const line = (mark, id, title, detail) => console.log(`  ${mark} ${pad(id, 8)} ${pad(title.slice(0, 52), 54)} ${detail}`);

console.log(`\n  Read-only checks against ${api}`);
for (const c of liveReadonly.filter(want)) {
  try {
    const { fixed, detail } = await c.run({ api, app });
    if (fixed === null) { skip++; line("?", c.id, c.title, detail); }
    else if (fixed) { pass++; line("FIXED  ", c.id, c.title, detail); }
    else { fail++; line("present", c.id, c.title, detail); }
  } catch (e) { skip++; line("?", c.id, c.title, `could not run: ${e.message.slice(0, 60)}`); }
}

console.log(`\n  Source checks${appsRoot ? ` against ${appsRoot}` : " — skipped, pass --source <bench>/apps"}`);
for (const c of source.filter(want)) {
  if (!appsRoot) { skip++; continue; }
  try {
    const { fixed, detail } = await c.run({ appsRoot });
    if (fixed) { pass++; line("FIXED  ", c.id, c.title, detail); }
    else { fail++; line("present", c.id, c.title, detail); }
  } catch (e) { skip++; line("ERROR  ", c.id, c.title, e.message.slice(0, 80)); }
}

console.log(`\n  Write-based — disposable instance only, run these yourself:`);
for (const c of isolatedWrite.filter(want)) console.log(`    ${pad(c.id, 8)} ${pad(c.title.slice(0, 52), 54)} ${c.external}`);

console.log(`\n  ${pass} fixed · ${fail} still present · ${skip} not run\n`);
process.exit(fail > 0 ? 1 : 0);
