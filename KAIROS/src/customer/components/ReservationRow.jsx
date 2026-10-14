import { CalendarDays, ChevronRight, Users } from "lucide-react";
import { Link } from "react-router";
import { formatDateRange, formatTime, formatVenueWindow } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";
import PaymentStatusBadge from "./PaymentStatusBadge";
import ReservationStatusBadge from "./ReservationStatusBadge";
import ResourceImage from "../../shared/ResourceImage";
import { compactCardButton, compactCardContent, compactCardImage, compactCardInfo, compactCardPrice, compactCardShell, compactCardThumbnail, compactCardTitle } from "./compactCardClasses";

function compactDate(value) {
  if (!value) return "Date unavailable";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
}

function compactReservationInfo(reservation) {
  if (reservation.type === "venue") {
    const time = reservation.startTime && reservation.endTime
      ? ` · ${formatTime(reservation.startTime)}–${formatTime(reservation.endTime)}`
      : "";
    return `${compactDate(reservation.startDate)}${time} · ${reservation.pax ?? reservation.guests} pax`;
  }
  return `${formatDateRange(reservation.startDate, reservation.endDate).replace(/, \d{4}/g, "")} · ${reservation.guests} adults`;
}

function showPaymentPill(reservation) {
  return !["Cancelled", "Rejected"].includes(reservation.status)
    && (reservation.paymentStatus !== "Verified" || !["Confirmed", "Completed"].includes(reservation.status));
}

export default function ReservationRow({ reservation }) {
  return (
    <article className={`${compactCardShell} min-w-0 items-stretch sm:items-center sm:p-4`}>
      <div className={`${compactCardThumbnail} sm:h-24 sm:w-28 sm:rounded-xl`}>
        <ResourceImage src={reservation.image} alt="" type={reservation.type} wrapperClassName="aspect-[4/3] sm:aspect-auto" className={`${compactCardImage} sm:transition-none sm:group-hover:scale-100`} />
      </div>
      <div className={`${compactCardContent} gap-1 sm:block`}>
        <div className="flex flex-wrap gap-1 sm:hidden [&>span]:whitespace-nowrap [&>span]:rounded-full [&>span]:px-2 [&>span]:py-0.5 [&>span]:text-[10px]">
          <ReservationStatusBadge status={reservation.status} />
          {showPaymentPill(reservation) ? <PaymentStatusBadge status={reservation.paymentStatus} /> : null}
        </div>
        <h3 className={`${compactCardTitle} sm:hidden`}>{reservation.itemName}</h3>
        <p className={`${compactCardInfo} break-normal sm:hidden`}>{compactReservationInfo(reservation)}</p>
        <p className="truncate text-[11px] text-slate-500 sm:hidden">{reservation.reference}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1 sm:hidden">
          <p className="truncate"><span className={compactCardPrice}>{formatCurrency(reservation.total)}</span></p>
          <Link aria-label={`Details for ${reservation.itemName}`} className={`${compactCardButton} px-4`} to={`/portal/reservations/${reservation.id}`}>Details</Link>
        </div>

        <div className="hidden sm:block">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-normal font-bold text-navy">{reservation.itemName}</h3>
            <ReservationStatusBadge status={reservation.status} />
            <PaymentStatusBadge status={reservation.paymentStatus} />
          </div>
          <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-slate">{reservation.reference}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
            <span className="flex items-center gap-1.5"><CalendarDays size={15} />{reservation.type === "venue" ? formatVenueWindow(reservation.startDate, reservation.startTime, reservation.endTime) : formatDateRange(reservation.startDate, reservation.endDate)}</span>
            <span className="flex items-center gap-1.5"><Users size={15} />{reservation.guests} adults{reservation.children ? `, ${reservation.children} ${reservation.children === 1 ? "child" : "children"}` : ""}</span>
            {reservation.type === "venue" && reservation.packageName ? <span>{reservation.packageName}</span> : null}
            <span className="font-bold text-navy">{formatCurrency(reservation.total)}</span>
          </div>
        </div>
      </div>
      <Link className="hidden h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-border px-3 text-sm font-bold text-primary hover:bg-tint sm:inline-flex sm:w-auto sm:px-4" to={`/portal/reservations/${reservation.id}`}>
        Details <ChevronRight size={16} />
      </Link>
      {reservation.isActiveHold && reservation.paymentStatus === "Unpaid" ? <Link className="hidden h-10 shrink-0 items-center justify-center rounded-xl bg-accent px-3 text-sm font-extrabold text-navy hover:bg-accent-hover sm:inline-flex sm:w-auto sm:px-4" to={`/portal/payment/${reservation.id}`}>Complete payment</Link> : null}
    </article>
  );
}
