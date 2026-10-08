import { CalendarDays, CircleAlert, CreditCard, MapPin, Users } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import PaymentStatusBadge from "../components/PaymentStatusBadge";
import ReservationStatusBadge from "../components/ReservationStatusBadge";
import ReservationTimeline from "../components/ReservationTimeline";
import { useBooking } from "../context/BookingContext";
import { formatDateRange } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";

export default function ReservationDetailsPage() {
  const { id } = useParams();
  const { getReservation } = useBooking();
  const reservation = getReservation(id);
  if (!reservation) return <Navigate to="/portal/reservations" replace />;

  return (
    <div className="page-shell">
      <Link className="text-sm font-bold text-primary" to="/portal/reservations">← Back to reservations</Link>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-white shadow-soft sm:rounded-3xl">
        <div className="grid lg:grid-cols-[22rem_1fr]">
          <img className="h-72 w-full object-cover lg:h-full" src={reservation.image} alt={reservation.itemName} />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0"><p className="break-all text-xs font-extrabold uppercase tracking-widest text-primary">{reservation.reference}</p><h1 className="mt-2 font-serif text-3xl font-bold text-navy sm:text-4xl">{reservation.itemName}</h1></div>
              <div className="flex gap-2"><ReservationStatusBadge status={reservation.status} /><PaymentStatusBadge status={reservation.paymentStatus} /></div>
            </div>
            <div className="mt-7 grid gap-4 rounded-2xl bg-tint p-5 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-slate"><CalendarDays size={18} className="text-primary" />{formatDateRange(reservation.startDate, reservation.endDate)}</p>
              <p className="flex items-center gap-2 text-slate"><Users size={18} className="text-primary" />{reservation.guests} guests</p>
              <p className="flex items-center gap-2 text-slate"><MapPin size={18} className="text-primary" />Harbor & Haven, Batangas</p>
              <p className="flex items-center gap-2 font-bold text-navy"><CreditCard size={18} className="text-primary" />{formatCurrency(reservation.total)}</p>
            </div>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              {reservation.status === "Pending" && reservation.paymentStatus === "Unpaid" && <Link className="rounded-xl bg-accent px-5 py-3 text-center text-sm font-extrabold text-navy hover:bg-accent-hover" to={`/portal/payment/${reservation.id}`}>Upload proof of payment</Link>}
              {reservation.paymentRejectionReason && <p className="basis-full text-sm font-bold text-red-700">Payment proof rejected: {reservation.paymentRejectionReason}</p>}
              {reservation.status === "Completed" && !reservation.reviewed && <Link className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-white" to={`/portal/reviews/new/${reservation.id}`}>Write a review</Link>}
            </div>
            <p className="mt-5 text-sm text-slate">All bookings are final. Cancellations, refunds, and rebooking are not available.</p>
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-soft"><h2 className="section-title">Reservation progress</h2><div className="mt-7"><ReservationTimeline status={reservation.status} /></div></section>
        <aside className="rounded-3xl bg-navy p-6 text-white"><div className="grid size-32 grid-cols-8 gap-1 rounded-xl bg-white p-3">{Array.from({ length: 64 }, (_, index) => <span key={index} className={(index * 7 + 3) % 5 < 2 ? "bg-navy" : "bg-white"} />)}</div><h2 className="mt-5 font-bold">Mobile check-in code</h2><p className="mt-2 text-sm leading-6 text-white/60">Keep this QR code handy when you arrive.</p><p className="mt-5 flex items-start gap-2 text-xs text-white/50"><CircleAlert size={15} className="shrink-0" />Mock code for demonstration only.</p></aside>
      </div>
    </div>
  );
}
