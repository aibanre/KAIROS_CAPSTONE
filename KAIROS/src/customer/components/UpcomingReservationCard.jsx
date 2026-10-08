import { CalendarDays, CreditCard, MapPin, Users } from "lucide-react";
import { Link } from "react-router";
import { formatDateRange } from "../utils/dateHelpers";
import PaymentStatusBadge from "./PaymentStatusBadge";
import ReservationStatusBadge from "./ReservationStatusBadge";

export default function UpcomingReservationCard({ reservation }) {
  if (!reservation) return null;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-soft">
      <div className="grid lg:grid-cols-[16rem_1fr]">
        <img className="h-60 w-full object-cover lg:h-full" src={reservation.image} alt={reservation.itemName} />
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary">Next reservation</p>
              <h3 className="mt-2 text-2xl font-extrabold text-navy">{reservation.itemName}</h3>
              <p className="mt-1 text-sm text-slate">{reservation.reference}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ReservationStatusBadge status={reservation.status} />
              <PaymentStatusBadge status={reservation.paymentStatus} />
            </div>
          </div>
          <div className="mt-6 grid gap-3 text-sm text-slate sm:grid-cols-2">
            <p className="flex items-center gap-2"><CalendarDays size={17} className="text-primary" />{formatDateRange(reservation.startDate, reservation.endDate)}</p>
            <p className="flex items-center gap-2"><Users size={17} className="text-primary" />{reservation.guests} guests</p>
            <p className="flex items-center gap-2"><MapPin size={17} className="text-primary" />Harbor & Haven, Batangas</p>
            <p className="flex items-center gap-2"><CreditCard size={17} className="text-primary" />{reservation.paymentStatus}</p>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link className="rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-white hover:bg-sky" to={`/portal/reservations/${reservation.id}`}>View details</Link>
            {reservation.status === "Pending" && reservation.paymentStatus === "Unpaid" && (
              <Link className="rounded-xl bg-accent px-5 py-3 text-center text-sm font-extrabold text-navy hover:bg-accent-hover" to={`/portal/payment/${reservation.id}`}>Upload proof of payment</Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
