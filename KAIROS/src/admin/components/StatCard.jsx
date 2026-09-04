export default function StatCard({ label, value, icon: Icon, iconBackground = 'bg-sky-100' }) {
    return (
        <article className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-full ${iconBackground}`}>
                {Icon ? <Icon className="h-5 w-5 text-sky-700" /> : null}
            </div>
        </article>
    )
}
