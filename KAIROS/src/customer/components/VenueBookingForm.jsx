import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config/api.js";
import { createReservation as createReservationRequest } from "../api/reservationsApi";
import { getVenuePackages } from "../api/venuesApi";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import formatCurrency from "../utils/formatCurrency";
import { isValidEmail, isValidPhone } from "../utils/validators";
import VenuePackageCards from "../../shared/VenuePackageCards.jsx";
import AvailabilityCalendar from "./AvailabilityCalendar";
import { earliestBookableDate } from "../../public/utils/dateRange.js";

function todayKey() { return earliestBookableDate(); }

function timeLabel(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value || "Unavailable";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function displayWindow(date, start, end) {
  if (!date || !start || !end) return "Choose a date and time";
  const parsed = new Date(`${date}T00:00:00`);
  const dateText = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return `${dateText}, ${timeLabel(start)} to ${timeLabel(end)}`;
}

export default function VenueBookingForm({ venue, onCreated, compact = false, date: controlledDate, onDateChange }) {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const isHall = venue?.booking_mode === "packaged";
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState("");
  const [date, setDate] = useState(controlledDate || "");
  const [start, setStart] = useState("");
  const [pax, setPax] = useState(venue?.capacity ? Math.min(1, venue.capacity) : 1);
  const [extraHours, setExtraHours] = useState(0);
  const [availability, setAvailability] = useState({ booked_ranges: [], valid_start_times: [] });
  const [bookedDates, setBookedDates] = useState([]);
  const [quote, setQuote] = useState(null);
  const [contact, setContact] = useState({ name: user?.full_name || "", email: user?.email || "", phone: user?.phone_number || user?.phone || "", address: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const venueId = venue?.venue_id || venue?.id;

  useEffect(() => {
    if (controlledDate !== undefined) setDate(controlledDate || "");
  }, [controlledDate]);

  function updateDate(nextDate) {
    if (nextDate < todayKey()) {
      setError("Bookings must be made at least one day in advance.");
      return;
    }
    if (bookedDates.includes(nextDate)) {
      setError("That date is no longer available.");
      return;
    }
    setDate(nextDate);
    onDateChange?.(nextDate);
  }

  async function loadAvailability() {
    if (!date || !venueId) return;
    const response = await fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/availability?date=${encodeURIComponent(date)}`, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load availability.");
    setAvailability(data);
  }

  const selectedPackage = packages.find((item) => String(item.package_id) === String(packageId));
  const minPax = isHall ? Number(selectedPackage?.min_pax || 1) : 1;
  const maxPax = isHall ? Number(selectedPackage?.max_pax ?? venue?.capacity ?? 1) : Number(venue?.capacity || 1);
  const paxIsValid = Number.isInteger(pax) && pax > 0 && pax <= maxPax && (!selectedPackage || pax >= minPax);

  useEffect(() => {
    if (!venue?.venue_id && !venue?.id) return;
    const id = venueId;
    getVenuePackages(id)
      .then((nextPackages) => {
        setPackages(nextPackages);
      })
      .catch((loadError) => setError(loadError.message));
  }, [venue?.venue_id, venue?.id]);

  useEffect(() => {
    if (!isHall) setStart("08:00");
  }, [isHall]);

  useEffect(() => {
    if (!date || !venue) return undefined;
    const id = venueId;
    const controller = new AbortController();
    fetch(`${API_URL}/api/venues/${encodeURIComponent(id)}/availability?date=${encodeURIComponent(date)}`, { signal: controller.signal, credentials: 'include' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load availability.");
        setAvailability(data);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      });
    if (!isHall) {
      const [year, month] = date.split("-").map(Number);
      fetch(`${API_URL}/api/venues/${encodeURIComponent(id)}/booked-dates?year=${year}&month=${month}`, { credentials: 'include' })
        .then((response) => response.json())
        .then((data) => setBookedDates(data.booked_dates || []))
        .catch(() => setBookedDates([]));
    }
    return () => controller.abort();
  }, [date, venueId, isHall]);

  useEffect(() => {
    if (!date || !start || !venue || (isHall && (!packageId || !selectedPackage || !paxIsValid))) {
      setQuote(null);
      return undefined;
    }
    const id = venueId;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ date, start, pax: String(pax), extra_hours: String(extraHours) });
      if (isHall && selectedPackage) params.set("package_id", String(packageId));
      fetch(`${API_URL}/api/venues/${encodeURIComponent(id)}/quote?${params}`, { signal: controller.signal, credentials: 'include' })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.reason || data.error || "Failed to calculate quote.");
          setQuote(data);
        })
        .catch((quoteError) => {
          if (quoteError.name !== "AbortError") setQuote({ valid: false, reason: quoteError.message });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [date, start, pax, extraHours, packageId, selectedPackage, venueId, isHall, paxIsValid]);

  const availableStarts = useMemo(() => {
    if (!isHall) return ["08:00"];
    const hours = Number(selectedPackage?.included_hours || 5) + Number(extraHours || 0);
    const toMinutes = (value) => {
      const [hour, minute] = String(value).split(":").map(Number);
      return hour * 60 + minute;
    };
    return (availability.valid_start_times || []).filter((value) => {
      const end = toMinutes(value) + hours * 60;
      return !availability.booked_ranges?.some((range) => toMinutes(value) < toMinutes(range.end_time) && end > toMinutes(range.start_time));
    });
  }, [availability, isHall, selectedPackage, extraHours]);

  const maxExtraHours = isHall && selectedPackage && venue?.latest_end && start
    ? Math.max(0, Math.floor((Number(venue.latest_end.split(":")[0]) * 60 + Number(venue.latest_end.split(":")[1]) - (Number(start.split(":")[0]) * 60 + Number(start.split(":")[1]) + Number(selectedPackage.included_hours || 5) * 60)) / 60))
    : 8;

  function updateContact(field, value) {
    setContact((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!date) return setError("Choose an event date.");
    if (!isHall && bookedDates.includes(date)) return setError("That date is no longer available.");
    if (isHall && (!packageId || !selectedPackage)) return setError("Select a package.");
    if (isHall && (!start)) return setError("Choose a start time.");
    if (isHall && !paxIsValid) return setError(`Pax must be between ${minPax} and ${maxPax} for ${selectedPackage?.package_name || "the selected package"}.`);
    if (!quote?.valid) return setError(quote?.reason || "Choose valid booking details.");
    if (!contact.name.trim()) return setError("Enter the guest name.");
    if (!isValidEmail(contact.email)) return setError("Enter a valid email address.");
    if (!isValidPhone(contact.phone)) return setError("Enter a valid Philippine mobile number.");
    setIsSubmitting(true);
    try {
      const [firstName = "", ...lastNameParts] = contact.name.trim().split(/\s+/);
      const data = await createReservationRequest({
        venue_id: Number(venue.venue_id || venue.id),
        event_date: date,
        start_time: isHall ? start : "08:00",
        package_id: isHall ? Number(packageId) : undefined,
        pax: Number(pax),
        extra_hours: isHall ? Number(extraHours) : 0,
        num_guests: Number(pax),
        customer: { first_name: firstName, last_name: lastNameParts.join(" ") || firstName, email: contact.email, phone_number: contact.phone, address: contact.address || "Venue booking" },
      });
      onCreated?.(data);
      if (user) navigate(`/portal/payment/${data.reservation_id}`);
      else {
        sessionStorage.setItem(`reservation_token_${data.reservation_id}`, data.access_token);
        navigate(`/payment/${data.reservation_id}`, { state: { access_token: data.access_token } });
      }
    } catch (submitError) {
      if (submitError.status === 409 || submitError.message === "That time slot is no longer available.") {
        setError("That time slot is no longer available. Availability has been refreshed.");
        loadAvailability().catch((loadError) => setError(loadError.message));
      } else setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!venue) return null;
  return (
    <form onSubmit={submit} className={`rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-7 ${compact ? "" : "mt-8"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="eyebrow">Venue reservation</p><h2 className="section-title">Plan your event</h2></div>
        <p className="text-right text-sm font-bold text-navy">{isHall ? "Choose a package and time" : "Day use: 8:00 AM to 5:00 PM"}<br /><span className="text-xs font-normal text-slate">All bookings are final.</span></p>
      </div>
      {isHall ? <div className="mt-5"><VenuePackageCards packages={packages} selectedId={packageId} onChange={(item) => { setPackageId(String(item.package_id)); setPax(Number(item.min_pax || 1)); setExtraHours(0); }} name="venue-booking-package" /></div> : <p className="mt-5 rounded-xl bg-tint p-4 text-sm text-navy">Flat day-use price: <b>{formatCurrency(venue.flat_price)}</b></p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="filter-label">Event date<input required type="date" min={todayKey()} value={date} onChange={(event) => updateDate(event.target.value)} className="form-control" /></label>
        {isHall ? <label className="filter-label">Start time<select required value={start} onChange={(event) => setStart(event.target.value)} className="form-control"><option value="">Choose a time</option>{availableStarts.map((value) => <option key={value} value={value}>{timeLabel(value)}</option>)}</select></label> : <p className="rounded-xl bg-tint p-3 text-sm text-navy">Booking window<br /><b>8:00 AM to 5:00 PM</b></p>}
        <label className="filter-label">Guests / pax<input required type="number" min={minPax} max={maxPax} value={pax} onChange={(event) => setPax(Number(event.target.value))} className="form-control" /></label>
        {isHall && selectedPackage ? <p className="text-xs text-slate">Package limit: {minPax}-{maxPax} pax</p> : null}
        {isHall && selectedPackage && !paxIsValid ? <p className="mt-1 text-xs font-medium text-red-600">Pax must be between {minPax} and {maxPax}.</p> : null}
        {isHall && <label className="filter-label">Extra hours<select value={extraHours} onChange={(event) => setExtraHours(Number(event.target.value))} className="form-control">{Array.from({ length: maxExtraHours + 1 }, (_, value) => <option key={value} value={value}>{value === 0 ? "None" : `${value} hour${value > 1 ? "s" : ""}`}</option>)}</select></label>}
      </div>
      <div className="mt-5"><AvailabilityCalendar venueId={venueId} selectedStart={date} onSelect={updateDate} onBookedDatesChange={setBookedDates} /></div>
      {quote ? <div className="mt-5 rounded-2xl bg-tint p-4 text-sm">{quote.valid ? <><div className="flex justify-between font-bold text-navy"><span>{displayWindow(date, quote.startTime, quote.endTime)}</span><span>{formatCurrency(quote.total)}</span></div><div className="mt-3 space-y-1 text-slate"><div className="flex justify-between"><span>Base amount</span><span>{formatCurrency(quote.breakdown.base_amount)}</span></div>{quote.breakdown.extra_amount ? <div className="flex justify-between"><span>Extra hours</span><span>{formatCurrency(quote.breakdown.extra_amount)}</span></div> : null}</div></> : <p className="font-bold text-red-700" role="alert">{quote.reason}</p>}</div> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="filter-label">Full name<input required className="form-control" value={contact.name} onChange={(event) => updateContact("name", event.target.value)} /></label><label className="filter-label">Email address<input required type="email" readOnly={Boolean(user)} className="form-control" value={contact.email} onChange={(event) => updateContact("email", event.target.value)} /></label><label className="filter-label">Mobile number<input required className="form-control" value={contact.phone} onChange={(event) => updateContact("phone", event.target.value)} /></label><label className="filter-label">Address<input className="form-control" value={contact.address} onChange={(event) => updateContact("address", event.target.value)} /></label></div>
      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p> : null}
      {isHall && !packageId ? <p className="mt-4 text-sm text-slate">Select a package to continue.</p> : null}
      <button type="submit" disabled={isSubmitting || !quote?.valid} className="mt-6 w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60">{isSubmitting ? "Creating reservation..." : "Create reservation and continue"}</button>
    </form>
  );
}
