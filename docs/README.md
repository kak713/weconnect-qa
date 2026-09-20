# Documents

The written record of the engagement. The report is the summary; the rest is the detail behind it.

| Document | What it is | Who it is for |
|---|---|---|
| `engagement-report.pdf` | Summary of Phases 1 and 2: what was found, what it means, and what is needed next. Start here. | Anyone |
| `CHARACTERISATION.md` | **Part 1 is what we need from you** — two questions, seven confirmations, and the sign-off, in about ten minutes. The rest is the reference baseline: what the platform actually does. | Whoever can decide how the platform is meant to behave |
| `DEFINITION-OF-DONE.md` | The standard each phase is measured against, agreed at the start. | Anyone checking our claims |
| `PHASE-1-CLOSURE-REPORT.md` | Read-only testing: coverage, method, results, exit criteria. | Technical reader |
| `PHASE-2-CLOSURE-REPORT.md` | Transactional testing: the same, for write behaviour. | Technical reader |
| `PERMISSION-MODEL-PROPOSAL.md` | A draft permission matrix for the model that WC-073 says does not exist. Derived from what each persona's application actually calls. **Correct it rather than adopt it.** | Whoever owns the platform's architecture |
| `TIMELINE.md` | What has happened, what is left, and what each remaining item depends on. | Anyone planning the work |
| `BROWSERSTACK-RECOMMENDATION.md` | What to buy for cross-browser testing in Phase 3, and what not to. | Whoever holds the budget |
| `WORKING-DOCUMENT.md` | The running record of the engagement, updated as work completed. Every figure in the other documents traces back to an entry here. | Reference |

The findings themselves are in `../findings/`. The summary is in `../findings/README.md` and the
full register, with evidence and a suggested fix for every item, is in
`../findings/findings-log.md`.

## Why the characterisation document matters most

WeConnect 2.0 has no written functional specification. An automated test has to assert something,
and with no specification every assertion is a guess about what correct behaviour looks like. If a
guess is wrong, the defect becomes the expected result and the suite protects it.

The characterisation document records what the platform does today, so that you can tell us which
of those behaviours are intended. Once you have confirmed it, it becomes the baseline the tests are
written against. Until then we can tell you whether the platform behaves the same way each time,
but we cannot tell you whether that behaviour is what you wanted.

## A note on the report and the Markdown files

`engagement-report.pdf` is typeset and is the version to circulate. The Markdown files are plain
text so they can be read in a browser, converted, or pasted into whatever system you use.
