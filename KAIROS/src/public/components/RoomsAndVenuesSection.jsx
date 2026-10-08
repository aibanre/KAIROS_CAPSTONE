import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_URL } from '../../config/api.js'
import { getImageUrl } from '../utils/parseImages.js'

function formatPrice(price) {
	return price == null ? null : `₱${Number(price).toLocaleString('en-PH')}`
}

function Card({ title, guests, price, tag, label, image, actionLabel, onSelect }) {
	return (
		<article className="group flex h-full min-w-0 shrink-0 snap-start w-[42%] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg min-[480px]:w-[34%] sm:rounded-2xl md:w-auto">
			<div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-100 text-center text-[9px] tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.2em]">
				{image ? <img src={image} alt={title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : label}
			</div>
			<div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-4">
				<h3 className="truncate text-sm font-semibold text-slate-800 sm:text-lg">{title}</h3>
				<div className="mt-1 truncate text-[11px] text-slate-500 sm:text-sm">{guests}</div>
				<div className="mt-1 min-h-5 truncate text-sm font-bold text-sky-700 sm:mt-2 sm:min-h-6 sm:text-base">{price || '\u00a0'}</div>
				<div className="mt-auto pt-2">
					<div className="flex min-h-6 min-w-0 items-start gap-1 sm:mt-3 sm:gap-2">
						<span className="inline-flex max-w-full rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:py-1 sm:text-xs">
							Available
						</span>
						{tag ? <span className="inline-flex max-w-full truncate rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 sm:py-1 sm:text-xs">{tag}</span> : null}
					</div>
					<button
						type="button"
						onClick={onSelect}
						className="mt-2 min-h-9 w-full rounded-lg border border-sky-400 px-2 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:mt-3 sm:rounded-xl sm:text-sm"
					>
						{actionLabel}
					</button>
				</div>
			</div>
		</article>
	)
}

function CardRow({ children }) {
	return (
		<div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-3 -mx-4 px-4 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:snap-none md:pb-0 lg:grid-cols-4">
			{children}
		</div>
	)
}

export function RoomsAndVenuesSection() {
	const navigate = useNavigate()
	const [rooms, setRooms] = useState([])
	const [venues, setVenues] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)

	useEffect(() => {
		const controller = new AbortController()

		Promise.all([
			fetch(`${API_URL}/api/rooms`, { signal: controller.signal }),
			fetch(`${API_URL}/api/venues`, { signal: controller.signal }),
		])
			.then(async ([roomsResponse, venuesResponse]) => {
				const [roomsData, venuesData] = await Promise.all([roomsResponse.json(), venuesResponse.json()])
				if (!roomsResponse.ok) throw new Error(roomsData.error || 'Failed to load rooms.')
				if (!venuesResponse.ok) throw new Error(venuesData.error || 'Failed to load venues.')

				setRooms((roomsData.rooms || []).filter((room) => room.status === 'available').slice(0, 2))
				setVenues((venuesData.venues || []).filter((venue) => venue.status === 'available').slice(0, 2))
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
				<header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Stay your way</div>
						<h2 className="font-['Lora'] text-xl font-bold tracking-tight text-slate-800 sm:text-3xl">
						Rooms & Venues
					</h2>
					<p className="mt-2 text-xs text-slate-500 sm:text-base">
						Choose from our selection of rooms and venues for your stay
					</p>
					</div>
					<Link to="/rooms-and-venues-details" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
						More About Rooms
					</Link>
				</header>

				{loading ? <CardRow>{[1, 2, 3, 4].map((item) => <div key={item} className="h-full shrink-0 snap-start w-[42%] min-[480px]:w-[34%] animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl md:w-auto"><div className="aspect-[4/3] bg-slate-200" /><div className="space-y-2 p-2.5 sm:space-y-3 sm:p-5"><div className="h-4 w-2/3 rounded bg-slate-200 sm:h-5" /><div className="h-3 w-1/2 rounded bg-slate-100 sm:h-4" /><div className="h-9 rounded-lg bg-slate-100 sm:h-11" /></div></div>)}</CardRow> : null}
				{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</p> : null}
				{!loading && !error ? <div className="space-y-6">
					<div>
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-semibold text-slate-700 sm:text-base">Rooms</h3>
							<span className="text-xs text-slate-400 md:hidden">Swipe →</span>
						</div>
						<CardRow>{rooms.map((room) => (
						<Card
							key={`room-${room.room_id}`}
							title={room.room_number}
							guests={`${room.capacity} Guests`}
							price={`${formatPrice(room.price_per_night)} / night`}
							tag={room.room_type}
							label={`[ ${room.room_type} ]`}
							image={getImageUrl(room.images)}
							actionLabel="View Details"
							onSelect={() => navigate(`/rooms-and-venues-details?roomId=${encodeURIComponent(room.room_id)}`)}
						/>
						))}</CardRow>
					</div>
					<div>
						<div className="mb-2 flex items-center justify-between">
							<h3 className="text-sm font-semibold text-slate-700 sm:text-base">Venues</h3>
							<span className="text-xs text-slate-400 md:hidden">Swipe →</span>
						</div>
						<CardRow>{venues.map((venue) => (
						<Card
							key={`venue-${venue.venue_id}`}
							title={venue.venue_name}
							guests={`Up to ${venue.capacity} guests`}
							tag={venue.venue_type}
							label={`[ ${venue.venue_type} ]`}
							image={getImageUrl(venue.images)}
							actionLabel="View Details"
							onSelect={() => navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venue.venue_id)}`)}
						/>
						))}</CardRow>
					</div>
				</div>
				 : null}
			</div>
		</section>
	)
}
