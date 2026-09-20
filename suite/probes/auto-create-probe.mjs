#!/usr/bin/env node
/**
 * Auto-resolving create prober.
 *
 * Each create endpoint enforces its own required-field logic, deeper than the doctype schema. This
 * drives a create endpoint by iterating: call it, read the error, satisfy it, retry. It resolves:
 *   - "'X' is required"                 -> supply X with a type-appropriate value
 *   - "Invalid ... 'V'" / "Could not find <Doctype>: V" -> query the DB for a real record and use it
 *   - a value that must be an enum      -> parsed from the message when listed
 * It stops on success, on a non-resolvable error, or after a bounded number of rounds.
 *
 * The point is coverage: it establishes whether each object's create path can be driven at all, and
 * records the field set that satisfies it, without a human reverse-engineering each wizard.
 *
 * Read-only against the DB for resolution; the create itself goes through the write guard.
 */
import "dotenv/config";
import fs from "node:fs";
import { createRequire } from "node:module";
const { evaluate } = createRequire(import.meta.url)("./write-guard.cjs");
const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:8080";
const HOST = process.env.TEST_SITE || "qa.localhost";

async function login(k){const b=new FormData();b.set("usr",`qa.${k}@qa-synthetic.invalid`);b.set("pwd","QA-synthetic-pw-2026");
const r=await fetch(`${BASE}/api/method/authentication.api.auth.login`,{method:"POST",body:b,headers:{Host:HOST}});const m=JSON.parse(await r.text()).message;return `token ${m.api_key}:${m.api_secret}`;}

async function anyRecord(doctype, auth){
  const r=await fetch(`${BASE}/api/method/frappe.client.get_list?doctype=${encodeURIComponent(doctype)}&limit_page_length=1`,{headers:{Host:HOST,Authorization:auth}});
  try{const d=JSON.parse(await r.text()).message;return d&&d[0]?d[0].name:null;}catch{return null;}
}

function typedValue(field){
  const f=field.toLowerCase();
  if(/email/.test(f))return "qa.f@qa-synthetic.invalid";
  if(/phone|mobile|contact_no|alternate_no/.test(f))return "9000000001";
  if(/date/.test(f))return "2026-07-01";
  if(/time/.test(f))return "10:00:00";
  if(/pin|pincode/.test(f))return "560001";
  if(/hour|duration|count|number|age|level|fee|cost|amount|marks|score|capacity|strength|min_|max_|qty|quantity|total_|percent|weightage|days|months|years|batch_strength/.test(f))return "10";
  if(/remark|note|description|reason|name|title|address|place|source|city|state|sector/.test(f))return "QA "+field;
  return "QA-"+field;
}

async function driveCreate(ep, verb, persona, seed){
  const auth=await login(persona);
  const url=`${BASE}/api/method/${ep}`;
  if(!evaluate(url,verb).allow)return{ep,ok:false,reason:"guard refused",rounds:0};
  const fields={...seed};
  for(let round=0; round<40; round++){
    const b=new FormData();
    for(const[k,v]of Object.entries(fields)) b.set(k, typeof v==="string"?v:JSON.stringify(v));
    const r=await fetch(url,{method:verb,headers:{Host:HOST,Authorization:auth},body:b});
    const t=await r.text();
    let ok=false; try{const j=JSON.parse(t);const p=j.message&&typeof j.message==="object"?j.message:j;ok=Number(p.success??p.success_key)===1||/created|success/i.test(p.message||"");}catch{ok=r.status>=200&&r.status<300;}
    if(ok)return{ep,ok:true,rounds:round,fields:Object.keys(fields)};
    // required field?
    let m=/'([a-z_]+)' is required|"([a-z_]+)" is required|([a-z_]+) is required/i.exec(t);
    if(m){const f=m[1]||m[2]||m[3]; if(!(f in fields)){fields[f]=typedValue(f); continue;}}
    // "'X' must be a non-negative integer" / "must be" numeric
    m=/'([a-z_]+)' must be a (non-negative )?(integer|number|float|positive)/i.exec(t);
    if(m){fields[m[1]]="10"; continue;}
    // enum: "must be one of ..." list
    m=/'([a-z_]+)'[^.]*one of:? "?([A-Za-z ]+)"?/i.exec(t);
    if(m){fields[m[1]]=m[2].split(/[,"]/)[0].trim(); continue;}
    // invalid/notfound link -> query DB and set the matching field.
    // formats: "Could not find <Doctype>: v", "Invalid Value for <Field> - 'v'",
    //          "<Doctype> 'v' not found", "Invalid <Field> 'v'"
    m=/Could not find ([A-Z][A-Za-z ]+):|Invalid Value for ([A-Za-z _]+) -|([A-Z][A-Za-z ]+) '[^']*' not found|Invalid ([A-Za-z _]+) '/.exec(t);
    if(m){
      const label=(m[1]||m[2]||m[3]||m[4]||"").trim();
      const key=label.toLowerCase().replace(/ /g,"_");
      // try the label as a doctype name; if not, try common doctype for the field
      let rec=await anyRecord(label,auth);
      if(!rec){ // field-name form: map to a doctype guess
        const guess={education:"Education",gender:"Gender",job_role:"Job Role",course:"Course",
          skilling_partner:"Skilling Partner",community:"Community",region:"Region"}[key];
        if(guess) rec=await anyRecord(guess,auth);
      }
      if(rec && fields[key]!==rec){fields[key]=rec; continue;}
    }
    // KeyError 'X' in a params/data object we control at top level
    m=/KeyError: '([a-z_]+)'/.exec(t);
    if(m && !(m[1] in fields)){fields[m[1]]=typedValue(m[1]); continue;}
    // stuck
    return{ep,ok:false,rounds:round,lastError:t.slice(0,120).replace(/\s+/g," "),fields:Object.keys(fields)};
  }
  return{ep,ok:false,reason:"max rounds",fields:Object.keys(fields)};
}

// Remaining object create endpoints + a minimal seed to start them
const TARGETS=JSON.parse(fs.readFileSync(process.argv[2]||new URL("../../evidence/remaining-creates.json", import.meta.url),"utf8"));
const results=[];
for(const t of TARGETS){
  const r=await driveCreate(t.ep, t.verb||"POST", t.persona, t.seed||{});
  results.push({object:t.object,...r});
  console.log(`  ${r.ok?"OK  ":"----"} ${(t.object||t.ep).padEnd(22)} rounds=${String(r.rounds??"-").padEnd(3)} ${r.ok?`(${r.fields.length} fields)`:(r.lastError||r.reason||"")}`);
}
fs.writeFileSync(new URL("../../evidence/auto-create-results.json", import.meta.url),JSON.stringify(results,null,1));
const ok=results.filter(r=>r.ok).length;
console.log(`\n  ${ok} of ${results.length} create endpoints driven to success`);
