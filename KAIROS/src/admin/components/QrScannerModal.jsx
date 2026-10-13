import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { FaCamera, FaQrcode, FaTimes } from 'react-icons/fa'
import parseReservationQr from '../utils/parseReservationQr'

const DECODE_INTERVAL_MS = 80
const MAX_FRAME_SIZE = 640
const INVALID_NOTICE_COOLDOWN_MS = 1800

export default function QrScannerModal({ open, onScan, onClose }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const animationFrameRef = useRef(null)
    const invalidNoticeTimerRef = useRef(null)
    const lastDecodeAtRef = useRef(0)
    const hasScannedRef = useRef(false)
    const [cameraError, setCameraError] = useState('')
    const [notice, setNotice] = useState('')
    const [manualReference, setManualReference] = useState('')

    const stopCamera = () => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
        }
        if (videoRef.current) videoRef.current.srcObject = null
    }

    const showInvalidNotice = () => {
        setNotice("That QR code isn't a KAIROS reservation")
        if (invalidNoticeTimerRef.current) window.clearTimeout(invalidNoticeTimerRef.current)
        invalidNoticeTimerRef.current = window.setTimeout(() => setNotice(''), INVALID_NOTICE_COOLDOWN_MS)
    }

    const submitReference = (value) => {
        const reference = parseReservationQr(value)
        if (!reference) {
            showInvalidNotice()
            return
        }
        if (hasScannedRef.current) return
        hasScannedRef.current = true
        stopCamera()
        onScan(reference)
    }

    useEffect(() => {
        if (!open) return undefined
        let active = true
        hasScannedRef.current = false
        lastDecodeAtRef.current = 0
        setCameraError('')
        setNotice('')
        setManualReference('')

        if (!window.isSecureContext) {
            setCameraError('Camera access needs HTTPS. Open the portal over HTTPS, or enter the booking reference manually.')
            return () => { active = false }
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError('Camera access is not available in this browser. Enter the booking reference manually.')
            return () => { active = false }
        }

        const scanFrame = (timestamp) => {
            if (!active || hasScannedRef.current) return
            animationFrameRef.current = requestAnimationFrame(scanFrame)
            const video = videoRef.current
            const canvas = canvasRef.current
            if (!video || !canvas || video.readyState < 2 || !video.videoWidth || timestamp - lastDecodeAtRef.current < DECODE_INTERVAL_MS) return
            lastDecodeAtRef.current = timestamp

            const scale = Math.min(1, MAX_FRAME_SIZE / Math.max(video.videoWidth, video.videoHeight))
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
            const context = canvas.getContext('2d', { willReadFrequently: true })
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            const image = context.getImageData(0, 0, canvas.width, canvas.height)
            const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
            if (result?.data) submitReference(result.data)
        }

        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
            .then((stream) => {
                if (!active) {
                    stream.getTracks().forEach((track) => track.stop())
                    return
                }
                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.play().catch(() => {})
                }
                animationFrameRef.current = requestAnimationFrame(scanFrame)
            })
            .catch(() => {
                if (active) setCameraError('Camera permission was denied or no camera was found. Enter the booking reference manually.')
            })

        return () => {
            active = false
            stopCamera()
            if (invalidNoticeTimerRef.current) window.clearTimeout(invalidNoticeTimerRef.current)
        }
    }, [open])

    const handleClose = () => {
        stopCamera()
        onClose()
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Scan reservation QR code">
            <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div className="flex items-center gap-2 text-slate-800"><FaQrcode className="text-sky-600" /><h2 className="font-bold">Scan reservation QR</h2></div>
                    <button type="button" aria-label="Close QR scanner" title="Close QR scanner" onClick={handleClose} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"><FaTimes /></button>
                </div>
                <div className="space-y-4 p-5">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
                        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay aria-label="QR scanner camera" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="h-48 w-48 rounded-xl border-4 border-sky-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" /></div>
                        <div className="absolute bottom-3 left-0 right-0 text-center text-xs font-medium text-white">Point the camera at the guest&apos;s QR code</div>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraError ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">{cameraError}</p> : null}
                    {notice ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="status">{notice}</p> : null}
                    <div className="border-t border-slate-200 pt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Manual entry</p>
                        <form onSubmit={(event) => { event.preventDefault(); submitReference(manualReference) }} className="flex flex-col gap-2 sm:flex-row">
                            <input value={manualReference} onChange={(event) => setManualReference(event.target.value)} placeholder="KAB-2026-10-0001" aria-label="Booking reference" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500" />
                            <button type="submit" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"><FaCamera className="h-3 w-3" />Find reservation</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
