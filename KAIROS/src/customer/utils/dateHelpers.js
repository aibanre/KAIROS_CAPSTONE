export function countNights(start, end) {
  if (!start || !end) return 1;
  const difference = new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`);
  return Math.max(1, Math.ceil(difference / 86400000));
}

export function isDateBooked(date, bookedDates = []) {
  return bookedDates.includes(date);
}

export function formatDate(date) {
  if (!date) return "Select a date";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

export function formatDateRange(start, end) {
  if (!start) return "Dates to be confirmed";
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function sortByStartDate(reservations = []) {
  return [...reservations].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

export function getMonthDays(monthDate = new Date(2026, 3, 1)) {
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
