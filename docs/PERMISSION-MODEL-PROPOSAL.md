# WeConnect 2.0 — Proposed Permission Model

**Version:** 1.0 · **Date:** 2026-09-25
**Status:** a draft for you to correct, not a specification

---

## What this is

Finding `WC-073` says your permission model does not exist: of 293 doctypes, **178 grant
`System Manager` alone, 115 grant nothing, and none grants any other role**. That forces every staff
account to hold `System Manager`, and application code then treats that role as "no restriction" at
45 sites. It is the reason the three S1 breaches cannot be closed.

We had reported that as a problem without proposing a solution. This is the proposal. It is derived
from what each persona's application demonstrably calls, not from assumptions about your programme.

**Correct it rather than adopt it.** We know what the software does; you know how your centres work.

## Two facts that make this smaller than it looks

**Only 176 doctypes need entries, not 293.** 117 of them are child tables, and Frappe
resolves a child table's permissions through its parent. They never need their own rules.

**Centre scoping is already solved and should not be rebuilt here.** `User Permission` records
against `Lighthouse Centre` already restrict *which records* a user sees. This matrix answers a
different question — *which doctypes* a role may touch at all. The two compose: role permissions
decide the doctype, user permissions decide the rows. Finding `WC-105` is about application code
skipping the second; this matrix is about supplying the first.

## How we derived it

We counted the endpoints each persona's application actually calls, grouped by the application that
owns them:

| Persona | Calls into |
|---|---|
| Outreach Coordinator | outreach 33 · centre_head 3 · batch_management 3 |
| Center Head | centre_head 66 · batch_management 30 · outreach 3 |
| Facilitator and Counsellor | batch_management 18 · facilitator_and_counsellor 12 · youth_skilling 3 · centre_head 3 · outreach 3 |
| Skilling Youth Coordinator | youth_skilling 39 · outreach 15 · batch_management 3 |
| Skilling Partner | youth_skilling 48 · batch_management 9 |
| Skilling Manager | youth_skilling 72 · outreach 12 · batch_management 9 |

The rule applied: a persona's **busiest** application is where it does its work, so it gets create,
read, write and delete there. Applications it calls into less are supporting reads, so it gets read,
plus write where the traffic is substantial enough to imply it edits rather than looks.

**One place we overrode the counts.** Facilitator and Counsellor calls `batch_management` more often
(18) than its own `facilitator_and_counsellor` application (12), which would have made batch
management its home. That is an artefact of counting calls rather than ownership — attendance and
batch screens are simply chattier than counselling forms. We gave FC full rights over its own
application and write rights over batch management. If the counts are telling us something real
about how Facilitators actually work, say so and we will put it back.

## The matrix

`C` create · `R` read · `W` write · `D` delete · `—` no access

| Application | Top-level doctypes | OC | CH | FC | SYC | SP | SM |
|---|---|---|---|---|---|---|---|
| `authentication` | 4 | — | — | — | — | — | — |
| `outreach` | 40 | CRUD | R | R | RW | — | RW |
| `centre_head` | 28 | R | CRUD | R | — | — | — |
| `facilitator_and_counsellor` | 18 | — | — | CRUD | — | — | — |
| `youth_skilling` | 33 | — | — | R | CRUD | CRUD | CRUD |
| `batch_management` | 30 | R | RW | RW | R | RW | RW |
| `youth_placement` | 20 | — | — | — | — | — | — |
| `event_management` | 3 | — | — | — | — | — | — |

**`authentication`, `youth_placement` and `event_management` show no persona traffic in our
captures.** `youth_placement` belongs to Placement Manager, which you deferred from scope.
`authentication` is the login path and needs no per-persona grant. `event_management` was called by
nobody — worth asking whether it is live at all.

## What we could not determine, and will not guess

- **Delete.** We have granted `D` only on each persona's primary application. Deletion is
  destructive and irreversible, and `WC-097` shows batch deletion performs no dependent-record
  check. Our instinct is that very few roles should hold `D` at all. This is a decision for you.
- **Skilling Manager as oversight.** SM's traffic is heavily `youth_skilling`, but the name suggests
  a supervisory role that may need read across every application. If that is right, give SM `R`
  everywhere and tell us.
- **Whether Skilling Partner is external.** SP is an external training provider. If so, its access
  should be narrower than this matrix gives it, and `WC-115` — an external partner triggering a bulk
  export of programme data — becomes more serious rather than less.
- **The 115 doctypes granting nothing.** Some are certainly internal plumbing that no role should
  reach. We have not separated those from the ones that were simply never configured.

## How to apply it

Frappe stores these as `DocPerm` rows against each doctype, and they export as app fixtures — which
also closes `WC-069`, that the permission model exists in no repository. Doing it as fixtures means
the model is versioned with the code and survives a rebuild, rather than living only in a database
someone configured by hand.

**Do not remove `System Manager` from staff accounts until this is in place.** `WC-073` and `WC-105`
have to move together: strip the role first and every account loses access, because there is
currently nothing else granting anything.
