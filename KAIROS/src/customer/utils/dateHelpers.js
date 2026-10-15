export function countNights(start, end) {
  if (!start || !end) return 1;
  const difference = new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`);
  return Math.max(1, Math.ceil(difference / 86400000));
}

export function isDateBooked(date, bookedDates = []) {
  return bookedDates.includes(date);
}

export function formatDate(date) {
  return formatStayDate(date) || "Date unavailable";
}

export function formatStayDate(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
    return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
  }
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
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
  const formattedStart = formatStayDate(start);
  const formattedEnd = formatStayDate(end);
  if (!formattedStart && !formattedEnd) return "";
  if (!formattedStart) return formattedEnd;
  if (!formattedEnd || start === end) return formattedStart;
  return `${formattedStart} – ${formattedEnd}`;
}

export function formatTime(time) {
  if (!time) return "Time unavailable";
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "Time unavailable";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatVenueWindow(date, start, end) {
  const formattedDate = formatStayDate(date);
  if (!formattedDate) return "";
  if (!start || !end) return formattedDate;
  return `${formattedDate}, ${formatTime(start)} to ${formatTime(end)}`;
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
