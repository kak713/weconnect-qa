"""
Boundary-value probe. Isolated stack, synthetic records, every write rolled back.

Only values that are self-contradictory are asserted on: a negative age, a capacity range whose
floor exceeds its ceiling, a percentage above 100, a birth date in the future, a deadline before
the issue it belongs to. These are wrong on their own terms, so they can be called defects without
waiting for the characterisation baseline to say what correct looks like.
"""
import frappe, datetime, json
frappe.init(site="qa.localhost"); frappe.connect()
frappe.set_user("Administrator")

TODAY = datetime.date.today()
CASES = [
    ("Enquiry Form",     {"age": -5},                      "age cannot be negative"),
    ("Enquiry Form",     {"age": 0},                       "age 0 for a skilling enquiry"),
    ("Enquiry Form",     {"age": 999999},                  "age far beyond a human lifespan"),
    ("Enquiry Form",     {"dob": str(TODAY + datetime.timedelta(days=3650))}, "date of birth in the future"),
    ("Enquiry Form",     {"dob": "1850-01-01"},            "date of birth before 1900"),
    ("Skilling Batch",   {"minimum_capacity": 50, "maximum_capacity": 10}, "minimum capacity above maximum"),
    ("Skilling Batch",   {"minimum_capacity": -10},        "negative capacity"),
    ("Pathway Batch",    {"minimum_capacity": 50, "maximum_capacity": 10}, "minimum capacity above maximum"),
    ("Skilling Invoice", {"installment_percent": 150},     "instalment percentage above 100"),
    ("Skilling Invoice", {"installment_percent": -20},     "negative percentage"),
    ("Skilling Invoice", {"course_cost_per_student": -5000}, "negative course cost"),
    ("Skilling Issue",   {"date_of_issue": str(TODAY), "resolution_deadline": str(TODAY - datetime.timedelta(days=30))},
                         "resolution deadline 30 days before the issue was raised"),
]

def a_record(dt):
    r = frappe.get_all(dt, pluck="name", limit=1)
    return r[0] if r else None

rows = []
for dt, patch, why in CASES:
    name = a_record(dt)
    if not name:
        rows.append((dt, patch, why, "NO RECORD", None)); continue
    before = {k: frappe.db.get_value(dt, name, k) for k in patch}
    try:
        doc = frappe.get_doc(dt, name)
        doc.update(patch)
        doc.save(ignore_permissions=True)
        after = {k: frappe.db.get_value(dt, name, k) for k in patch}
        def same(a, b):
            try: return float(a) == float(b)
            except (TypeError, ValueError): return str(a) == str(b)
        stored = all(same(after[k], v) for k, v in patch.items())
        rows.append((dt, patch, why, "ACCEPTED" if stored else "coerced", after))
    except Exception as e:
        rows.append((dt, patch, why, f"rejected ({type(e).__name__})", None))
    finally:
        frappe.db.rollback()

acc = [r for r in rows if r[3] == "ACCEPTED"]
print(f"  {len(acc)} of {len(rows)} self-contradictory values stored without complaint\n")
for dt, patch, why, outcome, after in rows:
    mark = "ACCEPTED " if outcome == "ACCEPTED" else "          "
    tail = f"  stored={json.dumps(after, default=str)[:44]}" if outcome == "coerced" else ""
    print(f"  {mark}{dt:18} {json.dumps(patch)[:46]:46} {outcome:12} {why}{tail}")
