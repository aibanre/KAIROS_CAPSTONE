import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft, FaChevronRight, FaDownload, FaSearch, FaTimes } from 'react-icons/fa'

const API_URL = `${API_BASE_URL}/api/admin/audit-logs`
const PAGE_SIZE_OPTIONS = [10, 25, 50]

const actionStyles = {
    create: 'bg-emerald-100 text-emerald-700',
    update: 'bg-sky-100 text-sky-700',
    deactivate: 'bg-amber-100 text-amber-700',
    accept: 'bg-emerald-100 text-emerald-700',
    decline: 'bg-rose-100 text-rose-700',
    login: 'bg-indigo-100 text-indigo-700',
    logout: 'bg-slate-100 text-slate-600',
    login_failed: 'bg-rose-100 text-rose-700',
}

const knownActionLabels = {
    'room.create': 'Room created',
    'room.update': 'Room updated',
    'room.deactivate': 'Room deactivated',
    'venue.create': 'Venue created',
    'venue.update': 'Venue updated',
    'venue.deactivate': 'Venue deactivated',
    'payment_method.create': 'Payment method created',
    'payment_method.update': 'Payment method updated',
    'payment_method.deactivate': 'Payment method deactivated',
    'payment.accept': 'Payment accepted',
    'payment.decline': 'Payment declined',
    'reservation.create': 'Reservation created',
    'reservation.hold_expired': 'Reservation hold expired',
    'auth.login': 'Login successful',
    'auth.logout': 'Logout',
    'auth.login_failed': 'Login failed',
    'user.create': 'User created',
    'user.update': 'User updated',
    'user.deactivate': 'User deactivated',
    'user.reactivate': 'User reactivated',
}

function titleCase(value) {
    return value.replaceAll('_', ' ').replaceAll('.', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function getActionVerb(action) {
    const normalized = String(action || '').toLowerCase()
    return normalized.split('.').pop() || normalized
}

function getActionLabel(action) {
    const normalized = String(action || '')
    return knownActionLabels[normalized] || titleCase(normalized)
}

function getActionStyle(action) {
    return actionStyles[getActionVerb(action)] || 'bg-slate-100 text-slate-600'
}

function parseDisplayValue(value) {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'object') return value
    return { value: String(value) }
}

function formatValue(value, key) {
    if (key === 'rejection_reason' && (value === null || value === undefined || value === '')) return 'No reason given'
    if (value === null || value === undefined || value === '') return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
}

function formatTimestamp(value) {
    if (!value) return { date: 'N/A', time: '' }
    const timestamp = new Date(value)
    if (Number.isNaN(timestamp.getTime())) return { date: 'N/A', time: '' }
    return {
        date: timestamp.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
        time: timestamp.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
    }
}

function mapAuditLog(log) {
    const timestamp = formatTimestamp(log.created_at)
    return {
        id: log.log_id,
        user: log.user_name || 'System',
        role: log.user_role || null,
        action: log.action || 'unknown',
        actionLabel: getActionLabel(log.action),
        entityType: log.entity_type || 'N/A',
        entityId: log.entity_id,
        timestamp: log.created_at,
        date: timestamp.date,
        time: timestamp.time,
        ipAddress: log.ip_address || 'N/A',
        oldValue: parseDisplayValue(log.old_value),
        newValue: parseDisplayValue(log.new_value),
    }
}

export default function AuditLogsPage({ onExportLogs, onViewLog }) {
    const navigate = useNavigate()
    const [logs, setLogs] = useState([])
    const [filterOptions, setFilterOptions] = useState({ actions: [], entityTypes: [] })
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [action, setAction] = useState('')
    const [entityType, setEntityType] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(25)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedLog, setSelectedLog] = useState(null)

    useEffect(() => {
        const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
        return () => window.clearTimeout(timer)
    }, [search])

    useEffect(() => { setPage(1) }, [debouncedSearch, action, entityType, startDate, endDate, limit])

    useEffect(() => {
        const controller = new AbortController()
        const params = new URLSearchParams({ page: String(page), limit: String(limit) })
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (action) params.set('action', action)
        if (entityType) params.set('entity_type', entityType)
        if (startDate) params.set('from', startDate)
        if (endDate) params.set('to', endDate)

        setIsLoading(true)
        setError('')
        fetch(`${API_URL}?${params.toString()}`, { credentials: 'include', signal: controller.signal })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}))
                if (response.status === 401 || response.status === 403) {
                    navigate('/admin/login', { replace: true })
                    throw new Error('Your admin session has expired.')
                }
                if (!response.ok) throw new Error(data.error || 'Unable to fetch audit logs.')
                return data
            })
            .then((data) => {
                setLogs((data.logs || []).map(mapAuditLog))
                setFilterOptions({ actions: data.filterOptions?.actions || [], entityTypes: data.filterOptions?.entityTypes || [] })
                setTotal(Number(data.total) || 0)
                setTotalPages(Number(data.totalPages) || 0)
            })
            .catch((fetchError) => {
                if (fetchError.name !== 'AbortError') setError(fetchError.message)
            })
            .finally(() => setIsLoading(false))

        return () => controller.abort()
    }, [page, limit, debouncedSearch, action, entityType, startDate, endDate, navigate])

    const clearFilters = () => {
        setSearch('')
        setAction('')
        setEntityType('')
        setStartDate('')
        setEndDate('')
        setPage(1)
    }

    const openLog = (log) => {
        setSelectedLog(log)
        onViewLog?.(log)
    }

    const firstResult = total === 0 ? 0 : ((page - 1) * limit) + 1
    const lastResult = Math.min(page * limit, total)

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
                <button type="button" onClick={() => onExportLogs?.(logs)} className="inline-flex items-center gap-2 rounded-lg border border-sky-500 bg-white px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"><FaDownload className="h-3 w-3" />Export Logs</button>
            </header>

            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:flex-wrap">
                    <label className="relative min-w-[240px] flex-1"><span className="sr-only">Search audit logs</span><FaSearch className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, entity, ID, or user..." className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500" /></label>
                    <label className="sr-only" htmlFor="audit-action">Action</label><select id="audit-action" value={action} onChange={(event) => setAction(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-sky-500"><option value="">All actions</option>{filterOptions.actions.map((option) => <option key={option} value={option}>{getActionLabel(option)}</option>)}</select>
                    <label className="sr-only" htmlFor="audit-entity">Entity type</label><select id="audit-entity" value={entityType} onChange={(event) => setEntityType(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-sky-500"><option value="">All entities</option>{filterOptions.entityTypes.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}</select>
                    <label className="sr-only" htmlFor="audit-start-date">From date</label><input id="audit-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="From date" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-500 outline-none focus:border-sky-500" />
                    <label className="sr-only" htmlFor="audit-end-date">To date</label><input id="audit-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="To date" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-500 outline-none focus:border-sky-500" />
                    <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-700">Clear filters</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50"><tr className="text-xs font-semibold text-slate-500"><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">IP address</th><th className="px-4 py-3">View</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">Loading audit logs...</td></tr> : null}
                            {!isLoading && logs.map((log) => <tr key={log.id} role="button" tabIndex="0" onClick={() => openLog(log)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openLog(log) } }} className="cursor-pointer text-sm transition hover:bg-sky-50"><td className="whitespace-nowrap px-4 py-4 text-slate-500"><div>{log.date}</div><div className="text-xs text-slate-400">{log.time}</div></td><td className="px-4 py-4"><div className="font-medium text-slate-800">{log.user}</div><div className="text-xs text-slate-500">{log.role || 'System'}</div></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getActionStyle(log.action)}`}>{log.actionLabel}</span></td><td className="px-4 py-4 text-slate-600"><span className="font-medium">{titleCase(log.entityType)}</span>{log.entityId !== null && log.entityId !== undefined ? <span className="ml-1 font-mono text-xs text-slate-400">#{log.entityId}</span> : null}</td><td className="px-4 py-4 font-mono text-xs text-slate-500">{log.ipAddress}</td><td className="px-4 py-4 text-sky-600">View</td></tr>)}
                            {!isLoading && logs.length === 0 ? <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No audit logs found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500"><span>Showing {firstResult}-{lastResult} of {total}</span><div className="flex items-center gap-3"><label className="flex items-center gap-2">Page size<select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label><span>Page {totalPages === 0 ? 0 : page} of {totalPages}</span><button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)} aria-label="Previous page" title="Previous page" className="rounded-lg border border-slate-300 p-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"><FaChevronLeft className="h-3 w-3" /></button><button type="button" disabled={page >= totalPages || isLoading} onClick={() => setPage((current) => current + 1)} aria-label="Next page" title="Next page" className="rounded-lg border border-slate-300 p-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"><FaChevronRight className="h-3 w-3" /></button></div></footer>
            </section>
            {selectedLog ? <AuditDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} /> : null}
        </div>
    )
}

function AuditDetailPanel({ log, onClose }) {
    const oldValue = log.oldValue
    const newValue = log.newValue
    const keys = Array.from(new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]))
    return <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>    <aside className="max-h-[90dvh] h-full w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-h-none sm:rounded-none sm:p-6" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Audit detail</p><h2 id="audit-detail-title" className="mt-1 text-xl font-bold text-slate-800">{log.actionLabel}</h2></div><button type="button" onClick={onClose} aria-label="Close audit detail" title="Close audit detail" className="text-slate-400 hover:text-slate-700"><FaTimes /></button></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><Detail label="Timestamp" value={`${log.date} ${log.time}`} /><Detail label="User" value={`${log.user}${log.role ? ` (${log.role})` : ''}`} /><Detail label="Raw action" value={log.action} /><Detail label="Entity" value={`${log.entityType}${log.entityId === null || log.entityId === undefined ? '' : ` #${log.entityId}`}`} /><Detail label="IP address" value={log.ipAddress} /></dl><div className="mt-6 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-800">Old vs new values</h3>{keys.length === 0 ? <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No values recorded.</div> : <div className="mt-3 space-y-2">{keys.map((key) => { const oldText = formatValue(oldValue?.[key], key); const newText = formatValue(newValue?.[key], key); const changed = oldText !== newText; return <div key={key} className={`rounded-lg border p-3 ${changed ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200 bg-slate-50'}`}><p className="text-xs font-semibold text-slate-700">{titleCase(key)}{changed ? <span className="ml-2 font-normal text-sky-700">Changed</span> : null}</p><div className="mt-2 grid gap-3 sm:grid-cols-2"><ValueBlock label="Old" value={oldText} /><ValueBlock label="New" value={newText} /></div></div> })}</div>}</div></aside></div>
}

function Detail({ label, value }) {
    return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value || 'N/A'}</dd></div>
}

function ValueBlock({ label, value }) {
    return <div><p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p><pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-slate-600">{value}</pre></div>
}
