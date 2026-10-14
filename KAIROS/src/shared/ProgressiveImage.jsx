import { useCallback, useEffect, useRef, useState } from 'react'

function ImageFallback({ fallback }) {
	if (fallback) return <div className="flex h-full w-full items-center justify-center">{fallback}</div>

	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-slate-500">
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-slate-400">
				<path d="M4 5h16v14H4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
				<path d="m6.5 16 3.5-4 2.5 2.5 2-2 3 3.5M8 9h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
			</svg>
			<span>Image unavailable</span>
		</div>
	)
}

export function ProgressiveImage({
	src,
	alt,
	className = '',
	wrapperClassName = '',
	aspect,
	priority = false,
	fit = 'cover',
	fallback,
	onLoad,
	onError,
	...imgProps
}) {
	const imageRef = useRef(null)
	const [loadedSrc, setLoadedSrc] = useState(null)
	const [failed, setFailed] = useState(() => !(typeof src === 'string' && src.trim()))
	const validSrc = (() => {
		if (typeof src !== 'string' || !src.trim()) return false
		try {
			new URL(src, document.baseURI)
			return true
		} catch {
			return false
		}
	})()
	const setImageRef = useCallback((image) => {
		imageRef.current = image
		if (image?.complete && image.naturalWidth > 0) setLoadedSrc(src)
	}, [src])

	useEffect(() => {
		if (!validSrc) {
			setLoadedSrc(null)
			setFailed(true)
			return undefined
		}

		setFailed(false)
		const image = imageRef.current
		if (image?.complete && image.naturalWidth > 0) {
			setLoadedSrc(src)
			return undefined
		}
		setLoadedSrc(null)

		const checkComplete = () => {
			if (image?.complete && image.naturalWidth > 0) setLoadedSrc(src)
		}
		const frame = window.requestAnimationFrame(checkComplete)
		const timeout = window.setTimeout(() => setFailed(true), 15000)
		return () => {
			window.cancelAnimationFrame(frame)
			window.clearTimeout(timeout)
		}
	}, [src, validSrc])

	const handleLoad = (event) => {
		setLoadedSrc(src)
		onLoad?.(event)
	}

	const handleError = (event) => {
		setFailed(true)
		onError?.(event)
	}

	const wrapperStyle = aspect ? { aspectRatio: aspect } : undefined
	const isLoaded = validSrc && loadedSrc === src
	const isError = !validSrc || failed
	const imageClasses = [
		'absolute inset-0 h-full w-full',
		fit === 'contain' ? 'object-contain' : 'object-cover',
		'opacity-0 scale-[1.02] motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out',
		isLoaded ? 'opacity-100 scale-100' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={`relative overflow-hidden ${wrapperClassName}`} style={wrapperStyle}>
			{!isLoaded && !isError ? (
				<div aria-hidden="true" className="absolute inset-0 bg-slate-200 motion-safe:animate-shimmer" />
			) : null}
			{isError ? (
				<div className="absolute inset-0 bg-slate-100">
					<ImageFallback fallback={fallback} />
				</div>
			) : null}
			{validSrc ? (
				<img
					{...imgProps}
					ref={setImageRef}
					src={src}
					alt={alt}
					loading={priority ? 'eager' : 'lazy'}
					decoding="async"
					fetchPriority={priority ? 'high' : undefined}
					className={imageClasses}
					onLoad={handleLoad}
					onError={handleError}
				/>
			) : null}
		</div>
	)
}
