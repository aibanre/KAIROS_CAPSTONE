import { useMemo, useState } from 'react'
import SignaturePad from './SignaturePad'

export default function InventoryChecklist({ value, onChange, readOnly = false, staffName = '', chargesCollected = false, onChargesCollectedChange }) {
    const [signatureFailed, setSignatureFailed] = useState(false)
    const checklist = useMemo(() => value || { items: [], guestName: '', attendantName: staffName, noDamageInside: false, noCrClogging: false }, [value, staffName])
    const items = Array.isArray(checklist.items) ? checklist.items : Array.isArray(checklist.lines) ? checklist.lines : []
    const update = (changes) => onChange?.({ ...checklist, ...changes })
    const updateItem = (index, changes) => update({ items: items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) })
    const totalCents = items.reduce((sum, item) => sum + Number(item.quantityMissing || 0) * Number(item.unitChargeCents || 0), 0)
    const totalDisplay = readOnly && checklist.totalCharge !== undefined ? checklist.totalCharge : totalCents / 100
    return <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Room check-out inspection">
        <div><h3 className="font-semibold text-slate-700">{readOnly ? 'Signed room check-out inspection' : 'Room check-out inspection'}</h3><p className="text-xs text-slate-500">Record missing or damaged items found when the guest leaves.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Guest name<input disabled={readOnly} value={checklist.guestName} onChange={(event) => update({ guestName: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Attendant name<input disabled={readOnly} value={checklist.attendantName || staffName} onChange={(event) => update({ attendantName: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal" /></label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-500"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Quantity</th><th className="px-3 py-2">Missing / damaged</th><th className="px-3 py-2">Charge</th></tr></thead>
                <tbody>{items.map((item, index) => <tr key={item.itemId} className="border-t border-slate-100"><td className="px-3 py-2 font-medium">{item.name}</td><td className="px-3 py-2"><input disabled={readOnly} type="number" min="0" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Math.max(0, Number(event.target.value)) })} className="min-h-11 w-24 rounded border border-slate-300 px-2" /></td><td className="px-3 py-2"><input disabled={readOnly} type="number" min="0" max={item.quantity} value={item.quantityMissing} onChange={(event) => updateItem(index, { quantityMissing: Math.min(item.quantity, Math.max(0, Number(event.target.value))) })} className="min-h-11 w-24 rounded border border-slate-300 px-2" /></td><td className="whitespace-nowrap px-3 py-2">PHP {(readOnly && item.charge !== undefined ? item.charge : item.quantityMissing * item.unitChargeCents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>)}</tbody>
            </table>
        </div>
        <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2"><label><input disabled={readOnly} type="checkbox" checked={Boolean(checklist.noDamageInside)} onChange={(event) => update({ noDamageInside: event.target.checked })} className="mr-2 accent-sky-600" />No damage inside</label><label><input disabled={readOnly} type="checkbox" checked={Boolean(checklist.noCrClogging)} onChange={(event) => update({ noCrClogging: event.target.checked })} className="mr-2 accent-sky-600" />No CR clogging</label></div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-800">Total loss/damage charges: PHP {totalDisplay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
        <p className="text-xs text-slate-600">The room was inspected at check-out. The findings above are accurate, and the guest understands any loss or damage charges.</p>
        {!readOnly ? <SignaturePad value={checklist.signatureFile || checklist.signatureUrl} onChange={(signatureFile) => update({ signatureFile })} /> : null}
        {readOnly && checklist.signatureUrl && !signatureFailed ? <img src={checklist.signatureUrl} alt="Guest signature for the room check-out inspection" onError={() => setSignatureFailed(true)} className="max-h-24 rounded border border-slate-200 bg-white p-2" /> : null}
        {readOnly && checklist.signatureUrl && signatureFailed ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">The signed inspection image could not be loaded.</p> : null}
        {!readOnly && totalCents > 0 ? <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={chargesCollected} onChange={(event) => onChargesCollectedChange?.(event.target.checked)} className="mt-0.5 accent-sky-600" />Loss/damage charges collected from guest</label> : null}
    </section>
}
