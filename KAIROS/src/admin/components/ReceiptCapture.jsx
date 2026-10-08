import { useEffect, useRef, useState } from 'react'
import { FaCamera, FaRedo, FaTimes } from 'react-icons/fa'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_LONG_EDGE = 1600

function validateFile(file) {
    if (!file) return ''
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Receipt must be a JPEG, PNG, or WebP image.'
    if (file.size > MAX_FILE_SIZE) return 'Receipt image must be 5 MB or smaller.'
    return ''
}

export default function ReceiptCapture({ value, onChange }) {
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const objectUrlRef = useRef('')
    const fileInputRef = useRef(null)
    const [cameraState, setCameraState] = useState('idle')
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [previewUrl, setPreviewUrl] = useState('')

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
    }

    const clearPreviewUrl = () => {
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = ''
        setPreviewUrl('')
    }

    const setReceiptFile = (file) => {
        const validationError = validateFile(file)
        setError(validationError)
        if (validationError) return
        clearPreviewUrl()
        if (file) {
            objectUrlRef.current = URL.createObjectURL(file)
            setPreviewUrl(objectUrlRef.current)
        }
        onChange(file || null)
    }

    const openCamera = async () => {
        setError('')
        setNotice('')
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setCameraState('fallback')
            setNotice('Camera preview is unavailable here. Use the gallery picker to take or choose a receipt photo.')
            fileInputRef.current?.click()
            return
        }
        setCameraState('starting')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
            if (!videoRef.current) {
                stream.getTracks().forEach((track) => track.stop())
                return
            }
            streamRef.current = stream
            videoRef.current.srcObject = stream
            await videoRef.current.play()
            setCameraState('ready')
        } catch {
            stopCamera()
            setCameraState('fallback')
            setNotice('Camera access was unavailable. Use the gallery picker to take or choose a receipt photo.')
            fileInputRef.current?.click()
        }
    }

    const capturePhoto = () => {
        const video = videoRef.current
        if (!video?.videoWidth) return
        const scale = Math.min(1, MAX_LONG_EDGE / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
            if (blob) setReceiptFile(new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.85)
        stopCamera()
        setCameraState('captured')
    }

    const cancelCamera = () => {
        stopCamera()
        setCameraState('idle')
    }

    const removePhoto = () => {
        clearPreviewUrl()
        setReceiptFile(null)
        setCameraState('idle')
    }

    useEffect(() => () => {
        stopCamera()
        clearPreviewUrl()
    }, [])

    useEffect(() => {
        if (!value) {
            clearPreviewUrl()
            return
        }
        if (!previewUrl) {
            objectUrlRef.current = URL.createObjectURL(value)
            setPreviewUrl(objectUrlRef.current)
        }
    }, [value])

    return (
        <div className="mt-3 space-y-3">
            {cameraState === 'ready' || cameraState === 'starting' ? <div className="space-y-2">
                <video ref={videoRef} autoPlay playsInline muted className="max-h-64 w-full rounded-lg bg-slate-900 object-contain" aria-label="Receipt camera preview" />
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={capturePhoto} disabled={cameraState !== 'ready'} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"><FaCamera />Capture</button>
                    <button type="button" onClick={cancelCamera} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><FaTimes />Cancel</button>
                </div>
            </div> : null}
            {cameraState !== 'ready' && cameraState !== 'starting' && !value ? <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="button" onClick={openCamera} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"><FaCamera />Take Photo</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-11 text-sm font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800">Upload from gallery</button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setReceiptFile(event.target.files?.[0] || null)} className="sr-only" />
            </div> : null}
            {value && previewUrl ? <div className="space-y-2">
                <img src={previewUrl} alt="Receipt preview" className="max-h-48 w-full rounded-lg border border-slate-200 object-contain" />
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={openCamera} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><FaRedo />Retake</button>
                    <button type="button" onClick={removePhoto} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"><FaTimes />Remove</button>
                </div>
            </div> : null}
            {notice ? <p className="text-xs text-slate-500" role="status">{notice}</p> : null}
            {error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
        </div>
    )
}
