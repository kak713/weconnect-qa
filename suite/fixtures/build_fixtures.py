"""Build the transactional fixtures the probes need, and write the fixtures manifest.

Runs after the reference, persona and transactional seeders. It creates a Skilling Partner with the
child rows a batch requires, a course, two North-owned batches (one open, one to be closed), a
North-owned invoice, and then writes `fixtures.json` — the manifest every probe reads, so no record
id is hardcoded.

Idempotent: existing fixtures are reused.

Run:  bench --site qa.localhost execute fixtures.build_fixtures.run
"""

from __future__ import annotations

import json
import logging

import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter

logger = logging.getLogger(__name__)

NORTH = "QA North Centre"
EAST = "QA East Centre"
SOUTH = "QA South Centre"

# The attendance controller writes these two Youth.status values, but neither ships in the
# `Youth Status` master (recorded as an S2). Without them every attendance save is rejected by
# link validation, so the syc lifecycle cannot be driven at all. Seeding them here is a
# workaround for the defect, not a fix for it.
REQUIRED_YOUTH_STATUSES = ("Skilling Enrolled", "Skilling Not Enrolled")

# `update_youth_status` refuses a youth already in one of these, so the syc lifecycle probe
# needs a youth outside them to stay re-runnable.
TERMINAL_YOUTH_STATUSES = ("Standby", "Drop Off", "Closed")


def _fill_mandatory(doc, meta) -> None:
    """Fill unset mandatory fields with type-appropriate synthetic values."""
    for f in meta.fields:
        if not f.reqd or doc.get(f.fieldname):
            continue
        fn, ft = f.fieldname.lower(), f.fieldtype
        if ft in ("Data", "Small Text", "Text"):
            doc.set(f.fieldname, "qa.f@qa-synthetic.invalid" if "email" in fn
                    else "+919000088888" if ("phone" in fn or "mobile" in fn) else f"QA-{f.fieldname}")
        elif ft == "Phone":
            doc.set(f.fieldname, "+919000088888")
        elif ft in ("Int", "Float", "Currency", "Percent"):
            doc.set(f.fieldname, 10)
        elif ft in ("Date", "Datetime"):
            doc.set(f.fieldname, "2026-06-01")
        elif ft == "Check":
            doc.set(f.fieldname, 0)
        elif ft == "Select" and f.options:
            doc.set(f.fieldname, [o for o in f.options.split("\n") if o.strip()][0])
        elif ft == "Link" and f.options:
            existing = frappe.get_all(f.options, pluck="name", limit=1)
            if existing:
                doc.set(f.fieldname, existing[0])


def _partner_with_children() -> tuple[str, str, str]:
    """A Skilling Partner with a training-centre row and a trainer row. Returns their names."""
    # The sm lifecycle probe creates partners and discontinues them, so a plain "first row"
    # lookup would latch onto a discontinued fixture on the next seed. Exclude them — filtering in
    # Python rather than SQL, because `!=` does not match NULL and a freshly seeded partner has no
    # status set at all.
    rows = frappe.get_all("Skilling Partner", fields=["name", "partner_status"], limit_page_length=50)
    name = next((r.name for r in rows if (r.partner_status or "") != "Discontinued"), None)
    if name is None and rows:
        # Every partner discontinued by a previous test run: reactivate rather than insert a
        # colliding deterministic name.
        frappe.db.set_value("Skilling Partner", rows[0].name, "partner_status", None)
        frappe.db.commit()
        name = rows[0].name
    doc = frappe.get_doc("Skilling Partner", name) if name else frappe.new_doc("Skilling Partner")
    if not doc.get("training_centers"):
        row = doc.append("training_centers", {})
        _fill_mandatory(row, frappe.get_meta("Skilling Partner Training Center Table"))
    if not doc.get("trainers"):
        doc.append("trainers", {
            "first_name": "QA", "last_name": "Trainer", "email": "qa.trainer@qa-synthetic.invalid",
            "phone_number": "+919000099999", "designation": "Trainer",
            "total_experience": 1, "teaching_experience": 1, "corporate_experience": 1,
        })
    _fill_mandatory(doc, doc.meta)
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return doc.name, doc.get("training_centers")[0].name, doc.get("trainers")[0].name


def _course(partner: str) -> str:
    # Same reason as the partner lookup, including the NULL caveat.
    #
    # Course names are deterministic (`<course>_<partner>_<region>`), so once one exists a second
    # insert always collides. The sm lifecycle probe discontinues the courses it creates, so after
    # a test run every course may be Discontinued. Reactivate one rather than attempting an insert
    # that cannot succeed — this keeps `npm run seed && npm test` repeatable.
    rows = frappe.get_all("Course", fields=["name", "course_status"], limit_page_length=50)
    active = [r.name for r in rows if (r.course_status or "") != "Discontinued"]
    if active:
        return active[0]
    if rows:
        frappe.db.set_value("Course", rows[0].name, "course_status", None)
        frappe.db.commit()
        return rows[0].name
    doc = frappe.new_doc("Course")
    doc.skilling_partner = partner
    _fill_mandatory(doc, doc.meta)
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


def _batch(partner: str, course: str, tc: str, tr: str, start: str, centre: str = NORTH) -> str:
    doc = frappe.new_doc("Skilling Batch")
    doc.skilling_partner, doc.course, doc.location_lcf = partner, course, centre
    doc.training_center, doc.trainer, doc.start_date = tc, tr, start
    _fill_mandatory(doc, doc.meta)
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name


def _invoice(batch: str) -> str:
    doc = frappe.new_doc("Skilling Invoice")
    doc.skilling_batch_id = batch
    if doc.meta.has_field("location"):
        doc.location = NORTH
    if doc.meta.has_field("installment"):
        doc.installment = "1"
    doc.flags.ignore_validate = True
    doc.insert(ignore_permissions=True, ignore_mandatory=True)
    frappe.db.commit()
    return doc.name


# Doctypes whose `naming_series` field ships with neither options nor a default. Any creation
# path that does not set one explicitly fails with `ValidationError: Naming Series mandatory` —
# which is why several API create endpoints cannot be driven at all on an install built from the
# repositories. Seeding a series here is a workaround for that defect, not a fix for it.
NAMING_SERIES_DEFAULTS = {
    "Youth": "YOUTH-",
    "Community": "COMMUNITY-.#####",
    "Ward": "WARD-.#####",
    "Funnel": "FUNNEL-.#####",
    "Skilling Batch": "SKILL-BATCH-.#####",
    "Pathway Batch": "PATH-BATCH-.#####",
    "Sub Batch": "SUB-BATCH-.#####",
    "Lighthouse Visit": "LH-VISIT-.#####",
    "Curriculum Roadmap Template": "CRT-.#####",
    "Skilling Assessment Question Template": "SAQT-.#####",
}


def _ensure_naming_series() -> list[str]:
    """Give every naming_series field a usable series and default.

    Returns the doctypes that had to be patched. A non-empty list is itself evidence: on a site
    built from the repositories these are unset, and the API create paths that rely on them fail.
    """
    patched = []
    for doctype, series in NAMING_SERIES_DEFAULTS.items():
        if not frappe.db.exists("DocType", doctype):
            continue
        try:
            meta = frappe.get_meta(doctype)
            field = meta.get_field("naming_series")
            if not field:
                continue
            options = [o for o in (field.options or "").split("\n") if o.strip()]
            if options and (field.default or "").strip():
                continue
            if not options:
                options = [series]
            make_property_setter(doctype, "naming_series", "options", "\n".join(options), "Text",
                                 validate_fields_for_doctype=False)
            make_property_setter(doctype, "naming_series", "default", options[0], "Text",
                                 validate_fields_for_doctype=False)
            patched.append(doctype)
        except Exception as exc:  # noqa: BLE001
            logger.warning("naming series for %s: %s", doctype, exc)
    if patched:
        frappe.clear_cache()
        frappe.db.commit()
    return patched


# Application code creates approvals with the category name hardcoded as a string, and
# `Approval.validate_approval_category()` refuses any name that does not exist with a matching
# `ref_doc`. None of these records ships with the applications, so every approval-driven flow
# fails on a site built from the repositories. Creating them here is a workaround for that
# defect — see the approval-category finding in the register.
REQUIRED_APPROVAL_CATEGORIES = (
    ("Outreach Plan", "Community Visit"),
    ("Edit Outreach Plan", "Community Visit"),
)


def _ensure_named_approval_categories() -> list[str]:
    """Create the categories the platform's code names as literals. Returns those created."""
    created = []
    for name, ref_doc in REQUIRED_APPROVAL_CATEGORIES:
        if frappe.db.exists("Approval Category", name):
            continue
        if _ensure_approval_category(ref_doc, name):
            created.append(name)
    return created


def _ensure_approval_category(ref_doc: str, name: str | None = None) -> str | None:
    """An Approval Category bound to `ref_doc`, optionally with an exact required name."""
    if name and frappe.db.exists("Approval Category", name):
        return name
    if not name:
        existing = frappe.db.get_value("Approval Category", {"ref_doc": ref_doc}, "name")
        if existing:
            return existing
    try:
        doc = frappe.new_doc("Approval Category")
        doc.category = name or f"QA {ref_doc} Approval"
        doc.ref_doc = ref_doc
        role = (frappe.get_all("Role", filters={"disabled": 0}, pluck="name", limit=1) or [None])[0]
        if doc.meta.has_field("role") and role:
            doc.role = role
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return doc.name
    except Exception as exc:  # noqa: BLE001
        logger.warning("approval category for %s: %s", ref_doc, exc)
        return None


def _ensure_youth_statuses() -> list[str]:
    """Create the Youth Status records the platform's own code writes but does not ship."""
    created = []
    for status in REQUIRED_YOUTH_STATUSES:
        if frappe.db.exists("Youth Status", status):
            continue
        try:
            doc = frappe.new_doc("Youth Status")
            doc.status = status
            doc.insert(ignore_permissions=True)
            created.append(status)
        except Exception as exc:
            logger.warning("Youth Status %s: %s", status, exc)
    if created:
        frappe.db.commit()
    return created


def _reset_youth_status(youth: str) -> str | None:
    """Return a youth whose status is not terminal, resetting it if the probe left it that way."""
    if not youth:
        return None
    current = frappe.db.get_value("Youth", youth, "status")
    if current not in TERMINAL_YOUTH_STATUSES:
        return youth
    fallback = (frappe.get_all("Youth Status",
                               filters={"name": ["not in", TERMINAL_YOUTH_STATUSES]},
                               pluck="name", limit=1) or [None])[0]
    if fallback:
        frappe.db.set_value("Youth", youth, "status", fallback)
        frappe.db.commit()
    return youth


def _attendance_record(batch: str, youth: str) -> str | None:
    """A Skilling Batch Attendance row for the pair — `mark_attendance` requires one to exist."""
    if not (batch and youth):
        return None
    existing = frappe.db.get_value(
        "Skilling Batch Attendance", {"skilling_batch_id": batch, "youth": youth}, "name")
    if existing:
        return existing
    try:
        doc = frappe.new_doc("Skilling Batch Attendance")
        doc.skilling_batch_id = batch
        doc.youth = youth
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return doc.name
    except Exception as exc:
        logger.warning("attendance record for %s/%s: %s", batch, youth, exc)
        return None


def _enrol(batch: str, youth: str) -> None:
    """Add the youth to the batch's student table, if not already there."""
    if not (batch and youth):
        return
    doc = frappe.get_doc("Skilling Batch", batch)
    if any(r.youth == youth for r in (doc.youth or [])):
        return
    try:
        doc.append("youth", {"youth": youth})
        doc.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception as exc:
        logger.warning("enrol %s into %s: %s", youth, batch, exc)


def run() -> None:
    """Build fixtures and write the manifest."""
    partner, tc, tr = _partner_with_children()
    course = _course(partner)
    batch_to_close = _batch(partner, course, tc, tr, "2026-06-01")
    batch_open = _batch(partner, course, tc, tr, "2026-09-01")
    invoice = _invoice(batch_to_close)

    def ref(doctype):
        v = frappe.get_all(doctype, pluck="name", limit=1)
        return v[0] if v else None

    def youth_at(centre, skip=None):
        rows = frappe.get_all("Youth", filters={"lighthouse_centre": centre}, pluck="name", limit=2)
        return [r for r in rows if r != skip]

    north = youth_at(NORTH)
    east = youth_at(EAST)
    south = youth_at(SOUTH)

    # syc lifecycle prerequisites
    seeded_statuses = _ensure_youth_statuses()
    patched_series = _ensure_naming_series()
    youth_category = _ensure_approval_category("Youth")
    visit_category = _ensure_approval_category("Community Visit")
    named_categories = _ensure_named_approval_categories()
    east_batch = _batch(partner, course, tc, tr, "2026-08-01", centre=EAST)
    east_youth = east[0] if east else None
    _enrol(east_batch, east_youth)
    attendance = _attendance_record(east_batch, east_youth)
    south_youth = _reset_youth_status(south[0] if south else None)

    manifest = {
        "north_centre": NORTH,
        "north_batch": batch_to_close,
        "north_batch_open": batch_open,
        "north_invoice": invoice,
        "north_youth": north[0] if north else None,
        "north_youth_2": north[1] if len(north) > 1 else (north[0] if north else None),
        "east_youth": (youth_at("QA East Centre") or [None])[0],
        "skilling_partner": partner,
        "training_center": tc,
        "trainer": tr,
        "course": course,
        # The Approval create endpoint validates the category against the document type, so the
        # manifest must carry a category whose `ref_doc` is the doctype the probe submits.
        # Taking "the first category" silently yields one bound to another doctype and a 400.
        "approval_category": youth_category or ref("Approval Category"),
        "approval_category_visit": visit_category,
        "created_approval_categories": named_categories,
        "community": ref("Community"),
        "counselling_type": ref("Counselling Type"),
        "issue_category": ref("Skilling Issue Category"),
        "education": ref("Education"),
        "referral": ref("Lighthouse Referral Source"),
        "career_assistance": ref("Career Assistance"),
        # sm / syc lifecycle
        "east_centre": EAST,
        "east_batch": east_batch,
        "south_youth": south_youth,
        "attendance_record": attendance,
        "course_category": ref("Course Category"),
        "cert_authority": ref("Certificate Issuing Authority"),
        "job_role": ref("Job Role"),
        "region": ref("Region"),
        "seeded_youth_statuses": seeded_statuses,
        "patched_naming_series": patched_series,
    }
    path = "/home/frappe/frappe-bench/sites/fixtures.json"
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=1)
    print(f"fixtures manifest written: {sum(1 for v in manifest.values() if v)} of {len(manifest)} keys resolved")
