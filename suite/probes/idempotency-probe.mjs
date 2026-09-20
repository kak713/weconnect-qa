#!/usr/bin/env node
/**
 * Idempotency probe: does calling a mutation twice apply it twice?
 *
 * Networks retry, users double-click, and this platform's login endpoint has already shown
 * non-idempotent behaviour (api_key nulled on a repeat login). A create that runs twice makes two
 * records; a state change that runs twice may double-count or corrupt a workflow. This calls each
 * endpoint twice with an identical payload and reports whether the second call is a no-op
 * (idempotent, good), an error (guarded, acceptable), or a second successful application (not
 * idempotent — flagged).
 *
 * All writes go to the isolated host via the guard.
 */
import "dotenv/config";
import fs from "node:fs";
import { createRequire } from "node:module";
const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";
const { fixtures } = await import("./_config.mjs");
const FIX = fixtures();

async function login(k){const b=new FormData();b.set("usr",`qa.${k}@qa-synthetic.invalid`);b.set("pwd","QA-synthetic-pw-2026");
const r=await fetch(`${BASE}/api/method/authentication.api.auth.login`,{method:"POST",body:b,headers:{Host:HOST}});const m=JSON.parse(await r.text()).message;return `token ${m.api_key}:${m.api_secret}`;}

async function call(ep,verb,auth,fields){const url=`${BASE}/api/method/${ep}`;if(!evaluate(url,verb).allow)return{status:0,text:"guard refused"};
const b=new FormData();for(const[k,v]of Object.entries(fields))b.set(k,v);const r=await fetch(url,{method:verb,headers:{Host:HOST,Authorization:auth},body:b});return{status:r.status,text:await r.text()};}
const ok=(r)=>{try{const j=JSON.parse(r.text);const p=j.message&&typeof j.message==="object"?j.message:j;return Number(p.success??p.success_key)===1;}catch{return r.status<400;}};
async function count(doctype,auth,filters){const q=filters?`&filters=${encodeURIComponent(JSON.stringify(filters))}`:"";const r=await fetch(`${BASE}/api/method/frappe.client.get_count?doctype=${encodeURIComponent(doctype)}${q}`,{headers:{Host:HOST,Authorization:auth}});try{return JSON.parse(await r.text()).message;}catch{return null;}}

const results=[];
// create_task twice -> should make 2 tasks (creates are inherently non-idempotent, but we record it)
{
  const auth=await login("fc");
  const before=await count("Task",auth);
  const payload={data:JSON.stringify({title:`QA Idem ${Date.now()}`,priority:"Low",status:"Open",exp_start_date:"2026-10-01",exp_end_date:"2026-10-31"})};
  const r1=await call("outreach.apis.task.task.create_task","POST",auth,payload);
  const r2=await call("outreach.apis.task.task.create_task","POST",auth,payload);
  const after=await count("Task",auth);
  results.push({ep:"create_task",first:ok(r1),second:ok(r2),delta:after-before,note:after-before===2?"two records from identical calls":"idempotent/guarded"});
}
// raise_invoice twice on the same invoice -> does it double-raise?
{
  const auth=await login("sp");
  const inv={invoice_id:FIX.north_invoice,batch_id:FIX.north_batch,center:FIX.north_centre,installment:"1",remarks:"QA idem"};
  const r1=await call("youth_skilling.api.invoice.raise_invoice","PUT",auth,inv);
  const r2=await call("youth_skilling.api.invoice.raise_invoice","PUT",auth,inv);
  results.push({ep:"raise_invoice (already raised)",first:ok(r1),second:ok(r2),delta:"-",note:ok(r2)?"second raise ALSO succeeded — not guarded against double-raise":"second raise refused/guarded"});
}
// close_batch twice
{
  const auth=await login("sp");
  const b={batch_id:FIX.north_batch_open,short_remarks:"QA idem"};
  const r1=await call("youth_skilling.api.batch_management.close_batch","POST",auth,b);
  const r2=await call("youth_skilling.api.batch_management.close_batch","POST",auth,b);
  results.push({ep:"close_batch (already closed)",first:ok(r1),second:ok(r2),delta:"-",note:ok(r2)?"second close ALSO succeeded":"second close refused/guarded"});
}

console.log(`\n  Idempotency probe (identical call issued twice)\n`);
for(const r of results){
  console.log(`  ${r.ep.padEnd(32)} 1st=${String(r.first).padEnd(5)} 2nd=${String(r.second).padEnd(5)} delta=${String(r.delta).padEnd(4)} ${r.note}`);
}
fs.writeFileSync(new URL("../../evidence/idempotency-results.json", import.meta.url),JSON.stringify(results,null,1));
