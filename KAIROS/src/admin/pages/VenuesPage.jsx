import { FaEdit, FaImage, FaPlus, FaTrash } from 'react-icons/fa'

const defaultVenues = [
    { id: 1, name: 'Presidential Suite', type: 'Suite', capacity: '4 guests', price: 15000, status: 'Available', image: null },
    { id: 2, name: 'Beach Suite', type: 'Suite', capacity: '3 guests', price: 6800, status: 'Occupied', image: null },
    { id: 3, name: 'Garden Villa', type: 'Villa', capacity: '4 guests', price: 8200, status: 'Maintenance', image: null },
    { id: 4, name: 'Family Room', type: 'Family', capacity: '4 guests', price: 5500, status: 'Available', image: null },
]

const statusStyles = {
    Available: 'bg-emerald-100 text-emerald-600',
    Occupied: 'bg-sky-100 text-sky-600',
    Maintenance: 'bg-amber-100 text-amber-600',
}

function formatPrice(price) {
    return `₱${Number(price).toLocaleString('en-PH')}`
}

function VenueStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

function VenueAction({ label, icon: Icon, onClick, danger = false }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={`transition ${danger ? 'text-rose-400 hover:text-rose-600' : 'text-sky-600 hover:text-sky-800'}`}>
            <Icon className="h-3.5 w-3.5" />
        </button>
    )
}

export default function VenuesPage({ venues = defaultVenues, onAddVenue, onEditVenue, onViewImage, onDeleteVenue }) {
    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Venue Management</h1>
                <button type="button" onClick={onAddVenue} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700">
                    <FaPlus className="h-3 w-3" />
                    Add Venue
                </button>
            </header>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Photo</th>
                                <th className="px-4 py-4">Venue Name</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4">Capacity</th>
                                <th className="px-4 py-4">Price /<br />Night</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {venues.map((venue) => (
                                <tr key={venue.id} className="text-sm">
                                    <td className="px-4 py-3">
                                        {venue.image ? <img src={venue.image} alt={venue.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{venue.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{venue.type}</td>
                                    <td className="px-4 py-3 text-slate-500">{venue.capacity}</td>
                                    <td className="px-4 py-3 font-bold text-sky-700">{formatPrice(venue.price)}</td>
                                    <td className="px-4 py-3"><VenueStatus status={venue.status} /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-4">
                                            <VenueAction label="Edit venue" icon={FaEdit} onClick={() => onEditVenue?.(venue)} />
                                            <VenueAction label="View venue image" icon={FaImage} onClick={() => onViewImage?.(venue)} />
                                            <VenueAction label="Delete venue" icon={FaTrash} danger onClick={() => onDeleteVenue?.(venue)} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {venues.length === 0 ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">No venues found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
