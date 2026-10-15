import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaBed, FaCalendarAlt, FaChartLine, FaCreditCard, FaDoorOpen, FaExclamationCircle, FaSignOutAlt, FaSyncAlt } from 'react-icons/fa'
import BookingTrendsChart from '../components/BookingTrendsChart.jsx'
import OccupancyDonutChart from '../components/OccupancyDonutChart.jsx'
import RankedListCard from '../components/RankedListCard.jsx'
import StatCard from '../components/StatCard.jsx'
import { formatDateOnly, formatDateTime } from '../utils/formatDate.js'

const API_URL = `${API_BASE_URL}/api/admin/dashboard`

function formatPrice(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
}

function formatManilaDateTime(value) {
    return formatDateTime(value) === 'N/A' ? '' : formatDateTime(value)
}

function mapDashboard(data) {
    const revenue = data.revenue || {}
    const occupancy = data.occupancy || {}
    const actionItems = data.action_items || {}
    const popular = data.popular || {}
    const errors = new Set(data.section_errors || [])
    const max = (items) => Math.max(...items.map((item) => Number(item.bookings || 0)), 0)
    const roomItems = (popular.rooms || []).map((item) => ({ name: item.name, value: Number(item.bookings || 0) }))
    const venueItems = (popular.venues || []).map((item) => ({ name: item.name, value: Number(item.bookings || 0) }))

    return {
        stats: [
            { label: 'BOOKINGS (MONTH-TO-DATE)', value: Number(data.booking_trend?.[data.booking_trend.length - 1]?.bookings || 0), icon: FaCalendarAlt, iconBackground: 'bg-sky-50' },
            { label: "TODAY'S CHECK INS", value: data.today?.arrivals ?? 0, icon: FaChartLine, iconBackground: 'bg-cyan-50' },
            { label: "TODAY'S CHECK OUTS", value: data.today?.departures ?? 0, icon: FaSignOutAlt, iconBackground: 'bg-amber-50' },
            { label: 'OCCUPANCY RATE', value: `${occupancy.occupied_percentage ?? 0}%`, icon: FaBed, iconBackground: 'bg-emerald-50' },
            { label: 'REVENUE (MONTH-TO-DATE)', value: revenue ? formatPrice(revenue.current_month) : 'Unavailable', icon: FaCreditCard, iconBackground: 'bg-sky-50' },
            { label: 'PENDING PAYMENTS', value: actionItems.pending_payments?.count ?? 0, icon: FaDoorOpen, iconBackground: 'bg-rose-50' },
            { label: 'OUTSTANDING BALANCES', value: formatPrice(revenue.outstanding_balances?.amount), icon: FaCreditCard, iconBackground: 'bg-amber-50', secondary: `${revenue.outstanding_balances?.reservations || 0} reservations` },
        ],
        bookingData: data.booking_trend || [],
        occupancyData: [{ name: 'Occupied', value: occupancy.occupied_percentage ?? 0 }, { name: 'Available', value: occupancy.available_percentage ?? 0 }],
        popularRooms: roomItems.map((item) => ({ ...item, maxValue: max(roomItems) })),
        popularVenues: venueItems.map((item) => ({ ...item, maxValue: max(venueItems) })),
        actionItems,
        recentReservations: data.recent_reservations || [],
        errors,
        generatedAt: data.generated_at,
    }
}

function EmptyCard({ children = 'No data available.' }) {
    return <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">{children}</div>
}

function SectionError() {
    return <p className="mt-3 flex items-center gap-2 text-xs text-rose-600"><FaExclamationCircle />Unable to load this section.</p>
}

function ActionList({ title, count, items, linkLabel, linkPath, children }) {
    return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-800">{title}</h2><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{count}</span></div>{items?.length ? <div className="mt-4 divide-y divide-slate-100">{items.map((item) => <Link key={item.booking_reference} to={linkPath} className="block py-3 text-sm transition hover:bg-sky-50"><div className="flex justify-between gap-3"><span className="font-medium text-slate-800">{item.guest}</span><span className="font-mono text-xs text-slate-500">{item.booking_reference}</span></div><p className="mt-1 text-xs text-slate-500">{children(item)}</p></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">No items need attention.</p>}<Link to={linkPath} className="mt-3 inline-block text-sm font-medium text-sky-600 hover:text-sky-800">View {linkLabel}</Link></section>
}

export default function DashboardPage({ dashboard: initialDashboard }) {
    const navigate = useNavigate()
    const [dashboard, setDashboard] = useState(initialDashboard ? mapDashboard(initialDashboard) : null)
    const [isLoading, setIsLoading] = useState(!initialDashboard)
    const [error, setError] = useState('')
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        const loadDashboard = async () => {
            setIsLoading(true)
            setError('')
            try {
                const response = await fetch(API_URL, { credentials: 'include', signal: controller.signal })
                const data = await response.json().catch(() => ({}))
                if (response.status === 401 || response.status === 403) {
                    navigate('/admin/login', { replace: true })
                    throw new Error('Your admin session has expired.')
                }
                if (!response.ok) throw new Error(data.error || 'Unable to load dashboard data.')
                setDashboard(mapDashboard(data))
            } catch (loadError) {
                if (loadError.name !== 'AbortError') setError(loadError.message)
            } finally {
                if (!controller.signal.aborted) setIsLoading(false)
            }
        }
        const refreshWhenVisible = () => { if (!document.hidden) loadDashboard() }
        loadDashboard()
        const interval = window.setInterval(refreshWhenVisible, 60000)
        document.addEventListener('visibilitychange', refreshWhenVisible)
        return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', refreshWhenVisible) }
    }, [navigate, refreshKey])

    const view = dashboard
    const refresh = () => setRefreshKey((key) => key + 1)

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div><h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>{view?.generatedAt ? <p className="mt-1 text-xs text-slate-500">Last updated: {formatManilaDateTime(view.generatedAt)} (Asia/Manila)</p> : null}</div>
                <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"><FaSyncAlt className={isLoading ? 'animate-spin' : ''} />Refresh</button>
            </header>

            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(view?.stats || []).map((stat) => <div key={stat.label}><StatCard {...stat} value={isLoading ? '...' : stat.value} />{stat.secondary && !isLoading ? <p className="mt-1 px-1 text-xs text-slate-500">{stat.secondary}</p> : null}{view?.errors.has('revenue') && stat.label.startsWith('REVENUE') ? <SectionError /> : null}</div>)}
                {view ? <Link to="/admin/reservations" className="text-sm font-medium text-sky-600 hover:text-sky-800">View outstanding balances</Link> : null}
                {!view && isLoading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-200/70" />) : null}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[2fr_1fr]">
                {view?.errors.has('booking_trend') ? <div><EmptyCard>Booking trend unavailable.</EmptyCard><SectionError /></div> : view?.bookingData.length ? <BookingTrendsChart data={view.bookingData} /> : <EmptyCard>No bookings in the last six months.</EmptyCard>}
                {view ? <OccupancyDonutChart data={view.occupancyData} title="Occupancy Tonight" /> : <EmptyCard>Loading occupancy...</EmptyCard>}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {view?.errors.has('popular') ? <div><EmptyCard>Popular resources unavailable.</EmptyCard><SectionError /></div> : view?.popularRooms.length ? <RankedListCard title="Popular Rooms" items={view.popularRooms} /> : <EmptyCard>No room bookings in the last 90 days.</EmptyCard>}
                {view?.errors.has('popular') ? <div><EmptyCard>Popular resources unavailable.</EmptyCard><SectionError /></div> : view?.popularVenues.length ? <RankedListCard title="Popular Venues" items={view.popularVenues} /> : <EmptyCard>No venue bookings in the last 90 days.</EmptyCard>}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {view?.errors.has('action_items') ? <div><EmptyCard>Action items unavailable.</EmptyCard><SectionError /></div> : view ? <ActionList title="Payments awaiting verification" count={view.actionItems.pending_payments?.count || 0} items={view.actionItems.pending_payments?.oldest} linkLabel="Payments" linkPath="/admin/payments">{(item) => `${item.method} - ${formatPrice(item.amount)}`}</ActionList> : <EmptyCard>Loading action items...</EmptyCard>}
                {view?.errors.has('action_items') ? <div><EmptyCard>Action items unavailable.</EmptyCard><SectionError /></div> : view ? <ActionList title="Overdue arrivals" count={view.actionItems.overdue_arrivals?.count || 0} items={view.actionItems.overdue_arrivals?.reservations} linkLabel="Reservations" linkPath="/admin/reservations">{(item) => `${item.room_number || 'Room'} - check-in ${formatDateOnly(item.check_in_date)}`}</ActionList> : <EmptyCard>Loading action items...</EmptyCard>}
                {view?.errors.has('action_items') ? <div><EmptyCard>Action items unavailable.</EmptyCard><SectionError /></div> : view ? <ActionList title="Overdue departures" count={view.actionItems.overdue_departures?.count || 0} items={view.actionItems.overdue_departures?.reservations} linkLabel="Reservations" linkPath="/admin/reservations">{(item) => `${item.room_number || 'Room'} - check-out ${formatDateOnly(item.check_out_date)}`}</ActionList> : <EmptyCard>Loading action items...</EmptyCard>}
            </div>

            <div className="mt-5">
                {view?.errors.has('recent_reservations') ? <div><EmptyCard>Recent reservations unavailable.</EmptyCard><SectionError /></div> : view?.recentReservations.length ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-base font-semibold text-slate-800">Recent Reservations</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-[1] [&_td:first-child]:bg-white [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-[2] [&_th:first-child]:bg-slate-50"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Guest</th><th className="px-5 py-3">Room / venue</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Source</th></tr></thead><tbody className="divide-y divide-slate-100">{view.recentReservations.map((item) => <tr key={item.booking_reference}><td className="px-5 py-3 font-mono text-xs text-slate-500">{item.booking_reference}</td><td className="px-5 py-3 font-medium text-slate-800">{item.guest}</td><td className="px-5 py-3 text-slate-600">{item.resource}</td><td className="px-5 py-3 capitalize text-slate-600">{item.status.replace('_', ' ')}</td><td className="px-5 py-3 capitalize text-slate-600">{item.booking_source}</td></tr>)}</tbody></table></div></section> : <EmptyCard>No recent reservations.</EmptyCard>}
            </div>
        </div>
    )
}
