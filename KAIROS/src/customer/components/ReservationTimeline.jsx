const steps = ["Pending", "Payment Verified", "Confirmed", "Completed"];

export default function ReservationTimeline({ status }) {
  const currentIndex = steps.indexOf(status);
  if (status === "Cancelled") return <div className="rounded-2xl bg-red-50 p-4 font-semibold text-red-800">This reservation has been cancelled.</div>;
  if (status === "No Show") return <div className="rounded-2xl bg-slate-100 p-4 font-semibold text-slate-700">This reservation was marked No Show because check-in was not recorded before its scheduled end.</div>;

  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, index) => {
        const active = index <= currentIndex;
        return (
          <li key={step} className="relative">
            <div className={`mb-2 h-1 rounded-full ${active ? "bg-primary" : "bg-border"}`} />
            <div className="flex items-center gap-2">
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-black ${active ? "bg-primary text-white" : "bg-border text-slate"}`}>{index + 1}</span>
              <span className={`text-sm font-bold ${active ? "text-navy" : "text-slate"}`}>{step}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
