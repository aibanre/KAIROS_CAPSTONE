import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const defaultData = [
    { month: 'Jan', bookings: 42 },
    { month: 'Feb', bookings: 58 },
    { month: 'Mar', bookings: 51 },
    { month: 'Apr', bookings: 74 },
    { month: 'May', bookings: 68 },
    { month: 'Jun', bookings: 92 },
]

export default function BookingTrendsChart({ data = defaultData }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">Booking Trends</h2>
            <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="bookings" stroke="#0284c7" fill="url(#bookingFill)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    )
}
