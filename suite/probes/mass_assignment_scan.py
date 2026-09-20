import os, re, json

APPS = ["authentication","youth_skilling","centre_head","facilitator_and_counsellor",
        "outreach","batch_management","youth_placement","event_management"]
ROOT = "/home/frappe/frappe-bench/apps"

SINK = re.compile(r"""
    (?P<u>\b(\w+)\.update\s*\(\s*(?P<uarg>\w+)\s*\))
  | (?P<g>frappe\.get_doc\s*\(\s*\{[^}]*\*\*\s*(?P<garg>\w+))
  | (?P<n>frappe\.new_doc\s*\([^)]*\)\s*\.update\s*\(\s*(?P<narg>\w+)\s*\))
  | (?P<s>\bset_value\s*\(\s*[^,]+,\s*[^,]+,\s*(?P<sarg>\w+)\s*\))
""", re.X)

ALLOWLIST = re.compile(r"\b(allowed_fields|ALLOWED|whitelist_fields|permitted|pop\(|\bdel\s+\w+\[|"
                       r"\.get\(['\"]|fields\s*=\s*\[|for\s+\w+\s+in\s+\(?\[)", re.I)

def whitelisted_fns(src):
    """yield (name, startline, endline, params, body) for each @frappe.whitelist fn"""
    lines = src.split("\n")
    out = []
    for i, l in enumerate(lines):
        if not re.match(r"\s*@frappe\.whitelist", l):
            continue
        for j in range(i+1, min(i+6, len(lines))):
            m = re.match(r"\s*def\s+(\w+)\s*\(([^)]*)", lines[j])
            if m:
                indent = len(lines[j]) - len(lines[j].lstrip())
                k = j + 1
                while k < len(lines):
                    ln = lines[k]
                    if ln.strip() and (len(ln) - len(ln.lstrip())) <= indent and not ln.strip().startswith(("#","@","\"","'")):
                        break
                    k += 1
                out.append((m.group(1), j+1, k, m.group(2), "\n".join(lines[j:k])))
                break
    return out

rows = []
for app in APPS:
    for dp, _, fns in os.walk(os.path.join(ROOT, app)):
        for fn in fns:
            if not fn.endswith(".py"): continue
            p = os.path.join(dp, fn)
            try: src = open(p, encoding="utf-8", errors="ignore").read()
            except Exception: continue
            for name, s, e, params, body in whitelisted_fns(src):
                # request-derived dict params
                pnames = re.findall(r"(\w+)", params)
                dictish = [x for x in pnames if x in ("data","doc","payload","values","args","kwargs","form","fields")]
                has_kw = "**" in params
                if not dictish and not has_kw: continue
                for m in SINK.finditer(body):
                    arg = m.group("uarg") or m.group("garg") or m.group("narg") or m.group("sarg")
                    if arg not in dictish and not (has_kw and arg == "kwargs"): continue
                    # is there filtering before the sink?
                    pre = body[:m.start()]
                    guarded = bool(ALLOWLIST.search(pre))
                    kind = ("update" if m.group("u") else "get_doc**" if m.group("g")
                            else "new_doc.update" if m.group("n") else "set_value")
                    rows.append({
                        "file": p.replace(ROOT+"/",""), "line": s, "fn": name,
                        "sink": kind, "arg": arg, "guarded": guarded,
                        "snippet": " ".join(m.group(0).split())[:70],
                    })

print(f"whitelisted endpoints funnelling a request dict into a doc write: {len(rows)}")
print(f"  with some field filtering before the sink : {sum(1 for r in rows if r['guarded'])}")
print(f"  with NO filtering found before the sink   : {sum(1 for r in rows if not r['guarded'])}")
print()
for r in sorted(rows, key=lambda x: (x["guarded"], x["file"])):
    flag = "guarded" if r["guarded"] else "UNGUARDED"
    print(f"  [{flag:9}] {r['file']}:{r['line']}  {r['fn']}()  {r['sink']}({r['arg']})")
open("/tmp/massassign.json","w").write(json.dumps(rows, indent=1))
