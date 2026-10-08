import { getMonthDays, isDateBooked } from "../utils/dateHelpers";

export default function AvailabilityCalendar({ bookedDates = [], selectedStart, selectedEnd, onSelect }) {
  const days = getMonthDays();
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="rounded-3xl border border-border bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Availability</p>
          <h3 className="font-serif text-xl font-bold text-navy">April 2026</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate"><span><i className="mr-1 inline-block size-2 rounded-full bg-primary" />Selected</span><span><i className="mr-1 inline-block size-2 rounded-full bg-border" />Booked</span></div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {weekdayLabels.map((label) => <span key={label} className="py-2 text-xs font-bold text-slate">{label}</span>)}
        {days.map((day) => {
          if (day.empty) return <span key={day.key} />;
          const booked = isDateBooked(day.date, bookedDates);
          const selected = day.date === selectedStart || day.date === selectedEnd;
          return (
            <button
              key={day.key}
              type="button"
              disabled={booked}
              onClick={() => onSelect?.(day.date)}
              className={`m-0.5 aspect-square rounded-xl text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary ${
                booked ? "cursor-not-allowed bg-border/50 text-slate/50 line-through" : selected ? "bg-primary text-white" : "text-navy hover:bg-tint"
              }`}
              aria-label={`${day.date}${booked ? ", booked" : ""}`}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
