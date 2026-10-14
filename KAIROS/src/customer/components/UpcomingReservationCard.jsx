import { CalendarDays, CreditCard, MapPin, Users } from "lucide-react";
import { Link } from "react-router";
import { useResortInfo } from "../../public/context/ResortInfoContext";
import { formatDateRange, formatVenueWindow } from "../utils/dateHelpers";
import PaymentStatusBadge from "./PaymentStatusBadge";
import ReservationStatusBadge from "./ReservationStatusBadge";
import ResourceImage from "../../shared/ResourceImage";

export default function UpcomingReservationCard({ reservation }) {
  const { resort_name: resortName, address } = useResortInfo();
  if (!reservation) return null;
  const location = [resortName, address].filter(Boolean).join(", ");

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-soft">
      <div className="grid lg:grid-cols-[16rem_1fr]">
        <ResourceImage src={reservation.image} alt={reservation.itemName} name={reservation.itemName} type={reservation.type} large wrapperClassName="h-24 sm:h-60 lg:h-full" />
        <div className="p-4 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-primary">Next reservation</p>
              <h3 className="mt-1 truncate text-lg font-extrabold text-navy sm:mt-2 sm:text-2xl">{reservation.itemName}</h3>
              <p className="mt-1 text-sm text-slate">{reservation.reference}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ReservationStatusBadge status={reservation.status} />
              <PaymentStatusBadge status={reservation.paymentStatus} />
            </div>
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate sm:mt-6 sm:gap-3 sm:text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2"><CalendarDays size={17} className="text-primary" />{reservation.type === "venue" ? formatVenueWindow(reservation.startDate, reservation.startTime, reservation.endTime) : formatDateRange(reservation.startDate, reservation.endDate)}</p>
            <p className="flex items-center gap-2"><Users size={17} className="text-primary" />{reservation.guests} guests</p>
            {reservation.type === "venue" && reservation.packageName ? <p className="sm:col-span-2">{reservation.packageName} · {reservation.pax} pax</p> : null}
            {location ? <p className="flex items-center gap-2"><MapPin size={17} className="text-primary" />{location}</p> : null}
            <p className="flex items-center gap-2"><CreditCard size={17} className="text-primary" />{reservation.paymentStatus}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link className="h-10 rounded-xl bg-primary px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-sky" to={`/portal/reservations/${reservation.id}`}>View details</Link>
            {reservation.status === "Pending" && reservation.paymentStatus === "Unpaid" && (
              <Link className="h-10 rounded-xl bg-accent px-5 py-2.5 text-center text-sm font-extrabold text-navy hover:bg-accent-hover" to={`/portal/payment/${reservation.id}`}>Upload proof of payment</Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
