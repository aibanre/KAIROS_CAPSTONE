import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config/api.js";
import { isDateBooked } from "../utils/dateHelpers";
import { rangeHasBooked } from "../../public/utils/dateRange.js";

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthFromDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function AvailabilityCalendar({
  bookedDates: initialBookedDates = [],
  roomId,
  venueId,
  selectedStart,
  selectedEnd,
  selectionMode = "range",
  onSelect,
  onBookedDatesChange,
}) {
  const selectedMonth = monthFromDate(selectedStart || selectedEnd);
  const [viewDate, setViewDate] = useState(() => selectedMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [bookedDates, setBookedDates] = useState(initialBookedDates);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = todayKey();
  const currentMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1);
  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = useMemo(() => {
    const count = new Date(year, month + 1, 0).getDate();
    const leading = new Date(year, month, 1).getDay();
    return [
      ...Array.from({ length: leading }, (_, index) => ({ key: `empty-${index}`, empty: true })),
      ...Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { key: date, day, date };
      }),
    ];
  }, [month, year]);

  useEffect(() => {
    const nextMonth = monthFromDate(selectedStart || selectedEnd);
    if (nextMonth && monthKey(nextMonth) !== monthKey(viewDate)) setViewDate(nextMonth);
  }, [selectedEnd, selectedStart, viewDate]);

  useEffect(() => {
    const resourceId = roomId || venueId;
    if (!resourceId) return undefined;
    const controller = new AbortController();
    const resource = roomId ? "rooms" : "venues";
    setLoading(true);
    setError("");
    const monthsToLoad = roomId && selectedStart
      ? [{ year, month: month + 1 }, { year: month === 11 ? year + 1 : year, month: month === 11 ? 1 : month + 2 }]
      : [{ year, month: month + 1 }];
    const hold = resource === "venues"
      ? JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null")
      : null;
    const holdQuery = hold?.reservation_id ? `&hold_id=${encodeURIComponent(hold.reservation_id)}` : "";
    Promise.all(monthsToLoad.map(({ year: requestYear, month: requestMonth }) =>
      fetch(`${API_URL}/api/${resource}/${encodeURIComponent(resourceId)}/booked-dates?year=${requestYear}&month=${requestMonth}${holdQuery}`, { signal: controller.signal, credentials: "include" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Failed to load availability.");
          return data.bookedDates || data.booked_dates || [];
        })
    )).then((dateLists) => {
        const nextBookedDates = [...new Set(dateLists.flat())];
        setBookedDates(nextBookedDates);
        onBookedDatesChange?.(nextBookedDates);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setBookedDates([]);
          onBookedDatesChange?.([]);
          setError(loadError.message);
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [month, onBookedDatesChange, roomId, selectedStart, venueId, year]);

  const moveMonth = (delta) => setViewDate(new Date(year, month + delta, 1));

  return (
    <div className="rounded-3xl border border-border bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Availability</p>
          <h3 className="font-serif text-xl font-bold text-navy">{viewDate.toLocaleString("en-US", { month: "long" })} {year}{loading ? " …" : ""}</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate"><span><i className="mr-1 inline-block size-2 rounded-full bg-primary" />Selected</span><span><i className="mr-1 inline-block size-2 rounded-full bg-border" />Booked</span>{roomId && selectionMode === "range" ? <span><i className="mr-1 inline-block size-2 rounded-full bg-amber-200 ring-1 ring-amber-400" />Checkout only</span> : null}</div>
      </div>
      <div className="grid grid-cols-7 text-center">
        <div className="col-span-7 mb-2 flex justify-between text-xs text-slate-400"><button type="button" onClick={() => moveMonth(-1)} disabled={monthKey(viewDate) === monthKey(currentMonth)} className="disabled:cursor-not-allowed disabled:opacity-40">‹ Prev</button><button type="button" onClick={() => moveMonth(1)}>Next ›</button></div>
        {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} className="py-2 text-xs font-bold text-slate">{label}</span>)}
        {days.map((day) => {
          if (day.empty) return <span key={day.key} />;
          const booked = isDateBooked(day.date, bookedDates);
          const selected = selectionMode === "single" ? day.date === selectedStart : day.date === selectedStart || day.date === selectedEnd;
          const checkoutOnly = selectionMode === "range"
            && roomId
            && selectedStart
            && !selectedEnd
            && day.date > selectedStart
            && booked
            && !rangeHasBooked(selectedStart, day.date, new Set(bookedDates));
          const rangeBlocked = selectionMode === "range"
            && roomId
            && selectedStart
            && !selectedEnd
            && day.date > selectedStart
            && rangeHasBooked(selectedStart, day.date, new Set(bookedDates));
          const disabled = selectionMode === "single"
            ? booked || day.date < today
            : roomId
              ? day.date < today || (!selectedStart && booked) || (selectedEnd && booked) || (!selectedEnd && selectedStart && (day.date <= selectedStart || rangeBlocked))
              : booked || day.date < today;
          return (
            <button
              key={day.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(day.date)}
              className={`m-0.5 aspect-square rounded-xl text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary ${
                selected ? "bg-primary text-white" : checkoutOnly ? "bg-amber-100 text-amber-800 ring-1 ring-amber-400" : booked ? "cursor-not-allowed bg-red-100 text-red-600 line-through" : day.date < today || disabled ? "cursor-not-allowed text-slate/40" : "text-navy hover:bg-tint"
              }`}
              aria-label={`${day.date}${checkoutOnly ? ", checkout only" : booked ? ", booked" : day.date < today ? ", past date" : disabled ? ", unavailable for this range" : ""}`}
            >
              {day.day}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-xs text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
