import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const defaultData = [
    { month: 'Jan', revenue: 210000 },
    { month: 'Feb', revenue: 290000 },
    { month: 'Mar', revenue: 360000 },
    { month: 'Apr', revenue: 320000 },
    { month: 'May', revenue: 450000 },
    { month: 'Jun', revenue: 480000 },
    { month: 'Jul', revenue: 520000 },
]

function formatCurrency(value) {
    return `₱${Number(value).toLocaleString('en-PH')}`
}

export default function MonthlyRevenueChart({ data = defaultData }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">Monthly Revenue</h2>
            <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `₱${value / 1000}K`} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#036fa5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}
