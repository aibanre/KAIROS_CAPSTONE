import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaCopy, FaPlus } from 'react-icons/fa'
import { PackageManager, PackageManagerBoundary } from '../components/PackageManager.jsx'
import AdminModal from '../components/AdminModal.jsx'
import BulkEditModal from '../components/BulkEditModal.jsx'
import ImagePicker from '../components/ImagePicker.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { useAdminToast } from '../context/AdminNotificationsContext.jsx'
import { notifyAdminActionError } from '../utils/adminToastMessages.js'

const statusStyles = {
    Available: 'bg-emerald-100 text-emerald-600',
    Occupied: 'bg-sky-100 text-sky-600',
    Maintenance: 'bg-amber-100 text-amber-600',
}

function formatPrice(price) {
    return price === null || price === undefined ? 'N/A' : `₱${Number(price).toLocaleString('en-PH')}`
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

function mapVenue(venue) {
    return {
        id: venue.venue_id,
        name: venue.venue_name,
        type: venue.venue_type,
        capacity: `${venue.capacity} guests`,
        price: venue.flat_price,
        status: venue.status ? venue.status[0].toUpperCase() + venue.status.slice(1) : 'Unavailable',
        image: getImageUrl(venue.images),
        backend: venue,
    }
}

const API_URL = `${API_BASE_URL}/api/admin/venues`
const emptyForm = { venue_name: '', venue_type: '', capacity: '', description: '', amenities: '', images: '', booking_mode: 'day_use', start_time: '08:00', end_time: '17:00', earliest_start: '08:00', latest_end: '22:00', slot_step_minutes: 30, buffer_minutes: 0, flat_price: '', createMode: 'single', name_mode: 'range', range_prefix: '', range_start: '', range_end: '', range_width: '', name_list: '' }
const venueBulkFields = [
    { name: 'venue_type', label: 'Venue type', type: 'text' },
    { name: 'capacity', label: 'Capacity', type: 'number', min: '1', step: '1', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'amenities', label: 'Amenities', type: 'textarea' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: [
        { value: 'available', label: 'Available' },
        { value: 'unavailable', label: 'Unavailable' },
        { value: 'maintenance', label: 'Maintenance' },
    ] },
    { name: 'existing_image_url', label: 'Image', type: 'image', required: true },
    { name: 'flat_price', label: 'Flat price', type: 'number', min: '0.01', step: '0.01', required: true, rule: true, modes: ['day_use'] },
    { name: 'start_time', label: 'Start time', type: 'time', required: true, rule: true, modes: ['day_use'] },
    { name: 'end_time', label: 'End time', type: 'time', required: true, rule: true, modes: ['day_use'] },
    { name: 'earliest_start', label: 'Earliest start', type: 'time', required: true, rule: true, modes: ['packaged'] },
    { name: 'latest_end', label: 'Latest end', type: 'time', required: true, rule: true, modes: ['packaged'] },
    { name: 'slot_step_minutes', label: 'Slot step (minutes)', type: 'number', min: '1', step: '1', required: true, rule: true, modes: ['day_use', 'packaged'] },
    { name: 'buffer_minutes', label: 'Buffer (minutes)', type: 'number', min: '0', step: '1', required: true, rule: true, modes: ['day_use', 'packaged'] },
]

function getBulkVenueNamePreview(form, venues) {
    let candidates = []
    let count = 0
    let error = ''

    if (form.name_mode === 'range') {
        const start = Number(form.range_start)
        const end = Number(form.range_end)
        const width = form.range_width === '' ? 0 : Number(form.range_width)
        if (form.range_start === '' || form.range_end === '' || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
            error = 'Enter a valid range with an end number greater than or equal to the start.'
        } else if (form.range_width !== '' && (!Number.isInteger(width) || width < 1 || width > 100)) {
            error = 'Zero-pad width must be from 1 to 100.'
        } else {
            count = end - start + 1
            candidates = Array.from({ length: Math.min(count, 50) }, (_, index) => `${form.range_prefix || ''}${String(start + index).padStart(width || 0, '0')}`)
        }
    } else {
        candidates = String(form.name_list || '').split(/[,\n]/).map((name) => name.trim()).filter(Boolean)
        count = candidates.length
    }

    const names = candidates.slice(0, 50)
    if (!error && count === 0) error = 'Enter at least one venue name.'
    if (!error && count > 50) error = 'You can create at most 50 venues at once.'
    if (!error && candidates.some((name) => Array.from(name).length > 100)) error = 'Venue names must be 100 characters or fewer.'

    const seenNames = new Set()
    const duplicateNames = new Set()
    candidates.forEach((name) => {
        const normalized = name.toLowerCase()
        if (seenNames.has(normalized)) duplicateNames.add(normalized)
        seenNames.add(normalized)
    })
    if (!error && duplicateNames.size) error = 'Remove duplicate venue names from the list.'

    const existingNames = new Set(venues.map((venue) => String(venue.backend?.venue_name ?? venue.name).toLowerCase()))
    const existing = [...new Set(candidates.filter((name) => existingNames.has(name.toLowerCase())))]
    if (!error && existing.length) error = 'Resolve venue names that already exist before creating venues.'

    return { names, count, error, existing, duplicateNames }
}

function VenueStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

export default function VenuesPage({ venues: initialVenues, onAddVenue, onEditVenue, onViewImage, onDeleteVenue }) {
    const navigate = useNavigate()
    const toast = useAdminToast()
    const [venues, setVenues] = useState(initialVenues ?? [])
    const [isLoading, setIsLoading] = useState(!initialVenues)
    const [error, setError] = useState('')
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
            const requestError = new Error(data.error || 'Unable to complete the venue request.')
            requestError.conflicts = data.conflicts || []
            throw requestError
        }
        return data
    }

    const loadVenues = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(API_URL)
            setVenues((data.venues || []).map(mapVenue))
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadVenues() }, [])
    const visibleVenues = venues
    const visibleIds = visibleVenues.map((venue) => venue.id)
    const selectedVenues = venues.filter((venue) => selectedIds.includes(venue.id))
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    const bookingModes = new Set(selectedVenues.map((venue) => venue.backend.booking_mode))
    const hasMixedBookingModes = bookingModes.size > 1
    const bulkFields = venueBulkFields.filter((field) => !field.modes || hasMixedBookingModes || field.modes.includes(selectedVenues[0]?.backend.booking_mode))
        .map((field) => field.rule && hasMixedBookingModes
            ? { ...field, disabled: true, note: 'Select venues with the same booking type to edit booking rules.' }
            : field)

    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = selectedIds.some((id) => visibleIds.includes(id)) && !allVisibleSelected
        }
    }, [selectedIds, allVisibleSelected, venues])

    const toggleVenueSelection = (id) => {
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
        const selectedType = selectedVenues[0]?.backend.venue_type
        if (!selectedType) return
        setSelectedIds(visibleVenues.filter((venue) => venue.backend.venue_type === selectedType).slice(0, 100).map((venue) => venue.id))
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
            await loadVenues()
            toast.success(`Updated ${data.count} venues.`)
        } catch (saveError) {
            setPendingConfirm(null)
            setBulkEditError(saveError.message)
            notifyAdminActionError(toast, saveError, 'Unable to update the selected venues.')
        } finally {
            setIsSaving(false)
        }
    }

    const requestBulkUpdateConfirmation = (fields) => {
        const fieldSummary = Object.entries(fields).map(([name, value]) => {
            const definition = venueBulkFields.find((field) => field.name === name)
            return `${definition?.label || name}: ${name === 'existing_image_url' ? 'selected image' : value || '(empty)'}`
        }).join('; ')
        setPendingConfirm({
            title: `Update ${selectedIds.length} venues?`,
            message: `Update ${selectedIds.length} venues? Changes: ${fieldSummary}`,
            confirmLabel: `Update ${selectedIds.length} venues`,
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
            message: 'Your bulk venue changes have not been saved. Discard them?',
            confirmLabel: 'Discard changes',
            variant: 'warning',
            onConfirm: () => {
                setPendingConfirm(null)
                setIsBulkEditOpen(false)
                setBulkEditError('')
            },
        })
    }

    const openCreate = () => { setIsDirty(false); setBulkConflicts([]); setForm({ ...emptyForm, mode: 'create', originalImage: '', existing_image_url: '' }) }
    const openEdit = (venue) => { setIsDirty(false); setForm({ ...venue.backend, mode: 'edit', originalImage: getImageUrl(venue.backend.images), existing_image_url: '' }) }
    const openDuplicate = (venue) => {
        const imageUrl = getImageUrl(venue.backend.images) || ''
        setIsDirty(false)
        setBulkConflicts([])
        setForm({
            ...emptyForm,
            ...venue.backend,
            venue_id: undefined,
            images: imageUrl,
            mode: 'create',
            isDuplicate: true,
            duplicateFromPackaged: venue.backend.booking_mode === 'packaged',
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

    const saveVenue = async (event, bulkInput) => {
        event.preventDefault()
        if (saveLock.current) return
        const isBulk = form.mode === 'create' && form.createMode === 'multiple'
        const bulkPreview = isBulk ? getBulkVenueNamePreview({ ...form, ...bulkInput }, venues) : null
        const activeConflicts = isBulk ? bulkConflicts.filter((conflict) => bulkPreview.names.some((name) => name.toLowerCase() === conflict.toLowerCase())) : []
        if (isBulk && (bulkPreview.error || activeConflicts.length)) return
        saveLock.current = true
        setIsSaving(true)
        setError('')
        try {
            if (isBulk) {
                const body = new FormData()
                for (const name of ['venue_type', 'capacity', 'description', 'amenities', 'booking_mode', 'start_time', 'end_time', 'earliest_start', 'latest_end', 'slot_step_minutes', 'buffer_minutes', 'flat_price']) {
                    body.append(name, form[name] ?? '')
                }
                body.append('venue_names', JSON.stringify(bulkPreview.names))
                if (form.images instanceof File) body.append('images', form.images)
                else if (form.existing_image_url) body.append('existing_image_url', form.existing_image_url)
                const data = await request(`${API_URL}/bulk`, { method: 'POST', body })
                setIsDirty(false)
                setForm(null)
                setBulkConflicts([])
                await loadVenues()
                toast.success(`Created ${data.created.length} venues.`)
                data.created.forEach((venue) => onAddVenue?.(mapVenue(venue)))
                return
            }

            const { mode, venue_id, status, images, existing_image_url, originalImage, isDuplicate, duplicateFromPackaged, createMode, name_mode, range_prefix, range_start, range_end, range_width, name_list, ...payload } = form
            if (mode === 'edit') payload.status = status
            const body = new FormData()
            Object.entries(payload).forEach(([name, value]) => body.append(name, value ?? ''))
            if (images instanceof File) body.append('images', images)
            else if (existing_image_url) body.append('existing_image_url', existing_image_url)
            const data = await request(mode === 'create' ? API_URL : `${API_URL}/${venue_id}`, {
                method: mode === 'create' ? 'POST' : 'PUT',
                body,
            })
            setIsDirty(false)
            setForm(null)
            await loadVenues()
            toast.success(data.message || `Venue ${mode === 'create' ? 'created' : 'updated'} successfully.`)
            const savedVenue = data.venue ? mapVenue(data.venue) : null
            if (mode === 'create') onAddVenue?.(savedVenue)
            else onEditVenue?.(savedVenue)
        } catch (saveError) {
            setError(saveError.message)
            setBulkConflicts(saveError.conflicts || [])
            notifyAdminActionError(toast, saveError, 'Unable to save the venue.')
        } finally {
            setIsSaving(false)
            saveLock.current = false
        }
    }

    const deactivateVenue = async (venue) => {
        setIsDeactivating(true)
        setError('')
        try {
            const data = await request(`${API_URL}/${venue.id}/deactivate`, { method: 'PATCH' })
            await loadVenues()
            toast.success(data.message || 'Venue deactivated successfully.')
            onDeleteVenue?.(venue)
            return true
        } catch (deactivateError) {
            setError(deactivateError.message)
            notifyAdminActionError(toast, deactivateError, 'Unable to deactivate the venue.')
            return false
        } finally {
            setIsDeactivating(false)
        }
    }

    const closeForm = () => {
        if (isSaving || isDeactivating) return
        if (isDirty) {
            setPendingConfirm({
                title: 'Discard unsaved changes?',
                message: 'Your venue changes have not been saved. Discard them?',
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
        const venue = venues.find((item) => item.id === form.venue_id)
        if (!venue) return
        setPendingConfirm({
            title: 'Deactivate venue?',
            message: `Deactivate venue ${form.venue_name}?`,
            confirmLabel: 'Deactivate venue',
            variant: 'warning',
            onConfirm: () => {
                setPendingConfirm(null)
                deactivateVenue(venue).then((deactivated) => { if (deactivated) setForm(null) })
            },
        })
    }

    return (
        <div className="mx-auto max-w-7xl">
            <header className="mb-5 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Venue Management</h1>
                <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700">
                    <FaPlus className="h-3 w-3" />
                    Add Venue
                </button>
            </header>

            {error && !form ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            {form ? <VenueModal form={form} venues={venues} conflicts={bulkConflicts} savedVenue={form.mode === 'edit' ? venues.find((venue) => venue.id === form.venue_id)?.backend : null} isSaving={isSaving} isDeactivating={isDeactivating} error={error} request={request} onChange={updateForm} onCancel={closeForm} onSubmit={saveVenue} onCreateModeChange={(createMode) => { setIsDirty(true); setForm((current) => ({ ...current, createMode })) }} onViewImage={() => onViewImage?.(venues.find((venue) => venue.id === form.venue_id))} onDeactivate={confirmDeactivate} onImageSelect={(url) => { setIsDirty(true); setForm((current) => ({ ...current, images: url, existing_image_url: url })) }} onImageRemove={() => { setIsDirty(true); setForm((current) => ({ ...current, images: current.originalImage || '', existing_image_url: '' })) }} /> : null}
            {isBulkEditOpen ? <BulkEditModal
                title={`Edit ${selectedVenues.length} venues`}
                entityLabel="venues"
                selectedCount={selectedVenues.length}
                fields={bulkFields}
                request={request}
                error={bulkEditError}
                isSaving={isSaving}
                onSave={requestBulkUpdateConfirmation}
                onClose={closeBulkEdit}
            /> : null}
            <ConfirmDialog open={Boolean(pendingConfirm)} title={pendingConfirm?.title} message={pendingConfirm?.message} confirmLabel={pendingConfirm?.confirmLabel} onConfirm={pendingConfirm?.onConfirm} onCancel={() => setPendingConfirm(null)} loading={isSaving || isDeactivating} variant={pendingConfirm?.variant} />

            {selectedIds.length ? <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-800">{selectedIds.length} selected</span>
                {selectedVenues[0] ? <button type="button" onClick={selectAllOfType} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100">Select all of this type ({selectedVenues[0].backend.venue_type})</button> : null}
                {hasMixedBookingModes ? <span className="text-xs text-amber-700">Select venues with the same booking type to edit booking rules.</span> : null}
                {visibleIds.length > 100 && selectedIds.length === 100 ? <span className="text-xs text-amber-700">Bulk edits are limited to 100 venues per request.</span> : null}
                <div className="ml-auto flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setBulkEditError(''); setIsBulkEditOpen(true) }} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">Edit selected</button>
                    <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Clear selection</button>
                </div>
            </div> : null}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4"><input ref={selectAllRef} type="checkbox" aria-label="Select all visible venues" checked={allVisibleSelected} onChange={toggleVisibleSelection} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" /></th>
                                <th className="px-4 py-4">Photo</th>
                                <th className="px-4 py-4">Venue Name</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4">Capacity</th>
                                <th className="px-4 py-4">Price / Day</th>
                                <th className="px-4 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">Loading venues...</td></tr> : null}
                            {!isLoading && visibleVenues.map((venue) => (
                                <tr key={venue.id} tabIndex={0} role="button" aria-label={`Edit venue ${venue.name}`} onClick={(event) => { if (!event.target.closest('button, input')) openEdit(venue) }} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEdit(venue) } }} className="cursor-pointer text-sm hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
                                    <td className="px-4 py-3"><input type="checkbox" aria-label={`Select venue ${venue.name}`} checked={selectedIds.includes(venue.id)} disabled={!selectedIds.includes(venue.id) && selectedIds.length >= 100} onClick={(event) => event.stopPropagation()} onChange={() => toggleVenueSelection(venue.id)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50" /></td>
                                    <td className="px-4 py-3">
                                        {venue.image ? <img src={venue.image} alt={venue.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800"><span>{venue.name}</span><button type="button" title={`Duplicate venue ${venue.name}`} aria-label={`Duplicate venue ${venue.name}`} onClick={(event) => { event.stopPropagation(); openDuplicate(venue) }} className="ml-3 inline-flex rounded p-1 text-slate-400 hover:bg-sky-100 hover:text-sky-700"><FaCopy className="h-3 w-3" /></button></td>
                                    <td className="px-4 py-3 text-slate-500">{venue.type}</td>
                                    <td className="px-4 py-3 text-slate-500">{venue.capacity}</td>
                                    <td className="px-4 py-3 font-bold text-sky-700">{formatPrice(venue.price)}</td>
                                    <td className="px-4 py-3"><VenueStatus status={venue.status} /></td>
                                </tr>
                            ))}
                            {!isLoading && visibleVenues.length === 0 ? <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">No venues found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}

function VenueModal({ form, venues, conflicts, savedVenue, isSaving, isDeactivating, error, request, onChange, onCancel, onSubmit, onCreateModeChange, onViewImage, onDeactivate, onImageSelect, onImageRemove }) {
    const [imagePreview, setImagePreview] = useState(() => getImageUrl(form.images))
    const [imageError, setImageError] = useState('')
    const isMultiple = form.mode === 'create' && form.createMode === 'multiple'
    const namePreview = isMultiple ? getBulkVenueNamePreview(form, venues) : null
    const activeConflicts = namePreview ? conflicts.filter((conflict) => namePreview.names.some((name) => name.toLowerCase() === conflict.toLowerCase())) : []

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
        if (imageError || (isMultiple && (namePreview.error || activeConflicts.length))) {
            event.preventDefault()
            return
        }
        onSubmit(event, { venueNames: namePreview?.names || [] })
    }

    return <AdminModal title={form.mode === 'create' ? (form.isDuplicate ? 'Duplicate venue' : 'Add venue') : 'Edit venue'} labelledBy="venue-modal-title" onClose={onCancel} footer={<>
        {form.mode === 'edit' ? <div className="flex-1"><button type="button" disabled={isDeactivating || isSaving} onClick={onDeactivate} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Deactivate venue</button></div> : null}
        <div className="flex gap-3"><button type="button" disabled={isSaving || isDeactivating} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" form="venue-edit-form" disabled={isSaving || isDeactivating || (isMultiple && (namePreview.error || activeConflicts.length > 0))} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Saving...' : isMultiple ? 'Create venues' : 'Save'}</button></div>
    </>}>
        <form id="venue-edit-form" onSubmit={handleSubmit}>
        {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
        {isMultiple && activeConflicts.length ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">These venue names now exist: {activeConflicts.join(', ')}. Resolve them before submitting.</p> : null}
        {form.mode === 'create' ? <div className="mb-5 flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Venue creation mode">
            {['single', 'multiple'].map((mode) => <button key={mode} type="button" onClick={() => onCreateModeChange(mode)} className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${form.createMode === mode ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>{mode}</button>)}
        </div> : null}
        {isMultiple ? <section className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">Venue names</h3>
                <div className="flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Venue name input mode">
                    {['range', 'list'].map((mode) => <button key={mode} type="button" onClick={() => onChange({ target: { name: 'name_mode', value: mode } })} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${form.name_mode === mode ? 'bg-sky-100 text-sky-700' : 'text-slate-600 hover:text-slate-800'}`}>{mode}</button>)}
                </div>
            </div>
            {form.name_mode === 'range' ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[['range_prefix', 'Name prefix', 'text'], ['range_start', 'Start', 'number'], ['range_end', 'End', 'number'], ['range_width', 'Zero-pad width (optional)', 'number']].map(([name, label, type]) => <label key={name} className="text-xs font-semibold text-slate-600">{label}<input name={name} type={type} min={type === 'number' ? (name === 'range_width' ? '1' : '0') : undefined} max={name === 'range_width' ? '100' : undefined} value={form[name] ?? ''} onChange={onChange} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>)}
            </div> : <label className="block text-xs font-semibold text-slate-600">Venue names (comma or newline separated)<textarea name="name_list" rows="3" value={form.name_list ?? ''} onChange={onChange} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>}
            <div className="mt-4">
                <p className="text-xs font-semibold text-slate-700">Preview <span className="font-normal text-slate-500">({namePreview.count} {namePreview.count === 1 ? 'venue' : 'venues'})</span></p>
                {namePreview.names.length ? <div className="mt-2 flex flex-wrap gap-2">{namePreview.names.map((name, index) => {
                    const exists = namePreview.existing.some((item) => item.toLowerCase() === name.toLowerCase())
                    const duplicate = namePreview.duplicateNames.has(name.toLowerCase())
                    return <span key={`${name}-${index}`} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${exists ? 'border-rose-300 bg-rose-100 text-rose-700' : duplicate ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}>{name}</span>
                })}</div> : null}
                {namePreview.error ? <p className="mt-2 text-xs text-rose-600" role="alert">{namePreview.error}</p> : null}
            </div>
        </section> : null}
        <div className="grid gap-4 md:grid-cols-2">
            {['venue_name', 'venue_type', 'capacity', 'description', 'amenities'].filter((name) => !(isMultiple && name === 'venue_name')).map((name) => <label key={name} className="text-xs font-semibold text-slate-600">
                {name.replaceAll('_', ' ')}
                <input required={['venue_name', 'venue_type', 'capacity'].includes(name)} name={name} value={form[name] ?? ''} onChange={onChange} type={name === 'capacity' ? 'number' : 'text'} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" />
            </label>)}
            <label className="text-xs font-semibold text-slate-600">booking mode<select name="booking_mode" value={form.booking_mode ?? 'day_use'} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="day_use">Day use</option><option value="packaged">Packaged</option></select></label>
            <label className="text-xs font-semibold text-slate-600">flat price (₱)<input name="flat_price" type="number" min="0.01" step="0.01" value={form.flat_price ?? ''} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
            {['start_time', 'end_time', 'earliest_start', 'latest_end'].map((name) => <label key={name} className="text-xs font-semibold text-slate-600">{name.replaceAll('_', ' ')}<input name={name} type="time" value={String(form[name] ?? '').slice(0, 5)} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>)}
            {['slot_step_minutes', 'buffer_minutes'].map((name) => <label key={name} className="text-xs font-semibold text-slate-600">{name.replaceAll('_', ' ')}<input name={name} type="number" min="0" value={form[name] ?? 0} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>)}
            <label className="text-xs font-semibold text-slate-600">image
                <input key={form.existing_image_url ? 'library' : 'upload'} name="images" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
                {imageError ? <span className="mt-1 block text-xs font-normal text-rose-600" role="alert">{imageError}</span> : null}
                {imagePreview ? <button type="button" onClick={onViewImage} className="group mt-2 block cursor-zoom-in"><img src={imagePreview} alt="Venue preview" className="h-24 w-36 rounded object-cover group-hover:opacity-80" /><span className="mt-1 block text-left text-xs font-normal text-sky-600">View full image</span></button> : null}
                <ImagePicker request={request} selectedUrl={form.existing_image_url} currentUrl={form.originalImage} hasPendingFile={form.images instanceof File} onSelect={onImageSelect} onRemove={onImageRemove} />
            </label>
            {form.mode === 'edit' ? <label className="text-xs font-semibold text-slate-600">status<select name="status" value={form.status} onChange={onChange} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="maintenance">Maintenance</option></select></label> : null}
        </div>
        </form>
        {form.duplicateFromPackaged || (isMultiple && form.booking_mode === 'packaged') ? <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700">Packages are not copied. Add packages after saving {isMultiple ? 'these venues' : 'this venue'}.</p> : null}
        {savedVenue?.booking_mode === 'packaged' ? <section className="mt-6 border-t border-violet-200 pt-5"><h3 className="text-lg font-semibold text-slate-800">Packages</h3><p className="mb-4 mt-1 text-sm text-slate-500">Package changes are saved immediately.</p><PackageManagerBoundary><PackageManager venue={savedVenue} request={request} onClose={() => {}} /></PackageManagerBoundary></section> : null}
        {form.mode === 'create' ? <p className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-500">Save the venue first to add packages.</p> : null}
    </AdminModal>
}
