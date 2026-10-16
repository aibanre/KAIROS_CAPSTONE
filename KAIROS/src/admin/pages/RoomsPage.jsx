import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCopy, FaPlus } from 'react-icons/fa'
import AdminModal from '../components/AdminModal.jsx'
import BulkEditModal from '../components/BulkEditModal.jsx'
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
const emptyForm = { room_number: '', room_type: '', capacity: '', max_extra_beds: undefined, price_per_night: '', description: '', amenities: '', images: '', status: 'available', createMode: 'single', number_mode: 'range', range_prefix: '', range_start: '', range_end: '', range_width: '', number_list: '', copy_inventory_from_room_id: '' }
const roomBulkFields = [
    { name: 'room_type', label: 'Room type', type: 'text' },
    { name: 'capacity', label: 'Capacity', type: 'number', min: '1', step: '1', required: true },
    { name: 'max_extra_beds', label: 'Max extra beds', type: 'number', min: '0', max: '20', step: '1', required: true },
    { name: 'price_per_night', label: 'Price per night', type: 'number', min: '0.01', step: '0.01', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'amenities', label: 'Amenities', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: [
        { value: 'available', label: 'Available' },
        { value: 'unavailable', label: 'Unavailable' },
        { value: 'maintenance', label: 'Maintenance' },
    ] },
    { name: 'existing_image_url', label: 'Image', type: 'image', required: true },
]

function getBulkRoomNumberPreview(form, rooms) {
    let candidateNumbers = []
    let count = 0
    let error = ''

    if (form.number_mode === 'range') {
        const start = Number(form.range_start)
        const end = Number(form.range_end)
        const width = form.range_width === '' ? 0 : Number(form.range_width)
        if (form.range_start === '' || form.range_end === '' || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
            error = 'Enter a valid range with an end number greater than or equal to the start.'
        } else if (form.range_width !== '' && (!Number.isInteger(width) || width < 1 || width > 20)) {
            error = 'Zero-pad width must be from 1 to 20.'
        } else {
            count = end - start + 1
            candidateNumbers = Array.from({ length: Math.min(count, 50) }, (_, index) => `${form.range_prefix || ''}${String(start + index).padStart(width || 0, '0')}`)
        }
    } else {
        candidateNumbers = String(form.number_list || '').split(/[,\n]/).map((number) => number.trim()).filter(Boolean)
        count = candidateNumbers.length
    }

    const numbers = candidateNumbers.slice(0, 50)
    if (!error && count === 0) error = 'Enter at least one room number.'
    if (!error && count > 50) error = 'You can create at most 50 rooms at once.'
    if (!error && candidateNumbers.some((number) => Array.from(number).length > 20)) error = 'Room numbers must be 20 characters or fewer.'

    const seenNumbers = new Set()
    const duplicateNumbers = new Set()
    candidateNumbers.forEach((number) => {
        const normalized = number.toLowerCase()
        if (seenNumbers.has(normalized)) duplicateNumbers.add(normalized)
        seenNumbers.add(normalized)
    })
    if (!error && duplicateNumbers.size) error = 'Remove duplicate room numbers from the list.'

    const existingNumbers = new Set(rooms.map((room) => String(room.backend?.room_number ?? room.name).toLowerCase()))
    const existing = [...new Set(candidateNumbers.filter((number) => existingNumbers.has(number.toLowerCase())))]
    if (!error && existing.length) error = 'Resolve room numbers that already exist before creating rooms.'

    return { numbers, count, error, existing, duplicateNumbers }
}

function RoomStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

export default function RoomsPage({ rooms: initialRooms, onAddRoom, onEditRoom, onViewImage, onDeleteRoom }) {
    const navigate = useNavigate()
    const [rooms, setRooms] = useState(initialRooms ?? [])
    const [maxExtraBedsAvailable, setMaxExtraBedsAvailable] = useState(false)
    const [isLoading, setIsLoading] = useState(!initialRooms)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [form, setForm] = useState(null)
    const [isDirty, setIsDirty] = useState(false)
    const [pendingConfirm, setPendingConfirm] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeactivating, setIsDeactivating] = useState(false)
    const [bulkConflicts, setBulkConflicts] = useState([])
    const [selectedIds, setSelectedIds] = useState([])
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
    const [bulkEditError, setBulkEditError] = useState('')
    const saveLock = useRef(false)
    const selectAllRef = useRef(null)

    const request = async (url, options = {}) => {
        const headers = options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
        const response = await fetch(url, { ...options, credentials: 'include', headers })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) {
            const requestError = new Error(data.error || 'Unable to complete the room request.')
            requestError.conflicts = data.conflicts || []
            throw requestError
        }
        return data
    }

    const loadRooms = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(API_URL)
            setRooms((data.rooms || []).map(mapRoom))
            setMaxExtraBedsAvailable(data.features?.max_extra_beds === true)
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadRooms() }, [])
    const visibleRooms = rooms
    const visibleIds = visibleRooms.map((room) => room.id)
    const selectedRooms = rooms.filter((room) => selectedIds.includes(room.id))
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = selectedIds.some((id) => visibleIds.includes(id)) && !allVisibleSelected
        }
    }, [selectedIds, allVisibleSelected, rooms])

    const toggleRoomSelection = (id) => {
        setSelectedIds((current) => current.includes(id)
            ? current.filter((selectedId) => selectedId !== id)
            : current.length < 100 ? [...current, id] : current)
    }
    const toggleVisibleSelection = () => {
        if (allVisibleSelected) {
            setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)))
            return
        }
        setSelectedIds((current) => {
            const otherIds = current.filter((id) => !visibleIds.includes(id))
            return [...otherIds, ...visibleIds.filter((id) => !current.includes(id)).slice(0, Math.max(0, 100 - otherIds.length))]
        })
    }
    const selectAllOfType = () => {
        const selectedType = selectedRooms[0]?.backend.room_type
        if (!selectedType) return
        setSelectedIds(visibleRooms.filter((room) => room.backend.room_type === selectedType).slice(0, 100).map((room) => room.id))
    }

    const performBulkUpdate = async (ids, fields) => {
        setIsSaving(true)
        setBulkEditError('')
        setError('')
        try {
            const data = await request(`${API_URL}/bulk`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, fields }),
            })
            setPendingConfirm(null)
            setIsBulkEditOpen(false)
            setSelectedIds([])
            setNotice(`Updated ${data.count} rooms.`)
            await loadRooms()
        } catch (saveError) {
            setPendingConfirm(null)
            setBulkEditError(saveError.message)
        } finally {
            setIsSaving(false)
        }
    }

    const requestBulkUpdateConfirmation = (fields) => {
        const fieldSummary = Object.entries(fields).map(([name, value]) => {
            const definition = roomBulkFields.find((field) => field.name === name)
            return `${definition?.label || name}: ${name === 'existing_image_url' ? 'selected image' : value || '(empty)'}`
        }).join('; ')
        setPendingConfirm({
            title: `Update ${selectedIds.length} rooms?`,
            message: `Update ${selectedIds.length} rooms? Changes: ${fieldSummary}`,
            confirmLabel: `Update ${selectedIds.length} rooms`,
            variant: 'warning',
            onConfirm: () => performBulkUpdate([...selectedIds], fields),
        })
    }

    const closeBulkEdit = (hasChanges) => {
        if (!hasChanges) {
            setIsBulkEditOpen(false)
            return
        }
        setPendingConfirm({
            title: 'Discard unsaved changes?',
            message: 'Your bulk room changes have not been saved. Discard them?',
            confirmLabel: 'Discard changes',
            variant: 'warning',
            onConfirm: () => {
                setPendingConfirm(null)
                setIsBulkEditOpen(false)
                setBulkEditError('')
            },
        })
    }

    const openCreate = () => { setIsDirty(false); setBulkConflicts([]); setForm({ ...emptyForm, max_extra_beds: maxExtraBedsAvailable ? 0 : undefined, mode: 'create', originalImage: '', existing_image_url: '' }) }
    const openEdit = (room) => { setIsDirty(false); setForm({ ...room.backend, mode: 'edit', originalImage: getImageUrl(room.backend.images), existing_image_url: '' }) }
    const openDuplicate = (room) => {
        const imageUrl = getImageUrl(room.backend.images) || ''
        setIsDirty(false)
        setBulkConflicts([])
        setForm({
            ...emptyForm,
            ...room.backend,
            room_number: '',
            images: imageUrl,
            mode: 'create',
            createMode: 'single',
            isDuplicate: true,
            duplicateSourceRoomId: room.id,
            originalImage: imageUrl,
            existing_image_url: imageUrl,
        })
    }
    const updateForm = (event) => {
        setIsDirty(true)
        setError('')
        setForm((current) => ({
            ...current,
            [event.target.name]: event.target.name === 'images' ? event.target.files?.[0] ?? null : event.target.value,
            ...(event.target.name === 'images' ? { existing_image_url: '' } : {}),
        }))
    }

    const saveRoom = async (event, bulkInput) => {
        event.preventDefault()
        if (saveLock.current) return
        const isBulk = form.mode === 'create' && form.createMode === 'multiple'
        const bulkPreview = isBulk ? getBulkRoomNumberPreview({ ...form, ...bulkInput }, rooms) : null
        const activeConflicts = isBulk ? bulkConflicts.filter((conflict) => bulkPreview.numbers.some((number) => number.toLowerCase() === conflict.toLowerCase())) : []
        if (isBulk && (bulkPreview.error || activeConflicts.length)) return
        saveLock.current = true
        setIsSaving(true)
        setError('')
        try {
            if (isBulk) {
                const body = new FormData()
                for (const name of ['room_type', 'capacity', 'max_extra_beds', 'price_per_night', 'description', 'amenities', 'status']) {
                    body.append(name, form[name] ?? '')
                }
                body.append('room_numbers', JSON.stringify(bulkPreview.numbers))
                if (form.copy_inventory_from_room_id) body.append('copy_inventory_from_room_id', form.copy_inventory_from_room_id)
                if (form.images instanceof File) body.append('images', form.images)
                else if (form.existing_image_url) body.append('existing_image_url', form.existing_image_url)
                const data = await request(`${API_URL}/bulk`, { method: 'POST', body })
                setNotice(`Created ${data.created.length} rooms.`)
                setIsDirty(false)
                setForm(null)
                setBulkConflicts([])
                await loadRooms()
                data.created.forEach((room) => onAddRoom?.(mapRoom(room)))
                return
            }

            const { mode, room_id, status, images, existing_image_url, originalImage, createMode, isDuplicate, duplicateSourceRoomId, number_mode, range_prefix, range_start, range_end, range_width, number_list, copy_inventory_from_room_id, ...payload } = form
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
            setBulkConflicts(saveError.conflicts || [])
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
            {form ? <RoomModal form={form} rooms={rooms} conflicts={bulkConflicts} isSaving={isSaving} isDeactivating={isDeactivating} error={error} request={request} onChange={updateForm} onCancel={closeForm} onSubmit={saveRoom} onCreateModeChange={(createMode) => { setIsDirty(true); setForm((current) => ({ ...current, createMode })) }} onViewImage={() => onViewImage?.(rooms.find((room) => room.id === (form.room_id || form.duplicateSourceRoomId)))} onDeactivate={confirmDeactivate} onImageSelect={(url) => { setIsDirty(true); setForm((current) => ({ ...current, images: url, existing_image_url: url })) }} onImageRemove={() => { setIsDirty(true); setForm((current) => ({ ...current, images: current.originalImage || '', existing_image_url: '' })) }} /> : null}
            {isBulkEditOpen ? <BulkEditModal
                title={`Edit ${selectedRooms.length} rooms`}
                entityLabel="rooms"
                selectedCount={selectedRooms.length}
                fields={roomBulkFields.map((field) => field.name === 'max_extra_beds' && selectedRooms.some((room) => room.backend.max_extra_beds === undefined)
                    ? { ...field, disabled: true, note: 'Available after the bed-cap migration.' }
                    : field)}
                request={request}
                error={bulkEditError}
                isSaving={isSaving}
                onSave={requestBulkUpdateConfirmation}
                onClose={closeBulkEdit}
            /> : null}
            <ConfirmDialog open={Boolean(pendingConfirm)} title={pendingConfirm?.title} message={pendingConfirm?.message} confirmLabel={pendingConfirm?.confirmLabel} onConfirm={pendingConfirm?.onConfirm} onCancel={() => setPendingConfirm(null)} loading={isSaving || isDeactivating} variant={pendingConfirm?.variant} />

            {selectedIds.length ? <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">{selectedIds.length} selected</span>
                {selectedRooms[0] ? <button type="button" onClick={selectAllOfType} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100">Select all of this type ({selectedRooms[0].backend.room_type})</button> : null}
                {visibleIds.length > 100 && selectedIds.length === 100 ? <span className="text-xs text-amber-700">Bulk edits are limited to 100 rooms per request.</span> : null}
                <div className="ml-auto flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setBulkEditError(''); setIsBulkEditOpen(true) }} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">Edit selected</button>
                    <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Clear selection</button>
                </div>
            </div> : null}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4"><input ref={selectAllRef} type="checkbox" aria-label="Select all visible rooms" checked={allVisibleSelected} onChange={toggleVisibleSelection} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" /></th>
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
                            {isLoading ? <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">Loading rooms...</td></tr> : null}
                            {!isLoading && visibleRooms.map((room) => (
                                <tr key={room.id} tabIndex={0} role="button" aria-label={`Edit room ${room.name}`} onClick={(event) => { if (!event.target.closest('button, input')) openEdit(room) }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEdit(room) } }} className="cursor-pointer text-sm hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
                                    <td className="px-4 py-3"><input type="checkbox" aria-label={`Select room ${room.name}`} checked={selectedIds.includes(room.id)} disabled={!selectedIds.includes(room.id) && selectedIds.length >= 100} onClick={(event) => event.stopPropagation()} onChange={() => toggleRoomSelection(room.id)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50" /></td>
                                    <td className="px-4 py-3">
                                        {room.image ? <img src={room.image} alt={room.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800"><span>{room.name}</span><button type="button" title={`Duplicate room ${room.name}`} aria-label={`Duplicate room ${room.name}`} onClick={(event) => { event.stopPropagation(); openDuplicate(room) }} className="ml-3 inline-flex rounded p-1 text-slate-400 hover:bg-sky-100 hover:text-sky-700"><FaCopy className="h-3 w-3" /></button></td>
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

function RoomModal({ form, rooms, conflicts, isSaving, isDeactivating, error, request, onChange, onCancel, onSubmit, onCreateModeChange, onViewImage, onDeactivate, onImageSelect, onImageRemove }) {
    const [imagePreview, setImagePreview] = useState(() => getImageUrl(form.images))
    const [imageError, setImageError] = useState('')
    const isMultiple = form.mode === 'create' && form.createMode === 'multiple'
    const numberPreview = isMultiple ? getBulkRoomNumberPreview(form, rooms) : null
    const activeConflicts = numberPreview ? conflicts.filter((conflict) => numberPreview.numbers.some((number) => number.toLowerCase() === conflict.toLowerCase())) : []

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
        if (imageError || (isMultiple && (numberPreview.error || activeConflicts.length))) {
            event.preventDefault()
            return
        }
        onSubmit(event, { roomNumbers: numberPreview?.numbers || [] })
    }

    return <AdminModal title={form.mode === 'create' ? (form.isDuplicate ? 'Duplicate room' : 'Add room') : 'Edit room'} labelledBy="room-modal-title" onClose={onCancel} footer={<>
        {form.mode === 'edit' ? <div className="flex-1"><button type="button" disabled={isDeactivating || isSaving} onClick={onDeactivate} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Deactivate room</button></div> : null}
        <div className="flex gap-3"><button type="button" disabled={isSaving || isDeactivating} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" form="room-edit-form" disabled={isSaving || isDeactivating || (isMultiple && (numberPreview.error || activeConflicts.length > 0))} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Saving...' : isMultiple ? 'Create rooms' : 'Save'}</button></div>
    </>}>
        <form id="room-edit-form" onSubmit={handleSubmit}>
        {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
        {isMultiple && activeConflicts.length ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">These room numbers now exist: {activeConflicts.join(', ')}. Resolve them before submitting.</p> : null}
        {form.mode === 'create' ? <div className="mb-5 flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Room creation mode">
            {['single', 'multiple'].map((mode) => <button key={mode} type="button" onClick={() => onCreateModeChange(mode)} className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${form.createMode === mode ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>{mode}</button>)}
        </div> : null}
        {isMultiple ? <section className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Room numbers</h3>
                <div className="flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Room number input mode">
                    {['range', 'list'].map((mode) => <button key={mode} type="button" onClick={() => onChange({ target: { name: 'number_mode', value: mode } })} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${form.number_mode === mode ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:text-slate-800'}`}>{mode}</button>)}
                </div>
            </div>
            {form.number_mode === 'range' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[['range_prefix', 'Prefix', 'text'], ['range_start', 'Start', 'number'], ['range_end', 'End', 'number'], ['range_width', 'Zero-pad width (optional)', 'number']].map(([name, label, type]) => <label key={name} className="text-xs font-semibold text-slate-600">{label}<input name={name} type={type} min={type === 'number' ? (name === 'range_width' ? '1' : '0') : undefined} max={name === 'range_width' ? '20' : undefined} value={form[name] ?? ''} onChange={onChange} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>)}
            </div> : <label className="block text-xs font-semibold text-slate-600">Room numbers (comma or newline separated)<textarea name="number_list" rows="3" value={form.number_list ?? ''} onChange={onChange} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>}
            <div className="mt-4">
                <p className="text-xs font-semibold text-slate-700">Preview <span className="font-normal text-slate-500">({numberPreview.count} {numberPreview.count === 1 ? 'room' : 'rooms'})</span></p>
                {numberPreview.numbers.length ? <div className="mt-2 flex flex-wrap gap-2">{numberPreview.numbers.map((number, index) => {
                    const existing = numberPreview.existing.some((item) => item.toLowerCase() === number.toLowerCase())
                    const duplicate = numberPreview.duplicateNumbers.has(number.toLowerCase())
                    return <span key={`${number}-${index}`} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${existing ? 'border-rose-300 bg-rose-100 text-rose-700' : duplicate ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}>{number}</span>
                })}</div> : null}
                {numberPreview.error ? <p className="mt-2 text-xs text-rose-600" role="alert">{numberPreview.error}</p> : null}
            </div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Copy inventory from (optional)<select name="copy_inventory_from_room_id" value={form.copy_inventory_from_room_id ?? ''} onChange={onChange} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800"><option value="">Do not copy inventory</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
        </section> : null}
        <div className="grid gap-4 md:grid-cols-2">
            {['room_number', 'room_type', 'capacity', 'price_per_night', 'description', 'amenities'].filter((name) => !(isMultiple && name === 'room_number')).map((name) => <label key={name} className="text-xs font-semibold text-slate-600">
                {name.replaceAll('_', ' ')}
                <input autoFocus={form.isDuplicate && name === 'room_number'} required={['room_number', 'room_type', 'capacity', 'price_per_night'].includes(name)} name={name} value={form[name] ?? ''} onChange={onChange} type={['capacity', 'price_per_night'].includes(name) ? 'number' : 'text'} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" />
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
            {form.mode === 'edit' || isMultiple ? <label className="text-xs font-semibold text-slate-600">status<select name="status" value={form.status || 'available'} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="maintenance">Maintenance</option></select></label> : null}
        </div>
        </form>
    </AdminModal>
}
