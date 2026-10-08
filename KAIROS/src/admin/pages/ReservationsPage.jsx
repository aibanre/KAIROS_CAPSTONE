import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaQrcode, FaSearch } from 'react-icons/fa'
import ReservationActionModal from '../components/ReservationActionModal'
import QrScannerModal from '../components/QrScannerModal'
import { useAdminAuth } from '../context/AdminAuthContext'
import { mapInventoryInspection } from '../utils/inventoryChecklist'

const API_URL = `${API_BASE_URL}/api/admin/reservations`

function formatDate(value) {
    if (!value) return 'N/A'
    const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (!datePart) return 'N/A'
    const date = new Date(`${datePart}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return 'N/A'
    return date.toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

function normalizeStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'payment_pending') return 'Pending payment'
    if (normalized === 'pending_verification') return 'Pending verification'
    if (normalized === 'confirmed') return 'Confirmed'
    if (normalized === 'checked_in') return 'Checked In'
    if (normalized === 'completed') return 'Completed'
    if (normalized === 'checked_out') return 'Completed'
    if (['cancelled', 'rejected'].includes(normalized)) return 'Cancelled'
    return 'Unknown'
}

function normalizePaymentStatus(status) {
    const normalized = String(status || '').toLowerCase()
    if (normalized === 'fully_paid') return 'Fully paid'
    if (normalized === 'deposit_paid') return 'Deposit paid'
    return normalized === 'unpaid' ? 'Unpaid' : 'Unpaid'
}

function getManilaDateTime() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
    const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]))
    return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` }
}

function mapReservation(reservation) {
    return {
        id: reservation.booking_reference || reservation.reservation_id,
        reservationId: reservation.reservation_id,
        guest: [reservation.first_name, reservation.last_name].filter(Boolean).join(' ') || 'Guest',
        room: reservation.room_number || reservation.venue_name || 'N/A',
        checkIn: formatDate(reservation.check_in_date || reservation.event_date),
        checkOut: formatDate(reservation.check_out_date || reservation.event_date),
        status: normalizeStatus(reservation.reservation_status),
        payment: normalizePaymentStatus(reservation.payment_summary?.payment_summary),
        total: Number(reservation.payment_summary?.total ?? reservation.total_amount ?? 0),
        amountPaid: Number(reservation.payment_summary?.amount_paid ?? 0),
        balanceDue: Number(reservation.payment_summary?.balance_due ?? 0),
        bedsAdded: Number(reservation.payment_summary?.beds_added ?? 0),
        actualCheckIn: reservation.actual_check_in,
        actualCheckOut: reservation.actual_check_out,
        earlyCheckinFee: Number(reservation.early_checkin_fee ?? 0),
        lateCheckoutFee: Number(reservation.late_checkout_fee ?? 0),
        feesCollectedAt: reservation.fees_collected_at,
        databaseStatus: String(reservation.reservation_status || '').toLowerCase(),
        isRoom: Boolean(reservation.room_id || reservation.room_number),
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        checklist: mapInventoryInspection(reservation.inventory_checklist || reservation.checklist),
    }
}

function mapInspectionForDisplay(value) {
    const inspection = mapInventoryInspection(value)
    if (!inspection) return null
    return {
        ...inspection,
        totalCharge: inspection.totalChargeCents / 100,
        lines: inspection.lines.map((line) => ({
            ...line,
            unitCharge: line.unitChargeCents / 100,
            charge: line.chargeCents / 100,
        })),
    }
}

function StatusBadge({ children, type }) {
    const styles = {
        confirmed: 'bg-sky-100 text-sky-600',
        'pending payment': 'bg-amber-100 text-amber-700',
        'pending verification': 'bg-orange-100 text-orange-700',
        completed: 'bg-slate-100 text-slate-600',
        'checked in': 'bg-emerald-100 text-emerald-600',
        cancelled: 'bg-rose-100 text-rose-600',
        paid: 'bg-emerald-100 text-emerald-600',
        pending: 'bg-amber-100 text-amber-600',
    }

    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[type ?? children.toLowerCase()] ?? 'bg-slate-100 text-slate-600'}`}>{children}</span>
}

export default function ReservationsPage({
    reservations: initialReservations,
    totalReservations,
    onViewReservation,
    onEditReservation,
    onDeleteReservation,
    onFiltersChange,
}) {
    const navigate = useNavigate()
    const { user } = useAdminAuth()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const [reservations, setReservations] = useState(initialReservations ?? [])
    const [isLoading, setIsLoading] = useState(!initialReservations)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('All Statuses')
    const [dateRange, setDateRange] = useState('All Dates')
    const [page, setPage] = useState(1)
    const [selectedReservation, setSelectedReservation] = useState(null)
    const [actualDate, setActualDate] = useState('')
    const [actualTime, setActualTime] = useState('')
    const [preview, setPreview] = useState(null)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)
    const [actionError, setActionError] = useState('')
    const [actionNotice, setActionNotice] = useState('')
    const [feeCollected, setFeeCollected] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [paymentMethods, setPaymentMethods] = useState([])
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
    const [balanceProof, setBalanceProof] = useState(null)
    const [bedQuantity, setBedQuantity] = useState(1)
    const [isScannerOpen, setScannerOpen] = useState(false)
    const [checklist, setChecklist] = useState(null)
    const [checklistLoading, setChecklistLoading] = useState(false)
    const [inventoryItems, setInventoryItems] = useState([])
    const [inventoryAvailable, setInventoryAvailable] = useState(true)
    const [chargesCollected, setChargesCollected] = useState(false)
    const [inspectionLoading, setInspectionLoading] = useState(false)
    const [inspectionError, setInspectionError] = useState('')
    const actionTriggerRef = useRef(null)

    const request = async (url = API_URL, options = {}) => {
        const response = await fetch(url, { ...options, credentials: 'include' })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            const redirect = `${location.pathname}${location.search}`
            navigate(`/admin/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to fetch reservations.')
        return data
    }

    const openReservationAction = (reservation, allowReadOnly = false, trigger = null) => {
        if (!reservation.isRoom || (reservation.payment === 'Unpaid' && reservation.databaseStatus !== 'completed')) return
        if (!allowReadOnly && !['confirmed', 'checked_in', 'completed'].includes(reservation.databaseStatus)) return
        setSelectedReservation(reservation)
        const manilaDateTime = getManilaDateTime()
        setActualDate(manilaDateTime.date)
        setActualTime(manilaDateTime.time)
        setPreview(null)
        setIsPreviewLoading(false)
        setFeeCollected(false)
        setActionError('')
        setActionNotice('')
        setBedQuantity(1)
        setBalanceProof(null)
        setChargesCollected(false)
        setInspectionError('')
        setChecklist(reservation.databaseStatus === 'checked_in' ? { guestName: reservation.guest, attendantName: user?.full_name || '', items: [] } : null)
        setInventoryAvailable(true)
        setChecklistLoading(reservation.databaseStatus === 'checked_in' && Boolean(reservation.reservationId))
        setInspectionLoading(reservation.databaseStatus === 'completed' && Boolean(reservation.reservationId))
        actionTriggerRef.current = trigger
        if (reservation.reservationId) {
            if (['checked_in', 'completed'].includes(reservation.databaseStatus)) {
                const inventoryRequest = request(`${API_URL}/${encodeURIComponent(reservation.reservationId)}/inventory`)
                const itemsRequest = reservation.databaseStatus === 'checked_in'
                    ? request(`${API_BASE_URL}/api/admin/inventory-items`)
                    : Promise.resolve({ items: [] })
                Promise.all([itemsRequest, inventoryRequest])
                    .then(([itemsData, inventoryData]) => {
                        if (reservation.databaseStatus === 'completed') {
                            setChecklist(mapInspectionForDisplay(inventoryData.inspection))
                            return
                        }
                        const items = (itemsData.items || []).map((item) => ({ itemId: item.item_id, name: item.item_name, unitChargeCents: Number(item.default_charge_cents), quantity: 1, quantityMissing: 0 }))
                        setInventoryItems(items)
                        const inspection = mapInventoryInspection(inventoryData.inspection)
                        setChecklist(inspection ? { ...inspection, items: inspection.lines } : { guestName: reservation.guest, attendantName: user?.full_name || '', items })
                        setChargesCollected(Boolean(inspection?.charges_collected_at))
                    })
                    .catch(() => {
                        if (reservation.databaseStatus === 'completed') setInspectionError('Room inventory is temporarily unavailable.')
                        else {
                            setInventoryAvailable(false)
                            setActionNotice('Room inventory is unavailable until its database migration is applied. Attendance can still be recorded.')
                        }
                    })
                    .finally(() => {
                        setChecklistLoading(false)
                        setInspectionLoading(false)
                    })
            }
        }
        if (['confirmed', 'checked_in'].includes(reservation.databaseStatus)) {
            request(`${API_BASE_URL}/api/admin/walk-in/payment-methods`).then((data) => {
                setPaymentMethods(data.paymentMethods || [])
                setSelectedPaymentMethod(String(data.paymentMethods?.[0]?.payment_method_id || ''))
            }).catch(() => {})
        }
    }

    const closeReservationAction = () => {
        setSelectedReservation(null)
        actionTriggerRef.current?.focus?.()
        actionTriggerRef.current = null
        if (searchParams.has('ref')) {
            const nextParams = new URLSearchParams(searchParams)
            nextParams.delete('ref')
            setSearchParams(nextParams, { replace: true })
        }
    }

    const handlePaymentMethodChange = (value) => {
        setSelectedPaymentMethod(value)
        const method = paymentMethods.find((item) => String(item.payment_method_id) === String(value))
        if (['cash', 'card'].includes(method?.method_type?.toLowerCase())) setBalanceProof(null)
    }

    const handleQrScan = (reference) => {
        setScannerOpen(false)
        if (searchParams.get('ref') === reference) {
            setSearchParams({}, { replace: true })
            window.setTimeout(() => setSearchParams({ ref: reference }), 0)
            return
        }
        setSearchParams({ ref: reference })
    }

    const refreshReservation = async () => {
        const data = await request()
        const next = (data.reservations || []).map(mapReservation)
        setReservations(next)
        const updated = next.find((item) => item.reservationId === selectedReservation?.reservationId)
        if (updated) setSelectedReservation(updated)
        return updated
    }

    const collectReservationBalance = async () => {
        if (!selectedReservation?.balanceDue || !selectedPaymentMethod) return
        if (!window.confirm(`Collect ${selectedReservation.balanceDue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })} balance?`)) return
        setIsSubmitting(true)
        setActionError('')
        try {
            const body = new FormData()
            body.append('payment', JSON.stringify({ payment_method_id: Number(selectedPaymentMethod), amount: selectedReservation.balanceDue }))
            if (balanceProof) body.append('proof_of_payment', balanceProof)
            const data = await request(`${API_URL}/${selectedReservation.reservationId}/balance`, { method: 'POST', body })
            await refreshReservation()
            setActionNotice(data.message || 'Balance collected successfully.')
            setBalanceProof(null)
        } catch (mutationError) { setActionError(mutationError.message) } finally { setIsSubmitting(false) }
    }

    const addReservationBed = async () => {
        if (!selectedReservation || !bedQuantity) return
        if (!window.confirm(`Add ${bedQuantity} extra bed${bedQuantity === 1 ? '' : 's'} at the server price?`)) return
        setIsSubmitting(true)
        setActionError('')
        try {
            const data = await request(`${API_URL}/${selectedReservation.reservationId}/addons/extra-bed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: Number(bedQuantity) }) })
            await refreshReservation()
            setActionNotice(data.message || 'Extra bed added successfully.')
        } catch (mutationError) { setActionError(mutationError.message) } finally { setIsSubmitting(false) }
    }

    useEffect(() => {
        if (!selectedReservation || !actualDate || !actualTime || !selectedReservation.isRoom || selectedReservation.payment === 'Unpaid' || !['confirmed', 'checked_in'].includes(selectedReservation.databaseStatus)) return undefined
        const action = selectedReservation.databaseStatus === 'confirmed' ? 'check-in' : 'check-out'
        const controller = new AbortController()
        setPreview(null)
        setIsPreviewLoading(true)
        const actualDateTime = `${actualDate}T${actualTime}`
        fetch(`${API_URL}/${encodeURIComponent(selectedReservation.reservationId)}/attendance-preview?action=${action}&actual_time=${encodeURIComponent(actualDateTime)}`, { credentials: 'include', signal: controller.signal })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}))
                if (response.status === 401 || response.status === 403) {
                    const redirect = `${location.pathname}${location.search}`
                    navigate(`/admin/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
                    throw new Error('Your admin session has expired.')
                }
                if (!response.ok) throw new Error(data.error || data.message || 'Unable to calculate the fee preview.')
                return data
            })
            .then((data) => { setPreview(data); setActionError('') })
            .catch((previewError) => { if (previewError.name !== 'AbortError') setActionError(previewError.message) })
            .finally(() => setIsPreviewLoading(false))
        return () => controller.abort()
    }, [selectedReservation, actualDate, actualTime])

    const confirmReservationAction = async () => {
        if (!selectedReservation || !preview) return
        const action = selectedReservation.databaseStatus === 'confirmed' ? 'check-in' : 'check-out'
        if (preview.fee > 0 && !window.confirm(`Confirm ${action} and collect PHP ${Number(preview.fee).toLocaleString()} from the guest?`)) return
        setIsSubmitting(true)
        setActionError('')
        try {
            if (action === 'check-out') {
                const signature = checklist?.signatureFile
                if (!signature || !checklist?.guestName?.trim() || !checklist?.attendantName?.trim()) throw new Error('Guest name, attendant name, and signature are required.')
                const inventoryForm = new FormData()
                inventoryForm.append('signature', signature)
                inventoryForm.append('guest_name', checklist.guestName)
                inventoryForm.append('attendant_name', checklist.attendantName)
                inventoryForm.append('no_damage_inside', String(Boolean(checklist.noDamageInside)))
                inventoryForm.append('no_cr_clogging', String(Boolean(checklist.noCrClogging)))
                inventoryForm.append('lines', JSON.stringify((checklist.items || []).map((item) => ({ item_id: item.itemId, quantity: Number(item.quantity), quantity_missing: Number(item.quantityMissing) }))))
                const inventoryResponse = await fetch(`${API_BASE_URL}/api/admin/reservations/${encodeURIComponent(selectedReservation.reservationId)}/inventory/check-out`, { method: 'POST', credentials: 'include', body: inventoryForm })
                const inventoryData = await inventoryResponse.json().catch(() => ({}))
                if (inventoryResponse.status === 401 || inventoryResponse.status === 403) { navigate('/admin/login', { replace: true }); return }
                if (!inventoryResponse.ok) throw new Error(inventoryData.error || 'Unable to save the room inventory checklist.')
                if (Number(checklist.items?.reduce((sum, item) => sum + Number(item.quantityMissing || 0) * Number(item.unitChargeCents || 0), 0)) > 0) {
                    if (!chargesCollected) throw new Error('Loss/damage charges must be collected before check-out.')
                    const collectResponse = await fetch(`${API_BASE_URL}/api/admin/reservations/${encodeURIComponent(selectedReservation.reservationId)}/inventory/charges/collect`, { method: 'PATCH', credentials: 'include' })
                    const collectData = await collectResponse.json().catch(() => ({}))
                    if (!collectResponse.ok) throw new Error(collectData.error || 'Unable to record collected room charges.')
                }
            }
            const response = await fetch(`${API_URL}/${encodeURIComponent(selectedReservation.reservationId)}/${action}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actual_time: `${actualDate}T${actualTime}`, fee_collected: feeCollected }),
            })
            const data = await response.json().catch(() => ({}))
            if (response.status === 401 || response.status === 403) {
                const redirect = `${location.pathname}${location.search}`
                navigate(`/admin/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
                return
            }
            if (!response.ok) throw new Error(data.error || data.message || `Unable to record ${action}.`)
            setReservations((await request()).reservations.map(mapReservation))
            setNotice(data.message || `${action} recorded successfully.`)
            closeReservationAction()
        } catch (mutationError) {
            setActionError(mutationError.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    useEffect(() => {
        if (initialReservations) return undefined
        let isCurrent = true
        setIsLoading(true)
        request()
            .then((data) => { if (isCurrent) setReservations((data.reservations || []).map(mapReservation)) })
            .catch((loadError) => { if (isCurrent) setError(loadError.message) })
            .finally(() => { if (isCurrent) setIsLoading(false) })
        return () => { isCurrent = false }
    }, [initialReservations])

    useEffect(() => {
        const reference = searchParams.get('ref')
        if (!reference) return undefined
        let isCurrent = true
        request(`${API_URL}/lookup?ref=${encodeURIComponent(reference)}`)
            .then((data) => {
                if (!isCurrent) return
                const reservation = mapReservation(data.reservation)
                if (reservation.databaseStatus === 'cancelled' || !reservation.isRoom || (reservation.payment === 'Unpaid' && reservation.databaseStatus !== 'completed')) {
                    setNotice(`${reservation.id}: this reservation is read-only and has no attendance action.`)
                    return
                }
                openReservationAction(reservation, true)
            })
            .catch((lookupError) => { if (isCurrent) setError(lookupError.message) })
        return () => { isCurrent = false }
    }, [searchParams])

    const filteredReservations = useMemo(() => {
        const term = search.trim().toLowerCase()
        return reservations.filter((reservation) => {
            const matchesSearch = !term || `${reservation.id} ${reservation.guest} ${reservation.room}`.toLowerCase().includes(term)
            const matchesStatus = status === 'All Statuses' || reservation.status === status
            return matchesSearch && matchesStatus
        })
    }, [reservations, search, status])

    const updateFilter = (name, value) => {
        setPage(1)
        if (name === 'search') setSearch(value)
        if (name === 'status') setStatus(value)
        if (name === 'dateRange') setDateRange(value)
        onFiltersChange?.({ search: name === 'search' ? value : search, status: name === 'status' ? value : status, dateRange: name === 'dateRange' ? value : dateRange })
    }

    return (
        <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Reservations</h1>
                <button type="button" onClick={() => setScannerOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700" title="Scan reservation QR">
                    <FaQrcode className="h-4 w-4" />
                    <span>Scan QR</span>
                </button>
            </div>

            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            {notice ? <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p> : null}

            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                    <span className="sr-only">Search reservations</span>
                    <FaSearch className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                    <input value={search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search by name, reference, room..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500" />
                </label>
                <select value={status} onChange={(event) => updateFilter('status', event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-500 outline-none focus:border-sky-500">
                    <option>All Statuses</option>
                    <option>Confirmed</option>
                    <option>Checked In</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                </select>
                <select value={dateRange} onChange={(event) => updateFilter('dateRange', event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-500 outline-none focus:border-sky-500">
                    <option>All Dates</option>
                    <option>This Week</option>
                    <option>This Month</option>
                </select>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Reference</th>
                                <th className="px-4 py-4">Guest</th>
                                <th className="px-4 py-4">Room /<br />Venue</th>
                                <th className="px-4 py-4">Check-<br />in</th>
                                <th className="px-4 py-4">Check-<br />out</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4">Payment</th>
                                <th className="px-4 py-4">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">Loading reservations...</td></tr> : null}
                            {!isLoading && filteredReservations.map((reservation) => (
                                <tr key={reservation.id} role={reservation.isRoom && (reservation.databaseStatus === 'completed' || reservation.payment !== 'Unpaid') ? 'button' : undefined} tabIndex={reservation.isRoom && (reservation.databaseStatus === 'completed' || reservation.payment !== 'Unpaid') ? 0 : undefined} onClick={(event) => openReservationAction(reservation, false, event.currentTarget)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReservationAction(reservation, false, event.currentTarget) } }} className={`text-sm ${reservation.isRoom && (reservation.databaseStatus === 'completed' || reservation.payment !== 'Unpaid') ? 'cursor-pointer transition hover:bg-sky-50 focus:bg-sky-50 focus:outline-none' : ''}`}>
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{reservation.id}</td>
                                    <td className="max-w-[100px] px-4 py-4 font-medium text-slate-800">{reservation.guest}</td>
                                    <td className="max-w-[120px] px-4 py-4 text-slate-600">{reservation.room}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{reservation.checkIn}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{reservation.checkOut}</td>
                                    <td className="px-4 py-4"><StatusBadge>{reservation.status}</StatusBadge></td>
                                    <td className="px-4 py-4"><StatusBadge>{reservation.payment}</StatusBadge><p className="mt-1 text-[10px] text-slate-500">Total ₱{reservation.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / Paid ₱{reservation.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p></td>
                                    <td className="px-4 py-4 text-slate-600">₱{reservation.balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {!isLoading && filteredReservations.length === 0 ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No reservations found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
                <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                    <span>Showing {filteredReservations.length ? 1 : 0}–{filteredReservations.length} of {totalReservations ?? reservations.length} reservations</span>
                    <div className="flex items-center gap-3">
                        <button type="button" aria-label="Previous page" onClick={() => setPage(Math.max(1, page - 1))} className="hover:text-sky-600"><FaChevronLeft className="h-3 w-3" /></button>
                        <button type="button" onClick={() => setPage(1)} className={`rounded bg-sky-600 px-2.5 py-1.5 font-semibold text-white ${page === 1 ? '' : 'opacity-60'}`}>1</button>
                        <button type="button" onClick={() => setPage(2)} className="hover:text-sky-600">2</button>
                        <button type="button" onClick={() => setPage(3)} className="hover:text-sky-600">3</button>
                        <span>...</span><span>21</span>
                        <button type="button" aria-label="Next page" onClick={() => setPage(page + 1)} className="hover:text-sky-600"><FaChevronRight className="h-3 w-3" /></button>
                    </div>
                </footer>
            </section>
            <QrScannerModal open={isScannerOpen} onScan={handleQrScan} onClose={() => setScannerOpen(false)} />
            {selectedReservation ? <ReservationActionModal reservation={selectedReservation} actualDate={actualDate} actualTime={actualTime} preview={preview} isPreviewLoading={isPreviewLoading} error={actionError} notice={actionNotice} isSubmitting={isSubmitting} feeCollected={feeCollected} chargesCollected={chargesCollected} onChargesCollectedChange={setChargesCollected} paymentMethods={paymentMethods} selectedPaymentMethod={selectedPaymentMethod} balanceProof={balanceProof} bedQuantity={bedQuantity} checklist={checklist} checklistLoading={checklistLoading} inspectionLoading={inspectionLoading} inspectionError={inspectionError} staffName={user?.full_name || ''} onChecklistChange={setChecklist} onDateChange={setActualDate} onPaymentMethodChange={handlePaymentMethodChange} onBalanceProofChange={setBalanceProof} onBedQuantityChange={setBedQuantity} onCollectBalance={collectReservationBalance} onAddBed={addReservationBed} onTimeChange={setActualTime} onFeeCollectedChange={setFeeCollected} onConfirm={confirmReservationAction} onClose={closeReservationAction} /> : null}
        </div>
    )
}
