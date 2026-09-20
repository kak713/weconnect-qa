"""Extract authoritative DocType field definitions from an isolated Frappe instance.

Phase 2 needs the request shape of 103 mutating endpoints. Two ways to get them:
reverse-engineer 102 forms through the UI, or read the schema that defines them. Frappe is
schema-driven, so the second is both exact and cheap -- which is why the feasibility spike was
sequenced ahead of payload capture.

Runs INSIDE the container, via `bench --site <site> execute`. It reads only metadata: field
names, types, options and validation rules. No record data is touched.

Output: data/doctype-schemas.json, keyed by doctype.
"""

from __future__ import annotations

import json
import logging

import frappe

logger = logging.getLogger(__name__)

# Field properties that constrain what a valid payload looks like. Anything not here is
# presentation and does not affect the request.
RELEVANT = (
    "fieldname", "fieldtype", "label", "options", "reqd", "unique",
    "default", "read_only", "hidden", "depends_on", "mandatory_depends_on",
    "precision", "length", "in_list_view",
)

# The apps whose doctypes Phase 2 exercises. Framework doctypes are excluded: they are not
# what the personas create or edit.
WECONNECT_APPS = (
    "authentication", "youth_skilling", "centre_head", "facilitator_and_counsellor",
    "outreach", "batch_management", "youth_placement", "event_management",
)


def module_to_app() -> dict[str, str]:
    """Map each module name to the app that provides it. (M,) modules."""
    return {
        m.name: m.app_name
        for m in frappe.get_all("Module Def", fields=["name", "app_name"])
    }


def extract() -> dict[str, dict]:
    """Field definitions for every WeConnect doctype, keyed by doctype name."""
    mod_app = module_to_app()
    out: dict[str, dict] = {}

    for dt in frappe.get_all("DocType", fields=["name", "module", "issingle", "istable"]):
        app = mod_app.get(dt.module)
        if app not in WECONNECT_APPS:
            continue
        try:
            meta = frappe.get_meta(dt.name)
        except Exception:
            logger.warning("could not load meta for %s", dt.name)
            continue

        fields = []
        for f in meta.fields:
            d = {k: getattr(f, k, None) for k in RELEVANT}
            fields.append({k: v for k, v in d.items() if v not in (None, "", 0)})

        out[dt.name] = {
            "app": app,
            "module": dt.module,
            "is_single": bool(dt.issingle),
            "is_child_table": bool(dt.istable),
            "autoname": meta.autoname,
            "naming_series": getattr(meta, "naming_series", None),
            "title_field": meta.title_field,
            "mandatory": [f["fieldname"] for f in fields if f.get("reqd")],
            "links": [
                {"field": f["fieldname"], "to": f["options"]}
                for f in fields
                if f.get("fieldtype") == "Link" and f.get("options")
            ],
            "child_tables": [
                {"field": f["fieldname"], "doctype": f["options"]}
                for f in fields
                if f.get("fieldtype") in ("Table", "Table MultiSelect") and f.get("options")
            ],
            "fields": fields,
        }
    return out


def run() -> None:
    """Entry point for `bench execute`."""
    schemas = extract()
    path = "/home/frappe/frappe-bench/sites/doctype-schemas.json"
    with open(path, "w") as fh:
        json.dump(schemas, fh, indent=1, default=str)

    mandatory = sum(len(v["mandatory"]) for v in schemas.values())
    tables = sum(len(v["child_tables"]) for v in schemas.values())
    by_app: dict[str, int] = {}
    for v in schemas.values():
        by_app[v["app"]] = by_app.get(v["app"], 0) + 1

    print(f"extracted {len(schemas)} doctypes -> {path}")
    print(f"  mandatory fields: {mandatory}   child tables: {tables}")
    for app, n in sorted(by_app.items(), key=lambda kv: -kv[1]):
        print(f"    {app:<32} {n}")
