/**
 * S1 — cross-centre financial write.
 *
 * A user permitted only for East and West centres raises a Skilling Invoice owned by North Centre,
 * advancing it into the approval pipeline.
 * Expected after fix: refused, the invoice unchanged (exit 0). Before fix: raised (exit 1).
 *
 * Prerequisite: `npm run seed`, and a North-owned Skilling Invoice (set S1_INVOICE_ID, S1_BATCH_ID).
 */
import { login, callMethod, report } from "./lib.mjs";

const INVOICE_ID = process.env.S1_INVOICE_ID, BATCH_ID = process.env.S1_BATCH_ID;
if (!INVOICE_ID || !BATCH_ID) { console.error("Set S1_INVOICE_ID and S1_BATCH_ID."); process.exit(2); }

const intruder = await login("sp");
const r = await callMethod("youth_skilling.api.invoice.raise_invoice", "PUT", intruder.auth, {
  invoice_id: INVOICE_ID, batch_id: BATCH_ID, center: "QA North Centre", installment: "1",
  remarks: "boundary reproduction",
});
report(
  "raise_invoice across a permission boundary",
  r.succeeded,
  `intruder centres: ${intruder.centres.join("/")} — target invoice: ${INVOICE_ID} (North) — response: ${r.text.slice(0, 90)}`,
);
