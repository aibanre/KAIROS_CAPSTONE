import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_URL } from '../config/api.js'

function formatPrice(price) {
	return price == null ? null : `₱${Number(price).toLocaleString('en-PH')}`
}

function getImageUrl(images) {
	if (!images) return null
	if (Array.isArray(images)) return images[0] || null
	try {
		const parsed = JSON.parse(images)
		return Array.isArray(parsed) ? parsed[0] || null : parsed
	} catch {
		return images
	}
}

function Card({ title, guests, price, tag, label, image, actionLabel, onSelect }) {
	return (
		<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.08)]">
			<div className="flex h-40 items-center justify-center overflow-hidden bg-slate-100 text-center text-[12px] tracking-[0.2em] text-slate-400 sm:h-48">
				{image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : label}
			</div>
			<div className="p-4">
				<h3 className="text-base font-bold text-slate-700">{title}</h3>
				<div className="mt-1 text-sm text-slate-500">{guests}</div>
				{price ? <div className="mt-2 text-base font-bold text-sky-700">{price}</div> : null}
				{tag ? (
					<div className="mt-3 flex flex-wrap gap-2">
						<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
							Available
						</span>
						<span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-600">
							{tag}
						</span>
					</div>
				) : null}
				<button
					type="button"
					onClick={onSelect}
					className="mt-4 w-full rounded-full border border-sky-400 px-4 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-50"
				>
					{actionLabel}
				</button>
			</div>
		</article>
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
		<section id="rooms-and-venues" className="bg-slate-50 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-slate-800 text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: 'Lora' }}>
						Rooms & Venues
					</h2>
					<p className="mt-2 text-sm text-slate-500 sm:text-base">
						Choose from our selection of rooms and venues for your stay
					</p>
					</div>
					<Link to="/rooms-and-venues-details" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800">
						More About Rooms
					</Link>
				</header>

				{loading ? <p className="text-sm text-slate-500">Loading rooms and venues...</p> : null}
				{error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error}</p> : null}
				{!loading && !error ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{rooms.map((room) => (
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
					))}
					{venues.map((venue) => (
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
					))}
				</div>
				 : null}
			</div>
		</section>
	)
}
