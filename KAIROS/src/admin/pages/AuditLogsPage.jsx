import { useMemo, useState } from 'react'
import { FaDownload, FaSearch } from 'react-icons/fa'

const defaultLogs = [
    { id: 1, user: 'admin@kaiazul.com', action: 'Verified payment PAY-002', date: 'Jul 14', time: '10:32 AM', description: 'Payment for booking KAB-2025-07-4820 verified' },
    { id: 2, user: 'staff@kaiazul.com', action: 'Updated room status', date: 'Jul 14', time: '09:15 AM', description: 'Garden Villa changed to Maintenance' },
    { id: 3, user: 'admin@kaiazul.com', action: 'Cancelled reservation', date: 'Jul 13', time: '04:50 PM', description: 'KAB-2025-07-4817 cancelled — guest request' },
    { id: 4, user: 'admin@kaiazul.com', action: 'Added new room', date: 'Jul 12', time: '11:20 AM', description: 'New room: Coral Hideaway added' },
    { id: 5, user: 'staff@kaiazul.com', action: 'Updated knowledge base', date: 'Jul 11', time: '03:10 PM', description: 'Chatbot FAQ updated: Parking policy' },
]

export default function AuditLogsPage({ logs = defaultLogs, onExportLogs }) {
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const filteredLogs = useMemo(() => {
        const term = search.trim().toLowerCase()
        return logs.filter((log) => {
            const matchesSearch = !term || `${log.user} ${log.action} ${log.description}`.toLowerCase().includes(term)
            return matchesSearch
        })
    }, [logs, search])

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
                <button type="button" onClick={() => onExportLogs?.(filteredLogs)} className="inline-flex items-center gap-2 rounded-lg border border-sky-500 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50">
                    <FaDownload className="h-3 w-3" />
                    Export Logs
                </button>
            </header>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row">
                    <label className="relative flex-1">
                        <span className="sr-only">Search audit logs</span>
                        <FaSearch className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search logs by user or action..." className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500" />
                    </label>
                    <label className="sr-only" htmlFor="audit-start-date">Start Date</label>
                    <input id="audit-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Start Date" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-500 outline-none focus:border-sky-500" />
                    <label className="sr-only" htmlFor="audit-end-date">End Date</label>
                    <input id="audit-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="End Date" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-500 outline-none focus:border-sky-500" />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="text-sm">
                                    <td className="px-4 py-4 font-mono text-xs text-sky-700">{log.user}</td>
                                    <td className="max-w-[180px] px-4 py-4 font-medium text-slate-800">{log.action}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{log.date}</td>
                                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">{log.time}</td>
                                    <td className="max-w-[330px] px-4 py-4 text-xs leading-5 text-slate-500">{log.description}</td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 ? <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">No audit logs found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
