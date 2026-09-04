import { useMemo, useState } from 'react'
import { FaEye, FaSearch, FaUser } from 'react-icons/fa'

const defaultCustomers = [
    { id: 1, name: 'Juan Dela Cruz', email: 'juan@email.com', type: 'Registered', bookings: 3, totalSpent: 42620, memberSince: 'Jan 2024' },
    { id: 2, name: 'Ana Reyes', email: 'ana@email.com', type: 'Registered', bookings: 5, totalSpent: 78900, memberSince: 'Mar 2023' },
    { id: 3, name: 'Marco Lim', email: 'marco@email.com', type: 'Guest', bookings: 1, totalSpent: 45000, memberSince: 'Jul 2025' },
    { id: 4, name: 'Chloe Park', email: 'chloe@email.com', type: 'Registered', bookings: 2, totalSpent: 27400, memberSince: 'Jun 2024' },
]

function formatPrice(value) {
    return `₱${Number(value).toLocaleString('en-PH')}`
}

function CustomerType({ type }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${type === 'Registered' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'}`}>{type}</span>
}

export default function CustomersPage({ customers = defaultCustomers, onCustomerSelect }) {
    const [filter, setFilter] = useState('All')
    const [search, setSearch] = useState('')

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
                            {filteredCustomers.map((customer) => (
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
                            {filteredCustomers.length === 0 ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">No customers found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
