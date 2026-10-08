import { CheckCircle2 } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { useBooking } from "../context/BookingContext";
import { formatDateRange } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";

export default function BookingConfirmationPage() {
  const { reservationId } = useParams();
  const { getReservation } = useBooking();
  const reservation = getReservation(reservationId);
  if (!reservation) return <Navigate to="/portal/reservations" replace />;
  const pattern = Array.from({ length: 64 }, (_, index) => ((index * 7 + reservation.reference.charCodeAt(index % reservation.reference.length)) % 5) < 2);

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-5 text-center shadow-soft sm:rounded-3xl sm:p-10">
        <CheckCircle2 className="mx-auto text-emerald-600" size={60} />
        <p className="eyebrow mt-5">Proof submitted</p><h1 className="font-serif text-3xl font-bold text-navy sm:text-4xl">Your reservation is taking shape.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate sm:text-base">We will verify your proof and update the reservation status. You can follow every step from My Reservations.</p>
        <div className="mx-auto mt-7 grid size-36 grid-cols-8 gap-1 rounded-2xl bg-white p-3 ring-8 ring-tint sm:size-40">{pattern.map((active, index) => <span key={index} className={active ? "bg-navy" : "bg-white"} />)}</div>
        <p className="mt-7 text-xs font-bold uppercase tracking-widest text-slate">Reference number</p><p className="mt-1 font-mono text-2xl font-black text-primary">{reservation.reference}</p>
        <dl className="mx-auto mt-7 max-w-md divide-y divide-border rounded-2xl border border-border px-5 text-left text-sm"><div className="flex justify-between gap-4 py-4"><dt className="text-slate">Reservation</dt><dd className="font-bold text-navy">{reservation.itemName}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-slate">Dates</dt><dd className="text-right font-bold text-navy">{formatDateRange(reservation.startDate, reservation.endDate)}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-slate">Total</dt><dd className="font-bold text-navy">{formatCurrency(reservation.total)}</dd></div></dl>
        <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center"><Link className="rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-sky" to={`/portal/reservations/${reservation.id}`}>View reservation</Link><Link className="rounded-xl border border-border px-6 py-3 font-bold text-navy hover:bg-tint" to="/portal">Back to dashboard</Link></div>
      </div>
    </div>
  );
}
