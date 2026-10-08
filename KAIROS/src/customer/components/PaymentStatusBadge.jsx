export default function PaymentStatusBadge({ status }) {
  const styles = {
    Unpaid: "bg-amber-100 text-navy",
    "Proof Submitted": "bg-sky/10 text-primary",
    Verified: "bg-emerald-100 text-emerald-800",
    Rejected: "bg-red-100 text-red-700",
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles[status] || "bg-slate-100 text-slate"}`}>
      {status}
    </span>
  );
}
