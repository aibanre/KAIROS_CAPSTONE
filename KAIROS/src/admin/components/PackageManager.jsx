import { Component, useEffect, useState } from 'react'
import { API_URL } from '../../config/api.js'

const emptyForm = {
    package_name: '',
    description: '',
    inclusions: '',
    pricing_type: 'flat',
    price: '',
    min_pax: 1,
    max_pax: '',
    included_hours: 5,
    extra_hour_rate: 1500,
    sort_order: 0,
}

function normalizePackageForm(packageData) {
    return {
        ...packageData,
        inclusions: Array.isArray(packageData.inclusions) ? packageData.inclusions.join('\n') : packageData.inclusions || '',
        max_pax: packageData.max_pax ?? '',
        extra_hour_rate: packageData.extra_hour_rate ?? '',
    }
}

export class PackageManagerBoundary extends Component {
    state = { error: null }

    static getDerivedStateFromError(error) {
        return { error }
    }

    render() {
        if (this.state.error) {
            return <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">Package manager failed to render. Close it and try again.</p>
        }
        return this.props.children
    }
}

export function PackageManager({ venue, request, onClose }) {
    const [packages, setPackages] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    const load = async (signal) => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(`${API_URL}/api/admin/venues/${venue.venue_id}/packages`, { signal })
            setPackages(data.packages || [])
        } catch (loadError) {
            if (loadError.name === 'AbortError') return
            setError(loadError.message)
        } finally {
            if (!signal?.aborted) setIsLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        load(controller.signal)
        return () => controller.abort()
    }, [venue.venue_id])

    const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

    const save = async (event) => {
        event.preventDefault()
        setIsSaving(true)
        setError('')
        try {
            const payload = {
                ...form,
                inclusions: form.inclusions.split('\n').map((item) => item.trim()).filter(Boolean),
                max_pax: form.max_pax || null,
                extra_hour_rate: form.extra_hour_rate === '' ? null : form.extra_hour_rate,
            }
            const endpoint = form.package_id
                ? `${API_URL}/api/admin/venues/${venue.venue_id}/packages/${form.package_id}`
                : `${API_URL}/api/admin/venues/${venue.venue_id}/packages`
            await request(endpoint, { method: form.package_id ? 'PUT' : 'POST', body: JSON.stringify(payload) })
            setForm(emptyForm)
            await load()
        } catch (saveError) {
            setError(saveError.message)
        } finally {
            setIsSaving(false)
        }
    }

    const deactivate = async (packageId) => {
        setError('')
        try {
            await request(`${API_URL}/api/admin/venues/${venue.venue_id}/packages/${packageId}/deactivate`, { method: 'PATCH' })
            await load()
        } catch (deactivateError) {
            setError(deactivateError.message)
        }
    }

    const movePackage = async (packageData, direction) => {
        const activePackages = packages.filter((item) => item.is_active)
        const index = activePackages.findIndex((item) => item.package_id === packageData.package_id)
        const neighbor = activePackages[index + direction]
        if (!neighbor) return
        setError('')
        try {
            await Promise.all([
                request(`${API_URL}/api/admin/venues/${venue.venue_id}/packages/${packageData.package_id}`, { method: 'PUT', body: JSON.stringify({ ...packageData, inclusions: packageData.inclusions || [], sort_order: neighbor.sort_order }) }),
                request(`${API_URL}/api/admin/venues/${venue.venue_id}/packages/${neighbor.package_id}`, { method: 'PUT', body: JSON.stringify({ ...neighbor, inclusions: neighbor.inclusions || [], sort_order: packageData.sort_order }) }),
            ])
            await load()
        } catch (moveError) {
            setError(moveError.message)
        }
    }

    return (
        <section className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-800">Packages: {venue.venue_name}</h2>
                <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:text-slate-900">Close</button>
            </div>
            {error ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
            {isLoading ? <p className="rounded-lg bg-white p-4 text-sm text-slate-500">Loading packages...</p> : null}
            {!isLoading && !error && packages.filter((item) => item.is_active).length === 0 ? <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No active packages yet.</p> : null}
            <div className="mb-5 grid gap-3 md:grid-cols-2">
                {packages.filter((item) => item.is_active).map((item, index, activePackages) => (
                    <article key={item.package_id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div><h3 className="font-semibold text-slate-800">{item.package_name}</h3><p className="mt-1 text-slate-500">₱{Number(item.price).toLocaleString('en-PH')} · {item.pricing_type === 'per_person' ? 'Per person' : 'Flat'}</p></div>
                            <div className="flex gap-2 text-xs">
                                <button type="button" disabled={index === 0} onClick={() => movePackage(item, -1)} className="text-slate-500 disabled:opacity-30" aria-label="Move package up">↑</button>
                                <button type="button" disabled={index === activePackages.length - 1} onClick={() => movePackage(item, 1)} className="text-slate-500 disabled:opacity-30" aria-label="Move package down">↓</button>
                            </div>
                        </div>
                        {item.description ? <p className="mt-2 text-xs text-slate-500">{item.description}</p> : null}
                        <div className="mt-3 flex gap-3 text-xs">
                            <button type="button" onClick={() => setForm(normalizePackageForm(item))} className="text-sky-600 hover:text-sky-800">Edit</button>
                            <button type="button" onClick={() => deactivate(item.package_id)} className="text-rose-600 hover:text-rose-800">Deactivate</button>
                        </div>
                    </article>
                ))}
            </div>
            <form onSubmit={save} className="grid gap-3 rounded-xl border border-violet-100 bg-white p-4 md:grid-cols-2">
                <h3 className="md:col-span-2 text-sm font-semibold text-slate-700">{form.package_id ? 'Edit package' : 'Create package'}</h3>
                <label className="text-xs font-semibold text-slate-600">Name<input required name="package_name" value={form.package_name} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="text-xs font-semibold text-slate-600">Description<input name="description" value={form.description} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <label className="text-xs font-semibold text-slate-600">Pricing type<select name="pricing_type" value={form.pricing_type} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"><option value="flat">Flat</option><option value="per_person">Per person</option></select></label>
                <label className="text-xs font-semibold text-slate-600">Price<input required name="price" type="number" min="0.01" step="0.01" value={form.price} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                {['min_pax', 'max_pax', 'included_hours', 'extra_hour_rate', 'sort_order'].map((name) => <label key={name} className="text-xs font-semibold text-slate-600">{name.replaceAll('_', ' ')}<input name={name} type="number" min={name === 'min_pax' || name === 'included_hours' ? '1' : '0'} value={form[name]} onChange={updateForm} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>)}
                <label className="text-xs font-semibold text-slate-600 md:col-span-2">Inclusions <span className="font-normal text-slate-400">(one per line)</span><textarea name="inclusions" value={form.inclusions} onChange={updateForm} rows="3" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" /></label>
                <div className="flex gap-2 md:col-span-2"><button type="submit" disabled={isSaving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Saving...' : form.package_id ? 'Save package' : 'Create package'}</button>{form.package_id ? <button type="button" onClick={() => setForm(emptyForm)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600">Cancel edit</button> : null}</div>
            </form>
        </section>
    )
}
