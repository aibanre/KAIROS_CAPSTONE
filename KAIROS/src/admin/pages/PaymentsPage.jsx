import { FaCheck, FaClock, FaDownload, FaEye, FaFileInvoice } from 'react-icons/fa'
import StatCard from '../components/StatCard.jsx'

const defaultPayments = [
    { id: 'PAY-001', guest: 'Juan Dela Cruz', booking: 'KAB-4821', amount: 15620, method: 'GCash', date: 'Jul 14', status: 'Pending' },
    { id: 'PAY-002', guest: 'Ana Reyes', booking: 'KAB-4820', amount: 20400, method: 'Bank Transfer', date: 'Jul 13', status: 'Verified' },
    { id: 'PAY-003', guest: 'Marco Lim', booking: 'KAB-4819', amount: 45000, method: 'Credit Card', date: 'Jul 12', status: 'Verified' },
]

const statusStyles = {
    Pending: 'bg-amber-100 text-amber-600',
    Verified: 'bg-emerald-100 text-emerald-600',
}

function formatPrice(value) {
    return `₱${Number(value).toLocaleString('en-PH')}`
}

function PaymentStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

export default function PaymentsPage({
    payments = defaultPayments,
    totalRevenue = 87420,
    pendingVerification = 15620,
    onExport,
    onGenerateReceipt,
    onViewPayment,
    onVerifyPayment,
}) {
    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-800">Payment Management</h1>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onExport} className="inline-flex items-center gap-2 rounded-lg border border-sky-500 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"><FaDownload className="h-3 w-3" />Export</button>
                    <button type="button" onClick={onGenerateReceipt} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"><FaFileInvoice className="h-3 w-3" />Generate Receipt</button>
                </div>
            </header>

            <div className="grid max-w-[490px] gap-4 sm:grid-cols-2">
                <StatCard label="TOTAL REVENUE" value={formatPrice(totalRevenue)} icon={FaDownload} iconBackground="bg-emerald-50" />
                <StatCard label="PENDING VERIFICATION" value={formatPrice(pendingVerification)} icon={FaClock} iconBackground="bg-amber-50" />
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Ref</th>
                                <th className="px-4 py-4">Guest</th>
                                <th className="px-4 py-4">Booking</th>
                                <th className="px-4 py-4">Amount</th>
                                <th className="px-4 py-4">Method</th>
                                <th className="px-4 py-4">Date</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {payments.map((payment) => (
                                <tr key={payment.id} className="text-sm">
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{payment.id}</td>
                                    <td className="px-4 py-4 font-medium text-slate-800">{payment.guest}</td>
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{payment.booking}</td>
                                    <td className="px-4 py-4 font-bold text-slate-800">{formatPrice(payment.amount)}</td>
                                    <td className="max-w-[100px] px-4 py-4 text-slate-500">{payment.method}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{payment.date}</td>
                                    <td className="px-4 py-4"><PaymentStatus status={payment.status} /></td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <button type="button" aria-label="View payment" title="View payment" onClick={() => onViewPayment?.(payment)} className="text-sky-600 transition hover:text-sky-800"><FaEye className="h-3.5 w-3.5" /></button>
                                            {payment.status === 'Pending' ? <button type="button" aria-label="Verify payment" title="Verify payment" onClick={() => onVerifyPayment?.(payment)} className="text-emerald-500 transition hover:text-emerald-700"><FaCheck className="h-3.5 w-3.5" /></button> : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {payments.length === 0 ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No payments found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
