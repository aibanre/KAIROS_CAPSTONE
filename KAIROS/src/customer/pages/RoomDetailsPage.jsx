import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import EmptyState from "../components/EmptyState";
import StarRating from "../components/StarRating";
import { getBookedDates, getRoom } from "../api/roomsApi";
import { listReviews } from "../api/reviewsApi";
import { useBooking } from "../context/BookingContext";
import formatCurrency from "../utils/formatCurrency";

export default function RoomDetailsPage() {
  const { id } = useParams();
  const { booking, selectItem, updateBooking } = useBooking();
  const [room, setRoom] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [bookedDates, setBookedDates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getRoom(id), getBookedDates(id, 2026, 4), listReviews()])
      .then(([nextRoom, nextBooked, allReviews]) => {
        setRoom(nextRoom);
        setBookedDates(nextBooked.bookedDates || []);
        setReviews(allReviews.filter((review) => String(review.itemId) === String(id)));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  function selectDate(date) {
    if (!booking.startDate || booking.endDate) updateBooking({ startDate: date, endDate: "" });
    else updateBooking({ endDate: date < booking.startDate ? booking.startDate : date });
  }

  if (isLoading) return <div className="page-shell text-slate">Loading room details...</div>;
  if (error || !room) return <div className="page-shell"><EmptyState title="Room unavailable" message={error || "This room could not be loaded."} to="/portal/browse" actionLabel="Back to browse" /></div>;

  return (
    <div className="page-shell">
      <div className="grid gap-3 sm:grid-cols-3">
        <img className="h-64 w-full rounded-2xl object-cover sm:col-span-2 sm:h-[32rem] sm:rounded-3xl" src={room.photos[0] || room.image} alt={room.name} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          {room.photos.slice(1).map((photo, index) => <img key={photo} className="h-32 w-full rounded-2xl object-cover sm:h-full sm:min-h-38 sm:rounded-3xl" src={photo} alt={`${room.name} view ${index + 2}`} />)}
        </div>
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between"><div><p className="eyebrow">{room.type} · {room.size}</p><h1 className="page-title">{room.name}</h1></div><StarRating value={room.rating} /></div>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate">{room.description}</p>
          <h2 className="mt-10 font-serif text-2xl font-bold text-navy">Everything you need</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">{room.amenities.map((amenity) => <li key={amenity} className="rounded-2xl bg-tint px-4 py-3 text-sm font-semibold text-navy">✓ <span className="ml-2">{amenity}</span></li>)}</ul>
          <div className="mt-10"><AvailabilityCalendar bookedDates={bookedDates} selectedStart={booking.startDate} selectedEnd={booking.endDate} onSelect={selectDate} /></div>
        </div>
        <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-soft lg:sticky lg:top-24">
          <p><span className="font-serif text-3xl font-bold text-navy">{formatCurrency(room.price)}</span><span className="text-slate"> / night</span></p>
          <p className="mt-2 text-sm text-slate">For up to {room.capacity} guests · {room.bed}</p>
          <Link onClick={() => selectItem(room, "room")} className="mt-6 block rounded-xl bg-accent px-6 py-3.5 text-center font-extrabold text-navy hover:bg-accent-hover" to={`/portal/book?type=room&id=${room.id}`}>Book this room</Link>
          <p className="mt-3 text-center text-xs text-slate">Your dates stay saved as you continue</p>
        </aside>
      </div>
      <section className="mt-16 border-t border-border pt-12"><p className="eyebrow">Guest notes</p><h2 className="section-title">Loved by recent guests</h2>{reviews.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-3xl border border-border bg-white p-6"><StarRating value={review.rating} /><p className="mt-4 leading-7 text-slate">“{review.comment}”</p><p className="mt-4 text-sm font-bold text-navy">{review.name} · {review.date}</p></article>)}</div> : <div className="mt-6"><EmptyState title="No guest reviews yet" message="Be the first to review this room after a completed stay." /></div>}</section>
    </div>
  );
}
