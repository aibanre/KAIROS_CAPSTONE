import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config/api.js";
import formatCurrency from "../../customer/utils/formatCurrency";

function timeLabel(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "Unavailable";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function timeMinutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

export default function VenueSelectionCard({ venue, selectedDate = "", onSelectDate, onSelectedPackage, onReserve }) {
  const navigate = useNavigate();
  const venueId = venue?.venue_id || venue?.id;
  const isHall = venue?.booking_mode === "packaged";
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState("");
  const [start, setStart] = useState("");
  const [pax, setPax] = useState(1);
  const [extraHours, setExtraHours] = useState(0);
  const [availability, setAvailability] = useState({ booked_ranges: [], valid_start_times: [] });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const date = selectedDate;
  const hold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");

  const selectedPackage = packages.find((item) => String(item.package_id) === String(packageId));
  const minPax = isHall ? Number(selectedPackage?.min_pax || 1) : 1;
  const maxPax = isHall ? Number(selectedPackage?.max_pax || venue?.capacity || 1) : Number(venue?.capacity || 1);

  useEffect(() => {
    onSelectDate?.("");
    setStart("");
    setQuote(null);
    setError("");
  }, [venueId]);

  useEffect(() => {
    if (!venueId) return;
    fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/packages`, { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load venue packages.");
        setPackages(data.packages || []);
        if (data.packages?.[0]) {
          setPackageId(String(data.packages[0].package_id));
          setPax(Number(data.packages[0].min_pax || 1));
          onSelectedPackage?.(data.packages[0]);
        }
      })
      .catch((loadError) => setError(loadError.message));
  }, [onSelectedPackage, venueId]);

  useEffect(() => {
    if (!date || !venueId) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ date });
    if (hold?.reservation_id) params.set("hold_id", String(hold.reservation_id));
    fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/availability?${params}`, {
      signal: controller.signal,
      credentials: "include",
      headers: hold?.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
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
  }, [date, hold?.access_token, hold?.reservation_id, venueId, isHall]);

  const availableStarts = useMemo(() => {
    if (!isHall) return ["08:00"];
    const hours = Number(selectedPackage?.included_hours || 5) + Number(extraHours || 0);
    const minutes = (value) => {
      const [hour, minute] = String(value).split(":").map(Number);
      return hour * 60 + minute;
    };
    return (availability.valid_start_times || []).filter((value) => {
      const end = minutes(value) + hours * 60;
      return !availability.booked_ranges?.some((range) => minutes(value) < minutes(range.end_time) && end > minutes(range.start_time));
    });
  }, [availability, extraHours, isHall, selectedPackage]);

  const latestEndMinutes = timeMinutes(venue?.latest_end);
  const startMinutes = timeMinutes(start);
  const maxExtraHours = isHall && selectedPackage && latestEndMinutes !== null && startMinutes !== null
    ? Math.max(0, Math.floor((latestEndMinutes - (startMinutes + Number(selectedPackage.included_hours || 5) * 60)) / 60))
    : 0;

  useEffect(() => {
    if (!isHall) {
      setStart("08:00");
      return;
    }
    if (start && !availableStarts.includes(start)) setStart("");
  }, [availableStarts, isHall, start]);

  useEffect(() => {
    if (!date || !start || (isHall && !packageId)) {
      setQuote(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ date, start, pax: String(pax), extra_hours: String(extraHours) });
      if (isHall) params.set("package_id", packageId);
      if (hold?.reservation_id) params.set("hold_id", String(hold.reservation_id));
      fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/quote?${params}`, {
        signal: controller.signal,
        credentials: "include",
        headers: hold?.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
      })
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
  }, [date, extraHours, hold?.access_token, hold?.reservation_id, isHall, packageId, pax, start, venueId]);

  function reserve() {
    if (!date || !quote?.valid) return;
    if (onReserve) {
      onReserve({ eventDate: date, startTime: start, pax, extraHours, packageId: isHall ? packageId : "" });
      return;
    }
    const params = new URLSearchParams({ event_date: date, start_time: start, pax: String(pax), extra_hours: String(extraHours) });
    if (isHall) params.set("package_id", packageId);
    navigate(`/book/venue/${venueId}?${params.toString()}`);
  }

  const lowestPackage = packages.reduce((lowest, item) => (!lowest || Number(item.price) < Number(lowest.price) ? item : lowest), null);
  const priceLabel = isHall
    ? `From ${formatCurrency(lowestPackage?.price || 0)}${lowestPackage?.pricing_type === "per_person" ? " / person" : ""}`
    : `${formatCurrency(venue.flat_price)} / day`;

  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
      <div className="border-b border-slate-100 pb-4">
        <div className="text-xl font-bold text-sky-700">{priceLabel}</div>
        <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Available</span>
      </div>
      <div className="mt-4 space-y-3">
        {isHall ? <div>
          <p className="text-[10px] font-semibold uppercase text-slate-500">Package</p>
          <div className="mt-1 space-y-2">
            {packages.map((item) => {
              const selected = String(item.package_id) === String(packageId)
              return <button key={item.package_id} type="button" onClick={() => { setPackageId(String(item.package_id)); setPax(Number(item.min_pax || 1)); setExtraHours(0); onSelectedPackage?.(item); }} className={`w-full rounded-xl border p-3 text-left ${selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="block text-xs font-bold text-slate-800">{item.package_name}</span>
                <span className="mt-1 block text-xs font-semibold text-sky-700">{item.pricing_type === 'per_person' ? `${formatCurrency(item.price)} per person` : `${formatCurrency(item.price)} flat`}</span>
              </button>
            })}
          </div>
        </div> : null}
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          {date ? <span>Event date: <strong>{new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></span> : <span>Pick a date in the calendar</span>}
        </div>
        {isHall ? <label className="block text-[10px] font-semibold uppercase text-slate-500">Start time<select required value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500"><option value="">Choose a time</option>{availableStarts.map((value) => <option key={value} value={value}>{timeLabel(value)}</option>)}</select></label> : <p className="text-[10px] text-slate-500">Booking window: <b>8:00 AM to 5:00 PM</b></p>}
        <label className="block text-[10px] font-semibold uppercase text-slate-500">Guests / pax<input required type="number" min={minPax} max={maxPax} value={pax} onChange={(event) => setPax(Math.min(maxPax, Math.max(minPax, Number(event.target.value) || minPax)))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-sky-500" /></label>
        {isHall && selectedPackage?.extra_hour_rate !== null && maxExtraHours > 0 ? <label className="block text-[10px] font-semibold uppercase text-slate-500">Extra hours<select value={extraHours} onChange={(event) => setExtraHours(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500">{Array.from({ length: maxExtraHours + 1 }, (_, value) => <option key={value} value={value}>{value === 0 ? "None" : `${value} hour${value > 1 ? "s" : ""}`}</option>)}</select></label> : null}
      </div>
      {quote ? <div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-slate-600">{quote.valid ? <><div className="space-y-1"><div className="flex justify-between"><span>Base amount</span><span>{formatCurrency(quote.breakdown.base_amount)}</span></div>{quote.breakdown.extra_amount ? <div className="flex justify-between"><span>Extra hours</span><span>{formatCurrency(quote.breakdown.extra_amount)}</span></div> : null}</div><div className="mt-3 flex justify-between border-t border-sky-100 pt-2 font-bold text-slate-700"><span>Total</span><span>{formatCurrency(quote.total)}</span></div></> : <p className="font-bold text-rose-600" role="alert">{quote.reason}</p>}</div> : null}
      {error ? <p className="mt-3 text-xs text-rose-600" role="alert">{error}</p> : null}
      <button type="button" onClick={reserve} disabled={!quote?.valid || !date || (isHall && (!packageId || !start))} className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">Reserve Now</button>
      <p className="mt-2 text-center text-[10px] text-slate-400">No charge until reservation confirmation.</p>
      <p className="mt-1 text-center text-[10px] text-slate-400">All bookings are final.</p>
    </aside>
  );
}
