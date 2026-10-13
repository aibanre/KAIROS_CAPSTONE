import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import EmptyState from "../components/EmptyState";
import StarRating from "../../shared/StarRating";
import { getRoom } from "../api/roomsApi";
import { listReviews } from "../api/reviewsApi";
import { useBooking } from "../context/BookingContext";
import formatCurrency from "../utils/formatCurrency";
import { formatReviewDate } from "../utils/dateHelpers";
import { addDays, rangeHasBooked } from "../../public/utils/dateRange.js";
import { createReservationHold } from "../api/reservationsApi";

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function RoomDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { booking, selectItem, updateBooking } = useBooking();
  const [room, setRoom] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookedDates, setBookedDates] = useState([]);
  const [isHolding, setIsHolding] = useState(false);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  useEffect(() => {
    Promise.all([getRoom(id), listReviews()])
      .then(([nextRoom, allReviews]) => {
        setRoom(nextRoom);
        setReviews(allReviews.filter((review) => String(review.itemId) === String(id)));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  function selectDate(date) {
    const bookedSet = new Set(bookedDates);
    if (!booking.startDate || booking.endDate || date <= booking.startDate) {
      if (bookedSet.has(date) || date < todayKey()) return setError("That check-in date is unavailable.");
      setError("");
      updateBooking({ startDate: date, endDate: "" });
      return;
    }

    if (rangeHasBooked(booking.startDate, date, bookedSet)) {
      return setError("Selected dates include already-booked nights.");
    }
    setError("");
    updateBooking({ endDate: date });
  }

  async function startHold(event) {
    event.preventDefault();
    if (isHolding) return;
    if (!booking.startDate || !booking.endDate) {
      setError("Choose check-in and check-out dates first.");
      return;
    }
    setIsHolding(true);
    setError("");
    try {
      const existing = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
      if (existing?.reservation_id) {
        await fetch(`/api/reservations/${encodeURIComponent(existing.reservation_id)}/hold`, {
          method: "DELETE", credentials: "include", keepalive: true,
          headers: existing.access_token ? { "X-Reservation-Token": existing.access_token } : undefined,
        });
        sessionStorage.removeItem("kairos_reservation_hold");
      }
      const hold = await createReservationHold({
        room_id: Number(room.id), check_in: booking.startDate, check_out: booking.endDate,
        num_guests: Number(booking.guests || 1), children: Number(booking.children || 0),
      });
      if (!hold?.reservation_id) throw new Error("The booking hold was not created. Please try again.");
      sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(hold));
      navigate(`/portal/book?type=room&id=${room.id}&reservation_id=${hold.reservation_id}`);
    } catch (holdError) {
      if (holdError.status === 409) {
        setError("These dates were just taken. Please choose other dates.");
        setAvailabilityRefresh((value) => value + 1);
      } else setError(holdError.message || "Could not hold these dates.");
    } finally {
      setIsHolding(false);
    }
  }

  if (isLoading) return <div className="page-shell text-slate">Loading room details...</div>;
  if (error || !room) return <div className="page-shell"><EmptyState title="Room unavailable" message={error || "This room could not be loaded."} to="/portal/browse" actionLabel="Back to browse" /></div>;

  return (
    <div className="page-shell">
      <div className="grid gap-3 sm:grid-cols-3">
        {room.photos[0] || room.image ? (
          <img className="h-64 w-full rounded-2xl object-cover sm:col-span-2 sm:h-[32rem] sm:rounded-3xl" src={room.photos[0] || room.image} alt={room.name} />
        ) : (
          <div className="h-64 rounded-2xl bg-tint sm:col-span-2 sm:h-[32rem] sm:rounded-3xl" aria-label="No room image available" />
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          {room.photos.slice(1).map((photo, index) => <img key={photo} className="h-32 w-full rounded-2xl object-cover sm:h-full sm:min-h-38 sm:rounded-3xl" src={photo} alt={`${room.name} view ${index + 2}`} />)}
        </div>
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between"><div><p className="eyebrow">{room.type} · {room.size}</p><h1 className="page-title">{room.name}</h1></div><StarRating value={room.rating} reviewCount={room.reviewCount} showReviewLabel /></div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate">{room.description}</p>
          <h2 className="mt-10 font-serif text-2xl font-bold text-navy">Everything you need</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">{room.amenities.map((amenity) => <li key={amenity} className="rounded-2xl bg-tint px-4 py-3 text-sm font-semibold text-navy">✓ <span className="ml-2">{amenity}</span></li>)}</ul>
          <div className="mt-10"><AvailabilityCalendar key={availabilityRefresh} roomId={id} selectedStart={booking.startDate} selectedEnd={booking.endDate} onSelect={selectDate} onBookedDatesChange={setBookedDates} /></div>
        </div>
        <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-soft lg:sticky lg:top-24">
          <p><span className="font-serif text-3xl font-bold text-navy">{formatCurrency(room.price)}</span><span className="text-slate"> / night</span></p>
          <p className="mt-2 text-sm text-slate">For up to {room.capacity} guests · {room.bed}</p>
          <div className="mt-5 grid gap-3">
            <label className="filter-label">Check-in<input type="date" min={todayKey()} value={booking.startDate} onChange={(event) => { const value = event.target.value; if (bookedDates.includes(value)) return setError("That check-in date is unavailable."); setError(""); updateBooking({ startDate: value, ...(booking.endDate && value >= booking.endDate ? { endDate: "" } : {}) }); }} className="form-control" /></label>
            <label className="filter-label">Check-out<input type="date" min={booking.startDate ? addDays(booking.startDate, 1) : todayKey()} value={booking.endDate} onChange={(event) => { const value = event.target.value; if (!booking.startDate || value <= booking.startDate || rangeHasBooked(booking.startDate, value, new Set(bookedDates))) return setError("Selected dates include already-booked nights."); setError(""); updateBooking({ endDate: value }); }} className="form-control" /></label>
          </div>
          <Link onClick={(event) => { selectItem(room, "room"); startHold(event); }} className={`mt-6 block rounded-xl bg-accent px-6 py-3.5 text-center font-extrabold text-navy hover:bg-accent-hover ${isHolding ? "pointer-events-none opacity-60" : ""}`} to={`/portal/book?type=room&id=${room.id}`}>{isHolding ? "Holding dates..." : "Book this room"}</Link>
          <p className="mt-3 text-center text-xs text-slate">Your dates stay saved as you continue</p>
        </aside>
      </div>
      <section className="mt-16 border-t border-border pt-12"><p className="eyebrow">Guest notes</p><h2 className="section-title">Loved by recent guests</h2>{reviews.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{reviews.map((review) => { const date = formatReviewDate(review.date); return <article key={review.id} className="rounded-3xl border border-border bg-white p-6"><StarRating value={review.rating} /><p className="mt-4 leading-7 text-slate">“{review.comment}”</p><p className="mt-4 text-sm font-bold text-navy">{review.name}{date ? ` · ${date}` : ""}</p></article> })}</div> : <div className="mt-6"><EmptyState title="No guest reviews yet" message="Be the first to review this room after a completed stay." /></div>}</section>
    </div>
  );
}
