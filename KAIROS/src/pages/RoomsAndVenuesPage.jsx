import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const defaultRooms = [
	{ id: 3, name: 'Room Type #3', capacity: '2 Adults', guests: 2, price: 4500, type: 'Deluxe Ocean View', amenities: ['WiFi', 'AC', 'Mini Bar'], status: 'available' },
	{ id: 2, name: 'Room Type #2', capacity: '2 Adults, 1 Child', guests: 3, price: 6800, type: 'Beach Suite', amenities: ['WiFi', 'AC', 'Jacuzzi'], status: 'available' },
	{ id: 4, name: 'Room Type #4', capacity: '4 Adults', guests: 4, price: 8200, type: 'Garden Villa', amenities: ['WiFi', 'AC', 'Pool', 'Kitchen'], status: 'booked' },
	{ id: 1, name: 'Room Type #1', capacity: '2 Adults, 2 Children', guests: 4, price: 5500, type: 'Family Room', amenities: ['WiFi', 'AC', 'Extra Beds'], status: 'available' },
	{ id: 7, name: 'Room Type #7', capacity: '4 Adults', guests: 4, price: 15000, type: 'Presidential Suite', amenities: ['WiFi', 'AC', 'Butler', 'Pool'], status: 'available' },
	{ id: 5, name: 'Room Type #5', capacity: '2 Adults', guests: 2, price: 3200, type: 'Standard Room', amenities: ['WiFi', 'AC'], status: 'available' },
]

const statusLabels = {
	available: 'Available',
	booked: 'Booked',
}

const API_BASE_URL = 'http://localhost:5000'

function normalizeRoom(room) {
	const amenities = Array.isArray(room.amenities)
		? room.amenities
		: typeof room.amenities === 'string'
			? room.amenities.split(',').map((amenity) => amenity.trim()).filter(Boolean)
			: []

	return {
		...room,
		id: room.id ?? room.room_id,
		name: room.name ?? `Room ${room.room_number ?? room.room_id}`,
		type: room.type ?? room.room_type,
		guests: room.guests ?? room.capacity,
		capacity: room.capacityLabel ?? `${room.capacity} Guests`,
		price: room.price ?? Number(room.price_per_night),
		amenities,
		status: room.status ?? 'available',
	}
}

function formatPrice(price) {
	return `₱${Number(price).toLocaleString('en-PH')}`
}

function RoomCard({ room, onSelect }) {
	const isBooked = room.status === 'booked'

	return (
		<article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.10)]">
			<div className="flex h-28 items-center justify-center bg-slate-200 text-center text-[11px] tracking-[0.18em] text-slate-400 sm:h-36">
				[ {room.type} ]
			</div>
			<div className="p-3">
				<div className="flex items-start justify-between gap-2">
					<h3 className="text-sm font-bold text-slate-700">{room.name}</h3>
					<span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isBooked ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600'}`}>
						{statusLabels[room.status] ?? room.status}
					</span>
				</div>
				<p className="mt-1 text-xs text-slate-500">♧ {room.capacity}</p>
				<p className="mt-1 text-sm font-bold text-sky-700">{formatPrice(room.price)} <span className="font-normal text-slate-400">/ night</span></p>
				<div className="mt-2 flex min-h-5 flex-wrap gap-1">
					{room.amenities?.map((amenity) => (
						<span key={amenity} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{amenity}</span>
					))}
				</div>
				<button
					type="button"
					onClick={() => onSelect?.(room)}
					className="mt-3 w-full rounded-full border border-sky-500 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
					disabled={isBooked}
				>
					View Details
				</button>
			</div>
		</article>
	)
}

export function RoomsAndVenuesPage({
	rooms = defaultRooms,
	isLoading = false,
	error = null,
	onRoomSelect,
	onApplyFilters,
}) {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const checkInParam = searchParams.get('checkIn')
	const checkOutParam = searchParams.get('checkOut')
	const guestsParam = searchParams.get('guests')
	const hasDateRange = Boolean(checkInParam && checkOutParam)
	const [availableRooms, setAvailableRooms] = useState(null)
	const [databaseRooms, setDatabaseRooms] = useState(null)
	const [availabilityLoading, setAvailabilityLoading] = useState(false)
	const [roomsLoading, setRoomsLoading] = useState(false)
	const [availabilityError, setAvailabilityError] = useState(null)
	const [roomsError, setRoomsError] = useState(null)
	const [search, setSearch] = useState('')
	const [roomType, setRoomType] = useState('All Types')
	const [capacity, setCapacity] = useState('Any')
	const [availability, setAvailability] = useState('All')
	const [checkIn, setCheckIn] = useState(checkInParam ?? '')
	const [checkOut, setCheckOut] = useState(checkOutParam ?? '')
	const [sort, setSort] = useState('default')

	useEffect(() => {
		if (!hasDateRange) {
			setAvailableRooms(null)
			setAvailabilityError(null)
			return undefined
		}

		const controller = new AbortController()
		setAvailabilityLoading(true)
		setAvailabilityError(null)

		const availabilityParams = new URLSearchParams({
			check_in: checkInParam,
			check_out: checkOutParam,
		})
		if (guestsParam) availabilityParams.set('capacity', guestsParam)

		fetch(`${API_BASE_URL}/api/rooms/availability?${availabilityParams.toString()}`, { signal: controller.signal })
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Failed to load room availability.')
				setAvailableRooms((data.rooms || []).map(normalizeRoom))
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') {
					setAvailableRooms([])
					setAvailabilityError(fetchError.message)
				}
			})
			.finally(() => setAvailabilityLoading(false))

		return () => controller.abort()
	}, [checkInParam, checkOutParam, guestsParam, hasDateRange])

	useEffect(() => {
		if (hasDateRange) return undefined

		const controller = new AbortController()
		setRoomsLoading(true)
		setRoomsError(null)

		fetch(`${API_BASE_URL}/api/rooms`, { signal: controller.signal })
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Failed to load rooms.')
				setDatabaseRooms((data.rooms || []).map(normalizeRoom))
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') {
					setDatabaseRooms([])
					setRoomsError(fetchError.message)
				}
			})
			.finally(() => setRoomsLoading(false))

		return () => controller.abort()
	}, [hasDateRange])

	const displayedRooms = hasDateRange ? (availableRooms ?? []) : (databaseRooms ?? rooms)

	const roomTypes = useMemo(() => ['All Types', ...new Set(displayedRooms.map((room) => room.type))], [displayedRooms])

	const filteredRooms = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase()
		const filtered = displayedRooms.filter((room) => {
			const matchesSearch = !normalizedSearch || `${room.name} ${room.type} ${room.amenities?.join(' ')}`.toLowerCase().includes(normalizedSearch)
			const matchesType = roomType === 'All Types' || room.type === roomType
			const matchesCapacity = capacity === 'Any' || room.guests >= Number(capacity)
			const matchesAvailability = availability === 'All' || room.status === availability

			return matchesSearch && matchesType && matchesCapacity && matchesAvailability
		})

		if (sort === 'price-low') return [...filtered].sort((a, b) => a.price - b.price)
		if (sort === 'price-high') return [...filtered].sort((a, b) => b.price - a.price)
		if (sort === 'capacity') return [...filtered].sort((a, b) => b.guests - a.guests)
		return filtered
	}, [availability, capacity, displayedRooms, roomType, search, sort])

	const applyFilters = () => {
		onApplyFilters?.({ search, roomType, capacity, availability, checkIn, checkOut, sort })
	}

	const clearFilters = () => {
		setSearch('')
		setRoomType('All Types')
		setCapacity('Any')
		setAvailability('All')
		setCheckIn('')
		setCheckOut('')
		setSort('default')
		onApplyFilters?.({ search: '', roomType: 'All Types', capacity: 'Any', availability: 'All', checkIn: '', checkOut: '', sort: 'default' })
	}

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 py-8 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[1120px]">
				<header className="mb-5">
					<h1 className="text-3xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Lora' }}>Our Rooms & Venues</h1>
					<p className="mt-1 text-sm text-slate-500">Browse and filter our available accommodations</p>
				</header>

				<div className="grid gap-5 lg:grid-cols-[172px_1fr]">
					<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
						<h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">☷ Filters</h2>
						<label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Check-in
							<input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500" />
						</label>
						<label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Check-out
							<input type="date" value={checkOut} min={checkIn || undefined} onChange={(event) => setCheckOut(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500" />
						</label>
						<label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Type
							<select value={roomType} onChange={(event) => setRoomType(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500">
								{roomTypes.map((type) => <option key={type}>{type}</option>)}
							</select>
						</label>
						<label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Capacity
							<select value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500">
								<option>Any</option><option value="2">2+ Guests</option><option value="4">4+ Guests</option>
							</select>
						</label>
						<label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Availability
							<select value={availability} onChange={(event) => setAvailability(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500">
								<option value="All">All</option><option value="available">Available</option><option value="booked">Booked</option>
							</select>
						</label>
						<button type="button" onClick={applyFilters} className="mt-4 w-full rounded-xl bg-sky-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-800">Apply Filters</button>
						<button type="button" onClick={clearFilters} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Clear All</button>
					</aside>

					<section>
						<div className="mb-4 flex flex-col gap-3 sm:flex-row">
							<label className="relative flex-1">
								<span className="sr-only">Search</span>
								<span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
								<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="w-full rounded-xl border border-slate-200 bg-white px-8 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500" />
							</label>
							<div className="flex items-center gap-2">
								<label className="sr-only" htmlFor="room-sort">Sort rooms</label>
								<select id="room-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 outline-none focus:border-sky-500">
									<option value="default">Sort: Default</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="capacity">Capacity</option>
								</select>
								<span className="whitespace-nowrap text-xs text-slate-500">{filteredRooms.length} rooms found</span>
							</div>
						</div>

						{error || availabilityError || roomsError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error || availabilityError || roomsError}</p> : null}
						{isLoading || availabilityLoading || roomsLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading rooms...</p> : null}
						{!isLoading && !availabilityLoading && !roomsLoading && !error && !availabilityError && !roomsError ? (
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
								{filteredRooms.map((room) => <RoomCard key={room.id} room={room} onSelect={(selectedRoom) => {
									onRoomSelect?.(selectedRoom)
									navigate(`/rooms-and-venues-details?roomId=${encodeURIComponent(selectedRoom.id)}`)
								}} />)}
							</div>
						) : null}
						{!isLoading && !availabilityLoading && !roomsLoading && !error && !availabilityError && !roomsError && filteredRooms.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No rooms match your filters.</p> : null}
					</section>
				</div>
			</div>
		</main>
	)
}
