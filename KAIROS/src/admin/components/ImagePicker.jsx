import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../../config/api.js'

export default function ImagePicker({ request, selectedUrl, currentUrl, hasPendingFile, onSelect, onRemove }) {
    const [isOpen, setIsOpen] = useState(false)
    const [images, setImages] = useState([])
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('all')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!isOpen) return undefined
        const controller = new AbortController()
        setIsLoading(true)
        setError('')
        request(`${API_URL}/api/admin/images`, { signal: controller.signal })
            .then((data) => setImages(data.images || []))
            .catch((loadError) => {
                if (loadError.name !== 'AbortError') setError(loadError.message)
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false)
            })
        return () => controller.abort()
    }, [isOpen])

    const filteredImages = useMemo(() => images.filter((image) => {
        const matchesFilter = filter === 'all' || image.used_by.some((usage) => usage.type === filter)
        const text = image.used_by.map((usage) => usage.label).join(' ')
        return matchesFilter && text.toLowerCase().includes(query.toLowerCase())
    }), [filter, images, query])

    const closePicker = () => setIsOpen(false)

    return (
        <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setIsOpen((open) => !open)} className="rounded-lg border border-sky-300 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50">
                    {isOpen ? 'Hide uploaded images' : 'Choose from uploaded images'}
                </button>
                {selectedUrl || hasPendingFile ? <button type="button" onClick={onRemove} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">Remove selection</button> : null}
            </div>
            {selectedUrl ? <p className="mt-1 text-xs font-normal text-sky-700">An uploaded image is selected and will be reused.</p> : hasPendingFile ? <p className="mt-1 text-xs font-normal text-sky-700">A new image will be uploaded.</p> : currentUrl ? <p className="mt-1 text-xs font-normal text-slate-400">Current image will be kept unless you choose a file or uploaded image.</p> : null}
            {isOpen ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closePicker() } }}>
                    <div className="mb-3 flex flex-wrap gap-2">
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by room or venue" aria-label="Search uploaded images" className="min-h-10 min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                        {['all', 'room', 'venue'].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs ${filter === value ? 'bg-sky-600 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}>{value === 'all' ? 'All' : `${value}s`}</button>)}
                    </div>
                    {isLoading ? <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">Loading uploaded images...</p> : null}
                    {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p> : null}
                    {!isLoading && !error && filteredImages.length === 0 ? <p className="rounded-lg bg-white p-4 text-center text-sm text-slate-500">No uploaded images yet.</p> : null}
                    {!isLoading && !error ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{filteredImages.map((image) => <button key={image.url} type="button" onClick={() => { onSelect(image.url); closePicker() }} aria-label={`Use image used by ${image.used_by.map((usage) => usage.label).join(', ')}`} className={`overflow-hidden rounded-lg border bg-white text-left hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${selectedUrl === image.url ? 'border-sky-600 ring-2 ring-sky-200' : 'border-slate-200'}`}><img src={image.url} alt="" className="h-24 w-full object-cover" /><span className="block p-2 text-xs text-slate-600">{image.used_by.map((usage) => usage.label).join(', ')}</span></button>)}</div> : null}
                </div>
            ) : null}
        </div>
    )
}
