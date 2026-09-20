# Isolated environment

This builds a copy of the WeConnect 2.0 platform for transactional testing, pinned to the same
versions the live platform runs: Frappe 15.113.2, ERPNext 15.114.0 and Insights 3.12.5, on Python
3.11 and Node 22. The site binds to `127.0.0.1` only and is not reachable from outside the machine.

## Build and start

```
export GITHUB_TOKEN=<token with read access to the backend repositories>
./up.sh
```

`up.sh` clones `frappe_docker` at a pinned commit, builds the image from `apps.example.json`,
creates the site and installs the applications. It reads nothing from the live platform and writes
nothing to it. A first run takes roughly 20 minutes, almost all of it building the image.

The token is required because the eight WeConnect backend applications are in private
repositories. `up.sh` uses it only to clone them during the build.

## What you end up with

Eleven applications on the site: `frappe`, `erpnext`, `insights`, and the eight WeConnect
applications (`authentication`, `youth_skilling`, `centre_head`,
`facilitator_and_counsellor`, `outreach`, `batch_management`, `youth_placement`,
`event_management`).

The live platform runs one further application, `fintoo_analytics_bridge`, which is in none of the
foundation's repositories and so cannot be installed here. Nothing in the surface we tested depends
on it. This is recorded in the findings register, along with the question of who owns it.

You may also see module records in the live database for `hrms`, `mannlowe_support` and
`materialized_view_builder`. Those applications are not installed on the live platform either; the
records are left over from an earlier install and are recorded as a separate finding.

## Version fidelity

`suite/probes/compare-environments.mjs` compares the versions installed here against the versions
the live platform reports, so that any drift is caught before a test result is trusted. That check
needs a read-only credential for the live platform; see `suite/.env.example`.
