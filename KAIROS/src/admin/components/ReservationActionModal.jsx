import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useRef, useState } from 'react'
import { FaTimes } from 'react-icons/fa'
import ReceiptCapture from './ReceiptCapture'
import InventoryChecklist from './InventoryChecklist'
import ReservationPaymentsList from './ReservationPaymentsList'
import { formatDateOnly, formatDateRange, formatDateTime, formatVenueDateTime } from '../utils/formatDate.js'

const NO_RECEIPT_METHOD_TYPES = ['cash', 'card']

export default function ReservationActionModal({ reservation, actualDate, actualTime, preview, isPreviewLoading, error, notice, isSubmitting, feeCollected, chargesCollected, onChargesCollectedChange, paymentMethods, selectedPaymentMethod, balanceProof, bedQuantity, checklist, checklistLoading, inventoryAvailable = true, inspectionLoading, inspectionError, onChecklistChange, staffName, onDateChange, onPaymentMethodChange, onBalanceProofChange, onBedQuantityChange, onCollectBalance, onAddBed, onTimeChange, onFeeCollectedChange, onConfirm, onClose }) {
    const isRoomAttendance = !reservation.isVenue && ['confirmed', 'checked_in'].includes(reservation.databaseStatus)
    const readOnly = !isRoomAttendance && (reservation.isVenue ? reservation.payment === 'Fully paid' : reservation.databaseStatus === 'completed' || (reservation.databaseStatus === 'cancelled' && reservation.amountPaid > 0))
    const venueBalance = reservation.isVenue && reservation.databaseStatus === 'confirmed' && reservation.amountPaid >= reservation.depositDue && reservation.balanceDue > 0
    const action = !reservation.isVenue && !readOnly && (reservation.databaseStatus === 'confirmed' ? 'Check-in' : reservation.databaseStatus === 'checked_in' ? 'Check-out' : null)
    const canSubmit = !isSubmitting && !error && Boolean(preview) && (!preview?.fee || feeCollected) && (action !== 'Check-out' || (inventoryAvailable && checklist?.items?.length > 0 && Boolean(checklist?.signatureFile && checklist?.guestName?.trim() && checklist?.attendantName?.trim())))
    const selectedMethod = (paymentMethods || []).find((method) => String(method.payment_method_id) === String(selectedPaymentMethod))
    const methodType = selectedMethod?.method_type?.toLowerCase()
    const needsReceipt = Boolean(selectedPaymentMethod && (!methodType || !NO_RECEIPT_METHOD_TYPES.includes(methodType)))
    const bodyRef = useRef(null)
    const errorRef = useRef(null)
    const [payments, setPayments] = useState([])
    const [paymentsLoading, setPaymentsLoading] = useState(false)
    const [paymentsError, setPaymentsError] = useState('')

    useEffect(() => {
        if (!readOnly || !reservation.reservationId) return undefined
        let current = true
        setPaymentsLoading(true)
        setPaymentsError('')
        fetch(`${API_BASE_URL}/api/admin/reservations/${encodeURIComponent(reservation.reservationId)}/payments`, { credentials: 'include' })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}))
                if (!response.ok) throw new Error(data.error || 'Unable to fetch payment history.')
                return data
            })
            .then((data) => { if (current) setPayments(data.payments || []) })
            .catch((loadError) => { if (current) setPaymentsError(loadError.message) })
            .finally(() => { if (current) setPaymentsLoading(false) })
        return () => { current = false }
    }, [readOnly, reservation.reservationId])

    useEffect(() => {
        const hadOverflowHidden = document.body.classList.contains('overflow-hidden')
        document.body.classList.add('overflow-hidden')
        const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            if (!hadOverflowHidden) document.body.classList.remove('overflow-hidden')
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    useEffect(() => {
        if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [error])

    const handleOverlayClick = (event) => { if (event.target === event.currentTarget) onClose() }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="reservation-attendance-title">
            <div className="flex max-h-[90vh] max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Reservation attendance</p>
                        <h2 id="reservation-attendance-title" className="mt-1 text-xl font-bold text-slate-800">{action || 'Reservation summary'}</h2>
                    </div>
                    <button type="button" aria-label="Close reservation attendance" onClick={onClose} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
                </div>
                <div ref={bodyRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
                    <div className="grid grid-cols-1 gap-x-5 gap-y-3 text-slate-600 sm:grid-cols-2">
                        <p><span className="block text-xs text-slate-400">Guest</span><strong className="text-slate-800">{reservation.guest}</strong></p>
                        <p><span className="block text-xs text-slate-400">Booking reference</span><strong className="font-mono text-xs text-slate-800">{reservation.id}</strong></p>
                        <p><span className="block text-xs text-slate-400">{reservation.isVenue ? 'Venue' : 'Room'}</span>{reservation.room}</p>
                        <p><span className="block text-xs text-slate-400">Status</span>{reservation.status}</p>
                        <p><span className="block text-xs text-slate-400">{reservation.isVenue ? 'Event date / time' : 'Dates'}</span>{reservation.isVenue ? formatVenueDateTime(reservation.eventDate, reservation.startTime, reservation.endTime) : formatDateRange(reservation.checkInDate, reservation.checkOutDate)}</p>
                        {reservation.isVenue ? <><p><span className="block text-xs text-slate-400">Package</span>{reservation.packageName || 'Day use'}</p><p><span className="block text-xs text-slate-400">Pax</span>{reservation.pax || 'N/A'}</p></> : null}
                        <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="block text-xs text-slate-400">Payment summary</span><div className="mt-2 grid grid-cols-3 gap-2"><p><span className="block text-xs text-slate-400">Total</span><strong className="text-slate-800">PHP {reservation.total?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></p><p><span className="block text-xs text-slate-400">Paid</span><strong className="text-slate-800">PHP {reservation.amountPaid?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></p><p><span className="block text-xs text-slate-400">Balance</span><strong className="text-slate-800">PHP {reservation.balanceDue?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></p></div></div>
                        {!reservation.isVenue ? <p><span className="block text-xs text-slate-400">Extra beds</span>{reservation.bedsAdded ?? 0}</p> : null}
                        {readOnly ? <><p><span className="block text-xs text-slate-400">Actual check-in</span>{formatDateTime(reservation.actualCheckIn)}</p><p><span className="block text-xs text-slate-400">Actual check-out</span>{formatDateTime(reservation.actualCheckOut)}</p><p><span className="block text-xs text-slate-400">Early check-in fee</span>PHP {reservation.earlyCheckinFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><p><span className="block text-xs text-slate-400">Late check-out fee</span>PHP {reservation.lateCheckoutFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p></> : null}
                        <p><span className="block text-xs text-slate-400">Standard times</span>Check-in 2:00 PM / Check-out 12:00 noon</p>
                    </div>

                    {readOnly ? <ReservationPaymentsList payments={payments} loading={paymentsLoading} error={paymentsError} /> : null}
                    {action || venueBalance ? <>
                        {reservation.balanceDue > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="font-semibold text-amber-800">Balance due: PHP {reservation.balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><div className="mt-3 space-y-3"><select value={selectedPaymentMethod || ''} onChange={(event) => onPaymentMethodChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-sm"><option value="">Select payment method</option>{(paymentMethods || []).map((method) => <option key={method.payment_method_id} value={method.payment_method_id}>{method.method_name}</option>)}</select>{needsReceipt ? <ReceiptCapture value={balanceProof} onChange={onBalanceProofChange} /> : null}</div><button type="button" disabled={isSubmitting || !selectedPaymentMethod || (needsReceipt && !balanceProof)} onClick={onCollectBalance} className="mt-3 min-h-11 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Collect balance</button></div> : null}
                        {!reservation.isVenue ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-600">Extra beds</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input type="number" min="1" max="10" value={bedQuantity} onChange={(event) => onBedQuantityChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-2 py-2 sm:w-24" /><button type="button" disabled={isSubmitting || !bedQuantity} onClick={onAddBed} className="min-h-11 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add bed</button></div></div> : <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Cash change: PHP 0.00 (display only)</p>}
                        {action ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="font-medium text-slate-700"><span className="block text-xs font-normal text-slate-400">Actual date</span><input type="date" value={actualDate} min={reservation.checkInDate} max={reservation.checkOutDate} onChange={(event) => onDateChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-700 outline-none focus:border-sky-500" /></label>
                            <label className="font-medium text-slate-700"><span className="block text-xs font-normal text-slate-400">Actual {action === 'Check-in' ? 'check-in' : 'check-out'} time</span><input type="time" value={actualTime} onChange={(event) => onTimeChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-700 outline-none focus:border-sky-500" /></label>
                        </div> : null}
                        {action && reservation.databaseStatus === 'confirmed' && actualDate > reservation.checkInDate ? <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">Late arrival: scheduled check-in was {formatDateOnly(reservation.checkInDate)}. No early check-in fee applies.</p> : null}
                        {preview || isPreviewLoading ? <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-slate-700">{isPreviewLoading ? <p role="status">Calculating fee preview...</p> : <><p className="font-semibold text-slate-800">Fee preview: PHP {Number(preview.fee || 0).toLocaleString()}</p><p>{preview.hours_charged} {preview.hours_charged === 1 ? 'hr' : 'hrs'} x PHP {Number(preview.rate).toLocaleString()} = PHP {Number(preview.fee || 0).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Partial hours are rounded up.</p></>}</div> : null}
                        {action === 'Check-out' ? (checklistLoading ? <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500" role="status">Loading room inventory...</p> : !inventoryAvailable ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">Room inventory is unavailable until its migration is applied.</p> : !checklist?.items?.length ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No active checklist items are configured. <a href="/admin/settings" className="font-semibold underline">Go to Settings</a> to add or reactivate one before checkout.</p> : <InventoryChecklist value={checklist} onChange={onChecklistChange} staffName={staffName} chargesCollected={chargesCollected} onChargesCollectedChange={onChargesCollectedChange} />) : null}
                        {preview?.fee > 0 ? <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" checked={feeCollected} onChange={(event) => onFeeCollectedChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" /> <span>Fee collected from guest</span></label> : null}
                        {error ? <p ref={errorRef} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
                        {notice ? <p ref={errorRef} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notice}</p> : null}
                    </> : readOnly ? null : <>
                        {inspectionLoading ? <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500" role="status">Loading inventory inspection...</p> : null}
                        {inspectionError ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700" role="alert">{inspectionError}</p> : null}
                        {!inspectionLoading && !inspectionError && checklist ? <><InventoryChecklist value={checklist} readOnly /><p className="text-xs text-slate-500">Signed at: {formatDateTime(checklist.signed_at)}</p><p className="text-xs text-slate-500">Charges collected: {checklist.charges_collected_at ? `Yes, ${formatDateTime(checklist.charges_collected_at)}` : 'No'}</p></> : null}
                        {!inspectionLoading && !inspectionError && !checklist ? <p className="rounded-lg bg-slate-50 px-4 py-3 text-slate-600">No inventory inspection on record.</p> : null}
                    </>}
                </div>
                <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">{readOnly ? 'Close' : 'Cancel'}</button>{action ? <button type="button" disabled={!canSubmit} onClick={onConfirm} className="min-h-11 rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Saving...' : action}</button> : null}</div>
            </div>
        </div>
    )
}
