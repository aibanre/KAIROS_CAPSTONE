import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import { API_URL } from '../../config/api.js'
import { getImageUrl } from '../utils/parseImages.js'
import StarRating from '../../shared/StarRating.jsx'
import { Reveal } from './Reveal.jsx'
import { ProgressiveImage } from '../../shared/ProgressiveImage.jsx'
import { groupRooms, groupVenues } from '../utils/groupUnits.js'

const MAX_ROOMS_DISPLAY = 4
const MAX_VENUES_DISPLAY = 4

function formatPrice(price) {
	return price == null ? null : `₱${Number(price).toLocaleString('en-PH')}`
}

function normalizeResource(resource) {
	return {
		...resource,
		amenities: Array.isArray(resource.amenities)
			? resource.amenities
			: typeof resource.amenities === 'string'
				? resource.amenities.split(',').map((amenity) => amenity.trim()).filter(Boolean)
				: [],
		rating: resource.average_rating == null ? null : Number(resource.average_rating),
		reviewCount: Number(resource.review_count ?? 0),
	}
}

function Card({ title, guests, price, tag, amenities = [], label, image, actionLabel, onSelect, rating, reviewCount, unitLabel, index = 0 }) {
	const normalizedAmenities = Array.isArray(amenities) ? amenities : []
	const visibleAmenities = [tag, ...normalizedAmenities].filter(Boolean).slice(0, 3)
	const remainingCount = Math.max(normalizedAmenities.length + (tag ? 1 : 0) - visibleAmenities.length, 0)

	return (
		<Reveal as="article" delay={Math.min(index, 1) * 80} className="group flex h-full min-w-0 shrink-0 snap-start w-[78%] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-md sm:w-[60%] sm:rounded-2xl md:w-[44%] lg:w-auto">
			<div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-100 text-center text-[9px] tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.2em]">
				<div className="absolute inset-0">
					<ProgressiveImage src={image} alt={title} fallback={label} wrapperClassName="h-full w-full" className="transition duration-500 group-hover:scale-105" />
				</div>
				<span className="absolute right-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:py-1 sm:text-xs">
					Available
				</span>
			</div>
			<div className="flex min-h-0 flex-1 flex-col p-4">
				<div className="flex-1">
					<h3 className="truncate text-sm font-semibold text-slate-800 sm:text-lg">{title}</h3>
					<div className="mt-1 truncate text-[11px] text-slate-500 sm:text-sm">{guests}</div>
					{unitLabel ? <div className="mt-1 text-[11px] font-semibold text-slate-500 sm:text-xs">{unitLabel}</div> : null}
					<div className="mt-1"><StarRating value={rating} reviewCount={reviewCount} /></div>
					<div className="mt-1 min-h-8 truncate text-sm font-bold text-sky-700 sm:mt-2 sm:min-h-10 sm:text-base">{price || '\u00a0'}</div>
					<div className="flex min-h-[3.5rem] max-h-[3.5rem] flex-wrap content-start gap-1 overflow-hidden">
						{visibleAmenities.map((amenity) => <span key={amenity} className="inline-flex whitespace-nowrap rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">{amenity}</span>)}
						{remainingCount > 0 ? <span className="inline-flex whitespace-nowrap rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">+{remainingCount}</span> : null}
					</div>
				</div>
				<div className="mt-auto">
					<button type="button" onClick={onSelect} className="h-10 w-full rounded-lg border border-sky-400 px-2 text-xs font-medium text-sky-700 transition duration-200 motion-safe:active:scale-[0.98] motion-safe:hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:rounded-xl sm:text-sm">
						{actionLabel}
					</button>
				</div>
			</div>
		</Reveal>
	)
}

function VenuePackageSummary({ summary }) {
	if (!summary) return null
	return <div className="text-[10px] leading-4 text-slate-500 sm:text-xs">
		<span className="font-semibold text-sky-700">From {formatPrice(summary.price)}</span>
		<span> · {summary.count} package{summary.count === 1 ? '' : 's'}</span>
	</div>
}

function CardRow({ children }) {
	return (
		<div className="flex items-stretch snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth py-2 -mx-4 px-4 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:scroll-px-0 lg:snap-none lg:py-0 xl:grid-cols-4">
			{children}
		</div>
	)
}

export function RoomsAndVenuesSection({ checkIn, checkOut, guests, children }) {
	const navigate = useNavigate()
	const [rooms, setRooms] = useState([])
	const [venues, setVenues] = useState([])
	const [packageSummaries, setPackageSummaries] = useState({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const controller = new AbortController()

		Promise.all([
			fetch(`${API_URL}/api/rooms`, { signal: controller.signal, credentials: 'include' }),
			fetch(`${API_URL}/api/venues`, { signal: controller.signal, credentials: 'include' }),
		])
			.then(async ([roomsResponse, venuesResponse]) => {
				const [roomsData, venuesData] = await Promise.all([roomsResponse.json(), venuesResponse.json()])
				if (!roomsResponse.ok) throw new Error(roomsData.error || 'Failed to load rooms.')
				if (!venuesResponse.ok) throw new Error(venuesData.error || 'Failed to load venues.')

				const availableRooms = groupRooms(roomsData.rooms || []).filter((room) => room.unitCount > 0).slice(0, MAX_ROOMS_DISPLAY).map(normalizeResource)
				setRooms(availableRooms)
				const availableVenues = groupVenues(venuesData.venues || []).filter((venue) => venue.unitCount > 0).slice(0, MAX_VENUES_DISPLAY).map(normalizeResource)
				setVenues(availableVenues)
				const packagedVenues = availableVenues.filter((venue) => venue.booking_mode === 'packaged')
				const packageResults = await Promise.all(packagedVenues.map(async (venue) => {
					try {
						const response = await fetch(`${API_URL}/api/venues/${encodeURIComponent(venue.venue_id)}/packages`, { signal: controller.signal, cache: 'no-store', credentials: 'include' })
						const data = await response.json()
						if (!response.ok) throw new Error(data.error || 'Failed to load venue packages.')
						const packages = (data.packages || []).filter((item) => item.is_active !== false)
						const prices = packages.map((item) => Number(item.price)).filter(Number.isFinite)
						return [venue.venue_id, { count: packages.length, price: prices.length ? Math.min(...prices) : null }]
					} catch (packageError) {
						if (packageError.name === 'AbortError') throw packageError
						return [venue.venue_id, null]
					}
				}))
				setPackageSummaries(Object.fromEntries(packageResults))
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') setError(fetchError.message)
			})
			.finally(() => setLoading(false))

		return () => controller.abort()
	}, [])

	return (
		<section id="rooms-and-venues" className="scroll-mt-20 bg-slate-50 px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
			<div className="mx-auto max-w-7xl">
				<Reveal as="header" className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Stay your way</div>
						<h2 className="font-['Lora'] text-xl font-bold tracking-tight text-slate-800 sm:text-3xl">
						Rooms & Venues
					</h2>
					<p className="mt-2 text-xs text-slate-500 sm:text-base">
						Choose from our selection of rooms and venues for your stay
					</p>
					</div>
					<Link to="/rooms-and-venues" className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
						See more
						<FaArrowRight aria-hidden="true" className="text-sm transition-transform duration-200 group-hover:translate-x-1" />
					</Link>
					</Reveal>

				{loading ? <CardRow>{[1, 2, 3, 4].map((item) => <div key={item} className="flex h-full w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white sm:w-[60%] sm:rounded-2xl md:w-[44%] lg:w-auto"><div className="relative aspect-[4/3] overflow-hidden"><div aria-hidden="true" className="absolute inset-0 bg-slate-200 motion-safe:animate-shimmer" /></div><div className="flex flex-1 flex-col space-y-2 p-2.5 sm:space-y-3 sm:p-5"><div className="h-4 w-2/3 rounded bg-slate-200 sm:h-5" /><div className="h-3 w-1/2 rounded bg-slate-100 sm:h-4" /><div className="mt-auto h-9 rounded-lg bg-slate-100 sm:h-11" /></div></div>)}</CardRow> : null}
				{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</p> : null}
				{!loading && !error ? <div className="space-y-6">
					<div>
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-semibold text-slate-700 sm:text-base">Rooms</h3>
							<span className="text-xs text-slate-400 lg:hidden">Swipe →</span>
						</div>
						<CardRow>{rooms.map((room, index) => (
						<Card
							key={`room-${room.room_id}`}
							index={index}
							title={room.groupName || room.room_type}
							guests={`${room.capacity} Guests`}
							price={`${formatPrice(room.price_per_night)} / night`}
							unitLabel={room.unitLabel}
							tag={room.room_type}
							label={`[ ${room.room_type} ]`}
							image={getImageUrl(room.images)}
							actionLabel="View Details"
							onSelect={() => {
								const params = new URLSearchParams({ roomId: String(room.room_id) })
								if (room.grouped) params.set('group', '1')
								if (checkIn) params.set('checkIn', checkIn)
								if (checkOut) params.set('checkOut', checkOut)
								if (guests) params.set('guests', String(guests))
								if (children) params.set('children', String(children))
								navigate(`/rooms-and-venues-details?${params.toString()}`)
							}}
							rating={room.rating}
							reviewCount={room.reviewCount}
							amenities={room.amenities}
						/>
						))}</CardRow>
					</div>
					<div>
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-semibold text-slate-700 sm:text-base">Venues</h3>
							<span className="text-xs text-slate-400 lg:hidden">Swipe →</span>
						</div>
						<CardRow>{venues.map((venue, index) => (
						<Card
							key={`venue-${venue.venue_id}`}
							index={index}
							title={venue.groupName || venue.venue_name}
							guests={`Up to ${venue.capacity} guests`}
							unitLabel={venue.unitLabel}
							tag={venue.venue_type}
							price={venue.booking_mode === 'packaged' ? <VenuePackageSummary summary={packageSummaries[venue.venue_id]} /> : null}
							label={`[ ${venue.venue_type} ]`}
							image={getImageUrl(venue.images)}
							actionLabel="View Details"
							onSelect={() => navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venue.venue_id)}${venue.booking_mode === 'day_use' ? '&group=1' : ''}`)}
							rating={venue.rating}
							reviewCount={venue.reviewCount}
							amenities={venue.amenities}
						/>
						))}</CardRow>
					</div>
				</div>
				 : null}
			</div>
		</section>
	)
}
