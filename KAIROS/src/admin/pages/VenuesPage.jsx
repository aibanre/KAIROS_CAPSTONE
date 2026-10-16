import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaPlus } from 'react-icons/fa'
import { PackageManager, PackageManagerBoundary } from '../components/PackageManager.jsx'
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
const emptyForm = { venue_name: '', venue_type: '', capacity: '', description: '', amenities: '', images: '', booking_mode: 'day_use', start_time: '08:00', end_time: '17:00', earliest_start: '08:00', latest_end: '22:00', slot_step_minutes: 30, buffer_minutes: 0, flat_price: '' }

function VenueStatus({ status }) {
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
}

export default function VenuesPage({ venues: initialVenues, onAddVenue, onEditVenue, onViewImage, onDeleteVenue }) {
    const navigate = useNavigate()
    const [venues, setVenues] = useState(initialVenues ?? [])
    const [isLoading, setIsLoading] = useState(!initialVenues)
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
        if (!response.ok) throw new Error(data.error || 'Unable to complete the venue request.')
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

    const openCreate = () => { setIsDirty(false); setForm({ ...emptyForm, mode: 'create', originalImage: '', existing_image_url: '' }) }
    const openEdit = (venue) => { setIsDirty(false); setForm({ ...venue.backend, mode: 'edit', originalImage: getImageUrl(venue.backend.images), existing_image_url: '' }) }
    const updateForm = (event) => {
        setIsDirty(true)
        setForm((current) => ({
            ...current,
            [event.target.name]: event.target.name === 'images' ? event.target.files?.[0] ?? null : event.target.value,
            ...(event.target.name === 'images' ? { existing_image_url: '' } : {}),
        }))
    }

    const saveVenue = async (event) => {
        event.preventDefault()
        if (saveLock.current) return
        saveLock.current = true
        setIsSaving(true)
        setError('')
        try {
            const { mode, venue_id, status, images, existing_image_url, originalImage, ...payload } = form
            if (mode === 'edit') payload.status = status
            const body = new FormData()
            Object.entries(payload).forEach(([name, value]) => body.append(name, value ?? ''))
            if (images instanceof File) body.append('images', images)
            else if (existing_image_url) body.append('existing_image_url', existing_image_url)
            const data = await request(mode === 'create' ? API_URL : `${API_URL}/${venue_id}`, {
                method: mode === 'create' ? 'POST' : 'PUT',
                body,
            })
            setNotice(data.message || `Venue ${mode === 'create' ? 'created' : 'updated'} successfully.`)
            setIsDirty(false)
            setForm(null)
            await loadVenues()
            const savedVenue = data.venue ? mapVenue(data.venue) : null
            if (mode === 'create') onAddVenue?.(savedVenue)
            else onEditVenue?.(savedVenue)
        } catch (saveError) {
            setError(saveError.message)
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
            setNotice(data.message || 'Venue deactivated successfully.')
            await loadVenues()
            onDeleteVenue?.(venue)
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
                deactivateVenue(venue).then(() => setForm(null))
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

            {notice ? <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p> : null}
            {error && !form ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p> : null}
            {form ? <VenueModal form={form} savedVenue={form.mode === 'edit' ? venues.find((venue) => venue.id === form.venue_id)?.backend : null} isSaving={isSaving} isDeactivating={isDeactivating} error={error} request={request} onChange={updateForm} onCancel={closeForm} onSubmit={saveVenue} onViewImage={() => onViewImage?.(venues.find((venue) => venue.id === form.venue_id))} onDeactivate={confirmDeactivate} onImageSelect={(url) => { setIsDirty(true); setForm((current) => ({ ...current, images: url, existing_image_url: url })) }} onImageRemove={() => { setIsDirty(true); setForm((current) => ({ ...current, images: current.originalImage || '', existing_image_url: '' })) }} /> : null}
            <ConfirmDialog open={Boolean(pendingConfirm)} title={pendingConfirm?.title} message={pendingConfirm?.message} confirmLabel={pendingConfirm?.confirmLabel} onConfirm={pendingConfirm?.onConfirm} onCancel={() => setPendingConfirm(null)} loading={isSaving || isDeactivating} variant={pendingConfirm?.variant} />

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-xs font-semibold text-slate-500">
                                <th className="px-4 py-4">Photo</th>
                                <th className="px-4 py-4">Venue Name</th>
                                <th className="px-4 py-4">Type</th>
                                <th className="px-4 py-4">Capacity</th>
                                <th className="px-4 py-4">Price / Day</th>
                                <th className="px-4 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">Loading venues...</td></tr> : null}
                            {!isLoading && venues.map((venue) => (
                                <tr key={venue.id} tabIndex={0} role="button" aria-label={`Edit venue ${venue.name}`} onClick={() => openEdit(venue)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEdit(venue) } }} className="cursor-pointer text-sm hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500">
                                    <td className="px-4 py-3">
                                        {venue.image ? <img src={venue.image} alt={venue.name} className="h-10 w-14 rounded object-cover" /> : <div className="flex h-10 w-14 items-center justify-center rounded bg-slate-200 font-mono text-xs text-slate-400">[img]</div>}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{venue.name}</td>
                                    <td className="px-4 py-3 text-slate-500">{venue.type}</td>
                                    <td className="px-4 py-3 text-slate-500">{venue.capacity}</td>
                                    <td className="px-4 py-3 font-bold text-sky-700">{formatPrice(venue.price)}</td>
                                    <td className="px-4 py-3"><VenueStatus status={venue.status} /></td>
                                </tr>
                            ))}
                            {!isLoading && venues.length === 0 ? <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No venues found.</td></tr> : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}

function VenueModal({ form, savedVenue, isSaving, isDeactivating, error, request, onChange, onCancel, onSubmit, onViewImage, onDeactivate, onImageSelect, onImageRemove }) {
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

    return <AdminModal title={form.mode === 'create' ? 'Add venue' : 'Edit venue'} labelledBy="venue-modal-title" onClose={onCancel} footer={<>
        {form.mode === 'edit' ? <div className="flex-1"><button type="button" disabled={isDeactivating || isSaving} onClick={onDeactivate} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Deactivate venue</button></div> : null}
        <div className="flex gap-3"><button type="button" disabled={isSaving || isDeactivating} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" form="venue-edit-form" disabled={isSaving || isDeactivating} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button></div>
    </>}>
        <form id="venue-edit-form" onSubmit={handleSubmit}>
        {error ? <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
            {['venue_name', 'venue_type', 'capacity', 'description', 'amenities'].map((name) => <label key={name} className="text-xs font-semibold text-slate-600">
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
        {savedVenue?.booking_mode === 'packaged' ? <section className="mt-6 border-t border-violet-200 pt-5"><h3 className="text-lg font-semibold text-slate-800">Packages</h3><p className="mb-4 mt-1 text-sm text-slate-500">Package changes are saved immediately.</p><PackageManagerBoundary><PackageManager venue={savedVenue} request={request} onClose={() => {}} /></PackageManagerBoundary></section> : null}
        {form.mode === 'create' ? <p className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-500">Save the venue first to add packages.</p> : null}
    </AdminModal>
}
