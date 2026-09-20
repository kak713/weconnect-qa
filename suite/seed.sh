#!/usr/bin/env bash
# Seed the isolated environment and extract the fixtures manifest.
#
# The seeders are copied inside the `frappe` package so `bench execute` can import them by a
# real dotted path — bench does not put the bench root or sites/ on sys.path, so a top-level
# `fixtures.*` module is not importable.
set -euo pipefail
cd "$(dirname "$0")"

SITE=qa.localhost
PKG=/home/frappe/frappe-bench/apps/frappe/frappe/qa_fixtures
DC="docker compose -f ../environment/compose.yaml"

exec_py() { $DC exec -T backend bench --site "$SITE" execute "frappe.qa_fixtures.$1"; }

$DC exec -T backend mkdir -p "$PKG"
$DC cp fixtures/. "backend:$PKG/"
$DC exec -T backend touch "$PKG/__init__.py"

exec_py seed_synthetic.run
exec_py seed_personas.run
exec_py seed_transactional.run
exec_py build_fixtures.run
exec_py verify_seed.run

# Extract the manifest the probes read.
$DC cp backend:/home/frappe/frappe-bench/sites/fixtures.json ./fixtures.json
echo "Seeded. Manifest at suite/fixtures.json."
