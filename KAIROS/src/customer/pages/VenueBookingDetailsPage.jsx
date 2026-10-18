import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "../../config/api.js";
import { createReservationHold, updateReservationHold } from "../api/reservationsApi";
import { getVenue, getVenuePackages } from "../api/venuesApi";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatVenueWindow } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";
import { isValidEmail, isValidPhone } from "../utils/validators";
import { getImageUrl } from "../../public/utils/parseImages.js";
import { useBooking } from "../context/BookingContext";
import VenuePackageCards from "../../shared/VenuePackageCards.jsx";
import { earliestBookableDate } from "../../public/utils/dateRange.js";
import ReservationLimitNotice from "../../shared/ReservationLimitNotice.jsx";

export default function VenueBookingDetailsPage() {
  const { venueId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { booking } = useBooking();
  const [hold, setHold] = useState(() => JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null"));
  const [venue, setVenue] = useState(null);
  const [packages, setPackages] = useState([]);
  const [availability, setAvailability] = useState({ booked_ranges: [], valid_start_times: [] });
  const [quote, setQuote] = useState(null);
  const [selection, setSelection] = useState({
    eventDate: params.get("event_date") || booking.startDate || "",
    startTime: params.get("start_time") || "",
    packageId: params.get("package_id") || String(hold?.package_id || ""),
    pax: Number(params.get("pax") || booking.guests || 1),
    extraHours: Number(params.get("extra_hours") || 0),
  });
  const [contact, setContact] = useState({
    firstName: user?.full_name?.trim().split(/\s+/)[0] || "",
    lastName: user?.full_name?.trim().split(/\s+/).slice(1).join(" ") || "",
    email: user?.email || "",
    phone: user?.phone_number || user?.phone || "",
    address: user?.address || "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [holdError, setHoldError] = useState("");
  const [reservationLimitHolds, setReservationLimitHolds] = useState([]);
  const completedRef = useRef(false);
  const eventDate = selection.eventDate;
  const startTime = selection.startTime;
  const packageId = selection.packageId;
  const pax = selection.pax;
  const extraHours = selection.extraHours;
  const hasPackages = venue?.booking_mode === "packaged";
  const selectedPackage = packages.find((item) => String(item.package_id) === String(packageId));
  const packageMinPax = selectedPackage ? Number(selectedPackage.min_pax ?? 1) : 1;
  const packageMaxPax = selectedPackage ? Number(selectedPackage.max_pax ?? venue?.capacity ?? 1) : Number(venue?.capacity || 1);
  const paxIsValid = Number.isInteger(pax) && pax > 0 && pax <= packageMaxPax && (!selectedPackage || pax >= packageMinPax);
  const canRequestQuote = Boolean(eventDate && startTime && venue && (!hasPackages || (selectedPackage && paxIsValid)));
  const bookingKey = JSON.stringify([venueId, eventDate, startTime, packageId, pax, extraHours]);
  const availableStartTimes = useMemo(() => {
    const duration = selectedPackage
      ? (Number(selectedPackage.included_hours || 0) + Number(extraHours || 0)) * 60
      : null;
    const toMinutes = (value) => {
      const [hour, minute] = String(value || "").split(":").map(Number);
      return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
    };
    return (availability.valid_start_times || []).filter((time) => {
      if (duration === null) return true;
      const start = toMinutes(time);
      if (start === null) return false;
      const end = start + duration;
      const latest = toMinutes(venue?.booking_mode === "day_use" ? venue.end_time : venue?.latest_end);
      if (latest !== null && end > latest) return false;
      return !(availability.booked_ranges || []).some((range) => {
        const rangeStart = toMinutes(range.start_time);
        const rangeEnd = toMinutes(range.end_time);
        return rangeStart !== null && rangeEnd !== null && start < rangeEnd && end > rangeStart;
      });
    });
  }, [availability, extraHours, selectedPackage, venue]);

  const maxExtraHours = selectedPackage && startTime && venue?.latest_end
    ? Math.max(0, Math.floor((Number(venue.latest_end.split(":")[0]) * 60 + Number(venue.latest_end.split(":")[1]) - (Number(startTime.split(":")[0]) * 60 + Number(startTime.split(":")[1]) + Number(selectedPackage.included_hours || 0) * 60)) / 60))
    : 0;

  useEffect(() => {
    if (!hold?.hold_expires_at) return undefined;
    const updateRemainingTime = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(hold.hold_expires_at).getTime() - Date.now()) / 1000)));
    updateRemainingTime();
    const timer = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(timer);
  }, [hold?.hold_expires_at]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    sessionStorage.removeItem("kairos_reservation_hold");
    setHold(null);
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
          startTime: current.startTime || (nextVenue.booking_mode === "day_use" ? (nextVenue.start_time || "08:00").slice(0, 5) : ""),
          packageId: current.packageId || "",
          pax: current.pax || 1,
        }));
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [venueId]);

  function updateSelection(field, value) {
    setSelection((current) => ({
      ...current,
      [field]: value,
      ...(field === "eventDate" && hasPackages ? { startTime: "" } : {}),
      ...(field === "eventDate" || field === "startTime" ? { extraHours: 0 } : {}),
    }));
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

  useEffect(() => {
    if (!eventDate || !venue) return undefined;
    const controller = new AbortController();
    const query = new URLSearchParams({ date: eventDate });
    if (hold?.reservation_id) query.set("hold_id", String(hold.reservation_id));
    fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/availability?${query}`, {
      signal: controller.signal,
      credentials: "include",
      headers: hold?.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load venue availability.");
        setAvailability(data);
      })
      .catch((availabilityError) => {
        if (availabilityError.name !== "AbortError") setError(availabilityError.message);
      });
    return () => controller.abort();
  }, [eventDate, hold?.access_token, hold?.reservation_id, venue, venueId]);

  useEffect(() => {
    if (!hasPackages || !canRequestQuote || !quote?.valid || !selectedPackage) return undefined;
    const activeHold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
    if (activeHold?.booking_key === bookingKey
      && activeHold.hold_expires_at
      && new Date(activeHold.hold_expires_at).getTime() > Date.now()) {
      return undefined;
    }

    let cancelled = false;
    async function createSlotHold() {
      try {
        if (activeHold?.reservation_id) {
          await fetch(`${API_URL}/api/reservations/${encodeURIComponent(activeHold.reservation_id)}/hold`, {
            method: "DELETE",
            credentials: "include",
            headers: activeHold.access_token ? { "X-Reservation-Token": activeHold.access_token } : undefined,
          });
          sessionStorage.removeItem("kairos_reservation_hold");
          if (!cancelled) {
            setHold(null);
            setSecondsLeft(null);
          }
        }
        const created = await createReservationHold({
          venue_id: Number(venueId),
          event_date: eventDate,
          start_time: startTime,
          package_id: Number(packageId),
          pax,
          num_guests: pax,
          extra_hours: extraHours,
        });
        if (cancelled) {
          await fetch(`${API_URL}/api/reservations/${encodeURIComponent(created.reservation_id)}/hold`, {
            method: "DELETE",
            credentials: "include",
            headers: created.access_token ? { "X-Reservation-Token": created.access_token } : undefined,
          });
          return;
        }
        const nextHold = { ...created, booking_key: bookingKey };
        sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(nextHold));
        setHold(nextHold);
        setHoldError("");
      } catch (holdCreationError) {
        if (!cancelled && holdCreationError.status === 429) {
          setHoldError("There is a limit on reservations in progress. Continue an existing hold below or try again later.");
          setReservationLimitHolds(holdCreationError.existingHolds || []);
        } else if (!cancelled) {
          setHoldError(holdCreationError.message || "Could not hold this venue time.");
        }
      }
    }
    createSlotHold();
    return () => {
      cancelled = true;
    };
  }, [bookingKey, canRequestQuote, eventDate, extraHours, hasPackages, packageId, pax, quote?.valid, selectedPackage, startTime, venueId]);

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
    setContact((current) => ({
      ...current,
      [field]: field === "phone" ? value.replace(/\D/g, "").slice(0, 11) : value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!quote?.valid) return setError("Please review your venue selection and try again.");
    if (!contact.firstName.trim() || !contact.lastName.trim() || !contact.address.trim()
      || !isValidEmail(contact.email) || !isValidPhone(contact.phone)) {
      return setError("Enter your first name, last name, email address, mobile number, and address.");
    }
    setError("");
    setSubmitting(true);
    try {
      let activeHold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
      if (!activeHold?.reservation_id
        || Number(activeHold.venue_id) !== Number(venueId)
        || String(activeHold.event_date || "").slice(0, 10) !== eventDate
        || (hasPackages && activeHold.booking_key !== bookingKey)) {
        const holdDetails = {
          venue_id: Number(venueId),
          event_date: eventDate,
          start_time: startTime,
          package_id: hasPackages ? Number(packageId) : undefined,
          pax,
          num_guests: pax,
          extra_hours: extraHours,
          ...(params.get("group") === "1" && venue.booking_mode === "day_use" ? { resolve_group: true } : {}),
        };
        activeHold = await createReservationHold(holdDetails);
        activeHold.booking_key = bookingKey;
        sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(activeHold));
        setHold(activeHold);
      }
      const data = await updateReservationHold(activeHold.reservation_id, {
        event_date: eventDate,
        start_time: startTime,
        package_id: hasPackages ? Number(packageId) : undefined,
        pax,
        extra_hours: extraHours,
        num_guests: pax,
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        phone_number: contact.phone,
        address: contact.address,
      });
      if (!data?.reservation_id) throw new Error("The booking hold could not be updated.");
      completedRef.current = true;
      navigate(`/portal/payment/${data.reservation_id}`);
    } catch (submitError) {
      if (submitError.status === 409) {
        setError("That time slot is no longer available. Choose another time.");
      } else if (submitError.status === 410) {
        setError("Your booking hold has expired. Please choose the date again.");
      } else if (submitError.status === 429) {
        setError("There is a limit on reservations in progress. Continue an existing hold below or try again later.");
        setReservationLimitHolds(submitError.existingHolds || []);
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
      <ReservationLimitNotice holds={reservationLimitHolds} portal />
      {secondsLeft !== null ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Your date is held for {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}</p> : null}
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} className="space-y-7 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          {hasPackages ? <section><div className="flex items-center justify-between gap-4"><h2 className="section-title">Choose a package</h2><span className="text-sm text-slate">{packages.length} options</span></div><div className="mt-5"><VenuePackageCards packages={packages} selectedId={packageId} onChange={(item) => { setSelection((current) => ({ ...current, packageId: String(item.package_id), pax: Number(item.min_pax || 1), extraHours: 0 })); setQuote(null); }} name="portal-venue-package" /></div></section> : null}
          <section><h2 className="section-title">Event details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="filter-label">Event date<input required type="date" min={earliestBookableDate()} className="form-control" value={eventDate} onChange={(event) => updateSelection("eventDate", event.target.value)} /></label>
              {hasPackages ? <label className="filter-label">Start time<select required className="form-control" value={startTime} onChange={(event) => updateSelection("startTime", event.target.value)}><option value="">Choose a time</option>{availableStartTimes.map((time) => <option key={time} value={time}>{new Date(`2000-01-01T${time}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</option>)}</select></label> : null}
            <label className="filter-label">Guests / pax<input required type="number" min={selectedPackage ? packageMinPax : 1} max={selectedPackage ? packageMaxPax : venue.capacity || undefined} className="form-control" value={pax} onChange={(event) => updateSelection("pax", Number(event.target.value))} /></label>
            {selectedPackage ? <p className="text-xs text-slate">Package limit: {packageMinPax}-{packageMaxPax} pax</p> : null}
            {hasPackages ? <label className="filter-label">Extra hours<select className="form-control" value={extraHours} onChange={(event) => updateSelection("extraHours", Number(event.target.value))}>{Array.from({ length: maxExtraHours + 1 }, (_, value) => <option key={value} value={value}>{value === 0 ? "None" : `${value} hour${value === 1 ? "" : "s"}`}</option>)}</select></label> : null}
          </div>
          {hasPackages && selectedPackage && !paxIsValid ? <p className="mt-2 text-sm font-medium text-red-600">Pax must be between {packageMinPax} and {packageMaxPax} for {selectedPackage.package_name}.</p> : null}
          {holdError ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{holdError}</p> : null}
          {quote?.valid ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{hold?.booking_key === bookingKey ? "Your selected time is held. " : "Selection verified. "}Current total: {formatCurrency(quote.total)}.</p> : quote?.reason ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{quote.reason}</p> : <p className="mt-4 text-sm text-slate">Choose the event date and venue options to verify availability and calculate your total.</p>}
          </section>
          <section><h2 className="section-title">Guest details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">First name<input required maxLength={50} pattern="[A-Za-zÀ-ÿ' -]+" autoComplete="given-name" className="form-control" value={contact.firstName} onChange={(event) => updateContact("firstName", event.target.value)} /></label>
            <label className="filter-label">Last name<input required maxLength={50} pattern="[A-Za-zÀ-ÿ' -]+" autoComplete="family-name" className="form-control" value={contact.lastName} onChange={(event) => updateContact("lastName", event.target.value)} /></label>
            <label className="filter-label">Email address<input required type="email" readOnly={Boolean(user)} className="form-control" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label>
            <label className="filter-label">Mobile number<input required type="tel" inputMode="numeric" maxLength={11} pattern="[0-9]{11}" autoComplete="tel" className="form-control" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} /></label>
            <label className="filter-label sm:col-span-2">Address<input required maxLength={200} autoComplete="street-address" className="form-control" value={contact.address} onChange={(event) => updateContact("address", event.target.value)} /></label>
          </div></section>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
          {!selectedPackage && hasPackages ? <p className="text-sm text-slate">Select a package to continue.</p> : null}
          <button type="submit" disabled={submitting || !quote?.valid || (hasPackages && (!selectedPackage || !paxIsValid || hold?.booking_key !== bookingKey))} className="w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60">{submitting ? "Creating reservation..." : "Continue to payment"}</button>
        </form>
        <aside className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">Booking summary</p>{venue.image ? <img className="mt-4 h-40 w-full rounded-2xl object-cover" src={getImageUrl(venue.image) || venue.image} alt={venue.name} /> : <div className="mt-4 h-40 rounded-2xl bg-tint" aria-label="No venue image available" />}<h2 className="mt-4 text-xl font-bold text-navy">{venue.name}</h2><p className="mt-2 text-sm text-slate">{eventDate ? formatVenueWindow(eventDate, startTime, quote?.endTime) : "Choose an event date"}</p><p className="mt-2 text-sm text-slate">{selectedPackage?.package_name || (hasPackages ? "Select a package" : "Day-use venue")} · {selectedPackage ? `${pax} pax` : "—"}</p><div className="mt-5 border-t border-border pt-5"><div className="flex justify-between font-extrabold text-navy"><span>Total</span><span>{quote?.valid ? formatCurrency(quote.total) : "—"}</span></div><p className="mt-2 text-xs text-slate">Deposit due now: {quote?.valid ? formatCurrency(quote.total * 0.5) : "—"}</p></div></aside>
      </div>
    </div>
  );
}
