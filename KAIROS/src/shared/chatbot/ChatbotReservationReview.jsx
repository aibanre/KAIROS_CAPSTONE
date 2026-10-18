import { Link } from "react-router-dom";
import ReservationLimitNotice from "../ReservationLimitNotice.jsx";
import formatCurrency from "../../customer/utils/formatCurrency";

export default function ChatbotReservationReview({
  proposal,
  paymentReservationId,
  confirming = false,
  error = "",
  existingHolds = [],
  onConfirm,
}) {
  if (!proposal && !paymentReservationId && !error && !existingHolds.length) return null;

  const summary = proposal?.summary;
  return (
    <section className="rounded-xl border border-sky-200 bg-white p-4 text-sm shadow-sm" aria-label="Reservation confirmation">
      {paymentReservationId ? <>
        <p className="font-bold text-emerald-800">Your 15-minute reservation hold is ready.</p>
        <p className="mt-1 text-xs text-slate-600">Complete payment before the hold expires.</p>
        <Link to={`/portal/payment/${paymentReservationId}`} className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 font-bold text-white hover:bg-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Continue to payment</Link>
      </> : proposal ? <>
        <p className="font-bold text-slate-900">Please review your booking before confirming</p>
        <p className="mt-2 text-slate-700">{summary.resource_name}{summary.package_name ? ` — ${summary.package_name}` : ""}</p>
        {summary.check_in
          ? <p className="mt-1 text-slate-600">{summary.check_in} to {summary.check_out} · {summary.nights} night{summary.nights === 1 ? "" : "s"}</p>
          : <p className="mt-1 text-slate-600">{summary.event_date} · {summary.start_time} to {summary.end_time}</p>}
        <p className="mt-1 text-slate-600">{summary.guests ?? summary.pax} guest{Number(summary.guests ?? summary.pax) === 1 ? "" : "s"}{summary.children ? `, ${summary.children} child${summary.children === 1 ? "" : "ren"}` : ""}</p>
        <p className="mt-2 font-bold text-slate-900">Total: {formatCurrency(summary.total)}</p>
        <p className="mt-1 text-slate-700">50% deposit: {formatCurrency(summary.deposit_due)}</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">No reservation is held yet. Confirm to create a 15-minute hold. Availability will be checked again.</p>
        <button type="button" onClick={onConfirm} disabled={confirming} className="mt-3 w-full rounded-lg bg-accent px-4 py-2.5 font-bold text-navy hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          {confirming ? "Creating your hold…" : "Confirm reservation"}
        </button>
      </> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">{error}</p> : null}
      <ReservationLimitNotice holds={existingHolds} portal />
    </section>
  );
}
