import { useEffect, useRef, useState } from 'react'
import { ProgressiveImage } from '../../shared/ProgressiveImage.jsx'

export function AmenityIcon({ type, className = 'h-6 w-6 text-sky-600' }) {
	const common = { viewBox: '0 0 24 24', 'aria-hidden': true, className }
	if (type === 'wifi') return <svg {...common}><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 9c4.4-4.4 11.6-4.4 16 0M7 12c2.7-2.7 7.3-2.7 10 0M10 15c1.1-1.1 2.9-1.1 4 0" /><circle cx="12" cy="18" r="1.5" fill="currentColor" /></svg>
	if (type === 'parking') return <svg {...common}><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M5 17V7h7a4 4 0 0 1 0 8H8M8 7v10" /><path fill="currentColor" d="M4 18h16v2H4z" /></svg>
	if (type === 'activity') return <svg {...common}><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="m7 5.7 4.8 4.1-1.4 6.2M17 6.2l-3.3 4.2 3.1 4.8M4.5 12h5.8" /></svg>
	if (type === 'microphone') return <svg {...common}><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></svg>
	if (type === 'music') return <svg {...common}><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l10-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z" /></svg>
	return <svg {...common}><path fill="currentColor" d="M7 3h2v8h2V3h2v8h2V3h2v8a5 5 0 0 1-4 4.9V21h-2v-5.1A5 5 0 0 1 7 11z" /></svg>
}

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
			<path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	)
}

function ArrowIcon({ direction }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
			<path d={direction === 'previous' ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}

export function AmenityModal({ amenity, onClose, onCheckAvailability }) {
	const dialogRef = useRef(null)
	const closeButtonRef = useRef(null)
	const touchStartX = useRef(null)
	const [photoIndex, setPhotoIndex] = useState(0)
	const { photos } = amenity
	const visibleDetails = amenity.details.filter((detail) => !detail.includes('TODO'))

	useEffect(() => {
		if (photos.length < 2) return
		const neighborIndexes = [(photoIndex + 1) % photos.length, (photoIndex - 1 + photos.length) % photos.length]
		neighborIndexes.forEach((index) => {
			const image = new Image()
			image.src = photos[index]
		})
	}, [photoIndex, photos])

	useEffect(() => {
		const body = document.body
		const previousOverflow = body.style.overflow
		const previousPaddingRight = body.style.paddingRight
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
		body.style.overflow = 'hidden'
		if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
		closeButtonRef.current?.focus()

		return () => {
			body.style.overflow = previousOverflow
			body.style.paddingRight = previousPaddingRight
		}
	}, [])

	const movePhoto = (direction) => {
		setPhotoIndex((current) => (current + direction + photos.length) % photos.length)
	}

	const handleKeyDown = (event) => {
		if (event.key === 'Escape') {
			event.preventDefault()
			onClose()
			return
		}
		if (photos.length > 1 && event.key === 'ArrowLeft') {
			event.preventDefault()
			movePhoto(-1)
			return
		}
		if (photos.length > 1 && event.key === 'ArrowRight') {
			event.preventDefault()
			movePhoto(1)
			return
		}
		if (event.key !== 'Tab') return

		const focusable = dialogRef.current?.querySelectorAll(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		)
		if (!focusable?.length) {
			event.preventDefault()
			return
		}
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

	const handleTouchStart = (event) => {
		touchStartX.current = event.touches[0]?.clientX ?? null
	}

	const handleTouchEnd = (event) => {
		if (touchStartX.current === null || photos.length < 2) return
		const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
		if (Math.abs(distance) > 40) movePhoto(distance > 0 ? -1 : 1)
		touchStartX.current = null
	}

	return (
		<div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={`${amenity.id}-modal-title`}
				tabIndex="-1"
				onKeyDown={handleKeyDown}
				className="flex max-h-[85vh] max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl motion-safe:animate-[amenity-modal-in_200ms_ease-out] sm:max-w-2xl sm:rounded-2xl"
			>
				<div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
					<h2 id={`${amenity.id}-modal-title`} className="text-lg font-bold text-slate-800 sm:text-xl">{amenity.name}</h2>
					<button ref={closeButtonRef} type="button" onClick={onClose} aria-label={`Close ${amenity.name} details`} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 hover:bg-slate-100 hover:text-slate-800">
						<CloseIcon />
					</button>
				</div>

				<div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
					{photos.length > 0 ? (
						<>
							<div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
								{photos.map((photo, index) => (
									<div key={photo} className={`absolute inset-0 transition-opacity duration-200 ${index === photoIndex ? 'z-10 opacity-100' : 'pointer-events-none opacity-0'}`}>
										<ProgressiveImage src={photo} alt={`${amenity.name} view ${index + 1}`} wrapperClassName="h-full w-full" />
									</div>
								))}
								{photos.length > 1 ? (
									<>
										<button type="button" onClick={() => movePhoto(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
											<ArrowIcon direction="previous" />
										</button>
										<button type="button" onClick={() => movePhoto(1)} aria-label="Next photo" className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
											<ArrowIcon direction="next" />
										</button>
									</>
								) : null}
							</div>
							{photos.length > 1 ? (
								<div className="mt-3 flex justify-center gap-2" aria-label="Photo navigation">
									{photos.map((photo, index) => (
										<button key={photo} type="button" onClick={() => setPhotoIndex(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === photoIndex ? 'true' : undefined} className={`h-2.5 w-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${index === photoIndex ? 'bg-sky-700' : 'bg-slate-300'}`} />
									))}
								</div>
							) : null}
						</>
					) : (
						<div className="flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 via-sky-100 to-white sm:h-40">
							<div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sky-50 shadow-sm sm:h-24 sm:w-24">
								<AmenityIcon type={amenity.icon} className="h-12 w-12 text-sky-600 sm:h-14 sm:w-14" />
							</div>
						</div>
					)}

					<p className="mt-5 text-sm leading-6 text-slate-600">{amenity.description}</p>
					{visibleDetails.length > 0 ? (
						<ul className="mt-4 space-y-2 text-sm text-slate-700">
							{visibleDetails.map((detail) => <li key={detail} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />{detail}</li>)}
						</ul>
					) : null}
				</div>
			</div>
		</div>
	)
}
