# Test suite

Each probe targets one dimension of transactional behaviour. Every request that would change data
passes through a guard (`probes/write-guard.cjs`) which allows writes only to the isolated stack
and refuses them to any other host.

## Probes

| Probe | Question it answers |
|---|---|
| `compare-environments` | Does the isolated stack match the platform's applications and versions? |
| `gate-probe` | Does each mutating endpoint check authorisation before acting? |
| `rbac-write-probe` | Do write-side permission boundaries hold between personas? Owner and intruder controls guard against false results. |
| `state-boundary-sweep` | Can a persona change another centre's records through the state endpoints? |
| `validation-probe` | Is invalid input rejected, and how? |
| `idempotency-probe` | Does a repeated call apply twice? |
| `lifecycle-probe` | Do create, read, update and state-change work for each object? |
| `lifecycle-syc-sm` | The same, for the Skilling Manager and Skilling Youth Coordinator objects. |
| `auto-create-probe` | A helper for discovering what a create endpoint requires. Not part of `npm test`. |

## Fixtures

`fixtures/` seeds the environment in three stages: reference data, persona accounts with disjoint
centre scopes, and transactional records. `verify_seed.py` confirms volumes, synthetic markers,
link integrity, and initial states.

## Configuration

Copy `.env.example` to `.env` and set the two URLs and the persona password. The suite reads no
other configuration.

## Safety

`probes/write-guard.cjs` refuses any request that would change data on the live platform, even
when a test host has been configured. The self-verification controls exercise that refusal on every
run, so the guard's behaviour is checked each time the suite executes.
