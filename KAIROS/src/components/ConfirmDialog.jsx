import { useEffect, useId, useRef } from 'react'

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    loading = false,
    variant = 'default',
}) {
    const confirmButtonRef = useRef(null)
    const previousActiveElementRef = useRef(null)
    const id = useId().replace(/:/g, '')
    const titleId = `confirm-dialog-title-${id}`
    const descriptionId = `confirm-dialog-description-${id}`

    useEffect(() => {
        if (!open) return undefined
        previousActiveElementRef.current = document.activeElement
        confirmButtonRef.current?.focus()
        return () => {
            previousActiveElementRef.current?.focus?.()
            previousActiveElementRef.current = null
        }
    }, [open])

    if (!open) return null

    const handleKeyDown = (event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
            if (!loading) onCancel()
            return
        }
        if (event.key !== 'Tab') return
        const dialog = event.currentTarget
        const focusable = Array.from(dialog.querySelectorAll('button:not([disabled])'))
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    const handleBackdropMouseDown = (event) => {
        if (event.target === event.currentTarget && !loading) onCancel()
    }

    const confirmButtonClass = variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
        : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
            onMouseDown={handleBackdropMouseDown}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="border-b border-slate-200 px-6 py-5">
                    <h2 id={titleId} className="text-xl font-bold text-slate-800">{title}</h2>
                </div>
                <div className="px-6 py-5 text-sm text-slate-600">
                    <p id={descriptionId}>{message}</p>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onCancel}
                        className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        disabled={loading}
                        onClick={onConfirm}
                        className={`min-h-11 rounded-lg px-4 py-2 font-semibold text-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${confirmButtonClass}`}
                    >
                        {loading ? 'Confirming...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
