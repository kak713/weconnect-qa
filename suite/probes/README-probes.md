# Probes

Each probe is runnable on its own. The `.mjs` probes drive the HTTP API; the `.py` probes run
inside the backend container against the ORM, which is where a constraint shared by every write
path would live.

| Probe | What it answers |
|---|---|
| `gate-probe.mjs` | Which mutating endpoints perform no authorisation check |
| `rbac-write-probe.mjs` | Whether a persona can write another centre's records |
| `state-boundary-sweep.mjs` | Whether state-changing endpoints respect the centre boundary |
| `validation-probe.mjs` | How endpoints respond to input of the wrong class |
| `idempotency-probe.mjs` | Whether repeating a call repeats its effect |
| `lifecycle-probe.mjs`, `lifecycle-syc-sm.mjs` | Create/read/update/state-change per business object |
| `mass-assignment-probe.mjs` | Whether an endpoint writes fields it never declares |
| `chained-boundary-probe.mjs` | An undeclared *and* invalid value reaching the database via the API |
| `mass_assignment_scan.py` | Static sweep: every endpoint passing request data into a document write |
| `boundary_probe.py` | Whether self-contradictory values are stored |
| `state_transition_probe.py` | The full status transition matrix per doctype |

**The `.py` probes write and roll back.** They are for the disposable environment only. Run them
from inside the backend container:

```
docker cp probes/boundary_probe.py <backend-container>:/tmp/
docker exec -w /home/frappe/frappe-bench/sites <backend-container> \
  /home/frappe/frappe-bench/env/bin/python /tmp/boundary_probe.py
```

`mass-assignment-probe.mjs` and `chained-boundary-probe.mjs` need `_getfield.py` copied to
`/tmp/getfield.py` in that container first; they read the database directly so that a result is
never an API read that might itself be filtered.
