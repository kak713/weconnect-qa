/**
 * Structured finding reporter.
 *
 * Addresses the client's request: each probe should emit, alongside its human-readable output,
 * a machine-readable finding per failure carrying the fields the bug tracker needs — so a run
 * produces fix-ready rows directly rather than output someone then transcribes by hand.
 *
 * A probe builds a reporter, records one finding per failing case, and calls finish(). The
 * reporter appends to suite/findings-output.json, keyed by the stable WC id where the probe
 * knows it, so repeated runs update rather than duplicate.
 *
 * The emitted shape matches the tracker columns exactly:
 *   id, title, severity, persona, steps, expected, actual, area, source(probe+timestamp)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "findings-output.json");

export function reporter(probeName) {
  const findings = [];
  return {
    /** record one failing case as a tracker-ready row */
    add({ id = "", title, severity = "S3", persona = "", area = "",
          steps, expected, actual }) {
      findings.push({
        id, title, severity, persona, area,
        steps: Array.isArray(steps) ? steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : String(steps),
        expected, actual,
        source: `${probeName} @ ${new Date().toISOString().slice(0, 19)}Z`,
      });
    },
    /** merge this probe's findings into the shared output file, replacing its previous run */
    finish() {
      let all = {};
      try { all = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { /* first run */ }
      all[probeName] = findings;
      fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
      console.log(`\n  ${findings.length} structured finding(s) written for ${probeName} -> suite/findings-output.json`);
      return findings;
    },
  };
}
