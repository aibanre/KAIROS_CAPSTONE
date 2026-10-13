import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getVenue, getVenuePackages } from "../api/venuesApi";
import { getResourceReviews } from "../api/reviewsApi";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import EmptyState from "../components/EmptyState";
import StarRating from "../../shared/StarRating";
import { useBooking } from "../context/BookingContext";
import formatCurrency from "../utils/formatCurrency";
import { formatReviewDate } from "../utils/dateHelpers";
import { createReservationHold } from "../api/reservationsApi";
import { API_URL } from "../../config/api.js";

export default function VenueDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { booking, selectItem, updateBooking } = useBooking();
  const navigate = useNavigate();
  const location = useLocation();
  const [venue, setVenue] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(location.state?.message || "");
  const [holding, setHolding] = useState(false);
  const [packages, setPackages] = useState([]);

  async function startHold(event) {
    event.preventDefault();
    if (holding || !booking.startDate) {
      setError("Choose an event date first.");
      return;
    }
    setHolding(true);
    setError("");
    try {
      const existing = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
      if (existing?.reservation_id) {
        await fetch(`${API_URL}/api/reservations/${encodeURIComponent(existing.reservation_id)}/hold`, {
          method: "DELETE", credentials: "include", keepalive: true,
          headers: existing.access_token ? { "X-Reservation-Token": existing.access_token } : undefined,
        });
      }
      const holdPayload = {
        venue_id: Number(id),
        event_date: booking.startDate,
      };
      if (venue.booking_mode === "day_use") {
        holdPayload.start_time = "08:00";
      }
      const hold = await createReservationHold(holdPayload);
      sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(hold));
      navigate(`/portal/book/venue/${id}?event_date=${encodeURIComponent(booking.startDate)}&reservation_id=${hold.reservation_id}`);
    } catch (holdError) {
      if (holdError.status === 409) setError("These dates were just taken. Please choose other dates.");
      else setError(holdError.message);
    } finally {
      setHolding(false);
    }
  }

  useEffect(() => {
    Promise.all([getVenue(id), getVenuePackages(id)])
      .then(([nextVenue, nextPackages]) => {
        setVenue(nextVenue);
        setPackages(nextPackages);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    setReviewsLoading(true);
    setReviewsError("");
    getResourceReviews({ venueId: Number(id), limit: 6 })
      .then(setReviews)
      .catch((loadError) => setReviewsError(loadError.message || "Could not load guest reviews."))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  if (isLoading) return <div className="page-shell text-slate">Loading venue details...</div>;
  if (error || !venue) return <div className="page-shell"><EmptyState title="Venue unavailable" message={error || "This venue could not be loaded."} to="/portal/browse?tab=venues" actionLabel="Back to browse" /></div>;

  return (
    <div className="page-shell">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">{venue.photos[0] || venue.image ? <img className="h-72 w-full object-cover sm:h-[30rem]" src={venue.photos[0] || venue.image} alt={venue.name} /> : <div className="h-72 bg-tint sm:h-[30rem]" aria-label="No venue image available" />}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-widest text-accent">{venue.type} venue</p><h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{venue.name}</h1></div></div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-lg font-bold text-navy">Up to {venue.capacity} guests · {venue.size}</p><StarRating value={venue.rating} reviewCount={venue.reviewCount} showReviewLabel /></div>
          <p className="mt-5 text-lg leading-8 text-slate">{venue.description}</p>
          <h2 className="mt-10 font-serif text-2xl font-bold text-navy">Venue inclusions</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">{venue.amenities.map((amenity) => <li key={amenity} className="rounded-2xl bg-tint px-4 py-3 text-sm font-semibold text-navy">✓ <span className="ml-2">{amenity}</span></li>)}</ul>
          <div className="mt-10"><AvailabilityCalendar venueId={id} selectionMode="single" selectedStart={booking.startDate} onSelect={(date) => updateBooking({ startDate: date, endDate: date })} /></div>
        </div>
        <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-soft lg:sticky lg:top-24">
          <p className="text-sm text-slate">Event package from</p><p className="mt-1 font-serif text-3xl font-bold text-navy">{formatCurrency(venue.price)}</p>
          <Link onClick={(event) => { selectItem(venue, "venue"); startHold(event); }} className={`mt-6 block rounded-xl bg-accent px-6 py-3.5 text-center font-extrabold text-navy hover:bg-accent-hover ${holding ? "pointer-events-none opacity-60" : ""}`} to={`/portal/book/venue/${id}`}>{holding ? "Holding date..." : "Plan your event"}</Link>
          <p className="mt-3 text-center text-xs text-slate">Our events team will confirm details</p>
        </aside>
      </div>
      {searchParams.get("message") ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">{searchParams.get("message")}</p> : null}
      <section className="mt-16 border-t border-border pt-12"><h2 className="section-title">Loved by recent guests</h2>{reviewsLoading ? <p className="mt-6 text-sm text-slate">Loading guest reviews...</p> : reviewsError ? <p className="mt-6 text-sm text-red-600" role="alert">{reviewsError}</p> : reviews.length ? reviews.map((review) => { const date = formatReviewDate(review.date); return <article key={review.id} className="mt-6 max-w-2xl rounded-3xl border border-border bg-white p-6"><StarRating value={review.rating} /><p className="mt-4 leading-7 text-slate">“{review.comment}”</p><p className="mt-4 text-sm font-bold text-navy">{review.name}{date ? ` · ${date}` : ""}</p></article> }) : <div className="mt-6"><EmptyState title="No guest reviews yet" message="Completed events at this venue can be reviewed here." /></div>}</section>
    </div>
  );
}
