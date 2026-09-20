"""Build synthetic persona accounts with deliberately non-identical centre scopes.

This is the foundation for write-side access-control testing, which is the highest-value thing
Phase 2 establishes: Phase 1 proved an account can *read* counselling records outside its
permitted centres; nobody yet knows whether it can *edit or delete* them.

The platform's authorisation mechanism, read from its own source rather than assumed:

    `User Permission` rows with allow="Lighthouse Centre" scope a user to specific centres.
    `authentication.api.auth.login` collects them into `permitted_centres` in the login response.
    Endpoints then filter against that list — 94 places across 866 endpoints, applied per
    endpoint rather than enforced by the framework.

Scopes below are chosen so that some persona pairs are **fully disjoint**. A disjoint pair is what
makes a leak unambiguous: if CH (North only) can touch a record belonging to SP (East/West), that
is a boundary violation with no benign explanation.

Run:  bench --site qa.localhost execute utils.seed_personas.run
"""

from __future__ import annotations

import logging

import frappe

logger = logging.getLogger(__name__)

# Six centres across two regions, all obviously synthetic.
#
# The region split is load-bearing. A Skilling Partner's `permitted_centres` are derived from its
# REGION, not from User Permission rows — so with every centre in one region an SP would see all
# six and no disjoint pair involving SP would exist. Two regions keep the SP scope tight.
REGION_A = "QA Region Alpha"      # North, South, Central, Remote
REGION_B = "QA Region Bravo"      # East, West  -> the Skilling Partner's region

CENTRES: tuple[tuple[str, str, str], ...] = (
    ("QA North Centre",   "QAN", REGION_A),
    ("QA South Centre",   "QAS", REGION_A),
    ("QA East Centre",    "QAE", REGION_B),
    ("QA West Centre",    "QAW", REGION_B),
    ("QA Central Centre", "QAC", REGION_A),
    ("QA Remote Centre",  "QAR", REGION_A),
)

# Persona scopes. Overlapping in places, disjoint in others, deliberately.
#   ch  (North)          vs sp  (East, West)     -> fully disjoint
#   ch  (North)          vs oc  (West, Central)  -> fully disjoint
#   fc  (North, South)   vs sp  (East, West)     -> fully disjoint
#   sm  holds all six, standing in for a manager with full scope.
PERSONAS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("fc",  "Facilitator and Counsellor",   ("QA North Centre", "QA South Centre")),
    ("ch",  "Center Head",                  ("QA North Centre",)),
    ("sp",  "Skilling Partner",             ("QA East Centre", "QA West Centre")),
    ("syc", "Skilling Youth Coordinator",   ("QA South Centre", "QA East Centre")),
    ("sm",  "Skilling Manager",             tuple(c for c, _, _ in CENTRES)),
    ("oc",  "Outreach Coordinator",         ("QA West Centre", "QA Central Centre")),
)

PASSWORD = "QA-synthetic-pw-2026"
DOMAIN = "qa-synthetic.invalid"


def ensure_regions() -> None:
    """Create the two synthetic regions the centre split depends on."""
    for region in (REGION_A, REGION_B):
        if frappe.db.exists("Region", region):
            continue
        try:
            doc = frappe.new_doc("Region")
            field = "region_name" if doc.meta.has_field("region_name") else "region"
            doc.set(field, region)
            doc.insert(ignore_permissions=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("region %s: %s", region, exc)
            frappe.db.rollback()
    frappe.db.commit()


def ensure_centres() -> list[str]:
    """Create the synthetic centres, each in its designated region. Returns: their names."""
    ensure_regions()
    made = []
    for centre_name, abbr, region in CENTRES:
        if frappe.db.exists("Lighthouse Centre", centre_name):
            made.append(centre_name)
            continue
        try:
            doc = frappe.new_doc("Lighthouse Centre")
            doc.centre_name = centre_name
            doc.abbr = abbr
            if doc.meta.has_field("region") and frappe.db.exists("Region", region):
                doc.region = region
            doc.insert(ignore_permissions=True)
            made.append(doc.name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("centre %s: %s", centre_name, exc)
            frappe.db.rollback()
    frappe.db.commit()
    return made


# Roles granted to every persona profile.
#
# `System Manager` is here because the platform leaves no alternative: of 293 WeConnect doctypes,
# 178 grant permissions to `System Manager` alone and 115 grant none, so there is no
# lesser role that permits a persona to work with the data. That is recorded as a finding in its
# own right — the design forces over-privileged accounts or none at all.
#
# The consequence for testing must be stated plainly: framework-level permission cannot be
# meaningfully tested with these accounts, because `System Manager` passes every such check. What
# these personas DO test faithfully is the platform's own scope filtering — `permitted_centres`
# and `Employee.custom_center` — which is where the S1 occurred and which is applied in
# application code regardless of role.
PROFILE_ROLES: tuple[str, ...] = ("System Manager", "Projects User", "Employee")

# The application code branches on membership in these named roles (e.g. `"Skilling Partner" in
# user_roles`), but ships no Role records for them. They must exist and be held for role-gated logic
# to run as it does in production. Recorded as a finding; created here so tests are faithful.
PERSONA_ROLES: tuple[str, ...] = (
    "Skilling Partner", "Skilling Manager", "Center Head", "Centre Head",
    "Facilitator and Counsellor", "Outreach Coordinator", "Skilling Youth Coordinator", "Trainer",
)


def ensure_role_profiles() -> list[str]:
    """Create Role Profiles with the exact names the application code branches on.

    The applications ship no Role or Role Profile records, so these are constructed. The names
    matter: `auth.py` compares `role_profile_name` against them directly.

    Assigning `role_profile_name` to a user makes Frappe manage that user's roles FROM the profile.
    An empty profile therefore strips the user down to `All` and `Guest`, and every endpoint that
    calls `frappe.has_permission` then refuses them. The roles below must exist on the profile for
    the personas to function at all.

    Returns:
        Names of the role profiles now present.
    """
    # Create the persona-named roles the code checks for.
    for role in PERSONA_ROLES:
        if not frappe.db.exists("Role", role):
            try:
                frappe.get_doc({"doctype": "Role", "role_name": role}).insert(ignore_permissions=True)
            except Exception as exc:  # noqa: BLE001
                logger.warning("role %s: %s", role, exc)
                frappe.db.rollback()
    frappe.db.commit()

    made = []
    for _, profile, _ in PERSONAS:
        try:
            if frappe.db.exists("Role Profile", profile):
                doc = frappe.get_doc("Role Profile", profile)
            else:
                doc = frappe.new_doc("Role Profile")
                doc.role_profile = profile
            have = {r.role for r in (doc.get("roles") or [])}
            # The profile's own name is also a role the code checks for.
            for role in (*PROFILE_ROLES, profile):
                if role not in have and frappe.db.exists("Role", role):
                    doc.append("roles", {"role": role})
            doc.save(ignore_permissions=True) if doc.get("name") else doc.insert(ignore_permissions=True)
            made.append(profile)
        except Exception as exc:  # noqa: BLE001
            logger.warning("role profile %s: %s", profile, exc)
            frappe.db.rollback()
    frappe.db.commit()
    return made


def apply_profile_roles(email: str, profile: str) -> list[str]:
    """Ensure a user actually holds the roles their role profile carries.

    Frappe syncs a user's roles from `role_profile_name` when the user is saved. A user created
    before the profile had roles keeps the roles it had at the time — which is none, leaving it
    with only `All` and `Guest`, and refused by every endpoint that calls `has_permission`.
    Re-applying is therefore not optional, and must happen after the profile is populated.

    Args:
        email: The user to update.
        profile: The role profile to apply.

    Returns:
        The roles the user holds afterwards, excluding the implicit `All` and `Guest`.
    """
    try:
        user = frappe.get_doc("User", email)
        if user.meta.has_field("role_profile_name"):
            user.role_profile_name = profile
        # Assign directly as well: the profile sync is the mechanism, this is the guarantee.
        existing = {r.role for r in (user.get("roles") or [])}
        for role in (*PROFILE_ROLES, profile):
            if role not in existing and frappe.db.exists("Role", role):
                user.append("roles", {"role": role})
        user.save(ignore_permissions=True)
        frappe.db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("roles for %s: %s", email, exc)
        frappe.db.rollback()
    return sorted(r for r in frappe.get_roles(email) if r not in ("All", "Guest"))


def ensure_user(key: str, profile: str) -> str | None:
    """Create one persona user. Returns: the user's email, or None on failure."""
    email = f"qa.{key}@{DOMAIN}"
    if frappe.db.exists("User", email):
        return email
    try:
        user = frappe.new_doc("User")
        user.email = email
        user.first_name = f"QA {key.upper()} Persona"
        user.send_welcome_email = 0
        user.enabled = 1
        user.new_password = PASSWORD
        if user.meta.has_field("role_profile_name"):
            user.role_profile_name = profile
        user.insert(ignore_permissions=True)
        # Roles come from the role profile; assigning them directly here would be overwritten.
        # Re-saving the user applies the profile's roles.
        user.reload()
        if user.meta.has_field("role_profile_name") and not frappe.get_roles(email):
            user.role_profile_name = profile
            user.save(ignore_permissions=True)
        frappe.db.commit()
        return email
    except Exception as exc:  # noqa: BLE001
        logger.warning("user %s: %s", email, exc)
        frappe.db.rollback()
        return None


def scope_user(email: str, centres: tuple[str, ...]) -> int:
    """Grant a user access to exactly the named centres. Returns: permissions created."""
    made = 0
    for centre in centres:
        if frappe.db.exists("User Permission",
                            {"user": email, "allow": "Lighthouse Centre", "for_value": centre}):
            continue
        try:
            frappe.get_doc({
                "doctype": "User Permission", "user": email,
                "allow": "Lighthouse Centre", "for_value": centre,
                "apply_to_all_doctypes": 1,
            }).insert(ignore_permissions=True)
            made += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("permission %s -> %s: %s", email, centre, exc)
            frappe.db.rollback()
    frappe.db.commit()
    return made


def ensure_skilling_partner(email: str, centres: tuple[str, ...]) -> str | None:
    """Link the SP persona's e-mail to a Skilling Partner record.

    The Skilling Partner login path is deliberately different: `auth.py` refuses the login outright
    unless the address resolves to a partner, via `partner_email_id` or a trainer row. Its
    `permitted_centres` are then derived from the partner's region rather than from User Permission
    records. This is correct platform behaviour, not a defect, and the isolated instance reproduces
    it — which is itself evidence the environment is faithful.

    Args:
        email: The SP persona's login address.
        centres: Centres the partner should cover, used to pick a consistent region.

    Returns:
        The Skilling Partner record name, or None.
    """
    existing = frappe.get_all("Skilling Partner", filters={"partner_email_id": email}, pluck="name")
    if existing:
        return existing[0]
    # The partner's region determines its permitted_centres, so it must be the region holding
    # exactly the centres this persona should see.
    region = frappe.db.get_value("Lighthouse Centre", centres[0], "region") if centres else None
    region = region or REGION_B
    try:
        doc = frappe.new_doc("Skilling Partner")
        doc.third_party_center = "QA Synthetic Partner"
        doc.partner_email_id = email
        # `lighthouse_centre` is a CHILD TABLE, not a Link, despite reading as a single value in
        # the mandatory-field list. Assigning a string to it makes Frappe fail deep inside
        # `set_user_and_timestamp` with "'str' object has no attribute 'modified'", which gives no
        # hint of the real cause. One row per centre the partner covers.
        for centre in centres:
            doc.append("lighthouse_centre", {"lighthouse_centre": centre})
        if doc.meta.has_field("region"):
            doc.region = region
        if doc.meta.has_field("partner_type"):
            doc.partner_type = "Internal"
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return doc.name
    except Exception as exc:  # noqa: BLE001
        logger.warning("skilling partner: %s", exc)
        frappe.db.rollback()
        return None


def ensure_company() -> str | None:
    """Create a Company, which Employee is mandatory on. Returns: its name.

    Creating a Company makes ERPNext build a default warehouse tree, which links to
    `Warehouse Type: Transit`. That record is produced by ERPNext's setup wizard, which
    `bench install-app` does not run, so it is created here first. Without it the Company insert
    fails with `Could not find Warehouse Type: Transit` — an error that names a concept this
    platform never uses.
    """
    existing = frappe.get_all("Company", pluck="name", limit=1)
    if existing:
        return existing[0]
    for wt in ("Transit",):
        if not frappe.db.exists("Warehouse Type", wt):
            try:
                frappe.get_doc({"doctype": "Warehouse Type", "name": wt}).insert(ignore_permissions=True)
                frappe.db.commit()
            except Exception as exc:  # noqa: BLE001
                logger.warning("warehouse type %s: %s", wt, exc)
                frappe.db.rollback()

    # `batch_management` adds `custom_abbr` to Cost Center as mandatory with no default. ERPNext
    # creates a Cost Center automatically when a Company is created and knows nothing about that
    # field, so the Company insert fails. Recorded as a defect in its own right; relaxed here only
    # long enough to build the synthetic Company, then restored so the environment continues to
    # match the client's configuration.
    relaxed = False
    cf = frappe.db.exists("Custom Field", {"dt": "Cost Center", "fieldname": "custom_abbr"})
    if cf and frappe.db.get_value("Custom Field", cf, "reqd"):
        frappe.db.set_value("Custom Field", cf, "reqd", 0)
        frappe.clear_cache(doctype="Cost Center")
        frappe.db.commit()
        relaxed = True

    try:
        doc = frappe.get_doc({
            "doctype": "Company", "company_name": "QA Synthetic Foundation",
            "abbr": "QASF", "default_currency": "INR", "country": "India",
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return doc.name
    except Exception as exc:  # noqa: BLE001
        logger.warning("company: %s", exc)
        frappe.db.rollback()
        return None
    finally:
        if relaxed:
            frappe.db.set_value("Custom Field", cf, "reqd", 1)
            frappe.clear_cache(doctype="Cost Center")
            frappe.db.commit()


def ensure_employee(email: str, key: str, centre: str, company: str | None) -> str | None:
    """Create an Employee for a persona, scoped to one centre.

    This is a SECOND, independent centre-scoping mechanism. Reads resolve scope from
    `permitted_centres`, built from User Permission rows (89 references in the codebase). Several
    write paths instead read `Employee.custom_center` for the session user (58 references) — see
    `outreach.apis.task.task.create_task`, which derives `lh_center` that way. The two can
    disagree, which is recorded as a finding in its own right.

    Both are populated here so a persona behaves consistently whichever mechanism an endpoint uses.

    Args:
        email: The persona user's address.
        key: Short persona key, for a recognisable name.
        centre: The centre to scope the employee to.
        company: Company the employee belongs to.

    Returns:
        The Employee record name, or None.
    """
    existing = frappe.get_all("Employee", filters={"user_id": email}, pluck="name")
    if existing:
        return existing[0]
    try:
        doc = frappe.new_doc("Employee")
        doc.first_name = f"QA {key.upper()} Employee"
        doc.gender = (frappe.get_all("Gender", pluck="name") or ["Other"])[0]
        doc.date_of_birth = "1995-01-01"
        doc.date_of_joining = "2026-01-01"
        doc.status = "Active"
        doc.company = company
        doc.user_id = email
        if doc.meta.has_field("custom_center"):
            doc.custom_center = centre
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        return doc.name
    except Exception as exc:  # noqa: BLE001
        logger.warning("employee %s: %s", email, exc)
        frappe.db.rollback()
        return None


def run() -> None:
    """Build centres, role profiles, users and their centre scopes."""
    centres = ensure_centres()
    profiles = ensure_role_profiles()
    company = ensure_company()
    print(f"@@@centres: {len(centres)}   role profiles: {len(profiles)}   company: {company}")

    rows = []
    for key, profile, scope in PERSONAS:
        email = ensure_user(key, profile)
        if not email:
            rows.append((key, "FAILED", profile, 0, 0))
            continue
        roles = apply_profile_roles(email, profile)
        if not roles:
            logger.warning("%s holds no roles; endpoints calling has_permission will refuse it", key)
        n = scope_user(email, scope)
        # The employee's centre is the persona's FIRST centre, so the two scoping mechanisms
        # agree on at least one value and disagree on none.
        ensure_employee(email, key, scope[0] if scope else None, company)
        if key == "sp":
            partner = ensure_skilling_partner(email, scope)
            if not partner:
                logger.warning("SP persona will fail to log in without a partner record")
        rows.append((key, email, profile, len(scope), len(roles)))

    print("@@@persona  email                              role profile                  centres roles")
    for key, email, profile, n, nroles in rows:
        print(f"@@@  {key:<6} {email:<34} {profile:<29} {n:<7} {nroles}")

    # Disjoint pairs are what make a leak unambiguous; name them for the test suite.
    print("@@@")
    print("@@@fully disjoint persona pairs (for boundary testing):")
    scopes = {k: set(s) for k, _, s in PERSONAS}
    for a in scopes:
        for b in scopes:
            if a < b and not (scopes[a] & scopes[b]):
                print(f"@@@   {a} x {b}   {sorted(scopes[a])} vs {sorted(scopes[b])}")
