import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBan, FaCheck, FaEye, FaSearch, FaTimes, FaUser } from 'react-icons/fa'
import { formatMonthYear } from '../utils/formatDate.js'

const defaultCustomers = [
    { id: 1, name: 'Juan Dela Cruz', email: 'juan@email.com', type: 'Registered', bookings: 3, totalSpent: null, memberSince: 'Jan 2024' },
    { id: 2, name: 'Ana Reyes', email: 'ana@email.com', type: 'Registered', bookings: 5, totalSpent: null, memberSince: 'Mar 2023' },
    { id: 3, name: 'Marco Lim', email: 'marco@email.com', type: 'Guest', bookings: 1, totalSpent: null, memberSince: 'Jul 2025' },
    { id: 4, name: 'Chloe Park', email: 'chloe@email.com', type: 'Registered', bookings: 2, totalSpent: null, memberSince: 'Jun 2024' },
]

const API_URL = `${API_BASE_URL}/api/admin/customers`

function formatPrice(value) {
    return value === null || value === undefined ? 'N/A' : `₱${Number(value).toLocaleString('en-PH')}`
}

function formatMemberSince(value) {
    if (!value) return 'N/A'
    return formatMonthYear(value)
}

function mapCustomer(customer) {
    return {
        id: customer.customer_id,
        name: `${customer.first_name} ${customer.last_name}`.trim(),
        email: customer.email || 'N/A',
        type: customer.is_registered ? 'Registered' : 'Guest',
        bookings: Number(customer.reservation_count || 0),
        totalSpent: null,
        memberSince: formatMemberSince(customer.created_at),
    }
}

function CustomerType({ type }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${type === 'Registered' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'}`}>{type}</span>
}

export default function CustomersPage({ customers: initialCustomers, onCustomerSelect }) {
    const navigate = useNavigate()
    const [customers, setCustomers] = useState(initialCustomers ?? defaultCustomers)
    const [filter, setFilter] = useState('All')
    const [search, setSearch] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [customerDetails, setCustomerDetails] = useState(null)
    const [isDetailsLoading, setIsDetailsLoading] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)

    const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete the customer request.')
        return data
    }

    const loadCustomers = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(API_URL)
            setCustomers((data.customers || []).map(mapCustomer))
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadCustomers() }, [])

    const openCustomer = async (customer) => {
        setSelectedCustomer(customer)
        setCustomerDetails(null)
        setIsDetailsLoading(true)
        setError('')
        onCustomerSelect?.(customer)
        try {
            const data = await request(`${API_URL}/${customer.id}`)
            setCustomerDetails(data)
        } catch (detailError) {
            setError(detailError.message)
        } finally {
            setIsDetailsLoading(false)
        }
    }

    const updateCustomerStatus = async (action) => {
        if (!selectedCustomer || selectedCustomer.type !== 'Registered') return
        setIsUpdating(true)
        setError('')
        setNotice('')
        try {
            const data = await request(`${API_URL}/${selectedCustomer.id}/${action}`, { method: 'PATCH' })
            setNotice(data.message || `Customer ${action}d successfully.`)
            const details = await request(`${API_URL}/${selectedCustomer.id}`)
            setCustomerDetails(details)
            await loadCustomers()
        } catch (updateError) {
            setError(updateError.message)
        } finally {
            setIsUpdating(false)
        }
    }

    const filteredCustomers = useMemo(() => {
        const term = search.trim().toLowerCase()
        return customers.filter((customer) => {
            const matchesFilter = filter === 'All' || customer.type === filter
            const matchesSearch = !term || `${customer.name} ${customer.email}`.toLowerCase().includes(term)
            return matchesFilter && matchesSearch
        })
    }, [customers, filter, search])

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-800">Customer Management</h1>
                <div className="flex items-center gap-2">
                    {['All', 'Registered', 'Guest'].map((tab) => (
                        <button key={tab} type="button" onClick={() => setFilter(tab)} className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${filter === tab ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            {notice ? <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p> : null}
            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="border-b border-slate-200 p-3">
                    <label className="relative block max-w-sm">
                        <span className="sr-only">Search customers</span>
                        <FaSearch className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers..." className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500" />
                    </label>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Customer</th>
                                <th className="px-4 py-4">Email</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4">Bookings</th>
                                <th className="px-4 py-4">Total<br />Spent</th>
                                <th className="px-4 py-4">Member<br />Since</th>
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">Loading customers...</td></tr> : null}
                            {!isLoading && filteredCustomers.map((customer) => (
                                <tr key={customer.id} className="text-sm">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FaUser className="h-3 w-3" /></span>
                                            <span className="max-w-[100px] font-medium text-slate-800">{customer.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-slate-500">{customer.email}</td>
                                    <td className="px-4 py-4"><CustomerType type={customer.type} /></td>
                                    <td className="px-4 py-4 text-slate-600">{customer.bookings}</td>
                                    <td className="px-4 py-4 font-semibold text-slate-700">{formatPrice(customer.totalSpent)}</td>
                                    <td className="whitespace-pre-line px-4 py-4 text-slate-500">{customer.memberSince.replace(' ', '\n')}</td>
                                    <td className="px-4 py-4"><button type="button" aria-label={`View ${customer.name}`} title="View customer" onClick={() => onCustomerSelect?.(customer)} className="text-sky-600 transition hover:text-sky-800"><FaEye className="h-3.5 w-3.5" /></button></td>
                                </tr>
                            ))}
                            {!isLoading && filteredCustomers.length === 0 ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">No customers found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
            {selectedCustomer ? <CustomerDetailsModal customer={selectedCustomer} details={customerDetails} isLoading={isDetailsLoading} isUpdating={isUpdating} onClose={() => { setSelectedCustomer(null); setCustomerDetails(null) }} onDeactivate={() => updateCustomerStatus('deactivate')} onReactivate={() => updateCustomerStatus('reactivate')} /> : null}
        </div>
    )
}

function CustomerDetailsModal({ customer, details, isLoading, isUpdating, onClose, onDeactivate, onReactivate }) {
    const profile = details?.customer
    const reservations = details?.reservations || []
    const isActive = profile?.is_active !== false && profile?.is_active !== 0

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={`${customer.name} details`}>
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
                <div><h2 className="text-xl font-bold text-slate-800">{customer.name}</h2><p className="mt-1 text-sm text-slate-500">Customer #{customer.id}</p></div>
                <button type="button" aria-label="Close customer details" title="Close" onClick={onClose} className="text-slate-400 transition hover:text-slate-700"><FaTimes /></button>
            </div>
            {isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading customer details...</p> : null}
            {!isLoading && profile ? <>
                <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    <p><span className="font-semibold text-slate-600">Email:</span> {profile.email || 'N/A'}</p>
                    <p><span className="font-semibold text-slate-600">Phone:</span> {profile.phone_number}</p>
                    <p><span className="font-semibold text-slate-600">Address:</span> {profile.address || 'N/A'}</p>
                    <p><span className="font-semibold text-slate-600">Type:</span> {profile.is_registered ? 'Registered' : 'Guest'}</p>
                    {profile.is_registered ? <p><span className="font-semibold text-slate-600">Status:</span> {isActive ? 'Active' : 'Deactivated'}</p> : null}
                </div>
                {profile.is_registered ? <div className="mt-4 flex justify-end">{isActive ? <button type="button" disabled={isUpdating} onClick={onDeactivate} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"><FaBan />{isUpdating ? 'Updating...' : 'Deactivate account'}</button> : <button type="button" disabled={isUpdating} onClick={onReactivate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"><FaCheck />{isUpdating ? 'Updating...' : 'Reactivate account'}</button>}</div> : null}
                <h3 className="mt-6 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-700">Reservation history</h3>
                {reservations.length === 0 ? <p className="py-5 text-sm text-slate-500">No reservations found.</p> : <div className="mt-3 space-y-2">{reservations.map((reservation) => <div key={reservation.reservation_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm"><span className="font-medium text-slate-700">{reservation.booking_reference}</span><span className="text-slate-500">{reservation.status}</span><span className="font-semibold text-slate-700">{formatPrice(reservation.total_amount)}</span></div>)}</div>}
            </> : null}
        </div>
    </div>
}
