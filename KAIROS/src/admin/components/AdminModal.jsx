import { useEffect } from 'react'
import { FaTimes } from 'react-icons/fa'

export default function AdminModal({ title, eyebrow, labelledBy, onClose, children, footer }) {
    useEffect(() => {
        const hadOverflowHidden = document.body.classList.contains('overflow-hidden')
        document.body.classList.add('overflow-hidden')
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            if (!hadOverflowHidden) document.body.classList.remove('overflow-hidden')
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    const handleOverlayMouseDown = (event) => {
        if (event.target === event.currentTarget) onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={handleOverlayMouseDown}>
            <div className="flex max-h-[90vh] max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                    <div className="min-w-0">
                        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{eyebrow}</p> : null}
                        <h2 id={labelledBy} className="mt-1 text-xl font-bold text-slate-800">{title}</h2>
                    </div>
                    <button type="button" aria-label={`Close ${title}`} title={`Close ${title}`} onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
                        <FaTimes />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm">{children}</div>
                {footer ? <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">{footer}</div> : null}
            </div>
        </div>
    )
}
