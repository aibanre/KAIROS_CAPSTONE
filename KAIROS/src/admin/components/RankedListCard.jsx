export default function RankedListCard({ title, items = [] }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <div className="mt-5 space-y-4">
                {items.map((item) => {
                    const percentage = item.maxValue ? Math.min(100, (item.value / item.maxValue) * 100) : 0
                    return (
                        <div key={item.name}>
                            <div className="mb-1.5 flex justify-between gap-4 text-sm">
                                <span className="truncate text-slate-600">{item.name}</span>
                                <span className="font-semibold text-slate-800">{item.value}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${percentage}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
