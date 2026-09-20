# Verification

Re-checks findings and reports which are fixed. Every check names the finding it belongs to, so a
result maps straight back to the register.

```
node run.mjs                               read-only checks against the deployed system
node run.mjs --source <bench>/apps         also read the application sources
node run.mjs --only WC-121,WC-088          just these findings
node run.mjs --api https://… --app https://…
```

Node alone runs it. There is nothing to install.

## What each mode needs, and what it is safe against

| Mode | Needs | Safe to run against |
|---|---|---|
| read-only | a URL | anything, production included — it issues only GET and OPTIONS |
| source | a checkout of the backend apps | anything; it reads files and starts nothing |
| write-based | a disposable instance | **only** a throwaway environment |

The write-based probes are not run by this tool. It lists them and leaves them to you, because they
change data. They live in `../suite/probes/`.

## Reading the output

- `FIXED` — the check no longer finds the defect.
- `present` — the defect is still there; the detail says what was found.
- `ERROR` — the check could not run. **This is never a pass.** A source check pointed at the wrong
  directory reports an error rather than silently reporting every finding as fixed.

The exit code is non-zero while any checked finding is still present, so this can gate a pipeline.

## What it does not tell you

It covers the findings that can be checked mechanically, not all 119. A `FIXED` here means that
specific check no longer detects the defect — it is not a statement that the underlying weakness is
fully remediated. The register entry remains the description of record.
