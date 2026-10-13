export default function StatCard({ label, value, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-primary/10 text-primary",
    yellow: "bg-accent/25 text-navy",
    green: "bg-emerald-100 text-emerald-700",
    sky: "bg-sky/10 text-sky",
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-3 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div>
          <p className="text-xs font-semibold leading-4 text-slate sm:text-sm">{label}</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-navy sm:mt-2 sm:text-3xl">{value}</p>
        </div>
        <span className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-11 sm:rounded-xl ${tones[tone]}`}>
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
