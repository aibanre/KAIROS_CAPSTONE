import { CalendarDays, CreditCard, MapPin, Users } from "lucide-react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { useEffect } from "react";
import PaymentStatusBadge from "../components/PaymentStatusBadge";
import ReservationStatusBadge from "../components/ReservationStatusBadge";
import ReservationTimeline from "../components/ReservationTimeline";
import { useBooking } from "../context/BookingContext";
import { useResortInfo } from "../../public/context/ResortInfoContext";
import { formatDateRange, formatVenueWindow } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";

export default function ReservationDetailsPage() {
  const { id } = useParams();
  const { getReservation, refresh } = useBooking();
  const routeLocation = useLocation();
  useEffect(() => {
    if (routeLocation.state?.reviewed) refresh();
  }, [routeLocation.state?.reviewed, refresh]);
  const { resort_name: resortName, address } = useResortInfo();
  const reservation = getReservation(id);
  if (!reservation) return <Navigate to="/portal/reservations" replace />;
  const location = [resortName, address].filter(Boolean).join(", ");
  const statusMessage = {
    "Payment Verified": "Your check-in code will appear here once your payment is verified.",
    Pending: "Your check-in code will appear here once your payment is verified.",
    "Checked In": "You have already checked in for this reservation.",
    Completed: "This reservation has been completed.",
    Cancelled: "This reservation was cancelled and has no check-in code.",
    Rejected: "This reservation was rejected and has no check-in code.",
  }[reservation.status] || "This reservation has no check-in code yet.";

  return (
    <div className="page-shell">
      <Link className="text-sm font-bold text-primary" to="/portal/reservations">← Back to reservations</Link>
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-white shadow-soft sm:rounded-3xl">
        <div className="grid lg:grid-cols-[22rem_1fr]">
          {reservation.image ? (
            <img className="h-72 w-full object-cover lg:h-full" src={reservation.image} alt={reservation.itemName} />
          ) : (
            <div className="h-72 bg-tint lg:h-full" aria-label="No reservation image available" />
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0"><p className="break-all text-xs font-extrabold uppercase tracking-widest text-primary">{reservation.reference}</p><h1 className="mt-2 font-serif text-3xl font-bold text-navy sm:text-4xl">{reservation.itemName}</h1></div>
              <div className="flex gap-2"><ReservationStatusBadge status={reservation.status} /><PaymentStatusBadge status={reservation.paymentStatus} /></div>
            </div>
            <div className="mt-7 grid gap-4 rounded-2xl bg-tint p-5 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-slate"><CalendarDays size={18} className="text-primary" />{reservation.type === "venue" ? formatVenueWindow(reservation.startDate, reservation.startTime, reservation.endTime) : formatDateRange(reservation.startDate, reservation.endDate)}</p>
              <p className="flex items-center gap-2 text-slate"><Users size={18} className="text-primary" />{reservation.guests} adults{reservation.children ? `, ${reservation.children} ${reservation.children === 1 ? "child" : "children"}` : ""}</p>
              {location ? <p className="flex items-center gap-2 text-slate"><MapPin size={18} className="text-primary" />{location}</p> : null}
              <p className="flex items-center gap-2 font-bold text-navy"><CreditCard size={18} className="text-primary" />{formatCurrency(reservation.total)}</p>
              {reservation.type === "venue" ? <p className="text-slate sm:col-span-2"><b>{reservation.packageName || "Day-use venue"}</b>{reservation.packageInclusions?.length ? ` — ${reservation.packageInclusions.join(", ")}` : ""} · {reservation.pax} pax</p> : null}
            </div>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              {reservation.isActiveHold && reservation.paymentStatus === "Unpaid" && <Link className="rounded-xl bg-accent px-5 py-3 text-center text-sm font-extrabold text-navy hover:bg-accent-hover" to={`/portal/payment/${reservation.id}`}>Complete payment</Link>}
              {reservation.paymentRejectionReason && <p className="basis-full text-sm font-bold text-red-700">Payment proof rejected: {reservation.paymentRejectionReason}</p>}
              {reservation.status === "Completed" && (reservation.reviewed ? <span className="rounded-xl bg-emerald-100 px-5 py-3 text-sm font-bold text-emerald-800">Reviewed</span> : <Link className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-white" to={`/portal/reviews/new/${reservation.id}`} state={{ from: `/portal/reservations/${reservation.id}` }}>Write a review</Link>)}
            </div>
            <p className="mt-5 text-sm text-slate">All bookings are final. Cancellations, refunds, and rebooking are not available.</p>
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-soft"><h2 className="section-title">Reservation progress</h2><div className="mt-7"><ReservationTimeline status={reservation.status} /></div></section>
        <aside className="rounded-3xl bg-navy p-6 text-white">
          {reservation.checkinQr ? <div className="mx-auto w-fit rounded-xl bg-white p-3"><img className="size-36" src={reservation.checkinQr} alt={`Check-in QR code for reservation ${reservation.reference}`} /></div> : null}
          <h2 className="mt-5 font-bold">Mobile check-in code</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{reservation.checkinQr ? "Keep this QR code handy when you arrive." : statusMessage}</p>
          <p className="mt-4 break-all text-center font-mono text-sm font-bold text-white">{reservation.reference}</p>
        </aside>
      </div>
    </div>
  );
}
