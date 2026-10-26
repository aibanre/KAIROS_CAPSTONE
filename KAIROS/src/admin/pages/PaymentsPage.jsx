import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FaCheck, FaClock, FaDownload, FaEye, FaExternalLinkAlt, FaFileInvoice, FaSearch, FaTimes } from 'react-icons/fa'
import StatCard from '../components/StatCard.jsx'
import Pagination from '../components/Pagination.jsx'
import { formatDateRange, formatDateTime, formatVenueDateTime } from '../utils/formatDate.js'
import { useAdminToast } from '../context/AdminNotificationsContext.jsx'
import { notifyAdminActionError } from '../utils/adminToastMessages.js'
import useResponsivePageSize from '../hooks/useResponsivePageSize.js'

const statusStyles = {
    Pending: 'bg-amber-100 text-amber-600',
    'Pending verification': 'bg-sky-100 text-sky-700',
    Verified: 'bg-emerald-100 text-emerald-600',
    Rejected: 'bg-rose-100 text-rose-600',
}

const API_URL = `${API_BASE_URL}/api/admin/payments`

function formatPrice(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function normalizeStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'verified') return 'Verified'
    if (normalized === 'rejected') return 'Rejected'
    if (normalized === 'pending_verification') return 'Pending verification'
    return 'Pending'
}

function mapPayment(payment) {
    const guest = [payment.first_name, payment.last_name].filter(Boolean).join(' ') || 'Guest'
    return {
        id: payment.payment_id,
        guest,
        booking: payment.booking_reference,
        amount: Number(payment.amount),
        paymentType: payment.payment_type || 'full',
        reservationTotal: Number(payment.reservation_total || 0),
        method: payment.method_name || 'N/A',
        date: formatDateTime(payment.created_at),
        status: normalizeStatus(payment.payment_status),
        proofUrl: payment.proof_of_payment_url,
        reason: payment.rejection_reason || '',
        verifiedBy: payment.verifier_name || null,
        verifiedByRole: payment.verifier_role || null,
        verifiedAt: payment.verified_at,
        room: payment.room_number || 'Venue reservation',
        checkIn: payment.check_in_date,
        checkOut: payment.check_out_date,
        eventDate: payment.event_date,
        startTime: payment.start_time,
        endTime: payment.end_time,
        isVenue: Boolean(payment.event_date || payment.start_time || payment.end_time || payment.venue_name),
        reservationStatus: payment.reservation_status,
    }
}

function PaymentStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

export default function PaymentsPage({
    payments: initialPayments,
    onExport,
    onGenerateReceipt,
    onViewPayment,
    onVerifyPayment,
    onAcceptPayment,
    onDeclinePayment,
}) {
    const navigate = useNavigate()
    const toast = useAdminToast()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const [payments, setPayments] = useState(initialPayments ?? [])
    const [page, setPage] = useState(1)
    const pageSize = useResponsivePageSize()
    const [isLoading, setIsLoading] = useState(!initialPayments)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('All')
    const [selectedPayment, setSelectedPayment] = useState(null)
    const [confirmAction, setConfirmAction] = useState(null)
    const [declineReason, setDeclineReason] = useState('')
    const [actionState, setActionState] = useState('')
    const [proofError, setProofError] = useState(false)
    const previousPageSizeRef = useRef(pageSize)
    const deepLinkHandledRef = useRef(null)
    const listScrollRef = useRef(null)

    const request = async (url, options = {}) => {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...options.headers },
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            const redirect = `${location.pathname}${location.search}`
            navigate(`/admin/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) {
            const requestError = new Error(data.error || 'Unable to complete the payment request.')
            requestError.status = response.status
            throw requestError
        }
        return data
    }

    const loadPayments = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(API_URL)
            const mappedPayments = (data.payments || []).map(mapPayment)
            setPayments(mappedPayments)
            return mappedPayments
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadPayments() }, [])

    const openPayment = (payment) => {
        setSelectedPayment(payment)
        setConfirmAction(null)
        setDeclineReason(payment.reason || '')
        setProofError(false)
        onViewPayment?.(payment)
    }

    const closePayment = () => {
        if (actionState) return
        setSelectedPayment(null)
        setConfirmAction(null)
    }

    useEffect(() => {
        const paymentIdParam = searchParams.get('paymentId') || ''
        const booking = searchParams.get('booking')
        const deepLinkKey = `${paymentIdParam}:${booking || ''}`
        if (!paymentIdParam && !booking) {
            deepLinkHandledRef.current = null
            return
        }
        if (isLoading || deepLinkHandledRef.current === deepLinkKey) return
        const paymentId = Number(paymentIdParam)
        const payment = (Number.isInteger(paymentId) && paymentId > 0
            ? payments.find((item) => item.id === paymentId)
            : null) || (booking ? payments.find((item) => String(item.booking) === booking) : null)
        if (!payment) return
        const paymentIndex = payments.findIndex((item) => item.id === payment.id)
        if (search || statusFilter !== 'All') {
            setSearch('')
            setStatusFilter('All')
        }
        setPage(Math.floor(paymentIndex / pageSize) + 1)
        openPayment(payment)
        deepLinkHandledRef.current = deepLinkKey
        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('paymentId')
        nextParams.delete('booking')
        setSearchParams(nextParams, { replace: true })
    }, [isLoading, payments, searchParams, setSearchParams, pageSize, search, statusFilter])

    const performDecision = async () => {
        if (!selectedPayment || !confirmAction) return
        const isAccept = confirmAction === 'accept'
        setActionState(confirmAction)
        setError('')
        try {
            const data = await request(`${API_URL}/${selectedPayment.id}/${isAccept ? 'accept' : 'decline'}`, {
                method: 'PATCH',
                body: JSON.stringify(isAccept ? {} : { reason: declineReason.trim() }),
            })
            if (isAccept) onAcceptPayment?.(selectedPayment)
            else onDeclinePayment?.({ ...selectedPayment, reason: declineReason.trim() })
            onVerifyPayment?.(selectedPayment)
            setSelectedPayment(null)
            setConfirmAction(null)
            await loadPayments()
            toast.success(data.message || `Payment ${isAccept ? 'accepted' : 'declined'} successfully.`)
        } catch (decisionError) {
            notifyAdminActionError(toast, decisionError.status === 409 ? 'This payment was already processed.' : decisionError, 'Unable to process this payment.')
            if (decisionError.status === 409) await loadPayments()
        } finally {
            setActionState('')
        }
    }

    const normalizedSearch = search.trim().toLowerCase()
    const pendingCount = payments.filter((payment) => payment.status === 'Pending verification').length
    const filteredPayments = useMemo(() => payments.filter((payment) => {
        const matchesSearch = !normalizedSearch || payment.guest.toLowerCase().includes(normalizedSearch) || String(payment.booking).toLowerCase().includes(normalizedSearch)
        const matchesStatus = statusFilter === 'All' || payment.status === statusFilter
        return matchesSearch && matchesStatus
    }), [payments, normalizedSearch, statusFilter])
    const totalRevenue = payments.filter((payment) => payment.status === 'Verified').reduce((total, payment) => total + payment.amount, 0)
    const pendingVerification = payments.filter((payment) => payment.status === 'Pending verification').reduce((total, payment) => total + payment.amount, 0)
    const pageCount = Math.max(1, Math.ceil(filteredPayments.length / pageSize))
    const currentPage = Math.min(page, pageCount)
    const paginatedPayments = filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    useEffect(() => {
        if (previousPageSizeRef.current !== pageSize) {
            const firstVisibleIndex = (page - 1) * previousPageSizeRef.current
            setPage(Math.floor(firstVisibleIndex / pageSize) + 1)
            previousPageSizeRef.current = pageSize
        }
    }, [page, pageSize])

    useEffect(() => {
        if (page > pageCount) setPage(pageCount)
    }, [page, pageCount])

    useEffect(() => {
        if (!isLoading && !error && listScrollRef.current) listScrollRef.current.scrollTop = 0
    }, [currentPage])

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-800">Payment Management</h1>
                <div className="flex items-center gap-2">
                    
                </div>
            </header>

            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}

            <div className="grid max-w-[490px] gap-4 sm:grid-cols-2">
                <StatCard label="TOTAL REVENUE" value={formatPrice(totalRevenue)} icon={FaDownload} iconBackground="bg-emerald-50" />
                <StatCard label="PENDING VERIFICATION" value={formatPrice(pendingVerification)} icon={FaClock} iconBackground="bg-amber-50" />
            </div>

            <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Search payments</span>
                    <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search guest or booking" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-sky-500" />
                </label>
                <label>
                    <span className="sr-only">Filter payment status</span>
                    <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500 sm:w-auto">
                        <option>All</option>
                        <option value="Pending verification">Pending verification ({pendingCount})</option>
                        <option>Verified</option>
                        <option>Rejected</option>
                    </select>
                </label>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div ref={listScrollRef} className="max-h-[70vh] overflow-y-auto">
                <div className="divide-y divide-slate-100 md:hidden">
                    {isLoading ? <p className="px-4 py-10 text-center text-sm text-slate-500">Loading payments...</p> : null}
                    {!isLoading && paginatedPayments.map((payment) => <article key={payment.id} role="button" tabIndex="0" onClick={() => openPayment(payment)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPayment(payment) } }} className={`space-y-3 p-4 ${payment.status === 'Pending verification' ? 'bg-sky-50/70' : ''} cursor-pointer focus:bg-sky-50 focus:outline-none`}>
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-mono text-xs text-slate-500">Payment #{payment.id}</p><p className="mt-1 break-words font-semibold text-slate-800">{payment.guest}</p><p className="break-words font-mono text-xs text-slate-500">{payment.booking}</p></div><PaymentStatus status={payment.status} /></div>
                        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Amount</dt><dd className="font-bold text-slate-800">{formatPrice(payment.amount)} <span className="block text-xs font-normal text-slate-500">{payment.paymentType}</span></dd></div><div><dt className="text-xs text-slate-500">Method</dt><dd className="break-words text-slate-700">{payment.method}</dd></div><div><dt className="text-xs text-slate-500">Date</dt><dd className="text-slate-700">{payment.date}</dd></div><div><dt className="text-xs text-slate-500">Action</dt><dd><button type="button" aria-label="View payment" onClick={(event) => { event.stopPropagation(); openPayment(payment) }} className="inline-flex h-11 w-11 items-center justify-center text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500"><FaEye /></button></dd></div></dl>
                    </article>)}
                    {!isLoading && filteredPayments.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-500">No payments found.</p> : null}
                </div>
                <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Ref</th>
                                <th className="px-4 py-4">Guest</th>
                                <th className="px-4 py-4">Booking</th>
                                <th className="px-4 py-4">Type / Amount</th>
                                <th className="px-4 py-4">Method</th>
                                <th className="px-4 py-4">Date</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">Loading payments...</td></tr> : null}
                            {!isLoading && paginatedPayments.map((payment) => (
                                <tr key={payment.id} role="button" tabIndex="0" onClick={() => openPayment(payment)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPayment(payment) } }} className={`cursor-pointer text-sm transition hover:bg-sky-50 ${payment.status === 'Pending verification' ? 'bg-sky-50/70' : ''}`}>
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{payment.id}</td>
                                    <td className="px-4 py-4 font-medium text-slate-800">{payment.guest}</td>
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{payment.booking}</td>
                                    <td className="px-4 py-4 font-bold text-slate-800"><span className="block text-xs uppercase text-slate-500">{payment.paymentType}</span>{formatPrice(payment.amount)}<span className="block text-[10px] font-normal text-slate-500">of {formatPrice(payment.reservationTotal)}</span></td>
                                    <td className="max-w-[100px] px-4 py-4 text-slate-500">{payment.method}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{payment.date}</td>
                                    <td className="px-4 py-4"><PaymentStatus status={payment.status} /></td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <button type="button" aria-label="View payment" title="View payment" onClick={(event) => { event.stopPropagation(); openPayment(payment) }} className="text-sky-600 transition hover:text-sky-800"><FaEye className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && filteredPayments.length === 0 ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No payments found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
                </div>
                {!isLoading && !error ? <Pagination page={currentPage} pageSize={pageSize} totalItems={filteredPayments.length} onPageChange={setPage} /> : null}
            </section>
            {selectedPayment ? <PaymentPanel payment={selectedPayment} proofError={proofError} setProofError={setProofError} confirmAction={confirmAction} setConfirmAction={setConfirmAction} declineReason={declineReason} setDeclineReason={setDeclineReason} actionState={actionState} onClose={closePayment} onConfirm={performDecision} /> : null}
        </div>
    )
}

function PaymentPanel({ payment, proofError, setProofError, confirmAction, setConfirmAction, declineReason, setDeclineReason, actionState, onClose, onConfirm }) {
    const isPendingVerification = payment.status === 'Pending verification'
    const dates = payment.isVenue
        ? formatVenueDateTime(payment.eventDate, payment.startTime, payment.endTime)
        : formatDateRange(payment.checkIn, payment.checkOut)
    return <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/40 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
        <aside className="max-h-[90dvh] h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:h-full sm:max-h-none sm:rounded-none sm:p-6" role="dialog" aria-modal="true" aria-labelledby="payment-panel-title">
            <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Payment details</p><h2 id="payment-panel-title" className="mt-1 truncate text-xl font-bold text-slate-800">{payment.booking}</h2></div><button type="button" aria-label="Close payment details" title="Close payment details" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"><FaTimes /></button></div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><Detail label="Guest" value={payment.guest} /><Detail label="Room / venue" value={payment.room} /><Detail label="Dates" value={dates} /><Detail label="Amount" value={formatPrice(payment.amount)} /><Detail label="Method" value={payment.method} /><Detail label="Submitted" value={payment.date} /><div><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1"><PaymentStatus status={payment.status} /></dd></div></dl>
            <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-800">Proof of payment</h3>{payment.proofUrl && !proofError ? <button type="button" onClick={() => window.open(payment.proofUrl, '_blank', 'noopener,noreferrer')} className="group relative mt-3 block w-full cursor-zoom-in overflow-hidden rounded-lg border border-slate-200"><img src={payment.proofUrl} alt="Payment proof" onError={() => setProofError(true)} className="max-h-72 w-full object-contain" /><span className="absolute bottom-2 right-2 rounded bg-slate-900/70 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"><FaExternalLinkAlt className="mr-1 inline h-3 w-3" />Open full size</span></button> : <div className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">Proof image unavailable.</div>}</div>
            {!isPendingVerification ? <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-800">{payment.status}</p><p className="mt-1">Verified by: {payment.verifiedBy || 'Unavailable'}</p><p>Processed: {formatDateTime(payment.verifiedAt)}</p>{payment.reason ? <p className="mt-2">Reason: {payment.reason}</p> : null}</div> : null}
            {isPendingVerification && !confirmAction ? <div className="mt-6 flex gap-3"><button type="button" onClick={() => setConfirmAction('accept')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><FaCheck />Accept</button><button type="button" onClick={() => setConfirmAction('decline')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"><FaTimes />Decline</button></div> : null}
            {isPendingVerification && confirmAction ? <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">{confirmAction === 'accept' ? 'Accept this payment proof?' : 'Decline this payment proof?'}</p>{confirmAction === 'decline' ? <label className="mt-3 block text-xs font-semibold text-slate-600">Reason (optional)<textarea maxLength="255" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-sky-500" /></label> : null}<div className="mt-4 flex justify-end gap-3"><button type="button" disabled={Boolean(actionState)} onClick={() => setConfirmAction(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button><button type="button" disabled={Boolean(actionState)} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${confirmAction === 'accept' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{actionState ? 'Processing...' : 'Confirm'}</button></div></div> : null}
        </aside>
    </div>
}

function Detail({ label, value }) {
    return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>
}
