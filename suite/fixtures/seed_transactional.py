"""Seed transactional records — Youth and their dependents — across the persona centres.

Reference data (`seed_synthetic`) and persona accounts (`seed_personas`) come first; this adds the
transactional volume that both halves of Phase 2 need:

    DEPTH   the security probes need real records owned by specific centres to attempt
            cross-boundary reads, edits and deletes against.
    BREADTH the lifecycle create/edit/delete tests need existing records as Link targets and as
            edit/delete subjects.

Youth is the linchpin — the most-referenced object, ~3825 in production. Records are distributed
across the six synthetic centres so that a probe can pick a youth owned by a centre the intruding
persona has no permission for.

Everything created is obviously synthetic: names carry `QA`, phones are `+9190000NNNNN` (a valid
format that is plainly not a real number), and the naming series is the platform's own `YOUTH-`.

Run:  bench --site qa.localhost execute utils.seed_transactional.run
"""

from __future__ import annotations

import logging

import frappe

logger = logging.getLogger(__name__)

# Scaled from measured production cardinality (data-shape.json: 3825 youth), an order of magnitude
# down, spread across the six synthetic centres.
YOUTH_PER_CENTRE = 8

SYNTHETIC_WORDS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
                   "India", "Juliet", "Kilo", "Lima"]


def synthetic_phone(n: int) -> str:
    """A validly-formatted but obviously fake Indian mobile number. (n,) -> str."""
    return f"+9190000{n:05d}"


# Stage and status master-data values the platform's youth-creation flows set as literals. These
# are seeded by patches in production; a bare install lacks them, so the create endpoints fail with
# "Could not find Stage/Status". Seeded here with the exact names the code uses.
REQUIRED_STAGES = ("Pre Enquiry", "Enquiry", "Standby", "Drop Off")
REQUIRED_STATUSES = ("Open Pre Enquiry", "Open Enquiry", "Standby", "Drop Off", "Closed")


def ensure_youth_master_data() -> None:
    """Create the Youth Stages and Youth Status records the create flows reference by name."""
    def make(doctype: str, value: str) -> None:
        if frappe.db.exists(doctype, value):
            return
        try:
            d = frappe.new_doc(doctype)
            # autoname is `field:<x>`; set that field so the record is named by its value.
            name_field = (d.meta.autoname or "").split(":", 1)[1] if ":" in (d.meta.autoname or "") else None
            target = name_field or next((x.fieldname for x in d.meta.fields
                                         if x.reqd and x.fieldtype == "Data"), None)
            if target:
                d.set(target, value)
            d.insert(ignore_permissions=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s %s: %s", doctype, value, exc)
            frappe.db.rollback()

    for stage in REQUIRED_STAGES:
        make("Youth Stages", stage)
    for status in REQUIRED_STATUSES:
        make("Youth Status", status)
    # Categories used by the counselling/event/visit flows (referenced by name in code).
    for cat in ("Counselling", "Event", "Visit"):
        make("Categories", cat)
    frappe.db.commit()


def centres() -> list[str]:
    """The synthetic centres, in a stable order. Returns: centre names."""
    return sorted(frappe.get_all("Lighthouse Centre", filters={"name": ["like", "QA %"]},
                                 pluck="name"))


def seed_youth() -> dict[str, list[str]]:
    """Create Youth records distributed across centres.

    Returns:
        Mapping of centre name -> list of Youth record names created there.
    """
    stage = "Pre Enquiry" if frappe.db.exists("Youth Stages", "Pre Enquiry") else (frappe.get_all("Youth Stages", pluck="name", limit=1) or [None])[0]
    status = "Open Pre Enquiry" if frappe.db.exists("Youth Status", "Open Pre Enquiry") else (frappe.get_all("Youth Status", pluck="name", limit=1) or [None])[0]
    by_centre: dict[str, list[str]] = {}
    n = 0
    for centre in centres():
        made = []
        for i in range(YOUTH_PER_CENTRE):
            n += 1
            word = SYNTHETIC_WORDS[i % len(SYNTHETIC_WORDS)]
            try:
                y = frappe.new_doc("Youth")
                y.naming_series = "YOUTH-"
                y.first_name = f"QA {word}"
                y.last_name = f"Youth{n:04d}"
                y.contact_no = synthetic_phone(n)
                if y.meta.has_field("lighthouse_centre"):
                    y.lighthouse_centre = centre
                # stage and status are Link fields to seeded reference doctypes, not literals.
                if y.meta.has_field("stage") and stage:
                    y.stage = stage
                if y.meta.has_field("status") and status:
                    y.status = status
                y.insert(ignore_permissions=True)
                made.append(y.name)
            except Exception as exc:  # noqa: BLE001
                logger.warning("youth %d at %s: %s", n, centre, exc)
                frappe.db.rollback()
        if made:
            by_centre[centre] = made
            frappe.db.commit()
    return by_centre


def run() -> None:
    """Seed transactional records and report the distribution."""
    frappe.flags.in_import = True
    ensure_youth_master_data()
    youth = seed_youth()
    frappe.flags.in_import = False

    total = sum(len(v) for v in youth.values())
    print(f"@@@YOUTH {total} across {len(youth)} centres")
    for centre, names in sorted(youth.items()):
        print(f"@@@  {centre:<22} {len(names)}   e.g. {names[0] if names else '-'}")

    # A manifest the probes can read to pick owner/intruder records without re-querying.
    import json
    manifest = {"youth_by_centre": youth, "generated": frappe.utils.now()}
    with open("/home/frappe/frappe-bench/sites/transactional-manifest.json", "w") as fh:
        json.dump(manifest, fh, indent=1)
    print(f"@@@manifest written")
