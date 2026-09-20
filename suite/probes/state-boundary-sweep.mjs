#!/usr/bin/env node
/**
 * State-boundary sweep: does each STATE endpoint let a persona mutate another centre's record?
 *
 * The batch and invoice S1s proved two members of the truly-bypassed set breach across a centre
 * boundary. This tests whether the pattern is pervasive: it drives every state-change endpoint that
 * operates on a centre-scoped record we hold, as `sp` (permitted East/West), against a record owned
 * by North — a centre sp has no permission over. A success is a breach; a refusal is the boundary
 * holding.
 *
 * Every write goes through the guard. Targets are North-owned fixtures; sp is disjoint from North.
 */
import "dotenv/config";
import fs from "node:fs";
import { createRequire } from "node:module";
const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";
import { fixtures } from "./_config.mjs";
const fix = fixtures();

async function login(k){const b=new FormData();b.set("usr",`qa.${k}@qa-synthetic.invalid`);b.set("pwd","QA-synthetic-pw-2026");
const r=await fetch(`${BASE}/api/method/authentication.api.auth.login`,{method:"POST",body:b,headers:{Host:HOST}});const m=JSON.parse(await r.text()).message;return `token ${m.api_key}:${m.api_secret}`;}
async function call(ep,verb,auth,fields){const url=`${BASE}/api/method/${ep}`;if(!evaluate(url,verb).allow)return{status:0,text:"guard"};const b=new FormData();for(const[k,v]of Object.entries(fields))b.set(k,v);const r=await fetch(url,{method:verb,headers:{Host:HOST,Authorization:auth},body:b});return{status:r.status,text:await r.text()};}
const breached=(r)=>{try{const j=JSON.parse(r.text);const p=j.message&&typeof j.message==="object"?j.message:j;return Number(p.success??p.success_key)===1||/success|raised|closed|withdrawn|discontinued/i.test(p.message||"");}catch{return false;}};
const refused=(r)=>/permission|not allowed|not permitted|forbidden/i.test(r.text);

// STATE endpoints operating on North-owned records, driven as sp (East/West).
const NB=fix.north_batch, COURSE=fix.course, PARTNER=fix.partner;
const CASES=[
 {name:"withdraw_batch (North batch)", ep:"youth_skilling.api.batch_management.withdraw_batch", verb:"POST", f:{batch_id:NB, add_notes:"QA sweep"}},
 {name:"raise_batch_fill_request (North)", ep:"youth_skilling.api.batch_management.raise_batch_fill_request", verb:"POST", f:{batch_id:NB, short_remarks:"QA"}},
 {name:"mark_as_complete (North batch)", ep:"youth_skilling.api.batch_management.mark_as_complete", verb:"POST", f:{batch_id:NB, short_remarks:"QA"}},
 {name:"discontinue_course", ep:"youth_skilling.api.skilling_repository.discontinue_course", verb:"POST", f:{course_id:COURSE, discontinue_date:"2026-12-01", remarks:"QA"}},
 {name:"discontinue_skilling_partner", ep:"youth_skilling.api.skilling_repository.discontinue_skilling_partner", verb:"POST", f:{partner_id:PARTNER, discontinue_date:"2026-12-01", remarks:"QA"}},
];
const auth=await login("sp");
const results=[];
for(const c of CASES){
  const r=await call(c.ep,c.verb,auth,c.f);
  const verdict = breached(r) ? "BREACHED" : refused(r) ? "HELD" : "inconclusive";
  results.push({name:c.name, verdict, status:r.status, snippet:r.text.slice(0,90).replace(/\s+/g," ")});
  console.log(`  ${verdict.padEnd(13)} ${c.name.padEnd(34)} [${r.status}] ${verdict==="inconclusive"?r.text.slice(0,70).replace(/\s+/g," "):""}`);
}
const b=results.filter(r=>r.verdict==="BREACHED").length;
console.log(`\n  ${b} BREACHED, ${results.filter(r=>r.verdict==="HELD").length} held, ${results.filter(r=>r.verdict==="inconclusive").length} inconclusive`);
fs.writeFileSync(new URL("../../evidence/state-boundary-results.json", import.meta.url),JSON.stringify(results,null,1));
