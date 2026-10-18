import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "../../config/api.js";
import formatCurrency from "../../customer/utils/formatCurrency";
import { useCustomerAuth } from "../../customer/context/CustomerAuthContext";
import { isValidEmail, isValidPhone } from "../../customer/utils/validators";
import { formatDate, formatVenueWindow } from "../../customer/utils/dateHelpers";
import { getImageUrl } from "../utils/parseImages.js";
import VenuePackageInfo from "../components/VenuePackageInfo.jsx";
import HoldTimerBar from "../../shared/components/HoldTimerBar.jsx";
import useHoldCountdown from "../../shared/hooks/useHoldCountdown.js";

function Field({ label, ...props }) {
  return <label className="block text-[10px] font-semibold uppercase text-slate-500">{label}<input {...props} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none placeholder:text-slate-400 focus:border-sky-500" /></label>;
}

function minutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

export default function VenueBookingInformationPage() {
  const { venueId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hold = useMemo(() => JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null"), []);
  const { user } = useCustomerAuth();
  const eventDate = searchParams.get("event_date") || "";
  const reservationId = hold?.reservation_id || searchParams.get("reservation_id");
  const reservationToken = hold?.access_token || "";
  const completedRef = useRef(false);
  const [venue, setVenue] = useState(null);
  const [packages, setPackages] = useState([]);
  const [availability, setAvailability] = useState({ booked_ranges: [], valid_start_times: [] });
  const [packageId, setPackageId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [pax, setPax] = useState(1);
  const [extraHours, setExtraHours] = useState(0);
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", email: "", phone: "", address: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const secondsLeft = useHoldCountdown(hold?.hold_expires_at, hold?.server_time);

  const selectedPackage = packages.find((item) => String(item.package_id) === String(packageId));
  const isPackaged = venue?.booking_mode === "packaged";
  const minPax = isPackaged ? Math.max(100, Number(selectedPackage?.min_pax || 1)) : 1;
  const maxPax = isPackaged ? Math.min(Number(selectedPackage?.max_pax || venue?.capacity || 1), Number(venue?.capacity || 1)) : Number(venue?.capacity || 1);
  const availableStarts = useMemo(() => {
    const starts = availability.valid_start_times || [];
    const duration = isPackaged
      ? (Number(selectedPackage?.included_hours || 0) + Number(extraHours || 0)) * 60
      : null;
    return starts.filter((start) => {
      const startMinutes = minutes(start);
      if (startMinutes === null) return false;
      const endMinutes = duration === null ? minutes(venue?.end_time) : startMinutes + duration;
      return endMinutes !== null && !availability.booked_ranges?.some((range) => (
        startMinutes < minutes(range.end_time) && endMinutes > minutes(range.start_time)
      ));
    });
  }, [availability, extraHours, isPackaged, selectedPackage, venue]);
  const maxExtraHours = selectedPackage && startTime
    ? Math.max(0, Math.floor((minutes(venue?.latest_end) - (minutes(startTime) + Number(selectedPackage.included_hours || 0) * 60)) / 60))
    : 0;
  const requiredFieldsFilled = customer.firstName.trim() && customer.lastName.trim()
    && isValidEmail(customer.email) && isValidPhone(customer.phone) && customer.address.trim();

  useEffect(() => {
    if (!reservationId || !eventDate) navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venueId)}`, { replace: true });
  }, [eventDate, navigate, reservationId, venueId]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    sessionStorage.removeItem("kairos_reservation_hold");
    navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venueId)}&message=${encodeURIComponent("Your hold expired. Please choose a new date.")}`, { replace: true });
  }, [navigate, secondsLeft, venueId]);

  useEffect(() => () => {
    if (completedRef.current || !reservationId) return;
    fetch(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/hold`, {
      method: "DELETE",
      credentials: "include",
      headers: reservationToken ? { "X-Reservation-Token": reservationToken } : undefined,
      keepalive: true,
    }).catch(() => {});
  }, [reservationId, reservationToken]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}`, { signal: controller.signal, credentials: 'include' }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load venue details.");
        return data.venue;
      }),
      fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/packages`, { signal: controller.signal, credentials: 'include' }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load venue packages.");
        return data.packages || [];
      }),
    ])
      .then(([nextVenue, nextPackages]) => {
        setVenue(nextVenue);
        setPackages(nextPackages);
        const holdPackageId = hold?.package_id || searchParams.get("package_id") || "";
        const restoredPackage = nextPackages.find((item) => String(item.package_id) === String(holdPackageId));
        setPackageId(restoredPackage ? String(restoredPackage.package_id) : "");
        setPax(Number(restoredPackage?.min_pax || 1));
        setCustomer({
          firstName: user?.full_name?.split(" ")[0] || "",
          lastName: user?.full_name?.split(" ").slice(1).join(" ") || "",
          email: user?.email || "",
          phone: user?.phone_number || user?.phone || "",
          address: "",
        });
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [user, venueId]);

  useEffect(() => {
    if (selectedPackage?.pricing_type === "per_person" && pax < 100) setPax(100);
  }, [pax, selectedPackage]);

  useEffect(() => {
    if (!eventDate || !venue || !reservationId) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ date: eventDate, hold_id: String(reservationId) });
    fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/availability?${params}`, {
      signal: controller.signal,
      credentials: "include",
      headers: reservationToken ? { "X-Reservation-Token": reservationToken } : undefined,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load availability.");
        setAvailability(data);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      });
    return () => controller.abort();
  }, [eventDate, reservationId, reservationToken, venue, venueId]);

  useEffect(() => {
    if (startTime && !availableStarts.includes(startTime)) setStartTime("");
  }, [availableStarts, startTime]);

  useEffect(() => {
    setStartTime("");
    setExtraHours(0);
    setQuote(null);
  }, [eventDate, packageId]);

  useEffect(() => {
    if (!eventDate || !startTime || !venue || (isPackaged && !packageId)) {
      setQuote(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ date: eventDate, start: startTime, pax: String(pax), extra_hours: String(extraHours) });
      if (isPackaged) params.set("package_id", packageId);
      params.set("hold_id", String(reservationId));
      fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/quote?${params}`, {
        signal: controller.signal,
        credentials: "include",
        headers: reservationToken ? { "X-Reservation-Token": reservationToken } : undefined,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.reason || data.error || "Failed to calculate venue quote.");
          setQuote(data);
        })
        .catch((quoteError) => {
          if (quoteError.name !== "AbortError") setQuote({ valid: false, reason: quoteError.message });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [eventDate, extraHours, isPackaged, packageId, pax, reservationId, reservationToken, startTime, venue, venueId]);

  function updateCustomer(event) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: name === "phone" ? value.replace(/\D/g, "").slice(0, 11) : value }));
  }

  async function changeDate() {
    try {
      await fetch(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/hold`, {
        method: "DELETE",
        credentials: "include",
        headers: reservationToken ? { "X-Reservation-Token": reservationToken } : undefined,
      });
    } finally {
      completedRef.current = true;
      sessionStorage.removeItem("kairos_reservation_hold");
      navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venueId)}`);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!quote?.valid || !requiredFieldsFilled) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/hold`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(reservationToken ? { "X-Reservation-Token": reservationToken } : {}) },
        body: JSON.stringify({
          event_date: eventDate,
          start_time: startTime,
          package_id: isPackaged ? Number(packageId) : undefined,
          pax,
          extra_hours: extraHours,
          num_guests: pax,
          first_name: customer.firstName,
          last_name: customer.lastName,
          email: customer.email,
          phone_number: customer.phone,
          address: customer.address,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const holdError = new Error(data.error || "Could not update your booking hold.");
        holdError.status = response.status;
        throw holdError;
      }
      completedRef.current = true;
      sessionStorage.setItem("kairos_reservation_hold", JSON.stringify({ ...hold, ...data }));
      navigate(`/payment/${reservationId}`, { state: { ...hold, ...data, access_token: reservationToken } });
    } catch (submitError) {
      if (submitError.status === 409) {
        setError("That time slot is no longer available. Please choose another time.");
        setStartTime("");
        const response = await fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/availability?date=${encodeURIComponent(eventDate)}&hold_id=${encodeURIComponent(reservationId)}`, { credentials: "include" });
        if (response.ok) setAvailability(await response.json());
      } else if (submitError.status === 410) {
        sessionStorage.removeItem("kairos_reservation_hold");
        navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venueId)}&message=${encodeURIComponent("Your hold expired. Please choose a new date.")}`, { replace: true });
      } else {
        setError("We could not update your booking right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-slate-600">Loading venue details...</main>;
  if (!venue) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-rose-600">{error || "Venue not found."}</main>;

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500";
  const labelClass = "block text-[10px] font-semibold uppercase text-slate-500";
  const cardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5";

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
      <HoldTimerBar
        secondsLeft={secondsLeft}
        resourceName={venue?.venue_name}
        expiredHref={`/rooms-and-venues-details?venueId=${encodeURIComponent(venueId)}`}
        backLabel="Back to venue"
      />
      <div className="mx-auto max-w-[1120px]">
        <header className="mb-5">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800" style={{ fontFamily: "Lora" }}>Book Your Venue</h1>
          <p className="mt-1 text-sm text-slate-500">Complete your reservation - no account required</p>
        </header>
        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600" role="alert">{error}</p> : null}
        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_230px]">
          <div className="space-y-4">
            <section className={cardClass}>
              <h2 className="text-base font-bold text-slate-700">Customer Information</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="First Name" name="firstName" placeholder="Juan" value={customer.firstName} onChange={updateCustomer} pattern="[A-Za-zÀ-ÿ' -]+" maxLength={50} autoComplete="given-name" required />
                <Field label="Last Name" name="lastName" placeholder="Dela Cruz" value={customer.lastName} onChange={updateCustomer} pattern="[A-Za-zÀ-ÿ' -]+" maxLength={50} autoComplete="family-name" required />
                <Field label="Email Address" name="email" type="email" placeholder="juan@email.com" value={customer.email} onChange={updateCustomer} readOnly={Boolean(user)} maxLength={254} autoComplete="email" required />
                <Field label="Phone Number" name="phone" type="tel" inputMode="numeric" placeholder="09123456789" value={customer.phone} onChange={updateCustomer} maxLength={11} pattern="[0-9]{11}" autoComplete="tel" required />
                <Field label="Address" name="address" placeholder="Your address" value={customer.address} onChange={updateCustomer} maxLength={200} autoComplete="street-address" required />
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-base font-bold text-slate-700">Booking Details</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={labelClass}>
                  <div className="flex items-center justify-between">Event Date<button type="button" onClick={changeDate} className="text-[10px] font-semibold normal-case text-sky-700 hover:underline">Change date</button></div>
                  <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600">{formatDate(eventDate)}</div>
                </div>
                <div className={labelClass}>Venue<div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600">{venue.venue_name}</div></div>
                {isPackaged && (
                <div className="sm:col-span-2">
                  <VenuePackageInfo packages={packages} selectedId={packageId} onChange={(next) => {
                    setPackageId(String(next.package_id));
                    setPax(Math.max(100, Number(next.min_pax || 1)));
                  }} />
                </div>
                )}
                <label className={labelClass}>Start Time<select value={startTime} onChange={(event) => setStartTime(event.target.value)} className={inputClass} required><option value="">Select a start time</option>{availableStarts.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <Field label="Guests / Pax" name="pax" type="number" inputMode="numeric" min={minPax} max={maxPax} value={pax} onChange={(event) => setPax(Math.min(maxPax, Math.max(minPax, Number(event.target.value) || minPax)))} required />
                {isPackaged && selectedPackage?.pricing_type === "per_person" ? <p className="text-[10px] font-normal normal-case text-slate-500">Minimum 100 pax</p> : null}
                {isPackaged ? <label className={labelClass}>Extra Hours<select value={extraHours} onChange={(event) => setExtraHours(Math.min(maxExtraHours, Number(event.target.value)))} className={inputClass}>{Array.from({ length: maxExtraHours + 1 }, (_, value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
              </div>
              {isPackaged && !packageId ? <p className="mt-3 text-xs text-slate-500">Select a package above to continue.</p> : null}
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
            <h2 className="text-base font-bold text-slate-700">Booking Summary</h2>
            <div className="mt-4 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-[10px] text-slate-400">{getImageUrl(venue.images) ? <img src={getImageUrl(venue.images)} alt={venue.venue_name} className="h-full w-full object-cover" /> : "Venue photo unavailable"}</div>
            <p className="mt-3 text-xs font-medium text-slate-700">{venue.venue_name}</p>
            <p className="mt-1 text-[10px] text-slate-500">{quote?.valid ? formatVenueWindow(eventDate, quote.startTime, quote.endTime) : formatDate(eventDate)}</p>
            <p className="mt-2 text-[10px] text-slate-500">{selectedPackage?.package_name || "Day-use venue"}, {pax} {pax === 1 ? "guest" : "guests"}</p>
            <div className="my-4 border-t border-slate-100" />
            <div className="space-y-2 text-xs text-slate-600"><div className="flex justify-between"><span>{selectedPackage?.package_name || "Venue rental"}</span><span>{quote?.valid ? formatCurrency(quote.total) : "—"}</span></div></div>
            <div className="my-4 border-t border-slate-100" />
            <div className="flex justify-between text-sm font-bold text-slate-700"><span>Total</span><span>{quote?.valid ? formatCurrency(quote.total) : "—"}</span></div>
            {quote && !quote.valid && quote.reason ? <p className="mt-3 text-[10px] text-rose-600">{quote.reason}</p> : null}
            {!quote ? <p className="mt-3 text-[10px] text-slate-500">Select a start time to see your total.</p> : null}
            <a href="/payment-policy" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[10px] font-semibold text-sky-700 hover:underline">Read our Payment Policy</a>
            <p className="mt-3 text-[10px] text-slate-500">All bookings are final. Cancellations, refunds, and rebooking are not available.</p>
            <button type="submit" disabled={isSubmitting || !quote?.valid || !requiredFieldsFilled || (isPackaged && !packageId)} className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? "Saving information..." : "Continue to Payment"}</button>
          </aside>
        </form>
      </div>
    </main>
  );
}