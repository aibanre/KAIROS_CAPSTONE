import { FaBed, FaCalendarAlt, FaChartLine, FaCreditCard, FaDoorOpen, FaSignOutAlt } from 'react-icons/fa'
import BookingTrendsChart from '../components/BookingTrendsChart.jsx'
import OccupancyDonutChart from '../components/OccupancyDonutChart.jsx'
import RankedListCard from '../components/RankedListCard.jsx'
import StatCard from '../components/StatCard.jsx'

const stats = [
    { label: 'TOTAL BOOKINGS (JUL)', value: '102', icon: FaCalendarAlt, iconBackground: 'bg-sky-50' },
    { label: "TODAY'S CHECK INS", value: '8', icon: FaChartLine, iconBackground: 'bg-cyan-50' },
    { label: "TODAY'S CHECK OUTS", value: '5', icon: FaSignOutAlt, iconBackground: 'bg-amber-50' },
    { label: 'OCCUPANCY RATE', value: '74%', icon: FaBed, iconBackground: 'bg-emerald-50' },
    { label: 'MONTHLY REVENUE', value: '₱40K', icon: FaCreditCard, iconBackground: 'bg-sky-50' },
    { label: 'PENDING PAYMENTS', value: '12', icon: FaDoorOpen, iconBackground: 'bg-rose-50' },
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

const popularRooms = [
    { name: 'Room #1', value: 28, maxValue: 28 },
    { name: 'Room #1', value: 21, maxValue: 28 },
    { name: 'Room #1', value: 18, maxValue: 28 },
    { name: 'Room #1', value: 15, maxValue: 28 },
]

const popularVenues = [
    { name: 'Venue #1', value: 12, maxValue: 12 },
    { name: 'Venue #1', value: 9, maxValue: 12 },
    { name: 'Venue #1', value: 7, maxValue: 12 },
    { name: 'Venue #1', value: 5, maxValue: 12 },
]

export default function DashboardPage() {
    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[2fr_1fr]">
                <BookingTrendsChart data={bookingData} />
                <OccupancyDonutChart title="Occupancy Rate" />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <RankedListCard title="Popular Rooms" items={popularRooms} />
                <RankedListCard title="Popular Venues" items={popularVenues} />
            </div>
        </div>
    )
}
