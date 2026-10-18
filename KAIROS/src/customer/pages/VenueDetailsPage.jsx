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
import ReservationLimitNotice from "../../shared/ReservationLimitNotice.jsx";
import VenuePackageCards from "../../shared/VenuePackageCards.jsx";

export default function VenueDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const grouped = searchParams.get("group") === "1";
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
  const [selectedPackageId, setSelectedPackageId] = useState(searchParams.get("package_id") || "");
  const [reservationLimitHolds, setReservationLimitHolds] = useState([]);
  const selectedPackage = packages.find((item) => String(item.package_id) === String(selectedPackageId));

  async function startHold(event) {
    event.preventDefault();
    if (holding || !booking.startDate) {
      setError("Choose an event date first.");
      return;
    }
    setHolding(true);
    setError("");
    setReservationLimitHolds([]);
    try {
      if (venue.booking_mode === "packaged" && !selectedPackage) {
        setError("Choose an event package first.");
        return;
      }
      const existing = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
      if (existing?.reservation_id) {
        await fetch(`${API_URL}/api/reservations/${encodeURIComponent(existing.reservation_id)}/hold`, {
          method: "DELETE", credentials: "include", keepalive: true,
          headers: existing.access_token ? { "X-Reservation-Token": existing.access_token } : undefined,
        });
        sessionStorage.removeItem("kairos_reservation_hold");
      }
      selectItem(venue, "venue");
      if (venue.booking_mode === "packaged") {
        const availabilityResponse = await fetch(
          `${API_URL}/api/venues/${encodeURIComponent(id)}/availability?date=${encodeURIComponent(booking.startDate)}`,
          { credentials: "include" },
        );
        const availability = await availabilityResponse.json();
        if (!availabilityResponse.ok) throw new Error(availability.error || "Could not check venue availability.");
        const toMinutes = (value) => {
          const [hours, minutes] = String(value || "").split(":").map(Number);
          return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
        };
        const duration = Number(selectedPackage.included_hours ?? 5) * 60;
        const latest = toMinutes(venue.latest_end || "22:00");
        const buffer = Number(venue.buffer_minutes || 0);
        const startTime = (availability.valid_start_times || []).find((time) => {
          const start = toMinutes(time);
          if (start === null || latest === null || start + duration > latest) return false;
          return !(availability.booked_ranges || []).some((range) => {
            const existingStart = toMinutes(range.start_time);
            const existingEnd = toMinutes(range.end_time);
            return existingStart !== null && existingEnd !== null
              && start < existingEnd + buffer && start + duration > existingStart - buffer;
          });
        });
        if (!startTime) throw new Error("No time is available for this package on that date. Choose another date or package.");
        const pax = Number(selectedPackage.min_pax || 1);
        const hold = await createReservationHold({
          venue_id: Number(id),
          event_date: booking.startDate,
          start_time: startTime,
          package_id: Number(selectedPackage.package_id),
          pax,
          num_guests: pax,
          extra_hours: 0,
        });
        const assignedVenueId = Number(hold.venue_id || id);
        const bookingKey = JSON.stringify([String(assignedVenueId), booking.startDate, startTime, String(selectedPackage.package_id), pax, 0]);
        const storedHold = {
          ...hold,
          venue_id: assignedVenueId,
          event_date: booking.startDate,
          start_time: startTime,
          package_id: Number(selectedPackage.package_id),
          pax,
          booking_key: bookingKey,
        };
        sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(storedHold));
        const params = new URLSearchParams({
          event_date: booking.startDate,
          start_time: startTime,
          package_id: String(selectedPackage.package_id),
          pax: String(pax),
          extra_hours: "0",
          reservation_id: String(hold.reservation_id),
        });
        navigate(`/portal/book/venue/${assignedVenueId}?${params.toString()}`);
        return;
      } else {
        const hold = await createReservationHold({
          venue_id: Number(id),
          event_date: booking.startDate,
          start_time: "08:00",
          ...(grouped ? { resolve_group: true } : {}),
        });
        const assignedVenueId = Number(hold.venue_id || id);
        const assignedVenue = assignedVenueId === Number(id) ? venue : await getVenue(assignedVenueId);
        selectItem(assignedVenue, "venue");
        sessionStorage.setItem("kairos_reservation_hold", JSON.stringify({ ...hold, venue_id: assignedVenueId }));
        navigate(`/portal/book/venue/${assignedVenueId}?event_date=${encodeURIComponent(booking.startDate)}&reservation_id=${hold.reservation_id}`);
        return;
      }
    } catch (holdError) {
      if (holdError.status === 429) {
        setReservationLimitHolds(holdError.existingHolds || []);
      } else {
        setError(holdError.message || "Could not prepare your venue booking.");
      }
    } finally {
      setHolding(false);
    }
  }

  useEffect(() => {
    Promise.all([getVenue(id, { grouped }), getVenuePackages(id)])
      .then(([nextVenue, nextPackages]) => {
        setVenue(nextVenue);
        setPackages(nextPackages);
        setSelectedPackageId((current) => (
          nextPackages.some((item) => String(item.package_id) === String(current))
            ? current
            : String(nextPackages[0]?.package_id || "")
        ));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [grouped, id]);

  useEffect(() => {
    setReviewsLoading(true);
    setReviewsError("");
    getResourceReviews({ venueId: Number(id), limit: 6 })
      .then(setReviews)
      .catch((loadError) => setReviewsError(loadError.message || "Could not load guest reviews."))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  if (isLoading) return <div className="page-shell text-slate">Loading venue details...</div>;
  if (!venue) return <div className="page-shell"><EmptyState title="Venue unavailable" message={error || "This venue could not be loaded."} to="/portal/browse?tab=venues" actionLabel="Back to browse" /></div>;

  return (
    <div className="page-shell">
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl">{venue.photos[0] || venue.image ? <img className="h-72 w-full object-cover sm:h-[30rem]" src={venue.photos[0] || venue.image} alt={venue.name} /> : <div className="h-72 bg-tint sm:h-[30rem]" aria-label="No venue image available" />}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-widest text-accent">{venue.type} venue</p><h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{venue.name}</h1></div></div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_24rem]">
        {error ? <p className="lg:col-span-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
        {reservationLimitHolds.length ? <div className="lg:col-span-2"><ReservationLimitNotice holds={reservationLimitHolds} portal /></div> : null}
        <div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-lg font-bold text-navy">Up to {venue.capacity} guests · {venue.size}</p><StarRating value={venue.rating} reviewCount={venue.reviewCount} showReviewLabel /></div>
          <p className="mt-5 text-lg leading-8 text-slate">{venue.description}</p>
          <h2 className="mt-10 font-serif text-2xl font-bold text-navy">Venue inclusions</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">{venue.amenities.map((amenity) => <li key={amenity} className="rounded-2xl bg-tint px-4 py-3 text-sm font-semibold text-navy">✓ <span className="ml-2">{amenity}</span></li>)}</ul>
          {venue.booking_mode === "packaged" ? <section className="mt-10">
            <div className="flex items-center justify-between gap-4"><h2 className="section-title">Choose an event package</h2><span className="text-sm text-slate">{packages.length} options</span></div>
            <p className="mt-2 text-sm text-slate">Select a package before or after choosing your event date.</p>
            <div className="mt-4"><VenuePackageCards packages={packages} selectedId={selectedPackageId} onChange={(item) => setSelectedPackageId(String(item.package_id))} name="customer-date-venue-package" /></div>
          </section> : null}
          <div className="mt-10"><AvailabilityCalendar venueId={id} grouped={grouped && venue.booking_mode === "day_use"} selectionMode="single" selectedStart={booking.startDate} onSelect={(date) => updateBooking({ startDate: date, endDate: date })} /></div>
        </div>
        <aside className="h-fit rounded-3xl border border-border bg-white p-6 shadow-soft lg:sticky lg:top-24">
          <p className="text-sm text-slate">{selectedPackage ? selectedPackage.package_name : "Event package from"}</p>
          <p className="mt-1 font-serif text-3xl font-bold text-navy">{formatCurrency(selectedPackage?.price ?? venue.price)}</p>
          {selectedPackage ? <p className="mt-1 text-sm text-slate">{selectedPackage.pricing_type === "per_person" ? "per person" : "flat package price"}</p> : null}
          <Link onClick={(event) => { selectItem(venue, "venue"); startHold(event); }} className={`mt-6 block rounded-xl bg-accent px-6 py-3.5 text-center font-extrabold text-navy hover:bg-accent-hover ${holding ? "pointer-events-none opacity-60" : ""}`} to={`/portal/book/venue/${id}`}>{holding ? "Holding date..." : "Plan your event"}</Link>
          <p className="mt-3 text-center text-xs text-slate">Our events team will confirm details</p>
        </aside>
      </div>
      {searchParams.get("message") ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">{searchParams.get("message")}</p> : null}
      <section className="mt-16 border-t border-border pt-12"><h2 className="section-title">Loved by recent guests</h2>{reviewsLoading ? <p className="mt-6 text-sm text-slate">Loading guest reviews...</p> : reviewsError ? <p className="mt-6 text-sm text-red-600" role="alert">{reviewsError}</p> : reviews.length ? reviews.map((review) => { const date = formatReviewDate(review.date); return <article key={review.id} className="mt-6 max-w-2xl rounded-3xl border border-border bg-white p-6"><StarRating value={review.rating} /><p className="mt-4 leading-7 text-slate">“{review.comment}”</p><p className="mt-4 text-sm font-bold text-navy">{review.name}{date ? ` · ${date}` : ""}</p></article> }) : <div className="mt-6"><EmptyState title="No guest reviews yet" message="Completed events at this venue can be reviewed here." /></div>}</section>
    </div>
  );
}
