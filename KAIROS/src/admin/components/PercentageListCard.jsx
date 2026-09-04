export default function PercentageListCard({ title, items = [] }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <div className="mt-4 divide-y divide-slate-100">
                {items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-4 py-2 text-sm">
                        <span className="truncate text-slate-600">{item.name}</span>
                        <span className="font-semibold text-slate-600">{item.value}%</span>
                    </div>
                ))}
            </div>
        </section>
    )
}
