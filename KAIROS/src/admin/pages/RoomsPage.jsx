import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaEdit, FaImage, FaPlus, FaTrash } from 'react-icons/fa'

const statusStyles = {
    Available: 'bg-emerald-100 text-emerald-600',
    Occupied: 'bg-sky-100 text-sky-600',
    Maintenance: 'bg-amber-100 text-amber-600',
}

function formatPrice(price) {
    return price === null || price === undefined ? 'N/A' : `₱${Number(price).toLocaleString('en-PH')}`
}

function mapRoom(room) {
    return {
        id: room.room_id,
        name: room.room_number,
        type: room.room_type,
        capacity: `${room.capacity} guests`,
        price: Number(room.price_per_night),
        status: room.status ? room.status[0].toUpperCase() + room.status.slice(1) : 'Unavailable',
        image: getImageUrl(room.images),
        maxExtraBeds: room.max_extra_beds === undefined ? null : Number(room.max_extra_beds),
        backend: room,
    }
}

function getImageUrl(images) {
    if (!images) return null
    if (Array.isArray(images)) return images[0] || null
    try {
        const parsed = JSON.parse(images)
        return Array.isArray(parsed) ? parsed[0] || null : parsed
    } catch {
        return images
    }
}

const API_URL = `${API_BASE_URL}/api/admin/rooms`
const emptyForm = { room_number: '', room_type: '', capacity: '', max_extra_beds: undefined, price_per_night: '', description: '', amenities: '', images: '' }

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

export default function RoomsPage({ rooms: initialRooms, onAddRoom, onEditRoom, onViewImage, onDeleteRoom }) {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState(initialRooms ?? [])
    const [isLoading, setIsLoading] = useState(!initialRooms)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [form, setForm] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    const request = async (url, options = {}) => {
        const headers = options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
        const response = await fetch(url, { ...options, credentials: 'include', headers })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete the room request.')
        return data
    }

    const loadRooms = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(API_URL)
            setRooms((data.rooms || []).map(mapRoom))
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadRooms() }, [])

    const openCreate = () => setForm({ ...emptyForm, mode: 'create' })
    const openEdit = (room) => setForm({ ...room.backend, mode: 'edit' })
    const updateForm = (event) => setForm((current) => ({
        ...current,
        [event.target.name]: event.target.name === 'images' ? event.target.files?.[0] ?? null : event.target.value,
    }))

    const saveRoom = async (event) => {
        event.preventDefault()
        setIsSaving(true)
        setError('')
        try {
            const { mode, room_id, status, images, ...payload } = form
            if (mode === 'edit') payload.status = status
            const body = new FormData()
            Object.entries(payload).forEach(([name, value]) => body.append(name, value ?? ''))
            if (images instanceof File) body.append('images', images)
            const data = await request(mode === 'create' ? API_URL : `${API_URL}/${room_id}`, {
                method: mode === 'create' ? 'POST' : 'PUT',
                body,
            })
            setNotice(data.message || `Room ${mode === 'create' ? 'created' : 'updated'} successfully.`)
            setForm(null)
            await loadRooms()
            const savedRoom = data.room ? mapRoom(data.room) : null
            if (mode === 'create') onAddRoom?.(savedRoom)
            else onEditRoom?.(savedRoom)
        } catch (saveError) {
            setError(saveError.message)
        } finally {
            setIsSaving(false)
        }
    }

    const deactivateRoom = async (room) => {
        setError('')
        try {
            const data = await request(`${API_URL}/${room.id}/deactivate`, { method: 'PATCH' })
            setNotice(data.message || 'Room deactivated successfully.')
            await loadRooms()
            onDeleteRoom?.(room)
        } catch (deactivateError) {
            setError(deactivateError.message)
        }
    }

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Room Management</h1>
                <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700">
                    <FaPlus className="h-3 w-3" />
                    Add Room
                </button>
            </header>

            {notice ? <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p> : null}
            {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            {form ? <RoomForm form={form} isSaving={isSaving} onChange={updateForm} onCancel={() => setForm(null)} onSubmit={saveRoom} /> : null}

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
                                <th className="px-4 py-4">Max beds</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">Loading rooms...</td></tr> : null}
                            {!isLoading && rooms.map((room) => (
                                <tr key={room.id} className="text-sm">
                                    <td className="px-4 py-3">
                                        {room.image ? <img src={room.image} alt={room.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{room.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.type}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.capacity}</td>
                                    <td className="px-4 py-3 font-bold text-sky-700">{formatPrice(room.price)}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.maxExtraBeds === null ? 'Migration pending' : room.maxExtraBeds}</td>
                                    <td className="px-4 py-3"><RoomStatus status={room.status} /></td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-4">
                                            <RoomAction label="Edit room" icon={FaEdit} onClick={() => openEdit(room)} />
                                            <RoomAction label="View room image" icon={FaImage} onClick={() => onViewImage?.(room)} />
                                            <RoomAction label="Delete room" icon={FaTrash} danger onClick={() => deactivateRoom(room)} />
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

function RoomForm({ form, isSaving, onChange, onCancel, onSubmit }) {
    const [imagePreview, setImagePreview] = useState(() => getImageUrl(form.images))
    const [imageError, setImageError] = useState('')

    useEffect(() => {
        if (!(form.images instanceof File)) {
            setImagePreview(getImageUrl(form.images))
            return undefined
        }

        const previewUrl = URL.createObjectURL(form.images)
        setImagePreview(previewUrl)
        return () => URL.revokeObjectURL(previewUrl)
    }, [form.images])

    const handleImageChange = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setImageError('Please select a JPEG, PNG, or WebP image.')
            event.target.value = ''
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError('Image must be 5 MB or smaller.')
            event.target.value = ''
            return
        }
        setImageError('')
        onChange(event)
    }

    const handleSubmit = (event) => {
        if (imageError) {
            event.preventDefault()
            return
        }
        onSubmit(event)
    }

    return <form onSubmit={handleSubmit} className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">{form.mode === 'create' ? 'Add room' : 'Edit room'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
            {['room_number', 'room_type', 'capacity', 'price_per_night', 'description', 'amenities'].map((name) => <label key={name} className="text-xs font-semibold text-slate-600">
                {name.replaceAll('_', ' ')}
                <input required={['room_number', 'room_type', 'capacity', 'price_per_night'].includes(name)} name={name} value={form[name] ?? ''} onChange={onChange} type={['capacity', 'price_per_night'].includes(name) ? 'number' : 'text'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" />
            </label>)}
            <label className="text-xs font-semibold text-slate-600">max extra beds
                <input name="max_extra_beds" value={form.max_extra_beds ?? ''} onChange={onChange} type="number" min="0" max="20" disabled={form.max_extra_beds === undefined} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500 disabled:bg-slate-100 disabled:text-slate-400" />
                {form.max_extra_beds === undefined ? <span className="mt-1 block text-xs font-normal text-slate-400">Available after the bed-cap migration.</span> : null}
            </label>
            <label className="text-xs font-semibold text-slate-600">image
                <input name="images" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                {imageError ? <span className="mt-1 block text-xs font-normal text-rose-600" role="alert">{imageError}</span> : null}
                {imagePreview ? <img src={imagePreview} alt="Room preview" className="mt-2 h-24 w-36 rounded object-cover" /> : null}
            </label>
            {form.mode === 'edit' ? <label className="text-xs font-semibold text-slate-600">status<select name="status" value={form.status} onChange={onChange} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="maintenance">Maintenance</option></select></label> : null}
        </div>
        <div className="mt-4 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel</button><button disabled={isSaving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{isSaving ? 'Saving...' : 'Save room'}</button></div>
    </form>
}
