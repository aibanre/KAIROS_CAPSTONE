export default function StatCard({ label, value, icon: Icon, iconBackground = 'bg-sky-100' }) {
    return (
        <article className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="min-w-0">
                <p className="break-words text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
            </div>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBackground}`}>
                {Icon ? <Icon className="h-5 w-5 text-sky-700" /> : null}
            </div>
        </article>
    )
}
