import { FaEdit, FaImage, FaPlus, FaTrash } from 'react-icons/fa'

const defaultRooms = [
    { id: 1, name: 'Deluxe Ocean View', type: 'Deluxe', capacity: '2 guests', price: 4500, status: 'Available', image: null },
    { id: 2, name: 'Beach Suite', type: 'Suite', capacity: '3 guests', price: 6800, status: 'Occupied', image: null },
    { id: 3, name: 'Garden Villa', type: 'Villa', capacity: '4 guests', price: 8200, status: 'Maintenance', image: null },
    { id: 4, name: 'Family Room', type: 'Family', capacity: '4 guests', price: 5500, status: 'Available', image: null },
    { id: 5, name: 'Presidential Suite', type: 'Suite', capacity: '4 guests', price: 15000, status: 'Available', image: null },
]

const statusStyles = {
    Available: 'bg-emerald-100 text-emerald-600',
    Occupied: 'bg-sky-100 text-sky-600',
    Maintenance: 'bg-amber-100 text-amber-600',
}

function formatPrice(price) {
    return `₱${Number(price).toLocaleString('en-PH')}`
}

function RoomStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

function RoomAction({ label, icon: Icon, onClick, danger = false }) {
    return (
        <button type="button" aria-label={label} title={label} onClick={onClick} className={`transition ${danger ? 'text-rose-400 hover:text-rose-600' : 'text-sky-600 hover:text-sky-800'}`}>
            <Icon className="h-3.5 w-3.5" />
        </button>
    )
}

export default function RoomsPage({ rooms = defaultRooms, onAddRoom, onEditRoom, onViewImage, onDeleteRoom }) {
    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Room Management</h1>
                <button type="button" onClick={onAddRoom} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700">
                    <FaPlus className="h-3 w-3" />
                    Add Room
                </button>
            </header>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Photo</th>
                                <th className="px-4 py-4">Room Name</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4">Capacity</th>
                                <th className="px-4 py-4">Price /<br />Night</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rooms.map((room) => (
                                <tr key={room.id} className="text-sm">
                                    <td className="px-4 py-3">
                                        {room.image ? <img src={room.image} alt={room.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{room.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.type}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.capacity}</td>
                                    <td className="px-4 py-3 font-bold text-sky-700">{formatPrice(room.price)}</td>
                                    <td className="px-4 py-3"><RoomStatus status={room.status} /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-4">
                                            <RoomAction label="Edit room" icon={FaEdit} onClick={() => onEditRoom?.(room)} />
                                            <RoomAction label="View room image" icon={FaImage} onClick={() => onViewImage?.(room)} />
                                            <RoomAction label="Delete room" icon={FaTrash} danger onClick={() => onDeleteRoom?.(room)} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
