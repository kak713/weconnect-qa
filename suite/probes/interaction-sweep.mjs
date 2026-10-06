#!/usr/bin/env node
/**
 * Front-end INTERACTION sweep — extends the route sweep from "does it render" to
 * "does it break when you use it".
 *
 * For every static route of each persona we hold dedicated credentials for (OC, CH, FC —
 * the kak713 accounts the client issued), it loads the screen and exercises its controls:
 * tabs, dropdowns, expandable sections, search/filter inputs, non-destructive buttons, forms
 * (submitted EMPTY, to observe client-side validation), and keyboard focus order.
 *
 * SAFETY — runs against the live UAT, so:
 *   - every mutating request (POST/PUT/PATCH/DELETE) to the backend is aborted in the browser
 *     before it leaves the machine, and recorded (a control that tries to write is itself a finding);
 *   - buttons whose label reads as destructive (delete, approve, raise, close, submit outside a
 *     form, export, sync ...) are never clicked;
 *   - forms are only ever submitted empty, so even the attempt carries no data;
 *   - only the three kak713 accounts are used; the named-person accounts in .env are never touched.
 *
 * Credentials come from the environment (KAK_OC_USER etc.), never from a committed file.
 * Output: data/interaction-findings.json (structured rows) + a console summary.
 *
 * Usage:  KAK_PWD=... node utils/interaction-sweep.mjs [oc ch fc]
 */
import { chromium, request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL || "https://uat.lighthouseconnect.org").replace(/\/$/, "");
const BACKEND_URL = (process.env.BACKEND_URL || "https://api-dev.lighthouseconnect.org/api/method").replace(/\/$/, "");
const BACKEND_HOST = new URL(BACKEND_URL).host;
const APP_HOSTS = [new URL(BASE_URL).host, BACKEND_HOST];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PWD = process.env.KAK_PWD;
const ACCOUNTS = {
  oc: process.env.KAK_OC_USER || "kak713.oc@lighthouseconnect.org",
  ch: process.env.KAK_CH_USER || "kak713.ch@lighthouseconnect.org",
  fc: process.env.KAK_FC_USER || "kak713.fc@lighthouseconnect.org",
};
const DESTRUCTIVE = /\b(delete|remove|close|raise|approve|reject|submit|save|create|add|update|send|confirm|log ?out|sign ?out|discard|archive|mark|assign|transfer|move|upload|import|export|sync|generate|prepare|publish|deactivate|disable|reset|cancel enrol|drop|withdraw|apply|enrol|register|schedule|book|pay|invoice|download)\b/i;
const SETTLE = 2500;

if (!PWD) { console.error("Set KAK_PWD in the environment (not in a file)."); process.exit(2); }
const only = process.argv.slice(2);
const personas = JSON.parse(fs.readFileSync("data/personas.json", "utf8")).personas
  .filter((p) => ACCOUNTS[p.key] && (!only.length || only.includes(p.key)));

const knownBlank = new Set();
try {
  const kd = JSON.parse(fs.readFileSync("data/known-defects.json", "utf8"));
  const walk = (x) => { if (typeof x === "string" && x.startsWith("/")) knownBlank.add(x);
    else if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") Object.values(x).forEach(walk); };
  walk(kd.blankRoutes);
} catch { /* optional */ }

const routeUrl = (prefix, p) => `${BASE_URL}/${prefix}/${p}`.replace(/([^:]\/)\/+/g, "$1");

async function login(api, user) {
  for (let i = 0; i < 4; i++) {
    const res = await api.post(`${BACKEND_URL}/authentication.api.auth.login`, { multipart: { usr: user, pwd: PWD } });
    const m = (await res.json().catch(() => ({}))).message || {};
    if (m.api_key && m.api_secret) return m;
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(`login failed for ${user}`);
}

function seedFor(m, user, p) {
  return {
    api_key: m.api_key, api_secret: m.api_secret, sid: m.sid || "", email: m.email || user,
    full_name: m.full_name || "", employee_id: m.employee_id || "",
    username: m.username == null ? "null" : String(m.username), sp_role: m.sp_role || "NA",
    role: p.prefix, role_path: p.key.toUpperCase(),
    permitted_centres: JSON.stringify(m.permitted_centres || []),
    permitted_courses: JSON.stringify(m.permitted_courses || []),
    "auth-storage": JSON.stringify({ state: { initialData: { api_key: m.api_key, api_secret: m.api_secret,
      email: m.email || user, sid: m.sid || "", username: m.username || "" } }, version: 0 }),
  };
}

const findings = [];
const add = (f) => findings.push(f);

const browser = await chromium.launch();
const api = await request.newContext();

for (const p of personas) {
  const user = ACCOUNTS[p.key];
  const m = await login(api, user);
  add({ persona: p.key, route: "(account)", control: "(login)", kind: "account-provisioning",
        detail: `role_profile=${m.role_profile} permitted_centres=${JSON.stringify(m.permitted_centres || [])}` });
  const ctx = await browser.newContext();
  await ctx.addInitScript((data) => { try { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); } catch {} }, seedFor(m, user, p));

  // read-only guard
  let blocked = [];
  await ctx.route("**/*", (route) => {
    const req = route.request(); const url = req.url(); const method = req.method().toUpperCase();
    if (!APP_HOSTS.some((h) => url.includes(h))) return route.continue();
    if (url.includes(BACKEND_HOST) && MUTATING.has(method)) {
      blocked.push({ url: url.replace(/\?.*$/, ""), method });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });

  const page = await ctx.newPage();
  let consoleErrs = [], pageErrs = [], failedGets = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrs.push(msg.text().slice(0, 200)); });
  page.on("pageerror", (e) => pageErrs.push(String(e.message || e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400 && r.request().method() === "GET" && r.url().includes(BACKEND_HOST))
    failedGets.push(`${r.status()} ${r.url().replace(/\?.*$/, "").split("/").pop()}`); });
  const reset = () => { consoleErrs = []; pageErrs = []; failedGets = []; blocked = []; };

  const LIMIT = Number(process.env.ROUTE_LIMIT || 0);
  let routes = JSON.parse(fs.readFileSync(path.join("data/routes", `${p.key}.json`), "utf8")).routes.filter((r) => !r.dynamic);
  if (LIMIT) routes = routes.slice(0, LIMIT);
  console.log(`\n${p.key.toUpperCase()} — ${routes.length} static routes as ${user}`);

  for (const r of routes) {
    const url = routeUrl(p.prefix, r.path);
    const fullPath = `${p.prefix.replace(/\/$/, "")}${r.path.startsWith("/") ? r.path : "/" + r.path}`;
    reset();
    await page.goto(url, { waitUntil: "commit", timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector("#root")?.children.length > 0, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(SETTLE);

    const rendered = await page.evaluate(() => (document.querySelector("#root")?.innerText || "").trim().length > 40).catch(() => false);
    const loadErrs = { console: [...consoleErrs], page: [...pageErrs], gets: [...failedGets], writes: [...blocked] };
    if (!rendered) {
      if (!knownBlank.has(r.path) && !knownBlank.has(fullPath)) {
        const crashed = loadErrs.page.length > 0;
        add({ persona: p.key, route: fullPath, control: "(page load)",
              kind: crashed ? "blank-render-crash" : "blank-possibly-no-data",
              detail: loadErrs.page[0] || loadErrs.console[0] || "no content rendered" });
      }
      continue; // nothing to interact with
    }
    if (loadErrs.writes.length)
      add({ persona: p.key, route: fullPath, kind: "write-on-load", control: "(page load)", detail: loadErrs.writes.map((w) => `${w.method} ${w.url.split("/").pop()}`).join(", ") });
    for (const e of loadErrs.page) add({ persona: p.key, route: fullPath, kind: "js-error-on-load", control: "(page load)", detail: e });

    // ---------- exercise controls ----------
    const controls = await page.evaluate(() => {
      const out = [];
      const vis = (el) => { const s = getComputedStyle(el); const b = el.getBoundingClientRect();
        return s.visibility !== "hidden" && s.display !== "none" && b.width > 2 && b.height > 2; };
      const label = (el) => (el.getAttribute("aria-label") || el.innerText || el.value || el.title || el.placeholder || "").trim().replace(/\s+/g, " ").slice(0, 60);
      document.querySelectorAll('[role="tab"], button, [role="button"], select, [aria-expanded], input[type="search"], input[placeholder*="earch" i], input[placeholder*="ilter" i]')
        .forEach((el, i) => { if (!vis(el)) return; el.setAttribute("data-qa-ix", String(i));
          out.push({ ix: String(i), tag: el.tagName.toLowerCase(), role: el.getAttribute("role") || "",
            type: el.getAttribute("type") || "", label: label(el), inForm: !!el.closest("form") }); });
      return out.slice(0, 40);
    }).catch(() => []);

    for (const c of controls) {
      if (c.tag === "button" && c.inForm) continue;           // forms are handled below
      if (DESTRUCTIVE.test(c.label)) continue;                  // never click an action
      reset();
      const sel = `[data-qa-ix="${c.ix}"]`;
      try {
        if (c.tag === "select") {
          await page.selectOption(sel, { index: 1 }, { timeout: 3000 }).catch(() => {});
        } else if (c.tag === "input") {
          await page.fill(sel, "a", { timeout: 3000 }); await page.waitForTimeout(800); await page.fill(sel, "");
        } else {
          await page.click(sel, { timeout: 3000, trial: false });
        }
        await page.waitForTimeout(1200);
        await page.keyboard.press("Escape").catch(() => {});
      } catch { continue; }
      const ctl = `${c.tag}${c.role ? "[" + c.role + "]" : ""} "${c.label || "(unlabelled)"}"`;
      for (const e of pageErrs) add({ persona: p.key, route: fullPath, kind: "js-error-on-interaction", control: ctl, detail: e });
      if (blocked.length) add({ persona: p.key, route: fullPath, kind: "write-from-non-submit-control", control: ctl,
        detail: blocked.map((w) => `${w.method} ${w.url.split("/").pop()}`).join(", ") });
      if (failedGets.length) {
        const only403 = failedGets.every((g) => g.startsWith("403"));
        add({ persona: p.key, route: fullPath, control: ctl, detail: failedGets.slice(0, 3).join(", "),
              kind: only403 ? "403-account-not-provisioned" : "failed-load-on-interaction" });
      }
      if (!page.url().startsWith(url.split("?")[0].replace(/\/$/, ""))) {        // navigated away: come back
        await page.goto(url, { waitUntil: "commit", timeout: 30000 }).catch(() => {}); await page.waitForTimeout(SETTLE);
      }
    }

    // ---------- forms: submit EMPTY, observe client-side validation ----------
    const forms = await page.evaluate(() => [...document.querySelectorAll("form")].map((f, i) => {
      f.setAttribute("data-qa-form", String(i));
      const req = f.querySelectorAll("[required], [aria-required='true']").length;
      const btn = f.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      return { i: String(i), required: req, hasSubmit: !!btn };
    })).catch(() => []);
    for (const f of forms) {
      if (!f.hasSubmit) continue;
      reset();
      await page.evaluate((i) => { const f = document.querySelector(`[data-qa-form="${i}"]`);
        f.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea").forEach((x) => { x.value = ""; x.dispatchEvent(new Event("input", { bubbles: true })); }); }, f.i).catch(() => {});
      await page.click(`[data-qa-form="${f.i}"] button[type="submit"], [data-qa-form="${f.i}"] input[type="submit"], [data-qa-form="${f.i}"] button:not([type])`, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const validationShown = await page.evaluate(() => !!document.querySelector(':invalid, [aria-invalid="true"], .error, .text-red-500, [class*="error" i]')).catch(() => false);
      if (blocked.length && !validationShown)
        add({ persona: p.key, route: fullPath, kind: "empty-form-sent-to-server", control: `form #${f.i}`,
          detail: `submitted with all fields empty; the request was sent (${blocked.map((w) => w.method + " " + w.url.split("/").pop()).join(", ")}) with no client-side validation shown` });
      for (const e of pageErrs) add({ persona: p.key, route: fullPath, kind: "js-error-on-submit", control: `form #${f.i}`, detail: e });
      await page.keyboard.press("Escape").catch(() => {});
    }

    // ---------- keyboard focus: is focus visible as you tab? ----------
    const focus = await page.evaluate(async () => {
      let seen = 0, invisible = 0;
      document.body.focus();
      for (let i = 0; i < 12; i++) {
        const before = document.activeElement;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
        const el = document.activeElement;
        if (el && el !== document.body && el !== before) {
          seen++;
          const s = getComputedStyle(el);
          if ((s.outlineStyle === "none" || s.outlineWidth === "0px") && s.boxShadow === "none") invisible++;
        }
      }
      return { seen, invisible };
    }).catch(() => ({ seen: 0, invisible: 0 }));
    // (synthetic Tab cannot move focus in all browsers; recorded only when it does)
    if (focus.seen >= 3 && focus.invisible === focus.seen)
      add({ persona: p.key, route: fullPath, kind: "focus-not-visible", control: "(keyboard)", detail: `${focus.invisible} of ${focus.seen} focused elements show no focus indicator` });

    process.stdout.write(".");
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(process.env.OUT || "data/interaction-findings.json", JSON.stringify(findings, null, 2));
const by = {}; for (const f of findings) by[f.kind] = (by[f.kind] || 0) + 1;
console.log(`\n\n${findings.length} interaction findings -> data/interaction-findings.json`);
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
