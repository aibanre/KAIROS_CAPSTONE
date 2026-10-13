import { useEffect, useState } from 'react'
import { FaArrowRight, FaEnvelope, FaMapMarkerAlt, FaPhoneAlt, FaTimes } from 'react-icons/fa'
import { useResortInfo } from '../context/ResortInfoContext.jsx'
import { Reveal } from './Reveal.jsx'

const STREET_VIEW_TAB = 'street-view'
const MAP_TAB = 'map'

function getCoordinate(value) {
	const number = Number.parseFloat(value)
	return Number.isFinite(number) ? number : null
}

function createStreetViewUrl({ latitude, longitude, heading, pitch, fov }) {
	const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim()
	if (key) {
		const params = new URLSearchParams({
			key,
			location: `${latitude},${longitude}`,
			heading: String(heading),
			pitch: String(pitch),
			fov: String(fov),
		})
		return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`
	}

	// This keyless form is unofficial and may stop working.
	const params = new URLSearchParams({
		q: '',
		layer: 'c',
		cbll: `${latitude},${longitude}`,
		cbp: `12,${heading},0,0,0`,
		output: 'svembed',
	})
	return `https://maps.google.com/maps?${params.toString()}`
}

function EmbedFrame({ src, title, onError, onLoad }) {
	return (
		<iframe
			src={src}
			title={title}
			loading="lazy"
			referrerPolicy="no-referrer-when-downgrade"
			allowFullScreen
			width="100%"
			height="100%"
			frameBorder="0"
			className="absolute inset-0 h-full w-full border-0"
			onError={onError}
			onLoad={onLoad}
		/>
	)
}

function ContactRow({ icon: Icon, label, value, href }) {
	return (
		<div className="flex min-h-14 items-center gap-3 border-b border-slate-100 py-2.5 sm:min-h-16">
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700" aria-hidden="true">
				<Icon />
			</div>
			<span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
			<a href={href} className="ml-auto min-w-0 max-w-[68%] break-all py-2 text-right text-sm font-medium text-slate-700 transition hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:max-w-[62%]">
				{value}
			</a>
		</div>
	)
}

export function LocationSection() {
	const {
		resort_name: resortName,
		address,
		contact_number: contactNumber,
		email,
	} = useResortInfo()
	const [activeTab, setActiveTab] = useState(() => (
		getCoordinate(import.meta.env.VITE_RESORT_LAT) !== null
		&& getCoordinate(import.meta.env.VITE_RESORT_LNG) !== null
			? STREET_VIEW_TAB
			: MAP_TAB
	))
	const [mountedTabs, setMountedTabs] = useState(() => new Set([
		getCoordinate(import.meta.env.VITE_RESORT_LAT) !== null
		&& getCoordinate(import.meta.env.VITE_RESORT_LNG) !== null
			? STREET_VIEW_TAB
			: MAP_TAB,
	]))
	const [streetViewFailed, setStreetViewFailed] = useState(false)
	const [streetViewLoaded, setStreetViewLoaded] = useState(false)
	const [noticeDismissed, setNoticeDismissed] = useState(false)

	const latitude = getCoordinate(import.meta.env.VITE_RESORT_LAT)
	const longitude = getCoordinate(import.meta.env.VITE_RESORT_LNG)
	const hasCoordinates = latitude !== null && longitude !== null
	const heading = Number.parseFloat(import.meta.env.VITE_RESORT_HEADING || '0') || 0
	const pitch = Number.parseFloat(import.meta.env.VITE_RESORT_PITCH || '0') || 0
	const fov = Number.parseFloat(import.meta.env.VITE_RESORT_FOV || '90') || 90
	const locationQuery = hasCoordinates ? `${latitude},${longitude}` : address
	const mapUrl = locationQuery
		? `https://www.google.com/maps?q=${encodeURIComponent(locationQuery)}&output=embed`
		: ''
	const streetViewUrl = hasCoordinates
		? createStreetViewUrl({ latitude, longitude, heading, pitch, fov })
		: ''
	const directionsUrl = locationQuery
		? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(locationQuery)}`
		: ''

	useEffect(() => {
		if (activeTab !== STREET_VIEW_TAB || streetViewLoaded || streetViewFailed || !streetViewUrl) return undefined
		const timeout = window.setTimeout(() => setStreetViewFailed(true), 5000)
		return () => window.clearTimeout(timeout)
	}, [activeTab, streetViewFailed, streetViewLoaded, streetViewUrl])

	const selectTab = (tab) => {
		setActiveTab(tab)
		setMountedTabs((current) => new Set(current).add(tab))
	}

	const phoneHref = contactNumber ? `tel:${contactNumber.replace(/[^\d+]/g, '')}` : ''

	return (
		<section id="location" className="scroll-mt-20 bg-slate-50 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
			<div className="mx-auto max-w-7xl">
				<Reveal as="header" className="mb-10 text-slate-800">
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Our Location</p>
						<h2 className="mt-3 font-['Lora'] text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">Find us by the sea.</h2>
					<p className="mt-2 text-xs text-slate-500 sm:text-base">
						Located at your convenience
					</p>
				</Reveal>
				
				<div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:min-h-[420px] lg:grid-cols-2">
					<div className="relative min-h-[300px] overflow-hidden bg-slate-100 lg:min-h-[420px]">
						<div className="absolute left-3 top-3 z-20 inline-flex rounded-full bg-white/95 p-1 shadow-md backdrop-blur sm:left-4 sm:top-4">
							<button type="button" aria-pressed={activeTab === STREET_VIEW_TAB} onClick={() => selectTab(STREET_VIEW_TAB)} className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 aria-pressed:bg-sky-700 aria-pressed:text-white sm:px-4">
								Street View
							</button>
							<button type="button" aria-pressed={activeTab === MAP_TAB} onClick={() => selectTab(MAP_TAB)} className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 aria-pressed:bg-sky-700 aria-pressed:text-white sm:px-4">
								Map
							</button>
						</div>

						{mountedTabs.has(STREET_VIEW_TAB) && streetViewUrl && (
							<div className={`absolute inset-0 ${activeTab === STREET_VIEW_TAB ? 'block' : 'hidden'}`}>
								<EmbedFrame
									src={streetViewUrl}
									title={`Street View of ${resortName || 'the resort'}`}
									onError={() => setStreetViewFailed(true)}
									onLoad={() => setStreetViewLoaded(true)}
								/>
							</div>
						)}
						{mountedTabs.has(MAP_TAB) && mapUrl && (
							<div className={`absolute inset-0 ${activeTab === MAP_TAB ? 'block' : 'hidden'}`}>
								<EmbedFrame src={mapUrl} title={`Map showing the location of ${resortName || 'the resort'}`} />
							</div>
						)}
						{streetViewFailed && activeTab === STREET_VIEW_TAB && (
							<div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 p-6 text-center">
								<div className="max-w-xs">
									<FaMapMarkerAlt className="mx-auto mb-2 text-2xl text-sky-600" aria-hidden="true" />
									<p className="text-sm font-semibold text-slate-800">Street View is not available here</p>
									<button type="button" onClick={() => selectTab(MAP_TAB)} className="mt-3 min-h-11 rounded-xl bg-sky-700 px-4 text-sm font-medium text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
										View map
									</button>
								</div>
							</div>
						)}
						{!streetViewUrl && !mapUrl && (
							<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-500">
								<div>
									<FaMapMarkerAlt className="mx-auto mb-2 text-2xl text-sky-600" aria-hidden="true" />
									<p>Location details are not available yet.</p>
								</div>
							</div>
						)}
						{streetViewFailed && activeTab === STREET_VIEW_TAB && !noticeDismissed && (
							<div className="absolute left-3 right-3 top-20 z-20 flex items-center gap-2 rounded-xl bg-slate-950/90 p-3 text-xs text-white shadow-lg sm:left-4 sm:right-auto sm:max-w-xs">
								<span className="flex-1">Street View is not available here</span>
								<button type="button" onClick={() => setNoticeDismissed(true)} aria-label="Dismiss Street View notice" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
									<FaTimes aria-hidden="true" />
								</button>
								<button type="button" onClick={() => selectTab(MAP_TAB)} className="min-h-9 shrink-0 rounded-lg bg-sky-600 px-2.5 font-semibold text-white hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
									View map
								</button>
							</div>
						)}
						<div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl bg-slate-950/85 p-2 text-white shadow-lg sm:bottom-4 sm:left-4 sm:max-w-sm sm:gap-3 sm:p-3">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-400 text-slate-950 sm:h-10 sm:w-10">
								<FaMapMarkerAlt aria-hidden="true" />
							</div>
							<div className="min-w-0">
								<p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-200">{resortName || 'Our resort'}</p>
								<p className="line-clamp-2 text-xs leading-4 text-white sm:text-sm sm:leading-5">{address || 'Find us by the sea.'}</p>
							</div>
						</div>
					</div>

					<div className="flex flex-col p-5 sm:p-8 lg:p-10">
						<p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">Settle into the calm of the coast at our beach resort in Gingoog City, Misamis Oriental. We look forward to welcoming you to a relaxed stay by the water.</p>

						<div className="mt-5">
							{contactNumber && <ContactRow icon={FaPhoneAlt} label="Phone" value={contactNumber} href={phoneHref} />}
							{email && <ContactRow icon={FaEnvelope} label="Email" value={email} href={`mailto:${email}`} />}
						</div>

						<div className="mt-6 rounded-2xl bg-sky-50 p-4 sm:mt-auto sm:p-5">
							<h3 className="font-['Lora'] text-lg font-bold text-slate-900">Need help getting here?</h3>
							<p className="mt-1 text-sm leading-5 text-slate-600">Parking is available on site. Call us if you need help finding the resort.</p>
							{directionsUrl && (
								<a href={directionsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${resortName || 'the resort'} on Google Maps`} className="group mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto">
									Directions
									<FaArrowRight aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
								</a>
							)}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
