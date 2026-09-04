import { useMemo, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaEdit, FaEye, FaSearch, FaTimes } from 'react-icons/fa'

const defaultReservations = [
    { id: 'KAB-2025-07-4821', guest: 'Juan Dela Cruz', room: 'Deluxe Ocean View', checkIn: 'Jul 15', checkOut: 'Jul 18', status: 'Confirmed', payment: 'Pending' },
    { id: 'KAB-2025-07-4820', guest: 'Ana Reyes', room: 'Beach Suite', checkIn: 'Jul 14', checkOut: 'Jul 17', status: 'Checked In', payment: 'Paid' },
    { id: 'KAB-2025-07-4819', guest: 'Marco Lim', room: 'Grand Ballroom', checkIn: 'Jul 20', checkOut: 'Jul 20', status: 'Confirmed', payment: 'Paid' },
    { id: 'KAB-2025-07-4818', guest: 'Chloe Park', room: 'Family Room', checkIn: 'Jul 10', checkOut: 'Jul 13', status: 'Checked Out', payment: 'Paid' },
    { id: 'KAB-2025-07-4817', guest: 'Roberto Cruz', room: 'Standard Room', checkIn: 'Jul 8', checkOut: 'Jul 10', status: 'Confirmed', payment: 'Paid' },
]

function StatusBadge({ children, type }) {
    const styles = {
        confirmed: 'bg-sky-100 text-sky-600',
        'checked in': 'bg-emerald-100 text-emerald-600',
        'checked out': 'bg-slate-100 text-slate-600',
        paid: 'bg-emerald-100 text-emerald-600',
        pending: 'bg-amber-100 text-amber-600',
    }

    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[type ?? children.toLowerCase()] ?? 'bg-slate-100 text-slate-600'}`}>{children}</span>
}

function ActionButton({ label, icon: Icon, onClick, danger = false }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={`p-1 transition ${danger ? 'text-rose-400 hover:text-rose-600' : 'text-slate-400 hover:text-sky-600'}`}>
            <Icon className="h-3.5 w-3.5" />
        </button>
    )
}

export default function ReservationsPage({
    reservations = defaultReservations,
    totalReservations = 102,
    onViewReservation,
    onEditReservation,
    onDeleteReservation,
    onFiltersChange,
}) {
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('All Statuses')
    const [dateRange, setDateRange] = useState('All Dates')
    const [page, setPage] = useState(1)

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
            <h1 className="mb-6 text-2xl font-bold text-slate-800">Reservations</h1>

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
                    <option>Checked Out</option>
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
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReservations.map((reservation) => (
                                <tr key={reservation.id} className="text-sm">
                                    <td className="px-4 py-4 font-mono text-xs text-slate-500">{reservation.id}</td>
                                    <td className="max-w-[100px] px-4 py-4 font-medium text-slate-800">{reservation.guest}</td>
                                    <td className="max-w-[120px] px-4 py-4 text-slate-600">{reservation.room}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{reservation.checkIn}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{reservation.checkOut}</td>
                                    <td className="px-4 py-4"><StatusBadge>{reservation.status}</StatusBadge></td>
                                    <td className="px-4 py-4"><StatusBadge>{reservation.payment}</StatusBadge></td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <ActionButton label="View reservation" icon={FaEye} onClick={() => onViewReservation?.(reservation)} />
                                            <ActionButton label="Edit reservation" icon={FaEdit} onClick={() => onEditReservation?.(reservation)} />
                                            <ActionButton label="Delete reservation" icon={FaTimes} danger onClick={() => onDeleteReservation?.(reservation)} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredReservations.length === 0 ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">No reservations found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
                <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
                    <span>Showing {filteredReservations.length ? 1 : 0}–{filteredReservations.length} of {totalReservations} reservations</span>
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
        </div>
    )
}
