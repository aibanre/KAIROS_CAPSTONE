export function countNights(start, end) {
  if (!start || !end) return 1;
  const difference = new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`);
  return Math.max(1, Math.ceil(difference / 86400000));
}

export function isDateBooked(date, bookedDates = []) {
  return bookedDates.includes(date);
}

export function formatDate(date) {
  if (!date) return "Date unavailable";
  const parsed = date instanceof Date
    ? new Date(date.getTime())
    : typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00`)
      : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

export function formatReviewDate(value) {
  if (!value) return "";
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const parsed = normalized instanceof Date ? new Date(normalized.getTime()) : new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatDateRange(start, end) {
  if (!start && !end) return "Dates to be confirmed";
  if (!start) return `Until ${formatDate(end)}`;
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatTime(time) {
  if (!time) return "Time unavailable";
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "Time unavailable";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatVenueWindow(date, start, end) {
  if (!date) return "Event date unavailable";
  if (!start || !end) return formatDate(date);
  return `${formatDate(date)}, ${formatTime(start)} to ${formatTime(end)}`;
}

export function sortByStartDate(reservations = []) {
  return [...reservations].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

export function getMonthDays(monthDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1)) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  const leading = new Date(year, month, 1).getDay();
  return [
    ...Array.from({ length: leading }, (_, index) => ({ key: `empty-${index}`, empty: true })),
    ...Array.from({ length: count }, (_, index) => {
      const day = index + 1;
      return {
        key: `${year}-${month}-${day}`,
        day,
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      };
    }),
  ];
}
