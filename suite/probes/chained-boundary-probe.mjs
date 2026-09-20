/**
 * Chains the two findings: an endpoint that writes undeclared fields, over a doctype that does not
 * validate them. Demonstrates a contradictory value reaching the database through the public API.
 * Isolated stack and synthetic records only.
 */
import { BASE, HOST, fixtures, login } from "./_config.mjs";
import { execFileSync } from "node:child_process";

const BACKEND = process.env.TEST_BACKEND_CONTAINER || "weconnect-qa-backend-1";

const fx = fixtures();
const db = (dt, n, f) => execFileSync("docker", ["exec","-w","/home/frappe/frappe-bench/sites",
  BACKEND,"/home/frappe/frappe-bench/env/bin/python","/tmp/getfield.py",
  HOST, dt, n, f], { encoding: "utf8" }).trim().split("\n").pop().trim();

const youth = fx.north_youth;
const before = db("Youth", youth, "dob");
const futureDob = `${new Date().getFullYear() + 10}-01-01`;   // a birth date ten years from now

const fc = await login("fc");
const r = await fetch(`${BASE}/api/method/batch_management.api.fc.youth_interest.add_interest`, {
  method: "PUT",
  headers: { Host: HOST, Authorization: fc.auth, "Content-Type": "application/json" },
  body: JSON.stringify({
    youth,
    data: {
      interested_course: "QA-Course Master-Charlie-0002",
      interested_job_role: "QA-Job Role-Charlie-0002",
      int_entre: 0, higher_education_plans: "No", add_notes: "chained probe",
      dob: futureDob,            // never declared by the endpoint, never validated by the doctype
    },
  }),
});
const body = JSON.parse(await r.text());
const after = db("Youth", youth, "dob");
console.log(`  HTTP ${r.status}  success_key=${body?.message?.success_key ?? body?.success_key}`);
console.log(`  Youth.dob  ${JSON.stringify(before)} -> ${JSON.stringify(after)}   (sent ${futureDob})`);
console.log(`  contradictory value reached the database through the API: ${after === futureDob}`);
