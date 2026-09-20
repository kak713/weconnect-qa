/**
 * S1 — cross-centre batch close.
 *
 * A user permitted only for East and West centres closes a batch owned by North Centre.
 * Expected after fix: the call is refused and the batch is unchanged (exit 0).
 * Before fix: the call succeeds and the batch is closed (exit 1).
 *
 * Prerequisite: `npm run seed` in ../suite, and a North-owned Skilling Batch (BATCH_ID below,
 * or set S1_BATCH_ID in the environment).
 */
import { login, callMethod, report } from "./lib.mjs";

const BATCH_ID = process.env.S1_BATCH_ID;
if (!BATCH_ID) { console.error("Set S1_BATCH_ID to a North-owned Skilling Batch id."); process.exit(2); }

const intruder = await login("sp"); // permitted East/West only
const r = await callMethod("youth_skilling.api.batch_management.close_batch", "POST", intruder.auth, {
  batch_id: BATCH_ID, short_remarks: "boundary reproduction",
});
report(
  "close_batch across a permission boundary",
  r.succeeded,
  `intruder centres: ${intruder.centres.join("/")} — target batch: ${BATCH_ID} (North) — response: ${r.text.slice(0, 90)}`,
);
