# Defect tracker

The findings in the format requested for the Bugs sheet: Bug Title, Steps to Reproduce, Expected
Result, Actual Result, Attachment/Screenshot Reference, plus Previous Day and Today's Report.

| File | What it is |
|---|---|
| `WeConnect-QA-Bug-Tracker.xlsx` | The workbook. Five tabs: Read Me, Bugs, Daily Report, Summary, Observations. |
| `WeConnect-QA-Bugs.csv` | The Bugs tab alone, for importing straight into Google Sheets. |
| `WeConnect-QA-Daily-Report.csv` | The daily progress tab alone. |
| `WeConnect-QA-Observations.csv` | The informational records alone. |

**Start on the Read Me tab.** It says which columns are yours to maintain, and which
columns we could not fill in and why, so you are not left guessing whether a blank is an oversight.

## Three things worth knowing before you open it

**The Bugs tab holds 79 rows, not 119.** The register has 119 entries, but 40 of them are
informational records rather than defects: context we wrote down while testing. Putting those in a
bug tracker would inflate the defect count and give you 40 rows nobody can ever close. They are on
the Observations tab instead.

**Screenshots exist for 5 defects.** Those are the ones where a screen visibly failed. The other 74
are API or source-code findings with nothing to photograph. For those the Attachment column points
at the probe output, the script that reproduces the defect, or a one-line re-check command. That is better
evidence than a picture, because you can run it.

**23 defects can be re-checked with one command.** The Re-check Command column gives it. It needs
only Node, installs nothing, and is read-only by default.

## Keeping it current

The Summary tab is formulas reading the Bugs tab, so edit Bugs and the counts follow. The pale
yellow columns — Status, Assigned To, Target Fix Date, Previous Day Status, Today's Status — are
yours. Everything else traces back to `findings/findings-log.md`, which stays the source of record.
