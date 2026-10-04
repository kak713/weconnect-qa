# Defect tracker

The findings recorded in the requested format: Bug Title, Steps to Reproduce, Expected Result,
Actual Result and Attachment/Screenshot Reference, with daily progress on a separate tab.

| File | Contents |
|---|---|
| `WeConnect-QA-Bug-Tracker.xlsx` | The workbook. Tabs: Read Me, Bugs, Daily Report, Summary, Observations. |
| `WeConnect-QA-Bugs.csv` | The Bugs tab alone, for import into Google Sheets. |
| `WeConnect-QA-Daily-Report.csv` | The Daily Report tab alone. |
| `WeConnect-QA-Observations.csv` | The Observations tab alone. |

The Read Me tab carries the column reference, the coverage notes, and the outstanding items.

## Scope of the Bugs tab

The tab holds **79 defects**. The findings register contains 119 entries, of which 40 are
informational records rather than defects. Those are on the Observations tab, since they cannot be
assigned or closed and would otherwise distort the defect count.

## Evidence

Screen captures exist for 5 defects, being those where a visible screen failed. The remaining 74
are API-level or source-level findings. Each cites the probe output, the script that reproduces it,
or a re-check command. Twenty-three carry a command that re-verifies the defect in one line.

## Maintenance

Status, Assigned To, Target Fix Date, Previous Day Status and Today's Status are shaded pale yellow
and are maintained by Lighthouse. The Summary tab is formula-driven over the Bugs tab and updates
when it is edited. `findings/findings-log.md` remains the source of record for every entry.
