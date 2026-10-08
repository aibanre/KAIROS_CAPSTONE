import { useBooking } from "../context/BookingContext";
import { formatDate } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";

export default function BookingSummaryCard() {
  const { booking, nights, subtotal, serviceFee, total } = useBooking();

  return (
    <aside className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Your reservation</p>
      <h3 className="mt-2 font-serif text-2xl font-bold text-navy">{booking.item?.name || "Choose a stay or venue"}</h3>
      {booking.item && (
        <>
          <img className="mt-4 h-36 w-full rounded-2xl object-cover" src={booking.item.image} alt="" />
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4"><dt className="text-slate">Dates</dt><dd className="font-semibold text-navy sm:text-right">{formatDate(booking.startDate)} – {formatDate(booking.endDate || booking.startDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Guests</dt><dd className="font-semibold text-navy">{booking.guests}</dd></div>
            {booking.type === "room" && <div className="flex justify-between"><dt className="text-slate">Nights</dt><dd className="font-semibold text-navy">{nights}</dd></div>}
          </dl>
          <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
            <div className="flex justify-between text-slate"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-slate"><span>Service fee</span><span>{formatCurrency(serviceFee)}</span></div>
            <div className="flex justify-between pt-2 text-lg font-extrabold text-navy"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>
        </>
      )}
    </aside>
  );
}
