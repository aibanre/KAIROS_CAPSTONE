import { FaBed, FaExclamationCircle, FaMoneyBillWave, FaRegClock } from 'react-icons/fa'
import BookingTrendsChart from '../components/BookingTrendsChart.jsx'
import MonthlyRevenueChart from '../components/MonthlyRevenueChart.jsx'
import PercentageListCard from '../components/PercentageListCard.jsx'
import RankedListCard from '../components/RankedListCard.jsx'
import StatCard from '../components/StatCard.jsx'

const stats = [
    { label: 'OCCUPANCY RATE', value: '74%', icon: FaBed, iconBackground: 'bg-sky-50' },
    { label: 'MONTHLY REVENUE', value: '₱510K', icon: FaMoneyBillWave, iconBackground: 'bg-emerald-50' },
    { label: 'CANCELLATION RATE', value: '8%', icon: FaExclamationCircle, iconBackground: 'bg-rose-50' },
    { label: 'AVG. STAY DURATION', value: '3.2 days', icon: FaRegClock, iconBackground: 'bg-cyan-50' },
]

const bookingData = [
    { month: 'Jan', bookings: 42 },
    { month: 'Feb', bookings: 58 },
    { month: 'Mar', bookings: 72 },
    { month: 'Apr', bookings: 66 },
    { month: 'May', bookings: 90 },
    { month: 'Jun', bookings: 94 },
    { month: 'Jul', bookings: 102 },
]

const revenueData = [
    { month: 'Jan', revenue: 210000 },
    { month: 'Feb', revenue: 290000 },
    { month: 'Mar', revenue: 360000 },
    { month: 'Apr', revenue: 320000 },
    { month: 'May', revenue: 450000 },
    { month: 'Jun', revenue: 480000 },
    { month: 'Jul', revenue: 520000 },
]

const popularRooms = [
    { name: 'Deluxe Ocean View', value: 28, maxValue: 28 },
    { name: 'Beach Suite', value: 21, maxValue: 28 },
    { name: 'Family Room', value: 18, maxValue: 28 },
    { name: 'Garden Villa', value: 15, maxValue: 28 },
]

const demographics = [
    { name: 'Local (Philippines)', value: 58 },
    { name: 'International', value: 42 },
    { name: 'Couples', value: 45 },
    { name: 'Families', value: 30 },
    { name: 'Solo Travelers', value: 25 },
]

const paymentMethods = [
    { name: 'GCash', value: 45 },
    { name: 'Bank Transfer', value: 30 },
]

export default function ReportsPage() {
    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Reports &amp; Analytics</h1>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <MonthlyRevenueChart data={revenueData} />
                <BookingTrendsChart data={bookingData} />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
                <RankedListCard title="Most Booked Rooms" items={popularRooms} />
                <PercentageListCard title="Customer Demographics" items={demographics} />
                <PercentageListCard title="Payment Methods" items={paymentMethods} />
            </div>
        </div>
    )
}
