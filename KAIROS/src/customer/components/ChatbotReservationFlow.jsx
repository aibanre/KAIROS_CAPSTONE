import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createReservationHold } from "../api/reservationsApi";
import { listRooms } from "../api/roomsApi";
import { getVenuePackages, listVenues, quoteVenue } from "../api/venuesApi";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import ReservationLimitNotice from "../../shared/ReservationLimitNotice.jsx";
import formatCurrency from "../utils/formatCurrency";
import { earliestBookableDate } from "../../public/utils/dateRange.js";

const initialDetails = {
  kind: "room",
  resourceId: "",
  checkIn: "",
  checkOut: "",
  guests: 1,
  children: 0,
  eventDate: "",
  startTime: "",
  packageId: "",
  pax: 1,
  extraHours: 0,
};

function nightsBetween(checkIn, checkOut) {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
}

function availableTime(value) {
  return String(value || "").slice(0, 5);
}

function loadChatbotHold() {
  try {
    const hold = JSON.parse(sessionStorage.getItem("kairos_chatbot_reservation_hold") || "null");
    if (hold?.reservation_id && new Date(hold.hold_expires_at).getTime() > Date.now()) return hold;
    sessionStorage.removeItem("kairos_chatbot_reservation_hold");
  } catch {
    sessionStorage.removeItem("kairos_chatbot_reservation_hold");
  }
  return null;
}

export default function ChatbotReservationFlow({ compact = false }) {
  const { isAuthenticated } = useCustomerAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(() => Boolean(loadChatbotHold()));
  const [details, setDetails] = useState(initialDetails);
  const [rooms, setRooms] = useState([]);
  const [venues, setVenues] = useState([]);
  const [packages, setPackages] = useState([]);
  const [quote, setQuote] = useState(null);
  const [reservation, setReservation] = useState(loadChatbotHold);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [existingHolds, setExistingHolds] = useState([]);
  const [error, setError] = useState("");

  const resources = details.kind === "room" ? rooms : venues;
  const selectedResource = resources.find((item) => String(item.id) === details.resourceId);
  const selectedPackage = packages.find((item) => String(item.package_id) === details.packageId);
  const isPackagedVenue = details.kind === "venue" && selectedResource?.booking_mode === "packaged";

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([listRooms(), listVenues()])
      .then(([roomRows, venueRows]) => {
        setRooms(roomRows.filter((item) => item.status === "available"));
        setVenues(venueRows.filter((item) => item.status === "available"));
      })
      .catch(() => setError("Could not load bookable rooms and venues. Please try again."))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    setPackages([]);
    if (!selectedResource || details.kind !== "venue" || selectedResource.booking_mode !== "packaged") return;
    let cancelled = false;
    getVenuePackages(selectedResource.id)
      .then((rows) => {
        if (cancelled) return;
        setPackages(rows);
        setDetails((current) => ({
          ...current,
          packageId: rows.some((item) => String(item.package_id) === current.packageId)
            ? current.packageId
            : String(rows[0]?.package_id || ""),
          pax: rows.some((item) => String(item.package_id) === current.packageId)
            ? current.pax
            : Number(rows[0]?.min_pax || 1),
        }));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load venue packages. Please try again.");
      });
    return () => { cancelled = true; };
  }, [details.kind, selectedResource?.id, selectedResource?.booking_mode]);

  useEffect(() => {
    setQuote(null);
    setConfirmed(false);
    setReservation(null);
    setError("");
    setExistingHolds([]);
    if (!selectedResource) return undefined;

    if (details.kind === "room") {
      const count = nightsBetween(details.checkIn, details.checkOut);
      if (!details.checkIn || !details.checkOut || count < 1) return undefined;
      if (Number(details.guests) < 1 || Number(details.guests) > selectedResource.capacity) {
        setQuote({ valid: false, reason: `This room accommodates up to ${selectedResource.capacity} adults.` });
        return undefined;
      }
      setQuote({ valid: true, total: Number(selectedResource.price) * count, nights: count });
      return undefined;
    }

    if (!details.eventDate || !details.pax || (isPackagedVenue && (!details.packageId || !details.startTime))) return undefined;
    const params = {
      date: details.eventDate,
      start: isPackagedVenue ? details.startTime : availableTime(selectedResource.start_time || "08:00"),
      pax: String(details.pax),
      extra_hours: String(isPackagedVenue ? details.extraHours : 0),
      ...(isPackagedVenue ? { package_id: details.packageId } : {}),
    };
    let cancelled = false;
    quoteVenue(selectedResource.id, params)
      .then((nextQuote) => {
        if (!cancelled) setQuote(nextQuote);
      })
      .catch(() => {
        if (!cancelled) setQuote({ valid: false, reason: "Could not verify this venue selection. Please try again." });
      });
    return () => { cancelled = true; };
  }, [details, isPackagedVenue, selectedResource]);

  const quoteSummary = useMemo(() => {
    if (!quote?.valid || !selectedResource) return "";
    if (details.kind === "room") return `${quote.nights} night${quote.nights === 1 ? "" : "s"}`;
    return isPackagedVenue ? selectedPackage?.package_name || "Venue package" : "Day-use booking";
  }, [details.kind, isPackagedVenue, quote, selectedPackage, selectedResource]);

  if (!isAuthenticated) return null;

  function update(field, value) {
    if (reservation || submitting) return;
    setDetails((current) => ({
      ...current,
      [field]: value,
      ...(field === "kind" ? { resourceId: "", packageId: "", startTime: "" } : {}),
      ...(field === "resourceId" ? { packageId: "", startTime: "" } : {}),
    }));
    setConfirmed(false);
    setReservation(null);
    setError("");
  }

  async function confirmAndCreateHold(event) {
    event.preventDefault();
    if (!quote?.valid || !selectedResource || !confirmed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const hold = details.kind === "room"
        ? await createReservationHold({
          room_id: Number(selectedResource.id),
          check_in: details.checkIn,
          check_out: details.checkOut,
          num_guests: Number(details.guests),
          children: Number(details.children),
        })
        : await createReservationHold({
          venue_id: Number(selectedResource.id),
          event_date: details.eventDate,
          start_time: isPackagedVenue ? details.startTime : availableTime(selectedResource.start_time || "08:00"),
          package_id: isPackagedVenue ? Number(details.packageId) : undefined,
          pax: Number(details.pax),
          num_guests: Number(details.pax),
          extra_hours: isPackagedVenue ? Number(details.extraHours) : 0,
        });
      setReservation(hold);
      sessionStorage.setItem("kairos_chatbot_reservation_hold", JSON.stringify(hold));
      sessionStorage.setItem("kairos_reservation_hold", JSON.stringify(hold));
    } catch (holdError) {
      if ([401, 403].includes(holdError.status)) {
        navigate("/login");
      } else if (holdError.status === 429) {
        setExistingHolds(holdError.existingHolds || []);
        setError("You have reached the limit for reservations in progress. Continue one of your existing reservations below.");
      } else if (holdError.status === 409) {
        setError("That selection is no longer available. Please choose different dates or another option.");
      } else {
        setError("We could not create your hold. Please review your selection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`border-t border-border bg-white p-3 sm:p-4 ${compact ? "relative" : ""}`}>
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="w-full rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-left text-sm font-bold text-primary hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {expanded ? "Close reservation form" : "Start a reservation"}
      </button>
      {expanded && (
        <form onSubmit={confirmAndCreateHold} className={`${compact ? "absolute inset-x-2 bottom-2 z-20 max-h-[min(75vh,22rem)] shadow-xl" : "mt-3 max-h-[45vh]"} space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm`}>
          {compact && <button type="button" onClick={() => setExpanded(false)} className="float-right rounded-md px-2 py-1 text-xs font-bold text-primary hover:bg-sky-50">Close</button>}
          <p className="text-xs leading-5 text-slate-600">Choose your booking details and review the total. Nothing is held until you confirm below.</p>
          {loading ? <p className="text-slate-600" role="status">Loading bookable options…</p> : (
            <>
              <fieldset disabled={Boolean(reservation) || submitting} className="space-y-3 disabled:opacity-60">
              <label className="block font-semibold text-slate-700">Booking type
                <select value={details.kind} onChange={(event) => update("kind", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
                  <option value="room">Room or cottage</option><option value="venue">Venue</option>
                </select>
              </label>
              <label className="block font-semibold text-slate-700">{details.kind === "room" ? "Room" : "Venue"}
                <select required value={details.resourceId} onChange={(event) => update("resourceId", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
                  <option value="">Choose an option</option>
                  {resources.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.type}</option>)}
                </select>
              </label>
              {details.kind === "room" && selectedResource ? <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="font-semibold text-slate-700">Check-in<input required type="date" min={earliestBookableDate()} value={details.checkIn} onChange={(event) => update("checkIn", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                  <label className="font-semibold text-slate-700">Check-out<input required type="date" min={details.checkIn || earliestBookableDate()} value={details.checkOut} onChange={(event) => update("checkOut", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="font-semibold text-slate-700">Adults<input required type="number" min="1" max={selectedResource.capacity} value={details.guests} onChange={(event) => update("guests", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                  <label className="font-semibold text-slate-700">Children<input type="number" min="0" value={details.children} onChange={(event) => update("children", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                </div>
              </> : null}
              {details.kind === "venue" && selectedResource ? <>
                <label className="block font-semibold text-slate-700">Event date<input required type="date" min={earliestBookableDate()} value={details.eventDate} onChange={(event) => update("eventDate", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                <label className="block font-semibold text-slate-700">Guests / pax<input required type="number" min={isPackagedVenue ? selectedPackage?.min_pax || 1 : 1} max={isPackagedVenue ? selectedPackage?.max_pax || selectedResource.capacity : selectedResource.capacity} value={details.pax} onChange={(event) => update("pax", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                {isPackagedVenue ? <>
                  <label className="block font-semibold text-slate-700">Package<select required value={details.packageId} onChange={(event) => update("packageId", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"><option value="">Choose a package</option>{packages.map((item) => <option key={item.package_id} value={item.package_id}>{item.package_name} — {formatCurrency(item.price)}</option>)}</select></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="font-semibold text-slate-700">Start time<input required type="time" step={Number(selectedResource.slot_step_minutes || 30) * 60} min={availableTime(selectedResource.earliest_start)} max={availableTime(selectedResource.latest_end)} value={details.startTime} onChange={(event) => update("startTime", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                    <label className="font-semibold text-slate-700">Extra hours<input type="number" min="0" value={details.extraHours} onChange={(event) => update("extraHours", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" /></label>
                  </div>
                </> : <p className="rounded-lg bg-white p-2 text-xs text-slate-600">Day-use booking: {availableTime(selectedResource.start_time)}–{availableTime(selectedResource.end_time)}.</p>}
              </> : null}
              </fieldset>
              {quote?.valid && selectedResource ? <div className="rounded-lg border border-sky-200 bg-white p-3">
                <p className="font-bold text-slate-800">Review your booking</p>
                <p className="mt-1 text-slate-600">{selectedResource.name} · {quoteSummary}</p>
                <p className="mt-1 text-slate-600">{details.kind === "room" ? `${details.checkIn} to ${details.checkOut}` : details.eventDate}</p>
                <p className="mt-2 font-bold text-slate-900">Total: {formatCurrency(quote.total)}</p>
                <p className="mt-1 text-xs text-slate-500">A 50% deposit is due to proceed. Bookings are final.</p>
                <p className="mt-1 text-xs text-slate-500">{details.kind === "room" ? "Based on the current nightly rate; the server calculates the final total when creating your hold." : "Server-calculated quote. Availability is checked again when your hold is created."}</p>
              </div> : quote && !quote.valid ? <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800" role="status">{quote.reason || "This selection is not available."}</p> : null}
              {reservation ? <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
                <p className="font-bold">Your reservation hold is ready.</p>
                <p className="mt-1 text-xs">Reference: {reservation.booking_reference}</p>
                <p className="mt-1 text-xs">Complete payment while the 15-minute hold is active.</p>
                <Link to={`/portal/payment/${reservation.reservation_id}`} className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 font-bold text-white hover:bg-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Continue to payment</Link>
              </div> : quote?.valid ? <label className="flex items-start gap-2 rounded-lg bg-white p-3 text-xs leading-5 text-slate-700">
                <input required type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-sky-600" />
                <span>I reviewed these details and confirm I want to create this reservation hold before continuing to payment.</span>
              </label> : null}
              {error ? <p className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">{error}</p> : null}
              <ReservationLimitNotice holds={existingHolds} portal />
              {!reservation ? <button type="submit" disabled={!quote?.valid || !confirmed || submitting} className="w-full rounded-lg bg-accent px-4 py-2.5 font-bold text-navy hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Creating your hold…" : "Confirm booking and create hold"}</button> : null}
            </>
          )}
        </form>
      )}
    </section>
  );
}
