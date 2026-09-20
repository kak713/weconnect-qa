"""
State-transition probe. For each doctype carrying a status field, attempt every ordered pair of
distinct states and record which the platform accepts. A fully permissive matrix means no
transition control exists — a structural fact that needs no baseline to interpret.
Isolated stack, synthetic records, every write rolled back.
"""
import frappe, json
frappe.init(site="qa.localhost"); frappe.connect()
frappe.set_user("Administrator")

TARGETS = [("Skilling Invoice","current_status"), ("Skilling Batch","batch_status"),
           ("Skilling Issue","status"), ("Counselling","status"),
           ("Enquiry Form","enquiry_status"), ("Pre Enquiry","pre_enquiry_status"),
           ("Pathway Batch","batch_status"), ("Youth Status","status")]

summary = []
for dt, fld in TARGETS:
    if not frappe.db.exists("DocType", dt): continue
    meta = frappe.get_meta(dt); f = meta.get_field(fld)
    if not f or not f.options: continue
    states = [s for s in f.options.split("\n") if s.strip()]
    rec = frappe.get_all(dt, pluck="name", limit=1)
    if not rec:
        summary.append((dt, fld, len(states), None, None, "no record")); continue
    name = rec[0]
    accepted, refused, pairs = 0, 0, []
    for a in states:
        for b in states:
            if a == b: continue
            try:
                d = frappe.get_doc(dt, name); d.set(fld, a); d.save(ignore_permissions=True)
                d = frappe.get_doc(dt, name); d.set(fld, b); d.save(ignore_permissions=True)
                got = frappe.db.get_value(dt, name, fld)
                if got == b: accepted += 1
                else: refused += 1; pairs.append(f"{a}->{b} (became {got})")
            except Exception as e:
                refused += 1; pairs.append(f"{a}->{b} ({type(e).__name__})")
            finally:
                frappe.db.rollback()
    total = accepted + refused
    summary.append((dt, fld, len(states), accepted, total, pairs[:3]))

print(f"  {'doctype':20} {'field':20} states  accepted/total   blocked examples")
for dt, fld, ns, acc, tot, extra in summary:
    if acc is None:
        print(f"  {dt:20} {fld:20} {ns:^6}  {'-':^14}   {extra}")
    else:
        flag = "NO CONTROL" if acc == tot else f"{tot-acc} blocked"
        print(f"  {dt:20} {fld:20} {ns:^6}  {acc}/{tot:<12}  {flag}  {extra if extra else ''}")
