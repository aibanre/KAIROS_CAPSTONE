import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBed, FaExclamationCircle, FaMoneyBillWave, FaRegClock } from 'react-icons/fa'
import BookingTrendsChart from '../components/BookingTrendsChart.jsx'
import MonthlyRevenueChart from '../components/MonthlyRevenueChart.jsx'
import PercentageListCard from '../components/PercentageListCard.jsx'
import RankedListCard from '../components/RankedListCard.jsx'
import StatCard from '../components/StatCard.jsx'

const API_URL = `${API_BASE_URL}/api/admin/reports`

function getManilaDateParts() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
}

function getDefaultRange() {
    const { year, month } = getManilaDateParts()
    const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
    return { startDate: `${year}-${month}-01`, endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}` }
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function monthSpan(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00Z`)
    const end = new Date(`${endDate}T00:00:00Z`)
    return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1
}

function formatPrice(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
}

function mapReport(report) {
    const summary = report.summary || {}
    const roomOccupancy = report.occupancy?.rooms?.occupied ?? summary.occupancy_rate ?? 0
    const paymentMethods = (report.revenue?.by_payment_method || []).map((item) => ({ name: item.method, value: item.percentage }))
    const customerTypes = [
        { name: 'Registered customers in period', value: report.customers?.registered?.percentage || 0 },
        { name: 'Guest customers in period', value: report.customers?.guest?.percentage || 0 },
    ]
    const topRooms = (report.top_performers?.rooms || []).map((item) => ({ name: `${item.name} (Room)`, value: item.bookings }))
    const topVenues = (report.top_performers?.venues || []).map((item) => ({ name: `${item.name} (Venue)`, value: item.bookings }))
    const topItems = [...topRooms, ...topVenues].sort((left, right) => right.value - left.value).slice(0, 5)
    const maxValue = Math.max(...topItems.map((item) => item.value), 0)

    return {
        stats: [
            { label: 'ROOM OCCUPANCY RATE', value: `${roomOccupancy}%`, icon: FaBed, iconBackground: 'bg-sky-50' },
            { label: 'VERIFIED PAYMENT REVENUE', value: formatPrice(summary.total_revenue), icon: FaMoneyBillWave, iconBackground: 'bg-emerald-50' },
            { label: 'CANCELLATION RATE', value: `${summary.cancellation_rate || 0}%`, icon: FaExclamationCircle, iconBackground: 'bg-rose-50' },
            { label: 'AVG. STAY DURATION', value: `${summary.average_stay_days || 0} days`, icon: FaRegClock, iconBackground: 'bg-cyan-50' },
        ],
        revenueData: report.revenue?.by_month || [],
        bookingData: report.reservations?.by_month || [],
        popularRooms: topItems.map((item) => ({ ...item, maxValue })),
        customerTypes,
        paymentMethods,
        attendanceFees: summary.attendance_fees || { early_checkin: 0, late_checkout: 0 },
        hasRevenue: (report.revenue?.by_month || []).some((item) => item.revenue > 0),
        hasBookings: (report.reservations?.by_month || []).some((item) => item.bookings > 0),
        feesAvailable: summary.fees_available !== false,
        outstandingBalances: summary.outstanding_balances || { amount: 0, reservations: 0 },
        retainedDeposits: summary.deposits_retained_from_cancelled || 0,
        addonCharges: report.revenue?.addons_billed || 0,
        completedWithBalance: summary.completed_with_balance_count || 0,
    }
}

function EmptyReportCard({ children = 'No data for this period.' }) {
    return <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">{children}</div>
}

export default function ReportsPage({ reports: initialReports }) {
    const navigate = useNavigate()
    const defaultRange = getDefaultRange()
    const [startDate, setStartDate] = useState(defaultRange.startDate)
    const [endDate, setEndDate] = useState(defaultRange.endDate)
    const [report, setReport] = useState(initialReports ? mapReport(initialReports) : null)
    const [isLoading, setIsLoading] = useState(!initialReports)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isValidDate(startDate) || !isValidDate(endDate)) {
            setError('Enter valid start and end dates.')
            setIsLoading(false)
            return undefined
        }
        if (startDate > endDate) {
            setError('Start date cannot be after end date.')
            setIsLoading(false)
            return undefined
        }
        if (monthSpan(startDate, endDate) > 24) {
            setError('The report range cannot exceed 24 months.')
            setIsLoading(false)
            return undefined
        }

        const controller = new AbortController()
        const loadReports = async () => {
            setIsLoading(true)
            setError('')
            try {
                const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
                const response = await fetch(`${API_URL}?${params}`, { credentials: 'include', signal: controller.signal })
                const data = await response.json().catch(() => ({}))
                if (response.status === 401 || response.status === 403) {
                    navigate('/admin/login', { replace: true })
                    throw new Error('Your admin session has expired.')
                }
                if (!response.ok) throw new Error(data.error || 'Unable to generate reports.')
                setReport(mapReport(data))
            } catch (loadError) {
                if (loadError.name !== 'AbortError') setError(loadError.message)
            } finally {
                if (!controller.signal.aborted) setIsLoading(false)
            }
        }
        loadReports()
        return () => controller.abort()
    }, [startDate, endDate, navigate])

    const updateDate = (setter) => (event) => setter(event.target.value)
    const view = report

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-slate-800">Reports &amp; Analytics</h1><p className="mt-1 text-sm text-slate-500">Revenue and booking activity for the selected Manila date range.</p></div>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs font-semibold text-slate-500">From<input type="date" value={startDate} onChange={updateDate(setStartDate)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" /></label>
                    <label className="text-xs font-semibold text-slate-500">To<input type="date" value={endDate} onChange={updateDate(setEndDate)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" /></label>
                </div>
            </header>

            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            {isLoading ? <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700" role="status">Loading reports...</p> : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(view?.stats || []).map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>
            {view?.feesAvailable ? <p className="mt-3 text-xs text-slate-500">Attendance fees collected separately from revenue: early check-in {formatPrice(view.attendanceFees.early_checkin)}; late checkout {formatPrice(view.attendanceFees.late_checkout)}</p> : null}
            {view ? <div className="mt-4 grid gap-2 text-sm text-slate-600"><p>Outstanding balances: {formatPrice(view.outstandingBalances.amount)} ({view.outstandingBalances.reservations} reservations)</p><p>Informational: Deposits retained from cancelled reservations: {formatPrice(view.retainedDeposits)}</p><p>Informational: Add-on charges billed: {formatPrice(view.addonCharges)}</p><p>Data-quality flag: completed reservations with balance due: {view.completedWithBalance}</p></div> : null}

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {view?.hasRevenue ? <MonthlyRevenueChart data={view.revenueData} /> : <EmptyReportCard>No verified payment revenue for this period.</EmptyReportCard>}
                {view?.hasBookings ? <BookingTrendsChart data={view.bookingData} /> : <EmptyReportCard>No reservations created in this period.</EmptyReportCard>}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
                {view?.popularRooms.length ? <RankedListCard title="Most Booked Rooms & Venues" items={view.popularRooms} /> : <EmptyReportCard>No active room or venue bookings.</EmptyReportCard>}
                {view?.customerTypes.some((item) => item.value > 0) ? <PercentageListCard title="Customers in Selected Period" items={view.customerTypes} /> : <EmptyReportCard>No customers with reservations in this period.</EmptyReportCard>}
                {view?.paymentMethods.length ? <PercentageListCard title="Verified Payment Methods" items={view.paymentMethods} /> : <EmptyReportCard>No verified payment methods in this period.</EmptyReportCard>}
            </div>

            {view && !view.feesAvailable ? <p className="mt-4 text-xs text-slate-500">Attendance fees are unavailable until the attendance-fee migration is applied.</p> : null}
        </div>
    )
}
