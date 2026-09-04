import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const defaultData = [
    { name: 'Occupied', value: 68 },
    { name: 'Available', value: 32 },
]

const colors = ['#0284c7', '#e2e8f0']

export default function OccupancyDonutChart({ data = defaultData, title = 'Occupancy' }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            <div className="relative mt-2 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={92} paddingAngle={3} stroke="none">
                            {data.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-slate-800">{data[0]?.value ?? 0}%</span>
                    <span className="text-xs text-slate-500">occupied</span>
                </div>
            </div>
            <div className="flex justify-center gap-4 text-xs text-slate-500">
                {data.map((entry, index) => (
                    <span key={entry.name} className="flex items-center gap-1.5">
                        <i className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                        {entry.name} {entry.value}%
                    </span>
                ))}
            </div>
        </section>
    )
}
