import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaPlus } from 'react-icons/fa'
import AdminModal from '../components/AdminModal.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

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

export default function RoomsPage({ rooms: initialRooms, onAddRoom, onEditRoom, onViewImage, onDeleteRoom }) {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState(initialRooms ?? [])
    const [isLoading, setIsLoading] = useState(!initialRooms)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [form, setForm] = useState(null)
    const [isDirty, setIsDirty] = useState(false)
    const [pendingConfirm, setPendingConfirm] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeactivating, setIsDeactivating] = useState(false)
    const saveLock = useRef(false)

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

    const openCreate = () => { setIsDirty(false); setForm({ ...emptyForm, mode: 'create', originalImage: '', existing_image_url: '' }) }
    const openEdit = (room) => { setIsDirty(false); setForm({ ...room.backend, mode: 'edit', originalImage: getImageUrl(room.backend.images), existing_image_url: '' }) }
    const updateForm = (event) => {
        setIsDirty(true)
        setForm((current) => ({
            ...current,
            [event.target.name]: event.target.name === 'images' ? event.target.files?.[0] ?? null : event.target.value,
            ...(event.target.name === 'images' ? { existing_image_url: '' } : {}),
        }))
    }

    const saveRoom = async (event) => {
        event.preventDefault()
        if (saveLock.current) return
        saveLock.current = true
        setIsSaving(true)
        setError('')
        try {
            const { mode, room_id, status, images, existing_image_url, originalImage, ...payload } = form
            if (mode === 'edit') payload.status = status
            const body = new FormData()
            Object.entries(payload).forEach(([name, value]) => body.append(name, value ?? ''))
            if (images instanceof File) body.append('images', images)
            else if (existing_image_url) body.append('existing_image_url', existing_image_url)
            const data = await request(mode === 'create' ? API_URL : `${API_URL}/${room_id}`, {
                method: mode === 'create' ? 'POST' : 'PUT',
                body,
            })
            setNotice(data.message || `Room ${mode === 'create' ? 'created' : 'updated'} successfully.`)
            setIsDirty(false)
            setForm(null)
            await loadRooms()
            const savedRoom = data.room ? mapRoom(data.room) : null
            if (mode === 'create') onAddRoom?.(savedRoom)
            else onEditRoom?.(savedRoom)
        } catch (saveError) {
            setError(saveError.message)
        } finally {
            setIsSaving(false)
            saveLock.current = false
        }
    }

    const deactivateRoom = async (room) => {
        setIsDeactivating(true)
        setError('')
        try {
            const data = await request(`${API_URL}/${room.id}/deactivate`, { method: 'PATCH' })
            setNotice(data.message || 'Room deactivated successfully.')
            await loadRooms()
            onDeleteRoom?.(room)
        } catch (deactivateError) {
            setError(deactivateError.message)
        } finally {
            setIsDeactivating(false)
        }
    }

    const closeForm = () => {
        if (isSaving || isDeactivating) return
        if (isDirty) {
            setPendingConfirm({
                title: 'Discard unsaved changes?',
                message: 'Your room changes have not been saved. Discard them?',
                confirmLabel: 'Discard changes',
                variant: 'warning',
                onConfirm: () => {
                    setPendingConfirm(null)
                    setIsDirty(false)
                    setForm(null)
                },
            })
            return
        }
        setForm(null)
    }

    const confirmDeactivate = () => {
        if (form?.mode !== 'edit') return
        const room = rooms.find((item) => item.id === form.room_id)
        if (!room) return
        setPendingConfirm({
            title: 'Deactivate room?',
            message: `Deactivate room ${form.room_number}?`,
            confirmLabel: 'Deactivate room',
            variant: 'warning',
            onConfirm: () => {
                setPendingConfirm(null)
                deactivateRoom(room).then(() => setForm(null))
            },
        })
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
            {error && !form ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            {form ? <RoomModal form={form} isSaving={isSaving} isDeactivating={isDeactivating} error={error} request={request} onChange={updateForm} onCancel={closeForm} onSubmit={saveRoom} onViewImage={() => onViewImage?.(rooms.find((room) => room.id === form.room_id))} onDeactivate={confirmDeactivate} onImageSelect={(url) => { setIsDirty(true); setForm((current) => ({ ...current, images: url, existing_image_url: url })) }} onImageRemove={() => { setIsDirty(true); setForm((current) => ({ ...current, images: current.originalImage || '', existing_image_url: '' })) }} /> : null}
            <ConfirmDialog open={Boolean(pendingConfirm)} title={pendingConfirm?.title} message={pendingConfirm?.message} confirmLabel={pendingConfirm?.confirmLabel} onConfirm={pendingConfirm?.onConfirm} onCancel={() => setPendingConfirm(null)} loading={isSaving || isDeactivating} variant={pendingConfirm?.variant} />

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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">Loading rooms...</td></tr> : null}
                            {!isLoading && rooms.map((room) => (
                                <tr key={room.id} tabIndex={0} role="button" aria-label={`Edit room ${room.name}`} onClick={() => openEdit(room)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEdit(room) } }} className="cursor-pointer text-sm hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
                                    <td className="px-4 py-3">
                                        {room.image ? <img src={room.image} alt={room.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{room.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.type}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.capacity}</td>
                                    <td className="px-4 py-3 font-bold text-sky-700">{formatPrice(room.price)}</td>
                                    <td className="px-4 py-3 text-slate-500">{room.maxExtraBeds === null ? 'Migration pending' : room.maxExtraBeds}</td>
                                    <td className="px-4 py-3"><RoomStatus status={room.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}

function RoomModal({ form, isSaving, isDeactivating, error, request, onChange, onCancel, onSubmit, onViewImage, onDeactivate, onImageSelect, onImageRemove }) {
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

    return <AdminModal title={form.mode === 'create' ? 'Add room' : 'Edit room'} labelledBy="room-modal-title" onClose={onCancel} footer={<>
        {form.mode === 'edit' ? <div className="flex-1"><button type="button" disabled={isDeactivating || isSaving} onClick={onDeactivate} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Deactivate room</button></div> : null}
        <div className="flex gap-3"><button type="button" disabled={isSaving || isDeactivating} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" form="room-edit-form" disabled={isSaving || isDeactivating} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button></div>
    </>}>
        <form id="room-edit-form" onSubmit={handleSubmit}>
        {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
            {['room_number', 'room_type', 'capacity', 'price_per_night', 'description', 'amenities'].map((name) => <label key={name} className="text-xs font-semibold text-slate-600">
                {name.replaceAll('_', ' ')}
                <input required={['room_number', 'room_type', 'capacity', 'price_per_night'].includes(name)} name={name} value={form[name] ?? ''} onChange={onChange} type={['capacity', 'price_per_night'].includes(name) ? 'number' : 'text'} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" />
            </label>)}
            <label className="text-xs font-semibold text-slate-600">max extra beds
                <input name="max_extra_beds" value={form.max_extra_beds ?? ''} onChange={onChange} type="number" min="0" max="20" disabled={form.max_extra_beds === undefined} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500 disabled:bg-slate-100 disabled:text-slate-400" />
                {form.max_extra_beds === undefined ? <span className="mt-1 block text-xs font-normal text-slate-400">Available after the bed-cap migration.</span> : null}
            </label>
            <label className="text-xs font-semibold text-slate-600">image
                <input key={form.existing_image_url ? 'library' : 'upload'} name="images" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                {imageError ? <span className="mt-1 block text-xs font-normal text-rose-600" role="alert">{imageError}</span> : null}
                {imagePreview ? <button type="button" onClick={onViewImage} className="group mt-2 block cursor-zoom-in"><img src={imagePreview} alt="Room preview" className="h-24 w-36 rounded object-cover group-hover:opacity-80" /><span className="mt-1 block text-left text-xs font-normal text-sky-600">View full image</span></button> : null}
                <ImagePicker request={request} selectedUrl={form.existing_image_url} currentUrl={form.originalImage} hasPendingFile={form.images instanceof File} onSelect={onImageSelect} onRemove={onImageRemove} />
            </label>
            {form.mode === 'edit' ? <label className="text-xs font-semibold text-slate-600">status<select name="status" value={form.status} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="maintenance">Maintenance</option></select></label> : null}
        </div>
        </form>
    </AdminModal>
}
