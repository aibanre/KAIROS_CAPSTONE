import { formatDateTime } from '../utils/formatDate.js'

function formatAmount(value) {
    return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

export default function ReservationPaymentsList({ payments = [], loading = false, error = '' }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">Payments</h3>
            {loading ? <p className="mt-3 text-sm text-slate-500">Loading payment history...</p> : null}
            {error ? <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p> : null}
            {!loading && !error && payments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No payments recorded.</p> : null}
            <div className="mt-3 space-y-3">
                {payments.map((payment) => <div key={payment.payment_id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p className="font-semibold text-slate-800">{payment.payment_type || 'Payment'} · {payment.method_name || 'N/A'}</p>
                            <p className="text-xs text-slate-500">{formatDateTime(payment.created_at)}</p>
                        </div>
                        <p className="font-semibold text-slate-800">{formatAmount(payment.amount)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>{String(payment.payment_status || '').replace('_', ' ')}{payment.collector_name ? ` · Verified by ${payment.collector_name}${payment.collector_role ? ` (${payment.collector_role})` : ''}` : ''}</span>
                        {payment.proof_of_payment_url ? <a href={payment.proof_of_payment_url} target="_blank" rel="noreferrer" className="font-semibold text-sky-700 underline">View receipt</a> : null}
                    </div>
                </div>)}
            </div>
        </section>
    )
}
