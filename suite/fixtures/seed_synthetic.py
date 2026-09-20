"""Seed the isolated QA environment with synthetic data shaped like the platform's.

Why shaped, and not merely present: a lifecycle test run against one empty record is not the same
test as one run against a batch carrying thirty youth, attendance rows and an invoice. Defects that
only appear at realistic cardinality do not appear at cardinality one. Volumes here are therefore
scaled from measurements taken against the platform (`data/data-shape.json`) rather than invented.

Three properties this seeder is built to have:

    ISOLATED       It runs inside the isolated instance, via bench, against site `qa.localhost`.
                   It cannot reach the client's platform: it speaks to the local database directly
                   and has no network client at all.

    OBVIOUSLY SYNTHETIC
                   Every generated value is prefixed `QA-` or built from a fixed synthetic
                   vocabulary. If one of these records is ever seen outside this environment it
                   must be instantly recognisable as manufactured. Nothing here may resemble a real
                   person's name, number or address.

    SCHEMA-DRIVEN  Field values are generated from each doctype's own metadata — mandatory flags,
                   field types, Select options, Link targets. Nothing is hardcoded per doctype, so
                   the seeder tracks the schema as it changes instead of decaying.

Run:  bench --site qa.localhost execute utils.seed_synthetic.run
"""

from __future__ import annotations

import json
import logging
import random
from datetime import date, timedelta
from typing import Any

import frappe

logger = logging.getLogger(__name__)

SEED = 20260920  # deterministic: the same run produces the same data
random.seed(SEED)

# Volumes scaled from data-shape.json. The platform's figures are in the comments; the seed is
# roughly an order of magnitude smaller, which preserves ratios and pagination behaviour (lists
# page at 20) while staying quick to build and reset.
VOLUMES: dict[str, int] = {
    "Youth": 400,                    # platform: 3825
    "Pre Enquiry": 100,              # platform: 957
    "Counselling": 85,               # platform: 810
    "Approval": 52,                  # platform: 521
    "Training Center": 15,           # platform: 145
    "Pathway Batch": 12,             # platform: ~26 ongoing
    "Skilling Batch": 12,
    "Region": 8,                     # platform: 8 — matched exactly
    "Course": 6,
    "Approval Category": 5,          # platform: 5 — matched exactly
    "Donor": 4,                      # platform: 39
    "Pathway": 3,                    # platform: 3 — matched exactly
}
DEFAULT_VOLUME = 3  # every other doctype in the closure

# Doctypes we must not touch: framework configuration and anything owned by the framework apps.
WECONNECT_APPS = frozenset({
    "authentication", "youth_skilling", "centre_head", "facilitator_and_counsellor",
    "outreach", "batch_management", "youth_placement", "event_management",
})

SYNTHETIC_WORDS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
                   "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa"]


def _module_to_app() -> dict[str, str]:
    """Map each module name to the app providing it. Returns: {module: app}."""
    return {m.name: m.app_name for m in frappe.get_all("Module Def", fields=["name", "app_name"])}


def synthetic_value(field: Any, doctype: str, index: int, created: dict[str, list[str]],
                    depth: int = 0) -> Any:
    """A synthetic value appropriate to one field's type.

    Args:
        field: The DocField metadata object.
        doctype: Name of the doctype being created, used to make values self-describing.
        index: Row number, so values within a doctype differ.
        created: Records already created, keyed by doctype, for satisfying Link fields.
        depth: Recursion depth when creating a missing Link target on demand.

    Returns:
        A value valid for the field's type, or None where no value is required.
    """
    ft, fn = field.fieldtype, field.fieldname
    word = SYNTHETIC_WORDS[index % len(SYNTHETIC_WORDS)]

    if ft == "Link":
        if not field.options:
            return None
        # Resolved from the DATABASE, never from an in-memory cache.
        #
        # An earlier version cached created names in a dict. When a parent insert failed, the
        # rollback also discarded any dependency created on demand for it — but the cache still
        # listed those names, so every later reference resolved to a record that no longer
        # existed. That single bug produced most of a 80-doctype failure run as
        # `LinkValidationError: Could not find X: QA-...`. Querying the database cannot go stale.
        existing = frappe.get_all(field.options, pluck="name", limit=20)
        if existing:
            return existing[index % len(existing)]
        # Nothing of that type exists. Create one on demand and COMMIT it, so it survives a
        # rollback of whatever parent is being attempted. Bounded against a dependency cycle.
        if depth < 4:
            try:
                made = build_doc(field.options, 0, created, depth + 1)
                if made:
                    frappe.db.commit()
                    return made
            except Exception:  # noqa: BLE001 - a failed dependency is not fatal to the caller
                frappe.db.rollback()
        return None

    if ft == "Dynamic Link":
        # Its target doctype is named by another field on this document; resolved by the caller,
        # which sets that field first.
        return None

    if ft == "Select":
        options = [o.strip() for o in (field.options or "").split("\n") if o.strip()]
        if not options:
            return None
        # Status-like fields take their FIRST option, which is conventionally the initial state.
        # Cycling them would seed records already Completed, Cancelled or Deleted, and a lifecycle
        # test cannot exercise a transition out of a terminal state. Everything else cycles, so
        # the data has variety.
        if any(t in fn for t in ("status", "state", "stage")):
            return options[0]
        return options[index % len(options)]

    if ft in ("Date",):
        return (date(2026, 1, 1) + timedelta(days=index % 240)).isoformat()
    if ft in ("Datetime",):
        return f"{(date(2026, 1, 1) + timedelta(days=index % 240)).isoformat()} 09:30:00"
    if ft == "Time":
        return f"{9 + index % 8:02d}:00:00"

    if ft in ("Int", "Long Int"):
        return index + 1
    if ft == "Percent":
        # A percent field is validated against 100 on this platform ("Coverage percent cannot be
        # more than 100"), so it cannot share the Currency generator.
        return round((index * 7) % 100, 2)
    if ft in ("Float", "Currency"):
        return round(100.0 + index * 7.5, 2)
    if ft == "Check":
        return index % 2
    if ft == "Duration":
        return 3600 * (1 + index % 8)
    if ft == "Rating":
        return round((index % 5 + 1) / 5, 1)
    if ft == "Color":
        return ["#4A3F9E", "#B8860B", "#6B7280"][index % 3]
    if ft == "Password":
        return f"QA-synthetic-{index:04d}"
    if ft in ("Attach", "Attach Image", "Signature"):
        return None
    if ft == "JSON":
        return "{}"
    if ft == "Geolocation":
        return None
    if ft == "Barcode":
        return f"QA{index:08d}"

    if ft in ("Data", "Small Text", "Text", "Long Text", "Text Editor", "Markdown Editor"):
        if "email" in fn:
            return f"qa.{word.lower()}.{index}@qa-synthetic.invalid"
        if "phone" in fn or "mobile" in fn or "contact" in fn:
            # Deliberately not a dialable number.
            return f"+91-00000-{index:05d}"
        if "name" in fn:
            return f"QA {word} {index:04d}"
        if "url" in fn or "link" in fn:
            return f"https://qa-synthetic.invalid/{doctype.lower().replace(' ', '-')}/{index}"
        return f"QA-{doctype[:18]}-{word}-{index:04d}"

    return None


LAYOUT_FIELDS = frozenset({"Section Break", "Column Break", "Tab Break", "HTML", "Button",
                           "Fold", "Heading", "Image"})


def build_doc(doctype: str, index: int, created: dict[str, list[str]], depth: int = 0) -> str | None:
    """Create one synthetic record, filling every writable field.

    Every field is filled, not only the schema-mandatory ones. Server-side `validate()` hooks in
    this platform routinely require fields the schema does not mark `reqd` — 42 of the first run's
    106 failures were exactly that. Filling everything satisfies those hooks and also produces more
    realistic records, since a real one is rarely mandatory-fields-only.

    Args:
        doctype: Doctype to create.
        index: Row number within this doctype.
        created: Records created so far, for Link resolution.
        depth: Recursion depth, bounding on-demand creation of Link targets.

    Returns:
        The new record's name, or None if it could not be created.
    """
    meta = frappe.get_meta(doctype)
    doc = frappe.new_doc(doctype)

    # A naming series must be chosen before insert or naming fails.
    series_field = next((f for f in meta.fields if f.fieldname == "naming_series"), None)
    if series_field and series_field.options:
        first = [o.strip() for o in series_field.options.split("\n") if o.strip()]
        if first:
            doc.set("naming_series", first[0])

    for f in meta.fields:
        if f.fieldtype in LAYOUT_FIELDS:
            continue
        if f.fieldname == "naming_series":
            continue
        if getattr(f, "read_only", 0) and not f.reqd:
            continue

        if f.fieldtype in ("Table", "Table MultiSelect"):
            if not f.options:
                continue
            child_meta = frappe.get_meta(f.options)
            rows = 2 if f.reqd else 1
            for r in range(rows):
                row: dict[str, Any] = {}
                for cf in child_meta.fields:
                    if cf.fieldtype in LAYOUT_FIELDS:
                        continue
                    val = synthetic_value(cf, f.options, index + r, created, depth)
                    if val is not None:
                        row[cf.fieldname] = val
                if row:
                    doc.append(f.fieldname, row)
            continue

        value = synthetic_value(f, doctype, index, created, depth)
        if value is not None:
            doc.set(f.fieldname, value)

    # Dynamic Links name their target doctype in another field, which is now set.
    for f in meta.fields:
        if f.fieldtype == "Dynamic Link" and f.options:
            target_dt = doc.get(f.options)
            if target_dt:
                existing = frappe.get_all(target_dt, pluck="name", limit=1)
                if existing:
                    doc.set(f.fieldname, existing[0])

    if meta.autoname and meta.autoname.startswith("prompt"):
        doc.name = f"QA-{doctype[:20].replace(' ', '-')}-{index:04d}"

    doc.insert(ignore_permissions=True, ignore_mandatory=False)
    return doc.name


def seed_order(targets: list[str]) -> list[str]:
    """Topological order over mandatory Link dependencies.

    Args:
        targets: Doctypes to seed.

    Returns:
        The same doctypes ordered so each appears after everything it mandatorily links to.
    """
    target_set = set(targets)
    deps: dict[str, set[str]] = {}
    for dt in targets:
        meta = frappe.get_meta(dt)
        mandatory = {f.fieldname for f in meta.fields if f.reqd}
        deps[dt] = {
            f.options for f in meta.fields
            if f.fieldtype == "Link" and f.fieldname in mandatory
            and f.options in target_set and f.options != dt
        }

    ordered: list[str] = []
    placed: set[str] = set()
    # Repeatedly take whatever has no unplaced dependency. The graph was measured acyclic; the
    # guard below exists so a future cycle degrades to "seed anyway" rather than looping forever.
    while len(ordered) < len(targets):
        ready = [d for d in targets if d not in placed and not (deps[d] - placed)]
        if not ready:
            ready = [d for d in targets if d not in placed]
            logger.warning("cycle detected; seeding %s without dependency order", ready[0])
            ready = ready[:1]
        for d in sorted(ready):
            ordered.append(d)
            placed.add(d)
    return ordered


def collect_targets() -> list[str]:
    """Every seedable WeConnect doctype: not a child table, not a Single, not framework-owned."""
    mod_app = _module_to_app()
    out = []
    for dt in frappe.get_all("DocType", fields=["name", "module", "issingle", "istable"]):
        if dt.issingle or dt.istable:
            continue
        if mod_app.get(dt.module) not in WECONNECT_APPS:
            continue
        out.append(dt.name)
    return out


def ensure_framework_prerequisites() -> None:
    """Create the framework records the WeConnect doctypes link to mandatorily.

    ERPNext ships these as setup-wizard output, which a bare `install-app` does not run. Without
    them, 37 doctypes fail on `fiscal_year`, `cost_center` and similar. Created here rather than
    left to on-demand creation because they are shared by many doctypes and want stable values.
    """
    today = date(2026, 1, 1)

    if not frappe.db.exists("Company", {"company_name": "QA Synthetic Foundation"}):
        try:
            frappe.get_doc({
                "doctype": "Company", "company_name": "QA Synthetic Foundation",
                "abbr": "QASF", "default_currency": "INR", "country": "India",
            }).insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("company: %s", exc)
            frappe.db.rollback()

    if not frappe.get_all("Fiscal Year", limit=1):
        try:
            frappe.get_doc({
                "doctype": "Fiscal Year", "year": "2026-2027",
                "year_start_date": today.isoformat(),
                "year_end_date": date(2026, 12, 31).isoformat(),
            }).insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("fiscal year: %s", exc)
            frappe.db.rollback()

    for gender in ("Male", "Female", "Other"):
        if not frappe.db.exists("Gender", gender):
            try:
                frappe.get_doc({"doctype": "Gender", "gender": gender}).insert(ignore_permissions=True)
            except Exception:  # noqa: BLE001
                frappe.db.rollback()
    frappe.db.commit()

    # Cost Center is mandatory on several budget/expense doctypes and is normally produced by
    # ERPNext's setup wizard, which `install-app` does not run.
    if not frappe.get_all("Cost Center", limit=1):
        company = frappe.get_all("Company", pluck="name", limit=1)
        if company:
            try:
                frappe.get_doc({
                    "doctype": "Cost Center", "cost_center_name": "QA Synthetic Cost Center",
                    "company": company[0], "is_group": 0,
                }).insert(ignore_permissions=True)
                frappe.db.commit()
            except Exception as exc:  # noqa: BLE001
                logger.warning("cost center: %s", exc)
                frappe.db.rollback()

    # Several doctypes validate "No User Permission Found for Centre" before allowing an insert.
    # Administrator needs one for each centre-like master, or those doctypes cannot be seeded.
    for centre_dt in ("Lighthouse Centre", "Training Center", "LH Center", "Centre"):
        if not frappe.db.exists("DocType", centre_dt):
            continue
        for centre in frappe.get_all(centre_dt, pluck="name", limit=5):
            if frappe.db.exists("User Permission",
                                {"user": "Administrator", "allow": centre_dt, "for_value": centre}):
                continue
            try:
                frappe.get_doc({"doctype": "User Permission", "user": "Administrator",
                                "allow": centre_dt, "for_value": centre,
                                "apply_to_all_doctypes": 1}).insert(ignore_permissions=True)
            except Exception:  # noqa: BLE001
                frappe.db.rollback()
    frappe.db.commit()

    # Employee: the authentication service reads it, and several doctypes link to it.
    if not frappe.get_all("Employee", limit=1):
        company = frappe.get_all("Company", pluck="name", limit=1)
        try:
            frappe.get_doc({
                "doctype": "Employee", "first_name": "QA Synthetic Staff",
                "gender": "Other", "date_of_birth": "1995-01-01",
                "date_of_joining": today.isoformat(),
                "company": company[0] if company else None,
                "status": "Active",
            }).insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("employee: %s", exc)
            frappe.db.rollback()


def grant_centre_permissions() -> int:
    """Give Administrator a User Permission for every centre-like record.

    Several doctypes refuse to insert with "No User Permission Found for Centre". The centres must
    exist first, so this runs between seeding passes rather than up front.

    Returns:
        Number of permissions created.
    """
    made = 0
    for centre_dt in ("Lighthouse Centre", "Training Center", "LH Center", "Centre"):
        if not frappe.db.exists("DocType", centre_dt):
            continue
        for centre in frappe.get_all(centre_dt, pluck="name", limit=20):
            if frappe.db.exists("User Permission",
                                {"user": "Administrator", "allow": centre_dt, "for_value": centre}):
                continue
            try:
                frappe.get_doc({"doctype": "User Permission", "user": "Administrator",
                                "allow": centre_dt, "for_value": centre,
                                "apply_to_all_doctypes": 1}).insert(ignore_permissions=True)
                made += 1
            except Exception:  # noqa: BLE001
                frappe.db.rollback()
    frappe.db.commit()
    return made


def run() -> None:
    """Seed the environment and report what was created."""
    frappe.flags.in_import = True
    ensure_framework_prerequisites()

    targets = collect_targets()
    ordered = seed_order(targets)

    created: dict[str, list[str]] = {}
    failures: dict[str, str] = {}
    total = 0

    # Multiple passes. A doctype that fails because a Link target does not exist yet will
    # succeed once that target is created by a later doctype's pass, so the seed repeats until
    # a whole pass adds nothing. Thirteen of the first run's failures were purely ordering.
    remaining = list(ordered)
    for pass_no in range(1, 7):
        if not remaining:
            break
        progressed: list[str] = []
        still: list[str] = []
        for doctype in remaining:
            want = VOLUMES.get(doctype, DEFAULT_VOLUME)
            # Counted from the DATABASE. A dependency created on demand for some other doctype
            # already exists at index 0; counting from the in-memory list would start again at 0
            # and collide on the primary key. This is the same mistake as the Link cache, in a
            # second place, and it produced the duplicate-key failures.
            try:
                have = frappe.db.count(doctype)
            except Exception:  # noqa: BLE001
                have = 0
            if have >= want:
                continue
            made: list[str] = []
            err: str | None = None
            for i in range(have, want):
                try:
                    name = build_doc(doctype, i, created)
                    if name:
                        made.append(name)
                        frappe.db.commit()
                except Exception as exc:  # noqa: BLE001 - one doctype must not stop the seed
                    err = f"{type(exc).__name__}: {str(exc)[:150]}"
                    frappe.db.rollback()
                    break
            if made:
                created.setdefault(doctype, []).extend(made)
                total += len(made)
                progressed.append(doctype)
            if err and (have + len(made)) < want:
                failures[doctype] = err
                still.append(doctype)
        granted = grant_centre_permissions()
        print(f"@@@pass {pass_no}: +{len(progressed)} doctypes progressed, {len(still)} still failing"
              f"{f', +{granted} centre permissions' if granted else ''}")
        if not progressed:
            break
        remaining = still

    # Anything that succeeded on a later pass is no longer a failure.
    failures = {k: v for k, v in failures.items() if len(created.get(k, [])) < VOLUMES.get(k, DEFAULT_VOLUME)}
    frappe.flags.in_import = False

    print(f"@@@SEEDED {total} records across {len(created)} doctypes")
    print(f"@@@FAILED {len(failures)} doctypes")
    for dt, n in sorted(created.items(), key=lambda kv: -len(kv[1]))[:20]:
        print(f"@@@  {dt:<44} {len(n)}")
    if failures:
        print("@@@--- failures ---")
        for dt, err in sorted(failures.items())[:25]:
            print(f"@@@  {dt:<44} {err}")
    with open("/home/frappe/frappe-bench/sites/seed-report.json", "w") as fh:
        json.dump({"created": {k: len(v) for k, v in created.items()},
                   "failures": failures, "total": total}, fh, indent=1)
