import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "../../config/api.js";
import { updateReservationHold } from "../api/reservationsApi";
import { getVenue, getVenuePackages } from "../api/venuesApi";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatVenueWindow } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";
import { isValidEmail, isValidPhone } from "../utils/validators";
import { getImageUrl } from "../../public/utils/parseImages.js";
import { useBooking } from "../context/BookingContext";
import VenuePackageCards from "../../shared/VenuePackageCards.jsx";

function hourlyStartTimes(venue) {
  const [earliestHour = "08", earliestMinute = "00"] = String(venue?.earliest_start || "08:00").split(":");
  const [latestHour = "22", latestMinute = "00"] = String(venue?.latest_end || "22:00").split(":");
  const firstHour = Math.ceil((Number(earliestHour) * 60 + Number(earliestMinute || 0)) / 60);
  const lastHour = Math.floor((Number(latestHour) * 60 + Number(latestMinute || 0)) / 60);
  return Array.from({ length: Math.max(0, lastHour - firstHour) }, (_, index) => {
    const hour = firstHour + index;
    return `${String(hour).padStart(2, "0")}:00`;
  });
}

export default function VenueBookingDetailsPage() {
  const { venueId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { booking } = useBooking();
  const reservationHold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
  const [venue, setVenue] = useState(null);
  const [packages, setPackages] = useState([]);
  const [quote, setQuote] = useState(null);
  const [selection, setSelection] = useState({
    eventDate: params.get("event_date") || booking.startDate || "",
    startTime: params.get("start_time") || "",
    packageId: params.get("package_id") || String(reservationHold?.package_id || ""),
    pax: Number(params.get("pax") || booking.guests || 1),
    extraHours: Number(params.get("extra_hours") || 0),
  });
  const [contact, setContact] = useState({ name: user?.full_name || "", email: user?.email || "", phone: user?.phone_number || user?.phone || "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const completedRef = useRef(false);
  const eventDate = selection.eventDate;
  const startTime = selection.startTime;
  const packageId = selection.packageId;
  const pax = selection.pax;
  const extraHours = selection.extraHours;
  const hasPackages = venue?.booking_mode === "packaged" || packages.length > 0;
  const selectedPackage = packages.find((item) => String(item.package_id) === String(packageId));
  const packageMinPax = selectedPackage ? Number(selectedPackage.min_pax ?? 1) : 1;
  const packageMaxPax = selectedPackage ? Number(selectedPackage.max_pax ?? venue?.capacity ?? 1) : Number(venue?.capacity || 1);
  const paxIsValid = Number.isInteger(pax) && pax > 0 && pax <= packageMaxPax && (!selectedPackage || pax >= packageMinPax);
  const canRequestQuote = Boolean(eventDate && startTime && venue && (!hasPackages || (selectedPackage && paxIsValid)));
  const hourlyTimes = hourlyStartTimes(venue);
  const hold = reservationHold;

  useEffect(() => {
    if (!hold?.hold_expires_at) return undefined;
    const timer = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((new Date(hold.hold_expires_at).getTime() - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [hold?.hold_expires_at]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    sessionStorage.removeItem("kairos_reservation_hold");
    navigate(`/portal/venues/${venueId}`, {
      replace: true,
      state: { message: "Your booking hold expired. Please choose your date again." },
    });
  }, [navigate, secondsLeft, venueId]);

  useEffect(() => {
    Promise.all([getVenue(venueId), getVenuePackages(venueId)])
      .then(([nextVenue, nextPackages]) => {
        setVenue(nextVenue);
        setPackages(nextPackages);
        setSelection((current) => ({
          ...current,
          startTime: current.startTime || (nextVenue.booking_mode === "day_use" && nextPackages.length === 0 ? (nextVenue.start_time || "08:00").slice(0, 5) : ""),
          packageId: current.packageId || "",
          pax: current.pax || 1,
        }));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [venueId]);

  function updateSelection(field, value) {
    setSelection((current) => ({ ...current, [field]: value }));
    setQuote(null);
  }

  useEffect(() => {
    if (!canRequestQuote) {
      setQuote(null);
      return undefined;
    }
    const query = new URLSearchParams({ date: eventDate, start: startTime, pax: String(pax), extra_hours: String(extraHours) });
    if (hasPackages && selectedPackage) query.set("package_id", String(packageId));
    if (hold?.reservation_id) query.set("hold_id", String(hold.reservation_id));
    const controller = new AbortController();
    fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/quote?${query}`, {
      signal: controller.signal,
      credentials: "include",
      headers: hold?.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.reason || data.error || "Failed to verify quote.");
        setQuote(data);
      })
      .catch((quoteError) => {
        if (quoteError.name !== "AbortError") setQuote({ valid: false, reason: quoteError.message });
      });
    return () => controller.abort();
  }, [canRequestQuote, eventDate, extraHours, hasPackages, hold?.access_token, hold?.reservation_id, packageId, pax, selectedPackage, startTime, venue, venueId]);

  useEffect(() => () => {
    if (completedRef.current || !hold?.reservation_id) return;
    fetch(`${API_URL}/api/reservations/${encodeURIComponent(hold.reservation_id)}/hold`, {
      method: "DELETE",
      credentials: "include",
      headers: hold.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
      keepalive: true,
    }).catch(() => {});
  }, [hold?.reservation_id, hold?.access_token]);

  function updateContact(field, value) {
    setContact((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!quote?.valid) return setError("Please review your venue selection and try again.");
    const [firstName = "", ...lastNameParts] = contact.name.trim().split(/\s+/);
    if (!firstName || !isValidEmail(contact.email) || !isValidPhone(contact.phone)) return setError("Enter a valid name, email address, and Philippine mobile number.");
    setError("");
    setSubmitting(true);
    try {
      const hold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
      if (!hold?.reservation_id) {
        throw new Error("Your booking hold is missing or expired. Please choose the date again.");
      }
      const nameParts = contact.name.trim().split(/\s+/);
      const data = await updateReservationHold(hold.reservation_id, {
        event_date: eventDate,
        start_time: startTime,
        package_id: hasPackages ? Number(packageId) : undefined,
        pax,
        extra_hours: extraHours,
        num_guests: pax,
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(" ") || nameParts[0],
        email: contact.email,
        phone_number: contact.phone,
        address: "Customer portal venue booking",
      });
      if (!data?.reservation_id) throw new Error("The booking hold could not be updated.");
      completedRef.current = true;
      navigate(`/portal/payment/${data.reservation_id}`);
    } catch (submitError) {
      if (submitError.status === 409) {
        setError("That time slot is no longer available. Choose another time.");
      } else if (submitError.status === 410) {
        setError("Your booking hold has expired. Please choose the date again.");
      } else {
        setError("We could not update your booking right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="page-shell text-slate">Loading booking details...</div>;
  if (!venue) return <div className="page-shell text-red-700">{error || "Venue not found."}</div>;

  return (
    <div className="page-shell">
      <p className="eyebrow">Reserve your venue</p>
      <h1 className="page-title">Complete your booking details</h1>
      <p className="mt-3 text-slate">Confirm the event selection and guest information before proceeding to payment. <a href="/payment-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Read our Payment Policy</a></p>
      {secondsLeft !== null ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Your date is held for {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}</p> : null}
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} className="space-y-7 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          {hasPackages ? <section><div className="flex items-center justify-between gap-4"><h2 className="section-title">Choose a package</h2><span className="text-sm text-slate">{packages.length} options</span></div><div className="mt-5"><VenuePackageCards packages={packages} selectedId={packageId} onChange={(item) => { setSelection((current) => ({ ...current, packageId: String(item.package_id), pax: Number(item.min_pax || 1), extraHours: 0 })); setQuote(null); }} name="portal-venue-package" /></div></section> : null}
          <section><h2 className="section-title">Event details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">Event date<input required type="date" className="form-control" value={eventDate} onChange={(event) => updateSelection("eventDate", event.target.value)} /></label>
            {hasPackages ? <label className="filter-label">Start time<select required className="form-control" value={startTime} onChange={(event) => updateSelection("startTime", event.target.value)}><option value="">Choose an hour</option>{hourlyTimes.map((time) => <option key={time} value={time}>{new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</option>)}</select></label> : null}
            <label className="filter-label">Guests / pax<input required type="number" min={selectedPackage ? packageMinPax : 1} max={selectedPackage ? packageMaxPax : venue.capacity || undefined} className="form-control" value={pax} onChange={(event) => updateSelection("pax", Number(event.target.value))} /></label>
            {selectedPackage ? <p className="text-xs text-slate">Package limit: {packageMinPax}-{packageMaxPax} pax</p> : null}
            {hasPackages ? <label className="filter-label">Extra hours<input type="number" min="0" step="1" className="form-control" value={extraHours} onChange={(event) => updateSelection("extraHours", Number(event.target.value))} /></label> : null}
          </div>
          {hasPackages && selectedPackage && !paxIsValid ? <p className="mt-2 text-sm font-medium text-red-600">Pax must be between {packageMinPax} and {packageMaxPax} for {selectedPackage.package_name}.</p> : null}
          {quote?.valid ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">Selection verified. Your current total is {formatCurrency(quote.total)}.</p> : quote?.reason ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{quote.reason}</p> : <p className="mt-4 text-sm text-slate">Choose the event date and venue options to verify availability and calculate your total.</p>}
          </section>
          <section><h2 className="section-title">Guest details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">Full name<input required className="form-control" value={contact.name} onChange={(event) => updateContact("name", event.target.value)} /></label>
            <label className="filter-label">Email address<input required type="email" readOnly={Boolean(user)} className="form-control" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
            <label className="filter-label">Mobile number<input required className="form-control" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} /></label>
          </div></section>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
          {!selectedPackage && hasPackages ? <p className="text-sm text-slate">Select a package to continue.</p> : null}
          <button type="submit" disabled={submitting || !quote?.valid || (hasPackages && !selectedPackage) || (hasPackages && selectedPackage && !paxIsValid)} className="w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60">{submitting ? "Creating reservation..." : "Continue to payment"}</button>
        </form>
        <aside className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">Booking summary</p>{venue.image ? <img className="mt-4 h-40 w-full rounded-2xl object-cover" src={getImageUrl(venue.image) || venue.image} alt={venue.name} /> : <div className="mt-4 h-40 rounded-2xl bg-tint" aria-label="No venue image available" />}<h2 className="mt-4 text-xl font-bold text-navy">{venue.name}</h2><p className="mt-2 text-sm text-slate">{eventDate ? formatVenueWindow(eventDate, startTime, quote?.endTime) : "Choose an event date"}</p><p className="mt-2 text-sm text-slate">{selectedPackage?.package_name || (hasPackages ? "Select a package" : "Day-use venue")} · {selectedPackage ? `${pax} pax` : "—"}</p><div className="mt-5 border-t border-border pt-5"><div className="flex justify-between font-extrabold text-navy"><span>Total</span><span>{quote?.valid ? formatCurrency(quote.total) : "—"}</span></div><p className="mt-2 text-xs text-slate">Deposit due now: {quote?.valid ? formatCurrency(quote.total * 0.5) : "—"}</p></div></aside>
      </div>
    </div>
  );
}
