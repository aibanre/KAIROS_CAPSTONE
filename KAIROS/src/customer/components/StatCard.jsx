export default function StatCard({ label, value, icon: Icon, tone = "blue" }) {
  const tones = {
    blue: "bg-primary/10 text-primary",
    yellow: "bg-accent/25 text-navy",
    green: "bg-emerald-100 text-emerald-700",
    sky: "bg-sky/10 text-sky",
  };

  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-navy">{value}</p>
        </div>
        <span className={`grid size-11 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon size={21} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
