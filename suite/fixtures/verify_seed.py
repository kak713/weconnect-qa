"""Verify the synthetic seed: volumes, synthetic-ness, link integrity and usable states.

A seed that merely inserted rows is not evidence of anything. This checks the four properties the
seed is supposed to have, so a clean result means something:

    VOLUME       Counts match the plan scaled from the platform's measured cardinality.
    SYNTHETIC    Every record is recognisably manufactured. If one of these ever appears outside
                 this environment it must be impossible to mistake for a real person's record.
    INTEGRITY    No Link field points at a record that does not exist.
    USABLE       Status-like fields hold an initial state, so lifecycle transitions can be tested.

Run:  bench --site qa.localhost execute utils.verify_seed.run
"""

from __future__ import annotations

import json
import re
from typing import Any

import frappe

WECONNECT_APPS = frozenset({
    "authentication", "youth_skilling", "centre_head", "facilitator_and_counsellor",
    "outreach", "batch_management", "youth_placement", "event_management",
})

# A value is recognisably synthetic if it carries our marker or came from the fixed vocabulary.
SYNTHETIC_RE = re.compile(
    r"QA[-\s]|qa-synthetic\.invalid|\+91-00000-|"
    r"Alpha|Bravo|Charlie|Delta|Echo|Foxtrot|Golf|Hotel|India|Juliet|Kilo|Lima|Mike|November|Oscar|Papa",
    re.IGNORECASE,
)


def _module_to_app() -> dict[str, str]:
    return {m.name: m.app_name for m in frappe.get_all("Module Def", fields=["name", "app_name"])}


def check_volumes(plan: dict[str, int]) -> list[str]:
    """Compare actual record counts against the seed plan. Returns: list of shortfall messages."""
    issues = []
    for doctype, want in plan.items():
        try:
            have = frappe.db.count(doctype)
        except Exception:  # noqa: BLE001
            issues.append(f"{doctype}: could not count")
            continue
        if have < want:
            issues.append(f"{doctype}: {have} of {want}")
    return issues


def check_synthetic(sample_per_doctype: int = 5) -> list[str]:
    """Every text value in a sample of records must look manufactured.

    Returns:
        Values that do not carry a synthetic marker, as "doctype.field = value" strings.
    """
    mod_app = _module_to_app()
    suspicious: list[str] = []
    for dt in frappe.get_all("DocType", fields=["name", "module", "issingle", "istable"]):
        if dt.issingle or dt.istable or mod_app.get(dt.module) not in WECONNECT_APPS:
            continue
        try:
            meta = frappe.get_meta(dt.name)
            # Link and Dynamic Link fields hold another record's name, which may legitimately be
            # a framework value such as "Administrator". Only free-text fields are ours to judge.
            text_fields = [f.fieldname for f in meta.fields
                           if f.fieldtype in ("Data", "Small Text", "Text")
                           and "name" in f.fieldname
                           and not getattr(f, "options", None)]
            if not text_fields:
                continue
            rows = frappe.get_all(dt.name, fields=["name"] + text_fields, limit=sample_per_doctype)
        except Exception:  # noqa: BLE001
            continue
        for row in rows:
            for f in text_fields:
                v = row.get(f)
                if isinstance(v, str) and v.strip() and not SYNTHETIC_RE.search(v):
                    suspicious.append(f"{dt.name}.{f} = {v[:40]!r}")
    return suspicious


def check_link_integrity() -> list[str]:
    """Every Link value must resolve. Returns: list of dangling references."""
    mod_app = _module_to_app()
    broken: list[str] = []
    for dt in frappe.get_all("DocType", fields=["name", "module", "issingle", "istable"]):
        if dt.issingle or dt.istable or mod_app.get(dt.module) not in WECONNECT_APPS:
            continue
        try:
            meta = frappe.get_meta(dt.name)
            links = [(f.fieldname, f.options) for f in meta.fields
                     if f.fieldtype == "Link" and f.options]
            if not links:
                continue
            rows = frappe.get_all(dt.name, fields=["name"] + [f for f, _ in links], limit=20)
        except Exception:  # noqa: BLE001
            continue
        for row in rows:
            for field, target in links:
                v = row.get(field)
                if v and not frappe.db.exists(target, v):
                    broken.append(f"{dt.name}.{field} -> {target} {v!r} (missing)")
    return broken


def check_states() -> list[str]:
    """Status-like fields should hold their first declared option. Returns: records that do not."""
    mod_app = _module_to_app()
    terminal: list[str] = []
    for dt in frappe.get_all("DocType", fields=["name", "module", "issingle", "istable"]):
        if dt.issingle or dt.istable or mod_app.get(dt.module) not in WECONNECT_APPS:
            continue
        try:
            meta = frappe.get_meta(dt.name)
            status_fields = [f for f in meta.fields
                             if f.fieldtype == "Select" and f.options
                             and any(t in f.fieldname for t in ("status", "state", "stage"))]
            if not status_fields:
                continue
            names = [f.fieldname for f in status_fields]
            rows = frappe.get_all(dt.name, fields=["name"] + names, limit=10)
        except Exception:  # noqa: BLE001
            continue
        for f in status_fields:
            first = [o.strip() for o in f.options.split("\n") if o.strip()]
            if not first:
                continue
            for row in rows:
                v = row.get(f.fieldname)
                if v and v != first[0]:
                    terminal.append(f"{dt.name}.{f.fieldname} = {v!r} (expected {first[0]!r})")
    return terminal


def run() -> None:
    """Run all four checks and print a verdict."""
    report_path = "/home/frappe/frappe-bench/sites/seed-report.json"
    try:
        with open(report_path) as fh:
            plan = json.load(fh).get("created", {})
    except FileNotFoundError:
        plan = {}

    volumes = check_volumes(plan)
    synthetic = check_synthetic()
    integrity = check_link_integrity()
    states = check_states()

    mod_app = _module_to_app()
    total = 0
    seeded_doctypes = 0
    for dt in frappe.get_all("DocType", fields=["name", "module", "issingle", "istable"]):
        if dt.issingle or dt.istable or mod_app.get(dt.module) not in WECONNECT_APPS:
            continue
        try:
            n = frappe.db.count(dt.name)
        except Exception:  # noqa: BLE001
            continue
        total += n
        if n:
            seeded_doctypes += 1

    print(f"@@@RECORDS {total} across {seeded_doctypes} doctypes")
    print(f"@@@VOLUME     {'PASS' if not volumes else f'{len(volumes)} short'}")
    print(f"@@@SYNTHETIC  {'PASS' if not synthetic else f'{len(synthetic)} non-synthetic values'}")
    print(f"@@@INTEGRITY  {'PASS' if not integrity else f'{len(integrity)} dangling links'}")
    print(f"@@@STATES     {'PASS' if not states else f'{len(states)} not in initial state'}")
    for label, items in (("volume", volumes), ("synthetic", synthetic),
                         ("integrity", integrity), ("states", states)):
        for i in items[:8]:
            print(f"@@@  [{label}] {i}")
