import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaQrcode, FaSearch } from 'react-icons/fa'
import ReservationActionModal from '../components/ReservationActionModal'
import QrScannerModal from '../components/QrScannerModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useAdminToast } from '../context/AdminNotificationsContext.jsx'
import { notifyAdminActionError } from '../utils/adminToastMessages.js'
import { mapInventoryChecklist } from '../utils/inventoryChecklist'
import { formatDateOnly } from '../utils/formatDate.js'

const API_URL = `${API_BASE_URL}/api/admin/reservations`

function normalizeStatus(status) {
    const normalized = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (normalized === 'payment_pending') return 'Pending payment'
    if (normalized === 'pending_verification') return 'Pending verification'
    if (normalized === 'confirmed') return 'Confirmed'
    if (normalized === 'checked_in') return 'Checked In'
    if (normalized === 'no_show') return 'No Show'
    if (normalized === 'completed') return 'Completed'
    if (normalized === 'checked_out') return 'Checked Out'
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

function formatPeso(amount) {
    return Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

function mapReservation(reservation) {
    if (String(reservation.first_name || '').toUpperCase() === 'HOLD') return null
    return {
        id: reservation.booking_reference || reservation.reservation_id,
        reservationId: reservation.reservation_id,
        guest: [reservation.first_name, reservation.last_name].filter(Boolean).join(' ') || 'Guest',
        room: reservation.room_number || reservation.venue_name || 'N/A',
        checkIn: formatDateOnly(reservation.check_in_date || reservation.event_date),
        checkOut: formatDateOnly(reservation.check_out_date || reservation.event_date),
        status: normalizeStatus(reservation.reservation_status),
        payment: reservation.has_pending_payment || reservation.pending_payment_id ? 'Pending verification' : normalizePaymentStatus(reservation.payment_summary?.payment_summary),
        total: Number(reservation.payment_summary?.total ?? reservation.total_amount ?? 0),
        baseTotal: Number(reservation.payment_summary?.base_total ?? reservation.total_amount ?? 0),
        addonsTotal: Number(reservation.payment_summary?.addons_total ?? 0),
        earlyFee: Number(reservation.payment_summary?.early_fee ?? 0),
        lateFee: Number(reservation.payment_summary?.late_fee ?? 0),
        inventoryChargesTotal: Number(reservation.payment_summary?.inventory_charges_total ?? 0),
        amountPaid: Number(reservation.payment_summary?.amount_paid ?? 0),
        depositDue: Number(reservation.payment_summary?.deposit_due ?? 0),
        balanceDue: Number(reservation.payment_summary?.balance_due ?? 0),
        bedsAdded: Number(reservation.payment_summary?.beds_added ?? 0),
        databaseStatus: String(reservation.reservation_status || '').toLowerCase(),
        pendingPaymentId: reservation.pending_payment_id ? Number(reservation.pending_payment_id) : null,
        hasPendingPayment: Boolean(reservation.has_pending_payment || reservation.pending_payment_id),
        paymentId: Number(reservation.pending_payment_id || reservation.latest_payment_id) || null,
        isRoom: Boolean(reservation.room_id || reservation.room_number),
        isVenue: Boolean(reservation.venue_id || reservation.venue_name),
        venue: reservation.venue_name || null,
        eventDate: reservation.event_date,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        packageName: reservation.package_name,
        pax: reservation.pax,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        checklist: mapInventoryChecklist(reservation.inventory_checklist || reservation.checklist),
        actualCheckIn: reservation.actual_check_in,
        actualCheckOut: reservation.actual_check_out,
        earlyCheckinFee: Number(reservation.early_checkin_fee || 0),
        lateCheckoutFee: Number(reservation.late_checkout_fee || 0),
    }
}

function StatusBadge({ children, type }) {
    const styles = {
        confirmed: 'bg-sky-100 text-sky-600',
        'pending payment': 'bg-amber-100 text-amber-700',
        'pending verification': 'bg-orange-100 text-orange-700',
        'checked in': 'bg-emerald-100 text-emerald-600',
        'no show': 'bg-slate-100 text-slate-700',
        completed: 'bg-slate-100 text-slate-600',
        'checked out': 'bg-slate-100 text-slate-600',
        cancelled: 'bg-rose-100 text-rose-600',
        paid: 'bg-emerald-100 text-emerald-600',
        pending: 'bg-amber-100 text-amber-600',
    }

    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[type ?? children.toLowerCase()] ?? 'bg-slate-100 text-slate-600'}`}>{children}</span>
}

function isPendingPaymentReservation(reservation) {
    return reservation.hasPendingPayment
        || ['Pending payment', 'Pending verification'].includes(reservation.status)
        || ['Pending payment', 'Pending verification'].includes(reservation.payment)
}

function isReservationRowClickable(reservation) {
    if (isPendingPaymentReservation(reservation)) return true
    const isRoomAttendance = reservation.isRoom && ['confirmed', 'checked_in'].includes(reservation.databaseStatus)
    const readOnly = reservation.databaseStatus === 'no_show' || (!isRoomAttendance && (reservation.isVenue
        ? reservation.payment === 'Fully paid'
        : reservation.databaseStatus === 'completed' || (reservation.databaseStatus === 'cancelled' && reservation.amountPaid > 0)))
    const venueBalance = reservation.isVenue && reservation.databaseStatus === 'confirmed'
        && reservation.amountPaid >= reservation.depositDue && reservation.balanceDue > 0
    return readOnly || venueBalance || (reservation.isRoom && ['confirmed', 'checked_in'].includes(reservation.databaseStatus))
}

export default function ReservationsPage({
    reservations: initialReservations,
    totalReservations,
    onFiltersChange,
}) {
    const navigate = useNavigate()
    const toast = useAdminToast()
    const { user } = useAdminAuth()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const [reservations, setReservations] = useState(initialReservations ?? [])
    const [isLoading, setIsLoading] = useState(!initialReservations)
    const [error, setError] = useState('')
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
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [paymentMethods, setPaymentMethods] = useState([])
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
    const [balanceProof, setBalanceProof] = useState(null)
    const [cashReceived, setCashReceived] = useState('')
    const [bedQuantity, setBedQuantity] = useState(1)
    const [isScannerOpen, setScannerOpen] = useState(false)
    const [checklist, setChecklist] = useState(null)
    const [checklistLoading, setChecklistLoading] = useState(false)
    const [inspectionError, setInspectionError] = useState('')
    const [inventoryItems, setInventoryItems] = useState([])
    const [inventoryAvailable, setInventoryAvailable] = useState(true)
    const [pendingConfirm, setPendingConfirm] = useState(null)
    const [collecting, setCollecting] = useState(false)
    const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0)
    const actionTriggerRef = useRef(null)
    const inventoryRequestRef = useRef(null)
    const actionSessionRef = useRef(0)

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
        const sessionId = actionSessionRef.current + 1
        actionSessionRef.current = sessionId
        inventoryRequestRef.current?.abort()
        inventoryRequestRef.current = null
        const isRoomAttendance = reservation.isRoom && ['confirmed', 'checked_in'].includes(reservation.databaseStatus)
        const readOnly = reservation.databaseStatus === 'no_show' || (!isRoomAttendance && (reservation.isVenue
            ? reservation.payment === 'Fully paid'
            : reservation.databaseStatus === 'completed' || (reservation.databaseStatus === 'cancelled' && reservation.amountPaid > 0)))
        const venueBalance = reservation.isVenue && reservation.databaseStatus === 'confirmed'
            && reservation.amountPaid >= reservation.depositDue && reservation.balanceDue > 0
        if ((!reservation.isRoom && !venueBalance && !readOnly) || (reservation.payment === 'Unpaid' && !readOnly)) return
        if (!allowReadOnly && !readOnly && !venueBalance && !['confirmed', 'checked_in'].includes(reservation.databaseStatus)) return
        setSelectedReservation(reservation)
        const manilaDateTime = getManilaDateTime()
        setActualDate(manilaDateTime.date)
        setActualTime(manilaDateTime.time)
        setPreview(null)
        setIsPreviewLoading(false)
        setInspectionError('')
        setActionError('')
        setCollecting(false)
        setBedQuantity(1)
        setBalanceProof(null)
        setCashReceived('')
        const phase = reservation.databaseStatus === 'confirmed' ? 'check_in' : 'check_out'
        const isCheckOut = reservation.databaseStatus === 'checked_in'
        setChecklist(readOnly ? null : isCheckOut ? { phase, guestName: reservation.guest, attendantName: user?.full_name || '', items: [] } : null)
        setInventoryItems([])
        setInventoryAvailable(true)
        setChecklistLoading(Boolean(reservation.reservationId && (isCheckOut || readOnly)))
        actionTriggerRef.current = trigger
        if (reservation.reservationId && reservation.isRoom && !venueBalance && (isCheckOut || readOnly)) {
            const inventoryRequest = new AbortController()
            inventoryRequestRef.current = inventoryRequest
            Promise.all([
                readOnly ? Promise.resolve({ items: [] }) : request(`${API_BASE_URL}/api/admin/inventory-items`),
                request(`${API_URL}/${encodeURIComponent(reservation.reservationId)}/inventory`, { signal: inventoryRequest.signal }),
            ]).then(([itemsData, inventoryData]) => {
                if (inventoryRequest.signal.aborted || inventoryRequestRef.current !== inventoryRequest || actionSessionRef.current !== sessionId) return
                const items = (itemsData.items || []).map((item) => ({ itemId: item.item_id, name: item.item_name, unitChargeCents: Number(item.default_charge_cents), quantity: 1, quantityMissing: 0 }))
                setInventoryItems(items)
                const inspection = inventoryData.inspection
                const inspectionSaved = Boolean(inspection?.check_id)
                setChecklist(inspectionSaved ? {
                    checkId: inspection.check_id,
                    totalChargeCents: Number(inspection.total_charge_cents || 0),
                    signedAt: inspection.signed_at,
                    guestName: inspection.guest_name,
                    attendantName: inspection.attendant_name,
                    signatureUrl: inspection.signature_url,
                    noDamageInside: Boolean(inspection.no_damage_inside),
                    noCrClogging: Boolean(inspection.no_cr_clogging),
                    notes: inspection.notes || '',
                    items: (inspection.lines || []).map((line) => ({ itemId: line.item_id, name: line.item_name, unitChargeCents: Number(line.unit_charge_cents), quantity: line.quantity, quantityMissing: line.quantity_missing })),
                } : (readOnly ? null : { phase, guestName: reservation.guest, attendantName: user?.full_name || '', items }))
            })
                .catch((inventoryError) => {
                    if (inventoryError.name === 'AbortError' || inventoryRequest.signal.aborted || inventoryRequestRef.current !== inventoryRequest || actionSessionRef.current !== sessionId) return
                    setInventoryAvailable(false)
                    setInspectionError(inventoryError.message || 'Unable to load the room inspection.')
                })
                .finally(() => {
                    if (!inventoryRequest.signal.aborted && inventoryRequestRef.current === inventoryRequest && actionSessionRef.current === sessionId) setChecklistLoading(false)
                })
        }
        if ((reservation.isRoom || venueBalance) && ['confirmed', 'checked_in'].includes(reservation.databaseStatus) && !readOnly) {
            request(`${API_BASE_URL}/api/admin/walk-in/payment-methods`).then((data) => {
                setPaymentMethods(data.paymentMethods || [])
                setSelectedPaymentMethod(String(data.paymentMethods?.[0]?.payment_method_id || ''))
            }).catch(() => {})
        }
    }

    const closeReservationAction = () => {
        actionSessionRef.current += 1
        setPendingConfirm(null)
        setCollecting(false)
        inventoryRequestRef.current?.abort()
        inventoryRequestRef.current = null
        setSelectedReservation(null)
        setChecklist(null)
        setInspectionError('')
        setInventoryItems([])
        setChecklistLoading(false)
        setInventoryAvailable(true)
        setActionError('')
        setCashReceived('')
        actionTriggerRef.current?.focus?.()
        actionTriggerRef.current = null
        if (searchParams.has('ref')) {
            const nextParams = new URLSearchParams(searchParams)
            nextParams.delete('ref')
            setSearchParams(nextParams, { replace: true })
        }
    }

    const navigateToReservationPayment = (reservation) => {
        const params = new URLSearchParams()
        if (reservation.pendingPaymentId || reservation.paymentId) params.set('paymentId', String(reservation.pendingPaymentId || reservation.paymentId))
        if (reservation.id) params.set('booking', reservation.id)
        navigate(`/admin/payments?${params.toString()}`)
    }

    const handleReservationRowClick = (reservation, trigger) => {
        if (isPendingPaymentReservation(reservation)) {
            navigateToReservationPayment(reservation)
            return
        }
        openReservationAction(reservation, false, trigger)
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

    const refreshReservation = async (reservationId = selectedReservation?.reservationId, sessionId = actionSessionRef.current) => {
        const data = await request()
        if (actionSessionRef.current !== sessionId || selectedReservation?.reservationId !== reservationId) return null
        const next = (data.reservations || []).map(mapReservation).filter(Boolean)
        setReservations(next)
        const updated = next.find((item) => item.reservationId === reservationId)
        if (updated) {
            setSelectedReservation(updated)
            setPreview((current) => current ? {
                ...current,
                total: updated.total,
                amount_paid: updated.amountPaid,
                balance_due: updated.balanceDue,
            } : current)
        }
        return updated
    }

    const applyPaymentSummary = (summary, reservationId, sessionId = actionSessionRef.current) => {
        if (!summary || actionSessionRef.current !== sessionId || selectedReservation?.reservationId !== reservationId) return
        const values = {
            total: Number(summary.total ?? 0),
            amountPaid: Number(summary.amount_paid ?? 0),
            balanceDue: Number(summary.balance_due ?? 0),
            baseTotal: Number(summary.base_total ?? 0),
            addonsTotal: Number(summary.addons_total ?? 0),
            earlyCheckinFee: Number(summary.early_fee ?? 0),
            lateCheckoutFee: Number(summary.late_fee ?? 0),
            inventoryChargesTotal: Number(summary.inventory_charges_total ?? 0),
            depositDue: Number(summary.deposit_due ?? 0),
            payment: summary.payment_summary === 'fully_paid' ? 'Fully paid' : summary.payment_summary === 'deposit_paid' ? 'Deposit paid' : 'Unpaid',
        }
        setSelectedReservation((current) => current?.reservationId === reservationId ? { ...current, ...values } : current)
        setReservations((current) => current.map((item) => item.reservationId === reservationId ? { ...item, ...values } : item))
        setPreview((current) => current ? { ...current, ...summary } : current)
    }

    const refreshReservationInventory = async (reservationId, sessionId) => {
        const data = await request(`${API_URL}/${encodeURIComponent(reservationId)}/inventory`)
        if (actionSessionRef.current !== sessionId || selectedReservation?.reservationId !== reservationId) return
        const inspection = data.inspection
        if (!inspection) return
        setChecklist({
            checkId: inspection.check_id,
            totalChargeCents: Number(inspection.total_charge_cents || 0),
            signedAt: inspection.signed_at,
            guestName: inspection.guest_name,
            attendantName: inspection.attendant_name,
            signatureUrl: inspection.signature_url,
            noDamageInside: Boolean(inspection.no_damage_inside),
            noCrClogging: Boolean(inspection.no_cr_clogging),
            notes: inspection.notes || '',
            items: (inspection.lines || []).map((line) => ({ itemId: line.item_id, name: line.item_name, unitChargeCents: Number(line.unit_charge_cents), quantity: line.quantity, quantityMissing: line.quantity_missing })),
        })
    }

    const openConfirmation = (options) => {
        setPendingConfirm(options)
    }

    const collectReservationBalance = async () => {
        const reservationId = selectedReservation?.reservationId
        const sessionId = actionSessionRef.current
        const amountDue = Number(selectedReservation?.balanceDue ?? 0)
        if (!reservationId || !amountDue || !selectedPaymentMethod || collecting) return
        setPendingConfirm(null)
        setCollecting(true)
        setIsSubmitting(true)
        setActionError('')
        try {
            const body = new FormData()
            body.append('payment', JSON.stringify({ payment_method_id: Number(selectedPaymentMethod), amount: amountDue }))
            if (balanceProof) body.append('proof_of_payment', balanceProof)
            const data = await request(`${API_URL}/${reservationId}/balance`, { method: 'POST', body })
            applyPaymentSummary(data.payment_summary, reservationId, sessionId)
            const updated = await refreshReservation(reservationId, sessionId)
            await refreshReservationInventory(reservationId, sessionId)
            if (actionSessionRef.current === sessionId && updated) {
                setPaymentsRefreshKey((current) => current + 1)
                setSelectedPaymentMethod('')
                setBalanceProof(null)
                setCashReceived('')
                toast.success(data.message || 'Balance collected successfully.')
            }
        } catch (mutationError) {
            if (actionSessionRef.current === sessionId) {
                setActionError(mutationError.message)
                notifyAdminActionError(toast, mutationError, 'Unable to collect the reservation balance.')
            }
        } finally {
            setPendingConfirm(null)
            if (actionSessionRef.current === sessionId) {
                setIsSubmitting(false)
                setCollecting(false)
            }
        }
    }

    const addReservationBed = async () => {
        if (!selectedReservation || !bedQuantity) return
        setIsSubmitting(true)
        setActionError('')
        try {
            const data = await request(`${API_URL}/${selectedReservation.reservationId}/addons/extra-bed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: Number(bedQuantity) }) })
            await refreshReservation()
            toast.success(data.message || 'Extra bed added successfully.')
        } catch (mutationError) {
            setActionError(mutationError.message)
            notifyAdminActionError(toast, mutationError, 'Unable to add the extra bed.')
        } finally { setIsSubmitting(false) }
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

    const prepareCheckoutInspection = async () => {
        if (!selectedReservation || !checklist || checklist.checkId || !inventoryAvailable) return
        const sessionId = actionSessionRef.current
        const reservationId = selectedReservation.reservationId
        const signature = checklist.signatureFile
        if (!signature || !checklist.guestName?.trim() || !checklist.attendantName?.trim()) throw new Error('Guest name, attendant name, and signature are required.')
        const inventoryForm = new FormData()
        inventoryForm.append('signature', signature)
        inventoryForm.append('guest_name', checklist.guestName)
        inventoryForm.append('attendant_name', checklist.attendantName)
        inventoryForm.append('no_damage_inside', String(Boolean(checklist.noDamageInside)))
        inventoryForm.append('no_cr_clogging', String(Boolean(checklist.noCrClogging)))
        inventoryForm.append('notes', checklist.notes || '')
        inventoryForm.append('actual_time', `${actualDate}T${actualTime}`)
        inventoryForm.append('lines', JSON.stringify((checklist.items || []).map((item) => ({ item_id: item.itemId, quantity: Number(item.quantity), quantity_missing: Number(item.quantityMissing) }))))
        const inventoryResponse = await fetch(`${API_BASE_URL}/api/admin/reservations/${encodeURIComponent(selectedReservation.reservationId)}/inventory/check-out`, { method: 'POST', credentials: 'include', body: inventoryForm })
        const inventoryData = await inventoryResponse.json().catch(() => ({}))
        if (inventoryResponse.status === 401 || inventoryResponse.status === 403) { navigate('/admin/login', { replace: true }); return }
        if (inventoryResponse.status === 503) {
            setInventoryAvailable(false)
            throw new Error('Room inventory is unavailable until its database migration is applied.')
        }
        if (!inventoryResponse.ok) throw new Error(inventoryData.error || 'Unable to save the room inventory checklist.')
        applyPaymentSummary(inventoryData.payment_summary, reservationId, sessionId)
        const savedInspectionResponse = await request(`${API_BASE_URL}/api/admin/reservations/${encodeURIComponent(reservationId)}/inventory`)
        const savedInspection = savedInspectionResponse.inspection
        if (savedInspection) setChecklist({
            checkId: savedInspection.check_id,
            totalChargeCents: Number(savedInspection.total_charge_cents || 0),
            signedAt: savedInspection.signed_at,
            guestName: savedInspection.guest_name,
            attendantName: savedInspection.attendant_name,
            signatureUrl: savedInspection.signature_url,
            noDamageInside: Boolean(savedInspection.no_damage_inside),
            noCrClogging: Boolean(savedInspection.no_cr_clogging),
            notes: savedInspection.notes || '',
            items: (savedInspection.lines || []).map((line) => ({ itemId: line.item_id, name: line.item_name, unitChargeCents: Number(line.unit_charge_cents), quantity: line.quantity, quantityMissing: line.quantity_missing })),
        })
        await refreshReservation(reservationId, sessionId)
    }

    const prepareCheckout = async () => {
        setIsSubmitting(true)
        setActionError('')
        try {
            await prepareCheckoutInspection()
        } catch (mutationError) {
            setActionError(mutationError.message)
            notifyAdminActionError(toast, mutationError, 'Unable to save the room inspection.')
        } finally { setIsSubmitting(false) }
    }

    const confirmReservationAction = async () => {
        if (!selectedReservation || !preview) return
        const action = selectedReservation.databaseStatus === 'confirmed' ? 'check-in' : 'check-out'
        setIsSubmitting(true)
        setActionError('')
        try {
            if (action === 'check-out') {
                if (!checklist?.checkId) {
                    const signature = checklist?.signatureFile
                    if (!signature || !checklist?.guestName?.trim() || !checklist?.attendantName?.trim()) throw new Error('Guest name, attendant name, and signature are required.')
                }
                if (inventoryAvailable && !checklist?.checkId) {
                    await prepareCheckoutInspection()
                }
            }
            const response = await fetch(`${API_URL}/${encodeURIComponent(selectedReservation.reservationId)}/${action}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actual_time: `${actualDate}T${actualTime}` }),
            })
            const data = await response.json().catch(() => ({}))
            if (response.status === 401 || response.status === 403) {
                const redirect = `${location.pathname}${location.search}`
                navigate(`/admin/login?redirect=${encodeURIComponent(redirect)}`, { replace: true })
                return
            }
            if (!response.ok) {
                if (response.status === 409 && data.payment_summary) {
                    const updated = await refreshReservation()
                    if (updated) setPreview((current) => ({ ...current, ...data.payment_summary, fee: current?.fee || 0 }))
                }
                throw new Error(data.error || data.message || `Unable to record ${action}.`)
            }
            setReservations((await request()).reservations.map(mapReservation).filter(Boolean))
            toast.success(data.message || `${action} recorded successfully.`)
            closeReservationAction()
        } catch (mutationError) {
            setActionError(mutationError.message)
            notifyAdminActionError(toast, mutationError, `Unable to record ${action}.`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const requestCollectBalance = async () => {
        const reservationId = selectedReservation?.reservationId
        const sessionId = actionSessionRef.current
        if (!reservationId || !selectedPaymentMethod || collecting) return
        const updated = await refreshReservation(reservationId, sessionId)
        if (actionSessionRef.current !== sessionId || !updated) return
        const amountDue = Number(updated.balanceDue ?? 0)
        if (!amountDue) {
            setActionError('There is no outstanding balance to collect. Save the room inspection to calculate any late fees or charges first.')
            return
        }
        openConfirmation({
            title: 'Collect balance',
            message: `Collect PHP ${formatPeso(amountDue)} balance?`,
            confirmLabel: 'Collect balance',
            variant: 'warning',
            onConfirm: collectReservationBalance,
        })
    }

    const requestAddReservationBed = () => {
        if (!selectedReservation || !bedQuantity) return
        openConfirmation({
            title: 'Add extra bed',
            message: `Add ${bedQuantity} extra bed${bedQuantity === 1 ? '' : 's'} at the server price?`,
            confirmLabel: 'Add bed',
            onConfirm: addReservationBed,
        })
    }

    const requestReservationAction = () => {
        if (!selectedReservation || !preview) return
        const action = selectedReservation.databaseStatus === 'confirmed' ? 'check-in' : 'check-out'
        if (action === 'check-in' && preview.fee <= 0) {
            confirmReservationAction()
            return
        }
        const amountToCollect = action === 'check-out'
            ? Number(preview.balance_due ?? selectedReservation.balanceDue ?? 0)
            : Number(preview.fee || 0)
        openConfirmation({
            title: `Confirm ${action}`,
            message: amountToCollect > 0
                ? `Confirm ${action} and collect PHP ${formatPeso(amountToCollect)} from the guest?`
                : `Confirm ${action}?`,
            confirmLabel: action,
            onConfirm: confirmReservationAction,
        })
    }

    useEffect(() => {
        if (initialReservations) return undefined
        let isCurrent = true
        setIsLoading(true)
        request()
            .then((data) => { if (isCurrent) setReservations((data.reservations || []).map(mapReservation).filter(Boolean)) })
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
                if (!reservation) throw new Error('Reservation not found.')
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
                    <option>No Show</option>
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
                                <tr key={reservation.id} role={isReservationRowClickable(reservation) ? 'button' : undefined} tabIndex={isReservationRowClickable(reservation) ? 0 : undefined} aria-label={isPendingPaymentReservation(reservation) ? `Review payment for ${reservation.id}` : undefined} onClick={() => handleReservationRowClick(reservation)} onKeyDown={(event) => { if (isReservationRowClickable(reservation) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleReservationRowClick(reservation, event.currentTarget) } }} className={`text-sm ${isReservationRowClickable(reservation) ? 'cursor-pointer transition hover:bg-sky-50 focus-visible:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset' : ''}`}>
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{reservation.id}</td>
                                    <td className="max-w-[100px] px-4 py-4 font-medium text-slate-800">{reservation.guest}</td>
                                    <td className="max-w-[120px] px-4 py-4 text-slate-600">{reservation.room}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{reservation.checkIn}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{reservation.checkOut}</td>
                                    <td className="px-4 py-4"><StatusBadge>{reservation.status}</StatusBadge></td>
                                    <td className="px-4 py-4">
                                        <StatusBadge>{reservation.payment}</StatusBadge>
                                        <p className="mt-1 text-[10px] text-slate-500">Total ₱{reservation.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / Paid ₱{reservation.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                                    </td>
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
            {selectedReservation ? <ReservationActionModal reservation={selectedReservation} actualDate={actualDate} actualTime={actualTime} preview={preview} isPreviewLoading={isPreviewLoading} error={actionError} isSubmitting={isSubmitting} collecting={collecting} paymentsRefreshKey={paymentsRefreshKey} paymentMethods={paymentMethods} selectedPaymentMethod={selectedPaymentMethod} balanceProof={balanceProof} cashReceived={cashReceived} bedQuantity={bedQuantity} checklist={checklist} checklistLoading={checklistLoading} inventoryAvailable={inventoryAvailable} inspectionLoading={checklistLoading} inspectionError={inspectionError} onRetryInspection={() => openReservationAction(selectedReservation, true, actionTriggerRef.current)} staffName={user?.full_name || ''} onChecklistChange={setChecklist} onPrepareCheckout={prepareCheckout} onDateChange={setActualDate} onPaymentMethodChange={handlePaymentMethodChange} onBalanceProofChange={setBalanceProof} onCashReceivedChange={setCashReceived} onBedQuantityChange={setBedQuantity} onCollectBalance={requestCollectBalance} onAddBed={requestAddReservationBed} onTimeChange={setActualTime} onConfirm={requestReservationAction} onClose={closeReservationAction} /> : null}
            <ConfirmDialog open={Boolean(pendingConfirm)} title={pendingConfirm?.title} message={pendingConfirm?.message} confirmLabel={pendingConfirm?.confirmLabel} onConfirm={pendingConfirm?.onConfirm} onCancel={() => setPendingConfirm(null)} loading={isSubmitting} variant={pendingConfirm?.variant} />
        </div>
    )
}
