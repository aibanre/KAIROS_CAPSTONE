import { CalendarDays, ChevronRight, Users } from "lucide-react";
import { Link } from "react-router";
import { formatDateRange } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";
import PaymentStatusBadge from "./PaymentStatusBadge";
import ReservationStatusBadge from "./ReservationStatusBadge";

export default function ReservationRow({ reservation }) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 transition hover:border-primary/30 hover:shadow-soft sm:flex-row sm:items-center">
      <img className="h-24 w-full rounded-xl object-cover sm:w-28" src={reservation.image} alt="" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-navy">{reservation.itemName}</h3>
          <ReservationStatusBadge status={reservation.status} />
          <PaymentStatusBadge status={reservation.paymentStatus} />
        </div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate">{reservation.reference}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
          <span className="flex items-center gap-1.5"><CalendarDays size={15} />{formatDateRange(reservation.startDate, reservation.endDate)}</span>
          <span className="flex items-center gap-1.5"><Users size={15} />{reservation.guests} guests</span>
          <span className="font-bold text-navy">{formatCurrency(reservation.total)}</span>
        </div>
      </div>
      <Link className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-primary hover:bg-tint sm:w-auto" to={`/portal/reservations/${reservation.id}`}>
        Details <ChevronRight size={16} />
      </Link>
    </article>
  );
}
