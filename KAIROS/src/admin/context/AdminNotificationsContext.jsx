import { createContext, useContext, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { FaCalendarPlus, FaReceipt } from 'react-icons/fa'
import { API_URL } from '../../config/api.js'
import { useAdminAuth } from './AdminAuthContext.jsx'

const AdminNotificationsContext = createContext(null)
const DEDUPE_WINDOW_MS = 5000

function unlockNotificationAudio(audioContext) {
    if (!audioContext || audioContext.state === 'running') return
    audioContext.resume().catch((error) => {
        console.warn('[admin notifications] Could not enable notification sound:', error.message)
    })
}

function playPaymentNotificationSound(audioContextRef) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    try {
        const audioContext = audioContextRef.current || new AudioContextClass()
        audioContextRef.current = audioContext
        if (audioContext.state !== 'running') return

        const now = audioContext.currentTime
        ;[880, 1174, 1568].forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator()
            const gain = audioContext.createGain()
            const start = now + index * 0.16
            oscillator.type = 'triangle'
            oscillator.frequency.value = frequency
            gain.gain.setValueAtTime(0.0001, start)
            gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
            oscillator.connect(gain)
            gain.connect(audioContext.destination)
            oscillator.start(start)
            oscillator.stop(start + 0.29)
        })
    } catch (error) {
        console.warn('[admin notifications] Could not play notification sound:', error.message)
    }
}

function NotificationToast({ event, onClick }) {
    const isPayment = event.type === 'payment_submitted'
    const message = isPayment
        ? `Payment proof submitted for ${event.booking_reference}, needs verification`
        : `New reservation ${event.booking_reference} from ${event.guest_name} (${event.resource_name})`

    return (
        <button type="button" onClick={onClick} className="flex w-80 items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-lg transition hover:border-sky-300">
            <span className="mt-0.5 rounded-full bg-sky-100 p-2 text-sky-700">
                {isPayment ? <FaReceipt className="h-4 w-4" /> : <FaCalendarPlus className="h-4 w-4" />}
            </span>
            <span>{message}</span>
        </button>
    )
}

export function AdminNotificationsProvider({ children }) {
    const { role } = useAdminAuth()
    const navigate = useNavigate()
    const seenEvents = useRef(new Map())
    const authCheckInFlight = useRef(false)
    const audioContext = useRef(null)

    useEffect(() => {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return undefined

        const enableAudio = () => {
            if (!audioContext.current) {
                try {
                    audioContext.current = new AudioContextClass()
                } catch (error) {
                    console.warn('[admin notifications] Could not initialize notification sound:', error.message)
                    return
                }
            }
            unlockNotificationAudio(audioContext.current)
        }

        document.addEventListener('pointerdown', enableAudio, { once: true })
        document.addEventListener('keydown', enableAudio, { once: true })
        return () => {
            document.removeEventListener('pointerdown', enableAudio)
            document.removeEventListener('keydown', enableAudio)
        }
    }, [])

    useEffect(() => {
        if (!['admin', 'receptionist'].includes(role)) return undefined

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

            if (payload.type === 'payment_submitted') playPaymentNotificationSound(audioContext)

            toast.custom((toastId) => (
                <NotificationToast
                    event={{
                        type: payload.type,
                        booking_reference: String(payload.booking_reference),
                        guest_name: String(payload.guest_name || 'Guest'),
                        resource_name: String(payload.resource_name || 'Reserved resource'),
                    }}
                    onClick={() => {
                        toast.dismiss(toastId)
                        navigate(payload.type === 'payment_submitted'
                            ? '/admin/payments'
                            : `/admin/reservations?ref=${encodeURIComponent(payload.booking_reference)}`)
                    }}
                />
            ), { duration: 10000 })
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
    }, [navigate, role])

    return (
        <AdminNotificationsContext.Provider value={null}>
            {children}
            <Toaster position="top-right" />
        </AdminNotificationsContext.Provider>
    )
}

export function useAdminNotifications() {
    return useContext(AdminNotificationsContext)
}
