import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { FaBed, FaDownload, FaExclamationCircle, FaMoneyBillWave, FaPrint, FaRegClock, FaTimes } from 'react-icons/fa'
import AdminModal from '../components/AdminModal.jsx'
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

function getPresetRange(preset) {
    const { year, month, day } = getManilaDateParts()
    const current = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    let start
    let end
    if (preset === 'this-month') {
        start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))
        end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0))
    } else if (preset === 'last-month') {
        start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1))
        end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0))
    } else if (preset === 'last-3-months') {
        start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 2, 1))
        end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0))
    } else {
        start = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
        end = new Date(Date.UTC(current.getUTCFullYear(), 11, 31))
    }
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
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
    const { role } = useAdminAuth()
    const defaultRange = getDefaultRange()
    const [startDate, setStartDate] = useState(defaultRange.startDate)
    const [endDate, setEndDate] = useState(defaultRange.endDate)
    const [report, setReport] = useState(initialReports ? mapReport(initialReports) : null)
    const [isLoading, setIsLoading] = useState(!initialReports)
    const [error, setError] = useState('')
    const [isExporting, setIsExporting] = useState(false)
    const [preview, setPreview] = useState(null)
    const previewAbortRef = useRef(null)
    const previewRequestRef = useRef(0)
    const previewUrlRef = useRef('')
    const previewButtonRef = useRef(null)

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
    const rangeIsValid = isValidDate(startDate) && isValidDate(endDate) && startDate <= endDate && monthSpan(startDate, endDate) <= 24
    const revokePreviewUrl = () => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = ''
        }
    }
    const invalidatePreview = () => {
        previewRequestRef.current += 1
        previewAbortRef.current?.abort()
        previewAbortRef.current = null
        revokePreviewUrl()
        setPreview(null)
        setIsExporting(false)
    }
    const closePreview = () => {
        invalidatePreview()
        window.setTimeout(() => previewButtonRef.current?.focus(), 0)
    }
    const previewIncomeReport = async () => {
        if (!rangeIsValid || isExporting) return
        previewRequestRef.current += 1
        const requestId = previewRequestRef.current
        previewAbortRef.current?.abort()
        const controller = new AbortController()
        previewAbortRef.current = controller
        setIsExporting(true)
        setError('')
        setPreview({ loading: true, error: '', blobUrl: '', blob: null, filename: '' })
        const timeoutId = window.setTimeout(() => {
            if (requestId !== previewRequestRef.current) return
            controller.abort()
            previewAbortRef.current = null
            setIsExporting(false)
            setPreview({ loading: false, error: 'The income report preview timed out. Please try again.', blobUrl: '', blob: null, filename: '' })
        }, 60000)
        try {
            const params = new URLSearchParams({ start_date: startDate, end_date: endDate })
            const response = await fetch(`${API_URL}/income/pdf?${params}`, { credentials: 'include', signal: controller.signal })
            if (response.status === 401 || response.status === 403) {
                navigate('/admin/login', { replace: true })
                throw new Error('Your admin session has expired.')
            }
            if (response.status === 429) throw new Error('Too many export requests. Please try again later.')
            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Unable to generate the income report.')
            }
            const contentType = (response.headers.get('Content-Type') || '').split(';', 1)[0].toLowerCase()
            if (contentType !== 'application/pdf') {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Unable to generate the income report preview.')
            }
            const blob = await response.blob()
            const disposition = response.headers.get('Content-Disposition') || ''
            const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || `income-report_${startDate}_to_${endDate}.pdf`
            const url = URL.createObjectURL(blob)
            if (requestId !== previewRequestRef.current || controller.signal.aborted) {
                URL.revokeObjectURL(url)
                return
            }
            previewUrlRef.current = url
            setPreview({ loading: false, error: '', blobUrl: url, blob, filename })
        } catch (exportError) {
            if (exportError.name !== 'AbortError' && requestId === previewRequestRef.current) {
                setPreview({ loading: false, error: exportError.message, blobUrl: '', blob: null, filename: '' })
            }
        } finally {
            window.clearTimeout(timeoutId)
            if (requestId === previewRequestRef.current) {
                setIsExporting(false)
                previewAbortRef.current = null
            }
        }
    }
    useEffect(() => {
        invalidatePreview()
    // The initial run is harmless; later runs invalidate the prior range's request/blob.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate])
    useEffect(() => () => {
        previewRequestRef.current += 1
        previewAbortRef.current?.abort()
        revokePreviewUrl()
    // The cleanup must run only when ReportsPage unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const view = report

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div><h1 className="text-2xl font-bold text-slate-800">Reports &amp; Analytics</h1><p className="mt-1 text-sm text-slate-500">Revenue and booking activity for the selected Manila date range.</p></div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-wrap gap-1">
                        {[['this-month', 'This month'], ['last-month', 'Last month'], ['last-3-months', 'Last 3 months'], ['this-year', 'This year']].map(([value, label]) => <button key={value} type="button" onClick={() => { const range = getPresetRange(value); setStartDate(range.startDate); setEndDate(range.endDate) }} className="rounded-md border border-sky-200 bg-sky-50 px-2 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100">{label}</button>)}
                    </div>
                    <label className="text-xs font-semibold text-slate-500">From<input type="date" value={startDate} onChange={updateDate(setStartDate)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" /></label>
                    <label className="text-xs font-semibold text-slate-500">To<input type="date" value={endDate} onChange={updateDate(setEndDate)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" /></label>
                    {role === 'admin' ? <button ref={previewButtonRef} type="button" onClick={previewIncomeReport} disabled={!rangeIsValid || isExporting} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">{isExporting ? 'Generating PDF...' : 'Preview Income Report'}</button> : null}
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
            {preview ? <IncomeReportPreview preview={preview} period={`${startDate} to ${endDate}`} onClose={closePreview} onRetry={previewIncomeReport} /> : null}
        </div>
    )
}

function IncomeReportPreview({ preview, period, onClose, onRetry }) {
    const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 767px)').matches)
    const [iframeFailed, setIframeFailed] = useState(false)
    const [printNotice, setPrintNotice] = useState('')
    const iframeRef = useRef(null)
    const dialogRef = useRef(null)

    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)')
        const update = () => setIsNarrow(media.matches)
        update()
        media.addEventListener?.('change', update)
        return () => media.removeEventListener?.('change', update)
    }, [])

    useEffect(() => {
        setIframeFailed(false)
        if (!preview.loading && preview.blobUrl && !isNarrow) {
            const timer = window.setTimeout(() => setIframeFailed(true), 3000)
            return () => window.clearTimeout(timer)
        }
        return undefined
    }, [preview.loading, preview.blobUrl, isNarrow])

    useEffect(() => {
        const focusables = () => [...dialogRef.current?.querySelectorAll('button:not([disabled]), a[href]') || []]
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
            }
            if (event.key !== 'Tab') return
            const elements = focusables()
            if (!elements.length) return
            const first = elements[0]
            const last = elements[elements.length - 1]
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        dialogRef.current?.querySelector('button:not([disabled]), a[href]')?.focus()
        const hadOverflowHidden = document.body.classList.contains('overflow-hidden')
        document.body.classList.add('overflow-hidden')
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            if (!hadOverflowHidden) document.body.classList.remove('overflow-hidden')
        }
    }, [onClose])

    const download = () => {
        if (!preview.blobUrl) return
        const link = document.createElement('a')
        link.href = preview.blobUrl
        link.download = preview.filename
        link.click()
    }

    const print = () => {
        setPrintNotice('')
        if (isNarrow || iframeFailed) {
        window.open(preview.blobUrl, '_blank', 'noopener,noreferrer')
        setPrintNotice('The preview opened in a new tab. Print it from there.')
        return
        }
        try {
        iframeRef.current?.contentWindow?.print()
            window.setTimeout(() => {
                if (!iframeRef.current?.contentWindow) {
                    window.open(preview.blobUrl, '_blank', 'noopener,noreferrer')
                    setPrintNotice('The preview opened in a new tab. Print it from there.')
                }
            }, 500)
        } catch {
            window.open(preview.blobUrl, '_blank', 'noopener,noreferrer')
            setPrintNotice('The preview opened in a new tab. Print it from there.')
        }
    }

    const handleBackdrop = (event) => {
        if (event.target === event.currentTarget) onClose()
    }
    const showFallback = isNarrow || iframeFailed
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 md:p-4" onMouseDown={handleBackdrop}>
        <div ref={dialogRef} className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-xl md:h-[92vh] md:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="income-report-preview-title">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 md:px-6">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Income report</p><h2 id="income-report-preview-title" className="mt-1 text-lg font-bold text-slate-800">Income Report Preview</h2><p className="mt-1 text-xs text-slate-500">{period}</p></div>
                <button type="button" aria-label="Close income report preview" title="Close" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"><FaTimes /></button>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100 p-2 md:p-4">
                {preview.loading ? <div className="flex h-full items-center justify-center text-sm text-slate-500" role="status">Generating income report preview...</div> : preview.error ? <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm text-rose-700" role="alert">{preview.error}</p><button type="button" onClick={onRetry} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Retry</button></div> : showFallback ? <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-sm text-slate-600">This screen cannot display PDF previews inline. Open the preview in a new tab or download it.</p><div className="flex flex-wrap justify-center gap-2"><a href={preview.blobUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700">Open preview in new tab</a><button type="button" onClick={download} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white"><FaDownload className="mr-1 inline" />Download PDF</button></div></div> : <iframe ref={iframeRef} title={`Income report PDF for ${period}`} src={preview.blobUrl} onError={() => setIframeFailed(true)} className="h-full w-full rounded-lg border border-slate-300 bg-white" />}
            </div>
            {printNotice ? <p className="shrink-0 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800" role="status">{printNotice}</p> : null}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 md:px-6">
                <button type="button" disabled={preview.loading || !preview.blobUrl} onClick={download} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><FaDownload className="h-3 w-3" />Download PDF</button>
                <button type="button" disabled={preview.loading || !preview.blobUrl} onClick={print} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-700 disabled:opacity-50"><FaPrint className="h-3 w-3" />Print</button>
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Close</button>
            </div>
        </div>
    </div>
}
