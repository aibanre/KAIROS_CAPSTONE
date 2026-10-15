export default function ReservationStatusBadge({ status }) {
  const classes = {
    Pending: "bg-accent/35 text-navy",
    "Payment Verified": "bg-sky/15 text-primary",
    Confirmed: "bg-blue-100 text-blue-800",
    "Checked In": "bg-blue-100 text-blue-800",
    "No Show": "bg-slate-100 text-slate-700",
    Completed: "bg-emerald-100 text-emerald-800",
    Cancelled: "bg-red-100 text-red-700",
    Rejected: "bg-red-100 text-red-700",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes[status] || classes.Pending}`}>{status}</span>;
}
