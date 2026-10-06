import { FaTimes } from 'react-icons/fa'

function formatDate(value) {
    if (!value) return 'N/A'
    const datePart = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (!datePart) return 'N/A'
    const date = new Date(`${datePart}T00:00:00Z`)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ReservationActionModal({ reservation, actualDate, actualTime, preview, error, notice, isSubmitting, feeCollected, paymentMethods, selectedPaymentMethod, balanceProof, bedQuantity, onPaymentMethodChange, onBalanceProofChange, onBedQuantityChange, onCollectBalance, onAddBed, onTimeChange, onFeeCollectedChange, onConfirm, onClose }) {
    const action = reservation.databaseStatus === 'confirmed' ? 'Check-in' : reservation.databaseStatus === 'checked_in' ? 'Check-out' : null
    const canSubmit = !isSubmitting && (!preview?.fee || feeCollected)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Reservation attendance">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Reservation attendance</p>
                        <h2 className="mt-1 text-xl font-bold text-slate-800">{action || 'Reservation summary'}</h2>
                    </div>
                    <button type="button" aria-label="Close reservation attendance" onClick={onClose} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
                </div>
                <div className="space-y-4 px-6 py-5 text-sm">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-slate-600">
                        <p><span className="block text-xs text-slate-400">Guest</span><strong className="text-slate-800">{reservation.guest}</strong></p>
                        <p><span className="block text-xs text-slate-400">Booking reference</span><strong className="font-mono text-xs text-slate-800">{reservation.id}</strong></p>
                        <p><span className="block text-xs text-slate-400">Room</span>{reservation.room}</p>
                        <p><span className="block text-xs text-slate-400">Status</span>{reservation.status}</p>
                        <p><span className="block text-xs text-slate-400">Dates</span>{formatDate(reservation.checkInDate)} - {formatDate(reservation.checkOutDate)}</p>
                        <p><span className="block text-xs text-slate-400">Total / paid / balance</span>PHP {reservation.total?.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / PHP {reservation.amountPaid?.toLocaleString('en-PH', { minimumFractionDigits: 2 })} / PHP {reservation.balanceDue?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                        <p><span className="block text-xs text-slate-400">Extra beds</span>{reservation.bedsAdded ?? 0}</p>
                        <p><span className="block text-xs text-slate-400">Standard times</span>Check-in 2:00 PM / Check-out 12:00 noon</p>
                    </div>

                    {action ? <>
                        {reservation.balanceDue > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="font-semibold text-amber-800">Balance due: PHP {reservation.balanceDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={selectedPaymentMethod || ''} onChange={(event) => onPaymentMethodChange(event.target.value)} className="rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs"><option value="">Select payment method</option>{(paymentMethods || []).map((method) => <option key={method.payment_method_id} value={method.payment_method_id}>{method.method_name}</option>)}</select><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onBalanceProofChange(event.target.files?.[0] || null)} className="rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs" /></div><button type="button" disabled={isSubmitting || !selectedPaymentMethod} onClick={onCollectBalance} className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Collect balance</button></div> : null}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-semibold text-slate-600">Extra beds</p><div className="mt-2 flex gap-2"><input type="number" min="1" max="10" value={bedQuantity} onChange={(event) => onBedQuantityChange(event.target.value)} className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-xs" /><button type="button" disabled={isSubmitting} onClick={onAddBed} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add bed</button></div></div>
                        <div className="grid grid-cols-2 gap-4">
                            <p className="font-medium text-slate-700"><span className="block text-xs font-normal text-slate-400">Actual date</span><span className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-700">{formatDate(actualDate)}</span></p>
                            <label className="font-medium text-slate-700">Actual {action === 'Check-in' ? 'check-in' : 'check-out'} time
                                <input type="time" value={actualTime} onChange={(event) => onTimeChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-700 outline-none focus:border-sky-500" />
                            </label>
                        </div>
                        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-slate-700">
                            {preview ? <>
                                <p className="font-semibold text-slate-800">Fee preview: PHP {Number(preview.fee || 0).toLocaleString()}</p>
                                <p>{preview.hours_charged} {preview.hours_charged === 1 ? 'hr' : 'hrs'} x PHP {Number(preview.rate).toLocaleString()} = PHP {Number(preview.fee || 0).toLocaleString()}</p>
                                <p className="mt-1 text-xs text-slate-500">Partial hours are rounded up.</p>
                            </> : error ? null : <p>Calculating fee preview...</p>}
                        </div>
                        {preview?.fee > 0 ? <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" checked={feeCollected} onChange={(event) => onFeeCollectedChange(event.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" /> <span>Fee collected from guest</span></label> : null}
                        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
                        {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">{notice}</p> : null}
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button type="button" disabled={!canSubmit} onClick={onConfirm} className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Saving...' : action}</button>
                        </div>
                    </> : <p className="rounded-lg bg-slate-50 px-4 py-3 text-slate-600">No attendance action is available for this reservation.</p>}
                </div>
            </div>
        </div>
    )
}