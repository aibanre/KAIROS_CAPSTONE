import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getBookedDates, getVenue } from "../api/venuesApi";
import { listReviews } from "../api/reviewsApi";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import EmptyState from "../components/EmptyState";
import StarRating from "../components/StarRating";
import { useBooking } from "../context/BookingContext";
import formatCurrency from "../utils/formatCurrency";

export default function VenueDetailsPage() {
  const { id } = useParams();
  const { booking, selectItem, updateBooking } = useBooking();
  const [venue, setVenue] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getVenue(id), getBookedDates(id, 2026, 4), listReviews()])
      .then(([nextVenue, availability, allReviews]) => {
        setVenue(nextVenue);
        setVenue((current) => ({ ...current, bookedDates: availability.bookedDates || [] }));
        setReviews(allReviews.filter((review) => String(review.itemId) === String(id)));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <div className="page-shell text-slate">Loading venue details...</div>;
  if (error || !venue) return <div className="page-shell"><EmptyState title="Venue unavailable" message={error || "This venue could not be loaded."} to="/portal/browse?tab=venues" actionLabel="Back to browse" /></div>;

  return (
    <div className="page-shell">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl"><img className="h-72 w-full object-cover sm:h-[30rem]" src={venue.photos[0] || venue.image} alt={venue.name} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-widest text-accent">{venue.type} venue</p><h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{venue.name}</h1></div></div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-lg font-bold text-navy">Up to {venue.capacity} guests · {venue.size}</p><StarRating value={venue.rating} /></div>
          <p className="mt-5 text-lg leading-8 text-slate">{venue.description}</p>
          <h2 className="mt-10 font-serif text-2xl font-bold text-navy">Venue inclusions</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">{venue.amenities.map((amenity) => <li key={amenity} className="rounded-2xl bg-tint px-4 py-3 text-sm font-semibold text-navy">✓ <span className="ml-2">{amenity}</span></li>)}</ul>
          <div className="mt-10"><AvailabilityCalendar bookedDates={venue.bookedDates} selectedStart={booking.startDate} onSelect={(date) => updateBooking({ startDate: date, endDate: date })} /></div>
        </div>
        <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-soft lg:sticky lg:top-24">
          <p className="text-sm text-slate">Event package from</p><p className="mt-1 font-serif text-3xl font-bold text-navy">{formatCurrency(venue.price)}</p>
          <Link onClick={() => selectItem(venue, "venue")} className="mt-6 block rounded-xl bg-accent px-6 py-3.5 text-center font-extrabold text-navy hover:bg-accent-hover" to={`/portal/book?type=venue&id=${venue.id}`}>Plan your event</Link>
          <p className="mt-3 text-center text-xs text-slate">Our events team will confirm details</p>
        </aside>
      </div>
      <section className="mt-16 border-t border-border pt-12"><h2 className="section-title">Recent celebrations</h2>{reviews.length ? reviews.map((review) => <article key={review.id} className="mt-6 max-w-2xl rounded-3xl border border-border bg-white p-6"><StarRating value={review.rating} /><p className="mt-4 leading-7 text-slate">“{review.comment}”</p><p className="mt-4 text-sm font-bold text-navy">{review.name}</p></article>) : <div className="mt-6"><EmptyState title="No event reviews yet" message="Completed events at this venue can be reviewed here." /></div>}</section>
    </div>
  );
}
