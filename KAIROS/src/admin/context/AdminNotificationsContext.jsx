import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaCalendarPlus, FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaInfoCircle, FaReceipt, FaTimes } from 'react-icons/fa'
import { API_URL } from '../../config/api.js'
import positiveNotification from '../../public/positive-notification.wav'
import { useAdminAuth } from './AdminAuthContext.jsx'

const AdminNotificationsContext = createContext(null)
const DEDUPE_WINDOW_MS = 5000
const ACTION_DEDUPE_WINDOW_MS = 3000
const MAX_VISIBLE_TOASTS = 4

const DEFAULT_DURATIONS = {
    success: 4000,
    info: 4000,
    warning: 6000,
    error: 8000,
}

const TOAST_STYLES = {
    success: { Icon: FaCheckCircle, label: 'Success', border: 'border-emerald-300', icon: 'bg-emerald-100 text-emerald-800' },
    info: { Icon: FaInfoCircle, label: 'Information', border: 'border-sky-300', icon: 'bg-sky-100 text-sky-800' },
    warning: { Icon: FaExclamationTriangle, label: 'Warning', border: 'border-amber-300', icon: 'bg-amber-100 text-amber-900' },
    error: { Icon: FaExclamationCircle, label: 'Error', border: 'border-rose-300', icon: 'bg-rose-100 text-rose-800' },
}

function playPaymentNotificationSound(audioRef) {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    audio.play().catch((error) => {
        console.warn('[admin notifications] Could not play notification sound:', error.message)
    })
}

function AdminToast({ item, onDismiss }) {
    const [remaining, setRemaining] = useState(item.duration)
    const [paused, setPaused] = useState(false)
    const startedAt = useRef(0)
    const timeout = useRef(null)
    const pausedRef = useRef(false)
    const hoveredRef = useRef(false)
    const focusedRef = useRef(false)
    const style = TOAST_STYLES[item.type] || TOAST_STYLES.info
    const Icon = item.kind === 'payment'
        ? FaReceipt
        : item.kind === 'reservation'
            ? FaCalendarPlus
            : style.Icon

    useEffect(() => {
        if (paused) return undefined
        startedAt.current = Date.now()
        timeout.current = window.setTimeout(() => onDismiss(item.id), remaining)
        return () => window.clearTimeout(timeout.current)
    }, [item.id, onDismiss, paused, remaining])

    const pause = () => {
        if (pausedRef.current) return
        pausedRef.current = true
        setRemaining((current) => Math.max(0, current - (Date.now() - startedAt.current)))
        setPaused(true)
    }
    const resume = () => {
        if (hoveredRef.current || focusedRef.current || !pausedRef.current) return
        pausedRef.current = false
        setPaused(false)
    }
    const message = item.kind === 'payment'
        ? `Payment proof submitted for ${item.bookingReference}, needs verification`
        : item.kind === 'reservation'
            ? `New reservation ${item.bookingReference} from ${item.guestName} (${item.resourceName})`
            : item.message
    const commonProps = {
        onPointerEnter: () => {
            hoveredRef.current = true
            pause()
        },
        onPointerLeave: () => {
            hoveredRef.current = false
            resume()
        },
        onFocusCapture: () => {
            focusedRef.current = true
            pause()
        },
        onBlurCapture: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
                focusedRef.current = false
                resume()
            }
        },
        className: `flex w-full items-start gap-3 rounded-xl border ${style.border} bg-white p-3 text-left shadow-lg`,
        role: item.type === 'error' ? 'alert' : 'status',
        'aria-live': item.type === 'error' ? 'assertive' : 'polite',
    }

    return (
        <div {...commonProps}>
            {item.onClick
                ? <button type="button" onClick={() => { item.onClick(); onDismiss(item.id) }} className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
                    <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.icon}`} aria-hidden="true"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-800"><span className="sr-only">{style.label}: </span>{message}</span>
                </button>
                : <>
                    <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.icon}`} aria-hidden="true"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-800"><span className="sr-only">{style.label}: </span>{message}</span>
                </>}
            <button
                type="button"
                aria-label="Close notification"
                onClick={() => onDismiss(item.id)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
                <FaTimes className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}

export function AdminNotificationsProvider({ children }) {
    const { role } = useAdminAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const seenEvents = useRef(new Map())
    const seenActionToasts = useRef(new Map())
    const authCheckInFlight = useRef(false)
    const notificationAudio = useRef(null)
    const nextToastId = useRef(0)
    const [toasts, setToasts] = useState([])

    const dismissToast = useCallback((id) => {
        setToasts((current) => current.filter((item) => item.id !== id))
    }, [])

    const pushToast = useCallback((message, type, options = {}) => {
        const text = String(message || '').trim()
        if (!text && !options.kind) return null

        const key = `${type}:${options.id || text}`
        const now = Date.now()
        const previous = seenActionToasts.current.get(key)
        if (previous && now - previous.time < ACTION_DEDUPE_WINDOW_MS) {
            return previous.id
        }

        const id = `admin-toast-${++nextToastId.current}`
        seenActionToasts.current.set(key, { id, time: now })
        const cutoff = now - ACTION_DEDUPE_WINDOW_MS
        for (const [dedupeKey, value] of seenActionToasts.current) {
            if (value.time < cutoff) seenActionToasts.current.delete(dedupeKey)
        }

        setToasts((current) => [{
            id,
            type,
            message: text,
            duration: options.duration ?? DEFAULT_DURATIONS[type],
            kind: options.kind,
            bookingReference: options.bookingReference,
            guestName: options.guestName,
            resourceName: options.resourceName,
            onClick: options.onClick,
        }, ...current])
        return id
    }, [])

    const toast = useMemo(() => ({
        success: (message, options) => pushToast(message, 'success', options),
        error: (message, options) => pushToast(message, 'error', options),
        info: (message, options) => pushToast(message, 'info', options),
        warning: (message, options) => pushToast(message, 'warning', options),
    }), [pushToast])

    useEffect(() => {
        const audio = new Audio(positiveNotification)
        audio.preload = 'auto'
        notificationAudio.current = audio

        const enableAudio = () => {
            audio.muted = true
            audio.play()
                .then(() => {
                    audio.pause()
                    audio.currentTime = 0
                    audio.muted = false
                })
                .catch((error) => {
                    audio.muted = false
                    console.warn('[admin notifications] Could not enable notification sound:', error.message)
                })
        }

        document.addEventListener('pointerdown', enableAudio, { once: true })
        document.addEventListener('keydown', enableAudio, { once: true })
        return () => {
            document.removeEventListener('pointerdown', enableAudio)
            document.removeEventListener('keydown', enableAudio)
            audio.pause()
            notificationAudio.current = null
        }
    }, [])

    useEffect(() => {
        if (!['admin', 'receptionist'].includes(role)
            || ['/admin/login', '/admin/change-password'].includes(location.pathname)) return undefined

        const stream = new EventSource(`${API_URL}/api/admin/notifications/stream`, { withCredentials: true })
        const handleEvent = (event) => {
            let payload
            try {
                payload = JSON.parse(event.data)
            } catch {
                return
            }

            if (!payload?.booking_reference || !['reservation_created', 'payment_submitted'].includes(payload.type)) return
            const dedupeKey = `${payload.type}:${payload.booking_reference}`
            const now = Date.now()
            const previous = seenEvents.current.get(dedupeKey)
            if (previous && now - previous < DEDUPE_WINDOW_MS) return
            seenEvents.current.set(dedupeKey, now)

            const isPayment = payload.type === 'payment_submitted'
            if (isPayment) playPaymentNotificationSound(notificationAudio)
            pushToast('', 'info', {
                kind: isPayment ? 'payment' : 'reservation',
                duration: 10000,
                id: dedupeKey,
                bookingReference: String(payload.booking_reference),
                guestName: String(payload.guest_name || 'Guest'),
                resourceName: String(payload.resource_name || 'Reserved resource'),
                onClick: () => navigate(isPayment
                    ? '/admin/payments'
                    : `/admin/reservations?ref=${encodeURIComponent(payload.booking_reference)}`),
            })
        }

        stream.addEventListener('reservation_created', handleEvent)
        stream.addEventListener('payment_submitted', handleEvent)
        stream.onerror = async () => {
            if (authCheckInFlight.current) return
            authCheckInFlight.current = true
            try {
                const response = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
                if (response.status === 401 || response.status === 403) {
                    stream.close()
                    if (window.location.pathname !== '/admin/login') navigate('/admin/login', { replace: true })
                }
            } finally {
                authCheckInFlight.current = false
            }
        }

        return () => {
            stream.close()
            seenEvents.current.clear()
        }
    }, [location.pathname, navigate, pushToast, role])

    const contextValue = useMemo(() => ({ toast }), [toast])
    return (
        <AdminNotificationsContext.Provider value={contextValue}>
            {children}
            <div
                className="fixed left-3 right-3 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[100] flex max-h-[calc(100dvh-5rem)] flex-col gap-3 overflow-y-auto overscroll-contain sm:left-auto sm:w-[min(24rem,calc(100vw-2rem))] lg:left-auto lg:right-6 lg:top-[calc(1rem+env(safe-area-inset-top,0px))]"
                role="region"
                aria-label="Admin notifications"
            >
                {toasts.slice(0, MAX_VISIBLE_TOASTS).map((item) => (
                    <AdminToast key={item.id} item={item} onDismiss={dismissToast} />
                ))}
            </div>
        </AdminNotificationsContext.Provider>
    )
}

export function useAdminToast() {
    const context = useContext(AdminNotificationsContext)
    if (!context) throw new Error('useAdminToast must be used within AdminNotificationsProvider.')
    return context.toast
}
