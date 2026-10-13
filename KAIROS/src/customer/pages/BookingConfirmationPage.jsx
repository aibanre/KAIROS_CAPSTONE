import { CheckCircle2 } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { useBooking } from "../context/BookingContext";
import { getReservation as fetchReservation } from "../api/reservationsApi";
import { formatDateRange, formatVenueWindow } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";

export default function BookingConfirmationPage() {
  const { reservationId } = useParams();
  const { getReservation } = useBooking();
  const localReservation = getReservation(reservationId);
  const [loadedReservation, setLoadedReservation] = useState(null);
  const [isLoading, setIsLoading] = useState(!localReservation);
  const [loadError, setLoadError] = useState("");
  const reservation = localReservation || loadedReservation;

  useEffect(() => {
    if (localReservation || !reservationId) return undefined;
    let isCurrent = true;
    setIsLoading(true);
    fetchReservation(reservationId)
      .then(({ reservation: nextReservation }) => {
        if (isCurrent) setLoadedReservation(nextReservation);
      })
      .catch((error) => {
        if (isCurrent) setLoadError(error.message || "We could not load your booking confirmation.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [localReservation, reservationId]);

  if (isLoading) return <div className="page-shell text-slate">Loading your booking confirmation...</div>;
  if (!reservation) {
    if (loadError) {
      return (
        <div className="page-shell">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-5 text-center shadow-soft sm:rounded-3xl sm:p-10">
            <p className="text-sm font-bold text-red-700">{loadError}</p>
            <Link className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-sky" to="/portal/reservations">Go to My Reservations</Link>
          </div>
        </div>
      );
    }
    return <Navigate to="/portal/reservations" replace />;
  }
  const pattern = Array.from({ length: 64 }, (_, index) => ((index * 7 + reservation.reference.charCodeAt(index % reservation.reference.length)) % 5) < 2);

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-5 text-center shadow-soft sm:rounded-3xl sm:p-10">
        <CheckCircle2 className="mx-auto text-emerald-600" size={60} />
        <p className="eyebrow mt-5">Proof submitted</p><h1 className="font-serif text-3xl font-bold text-navy sm:text-4xl">Your reservation is taking shape.</h1><p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-slate sm:text-base">We will verify your proof and update the reservation status. You can follow every step from My Reservations.</p>
        
        <p className="mt-7 text-xs font-bold uppercase tracking-widest text-slate">Reference number</p><p className="mt-1 font-mono text-2xl font-black text-primary">{reservation.reference}</p>
        <dl className="mx-auto mt-7 max-w-md divide-y divide-border rounded-2xl border border-border px-5 text-left text-sm"><div className="flex justify-between gap-4 py-4"><dt className="text-slate">Reservation</dt><dd className="font-bold text-navy">{reservation.itemName}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-slate">{reservation.type === "venue" ? "Event" : "Dates"}</dt><dd className="text-right font-bold text-navy">{reservation.type === "venue" ? formatVenueWindow(reservation.startDate, reservation.startTime, reservation.endTime) : formatDateRange(reservation.startDate, reservation.endDate)}</dd></div>{reservation.type === "venue" ? <div className="flex justify-between gap-4 py-4"><dt className="text-slate">Package / pax</dt><dd className="text-right font-bold text-navy">{reservation.packageName || "Day-use venue"} · {reservation.pax} pax</dd></div> : null}<div className="flex justify-between gap-4 py-4"><dt className="text-slate">Total</dt><dd className="font-bold text-navy">{formatCurrency(reservation.total)}</dd></div></dl>
        <p className="mt-6 text-sm text-slate">All bookings are final. Cancellations, refunds, and rebooking are not available.</p><div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center"><Link className="rounded-xl bg-primary px-6 py-3 font-bold text-white hover:bg-sky" to={`/portal/reservations/${reservation.id}`}>View reservation</Link><Link className="rounded-xl border border-border px-6 py-3 font-bold text-navy hover:bg-tint" to="/portal">Back to dashboard</Link></div>
      </div>
    </div>
  );
}
