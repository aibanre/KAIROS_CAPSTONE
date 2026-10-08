import { useEffect, useRef, useState } from 'react'

function canvasFile(canvas) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ? new File([blob], 'guest-signature.png', { type: 'image/png' }) : null), 'image/png'))
}

export default function SignaturePad({ value, onChange, disabled = false, label = 'Guest signature' }) {
    const canvasRef = useRef(null)
    const historyRef = useRef([])
    const drawingRef = useRef(false)
    const [isEmpty, setIsEmpty] = useState(!value)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = Math.max(1, Math.floor(rect.width * ratio))
        canvas.height = Math.max(1, Math.floor(rect.height * ratio))
        const context = canvas.getContext('2d')
        context.scale(ratio, ratio)
        context.lineCap = 'round'
        context.lineJoin = 'round'
        let image
        if (value instanceof Blob) {
            image = new Image()
            image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height)
            image.src = URL.createObjectURL(value)
        }
        return () => { if (value instanceof Blob) URL.revokeObjectURL(image?.src) }
    }, [value])

    const point = (event) => {
        const canvas = canvasRef.current
        const bounds = canvas.getBoundingClientRect()
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
    }
    const start = (event) => {
        if (disabled) return
        const context = canvasRef.current.getContext('2d')
        const position = point(event)
        historyRef.current.push(context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height))
        context.beginPath()
        context.moveTo(position.x, position.y)
        context.strokeStyle = '#0f172a'
        context.lineWidth = 2
        drawingRef.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    const draw = (event) => {
        if (!drawingRef.current || disabled) return
        const context = canvasRef.current.getContext('2d')
        const position = point(event)
        context.lineTo(position.x, position.y)
        context.stroke()
    }
    const finish = async () => {
        if (!drawingRef.current) return
        drawingRef.current = false
        setIsEmpty(false)
        onChange?.(await canvasFile(canvasRef.current))
    }
    const clear = () => {
        if (disabled) return
        const canvas = canvasRef.current
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
        historyRef.current = []
        setIsEmpty(true)
        onChange?.(null)
    }
    const undo = () => {
        if (disabled) return
        const previous = historyRef.current.pop()
        if (!previous) return clear()
        canvasRef.current.getContext('2d').putImageData(previous, 0, 0)
        setIsEmpty(historyRef.current.length === 0)
        onChange?.(historyRef.current.length ? canvasFile(canvasRef.current) : null)
    }

    return <div>
        <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600">{label}</label>
            {!disabled ? <div className="flex gap-3"><button type="button" onClick={undo} className="text-xs font-medium text-sky-600">Undo</button><button type="button" onClick={clear} className="text-xs font-medium text-sky-600">Clear</button></div> : null}
        </div>
        <canvas ref={canvasRef} aria-label={label} className="h-32 w-full touch-none rounded-lg border border-slate-300 bg-white" onPointerDown={start} onPointerMove={draw} onPointerUp={finish} onPointerCancel={finish} />
        {!disabled && isEmpty ? <p className="mt-1 text-xs text-slate-400">Sign inside the box above.</p> : null}
    </div>
}
