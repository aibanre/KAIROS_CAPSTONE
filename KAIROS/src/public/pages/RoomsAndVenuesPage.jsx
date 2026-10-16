import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { earliestBookableDate } from '../utils/dateRange.js'
import { API_URL } from '../../config/api.js'
import { getImageUrl } from '../utils/parseImages.js'
import StarRating from '../../shared/StarRating.jsx'
import { groupRooms, groupVenues } from '../utils/groupUnits.js'

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


function normalizeRoom(room) {
	const amenities = Array.isArray(room.amenities)
		? room.amenities
		: typeof room.amenities === 'string'
			? room.amenities.split(',').map((amenity) => amenity.trim()).filter(Boolean)
			: []

	return {
		...room,
		id: room.id ?? room.room_id,
		name: room.name ?? `${room.room_number ?? room.room_id}`,
		type: room.type ?? room.room_type,
		guests: room.guests ?? room.capacity,
		capacity: room.capacityLabel ?? (typeof room.capacity === 'string' && /guests?$/i.test(room.capacity.trim()) ? room.capacity : `${room.capacity} Guests`),
		price: room.price ?? Number(room.price_per_night),
		image: getImageUrl(room.images ?? room.image),
		amenities,
		rating: room.average_rating == null ? null : Number(room.average_rating),
		reviewCount: Number(room.review_count ?? 0),
		status: room.status ?? 'available',
	}
}

function normalizeVenue(venue) {
	const amenities = Array.isArray(venue.amenities)
		? venue.amenities
		: typeof venue.amenities === 'string'
			? venue.amenities.split(',').map((amenity) => amenity.trim()).filter(Boolean)
			: []

	return {
		...venue,
		id: venue.id ?? venue.venue_id,
		name: venue.name ?? venue.venue_name,
		type: venue.type ?? venue.venue_type,
		guests: venue.guests ?? venue.capacity,
		capacity: typeof venue.capacity === 'string' && /guests?$/i.test(venue.capacity.trim()) ? venue.capacity : `${venue.capacity} Guests`,
		image: getImageUrl(venue.images ?? venue.image),
		amenities,
		rating: venue.average_rating == null ? null : Number(venue.average_rating),
		reviewCount: Number(venue.review_count ?? 0),
		status: venue.status ?? 'available',
	}
}

function formatPrice(price) {
	return `₱${Number(price).toLocaleString('en-PH')}`
}

function formatShortDate(value) {
	if (!value) return ''
	return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function AmenityChips({ amenities = [] }) {
	const visibleAmenities = amenities.slice(0, 3)
	const remainingCount = Math.max(amenities.length - visibleAmenities.length, 0)

	return (
		<div className="flex min-h-[3.5rem] max-h-[3.5rem] flex-wrap content-start gap-1 overflow-hidden">
			{visibleAmenities.map((amenity) => (
				<span key={amenity} className="inline-flex whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{amenity}</span>
			))}
			{remainingCount > 0 ? <span className="inline-flex whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">+{remainingCount}</span> : null}
		</div>
	)
}

function RoomCard({ room, onSelect }) {
	const isBooked = room.status === 'booked'
	const title = room.groupName || room.type || room.name

	return (
		<article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.10)] sm:rounded-2xl">
			<div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-200 text-center text-[9px] tracking-[0.12em] text-slate-400 sm:text-[11px] sm:tracking-[0.18em]">
				{room.image ? <img src={room.image} alt={title} loading="lazy" className="h-full w-full object-cover" /> : `[ ${room.type} ]`}
				<span className={`absolute right-2 top-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px] ${isBooked ? 'bg-rose-100 text-rose-500' : 'bg-emerald-100 text-emerald-600'}`}>
					{statusLabels[room.status] ?? room.status}
				</span>
			</div>
			<div className="flex min-h-0 flex-1 flex-col p-4">
				<div className="flex-1">
					<h3 className="min-w-0 truncate text-xs font-semibold text-slate-700 sm:text-lg">{title}</h3>
				<p className="mt-1 truncate text-[10px] text-slate-500 sm:text-sm">♧ {room.capacity}</p>
				<p className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-xs">{room.unitLabel}</p>
				<div className="mt-1"><StarRating value={room.rating} reviewCount={room.reviewCount} /></div>
				<p className="mt-1 min-h-4 truncate text-xs font-bold text-sky-700 sm:min-h-6 sm:text-base">{formatPrice(room.price)} <span className="font-normal text-slate-400">/ night</span></p>
					<AmenityChips amenities={room.amenities} />
				</div>
				<div className="mt-auto">
					<button
						type="button"
						onClick={() => onSelect?.(room)}
						className="h-10 w-full rounded-lg border border-sky-500 px-1.5 text-[10px] font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:rounded-full sm:px-3 sm:text-xs"
						disabled={isBooked}
					>
						View Details
					</button>
				</div>
			</div>
		</article>
	)
}

function VenueCard({ venue, onSelect }) {
	const title = venue.groupName || venue.name
	return (
		<article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.10)] sm:rounded-2xl">
			<div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-200 text-center text-[9px] tracking-[0.12em] text-slate-400 sm:text-[11px] sm:tracking-[0.18em]">
				{venue.image ? <img src={venue.image} alt={title} loading="lazy" className="h-full w-full object-cover" /> : `[ ${venue.type} ]`}
				<span className="absolute right-2 top-2 shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 sm:px-2 sm:text-[10px]">Available</span>
			</div>
			<div className="flex min-h-0 flex-1 flex-col p-4">
				<div className="flex-1">
					<h3 className="min-w-0 truncate text-xs font-semibold text-slate-700 sm:text-lg">{title}</h3>
				<p className="mt-1 truncate text-[10px] text-slate-500 sm:text-sm">♧ Up to {venue.capacity}</p>
				<p className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-xs">{venue.unitLabel}</p>
				<div className="mt-1"><StarRating value={venue.rating} reviewCount={venue.reviewCount} /></div>
				<div className="min-h-4 truncate text-xs font-bold text-sky-700 sm:mt-1 sm:min-h-6 sm:text-base">&nbsp;</div>
					<AmenityChips amenities={venue.amenities} />
				</div>
				<div className="mt-auto">
					<button type="button" onClick={() => onSelect?.(venue)} className="h-10 w-full rounded-lg border border-sky-500 px-1.5 text-[10px] font-medium text-sky-700 transition hover:bg-sky-50 sm:rounded-full sm:px-3 sm:text-xs">
						View Details
					</button>
				</div>
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
	const minimumDate = earliestBookableDate()
	const validCheckInParam = checkInParam && checkInParam >= minimumDate ? checkInParam : ''
	const validCheckOutParam = checkOutParam && checkOutParam >= minimumDate ? checkOutParam : ''
	const guestsParam = searchParams.get('guests')
	const childrenParam = searchParams.get('children')
	const capacityParam = searchParams.get('capacity') || guestsParam
	const hasDateRange = Boolean(validCheckInParam && validCheckOutParam && validCheckOutParam > validCheckInParam)
	const [availableRooms, setAvailableRooms] = useState(null)
	const [databaseRooms, setDatabaseRooms] = useState(null)
	const [venues, setVenues] = useState([])
	const [availabilityLoading, setAvailabilityLoading] = useState(false)
	const [roomsLoading, setRoomsLoading] = useState(false)
	const [availabilityError, setAvailabilityError] = useState(null)
	const [roomsError, setRoomsError] = useState(null)
	const [venuesLoading, setVenuesLoading] = useState(false)
	const [venuesError, setVenuesError] = useState(null)
	const [search, setSearch] = useState('')
	const [roomType, setRoomType] = useState('All Types')
	const [capacity, setCapacity] = useState('Any')
	const [availability, setAvailability] = useState('All')
	const [checkIn, setCheckIn] = useState(validCheckInParam)
	const [checkOut, setCheckOut] = useState(validCheckOutParam)
	const [sort, setSort] = useState('default')
	const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
	const resultsRef = useRef(null)

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
			check_in: validCheckInParam,
			check_out: validCheckOutParam,
		})
		if (capacityParam) availabilityParams.set('capacity', capacityParam)

		fetch(`${API_URL}/api/rooms/availability?${availabilityParams.toString()}`, { signal: controller.signal, credentials: 'include' })
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
	}, [validCheckInParam, validCheckOutParam, capacityParam, childrenParam, hasDateRange])

	useEffect(() => {
		const controller = new AbortController()
		setRoomsLoading(true)
		setRoomsError(null)

		fetch(`${API_URL}/api/rooms`, { signal: controller.signal, credentials: 'include' })
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
	}, [])

	useEffect(() => {
		const controller = new AbortController()
		setVenuesLoading(true)
		setVenuesError(null)

		fetch(`${API_URL}/api/venues`, { signal: controller.signal, credentials: 'include' })
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Failed to load venues.')
				setVenues((data.venues || []).map(normalizeVenue))
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') {
					setVenues([])
					setVenuesError(fetchError.message)
				}
			})
			.finally(() => setVenuesLoading(false))

		return () => controller.abort()
	}, [])

	const availableRoomIds = hasDateRange
		? new Set((availableRooms ?? []).map((room) => Number(room.id)))
		: null
	const displayedRooms = useMemo(() => groupRooms(databaseRooms ?? rooms, availableRoomIds)
		.filter((room) => !hasDateRange || room.availableUnitCount > 0)
		.map((room) => normalizeRoom({
			...room,
			name: room.groupName,
			status: hasDateRange ? 'available' : room.unitCount > 0 ? 'available' : 'booked',
		})), [availableRoomIds, databaseRooms, hasDateRange, rooms])
	const groupedVenues = useMemo(() => groupVenues(venues)
		.filter((venue) => venue.unitCount > 0)
		.map((venue) => normalizeVenue({ ...venue, name: venue.groupName })), [venues])

	const roomTypes = useMemo(() => ['All Types', ...new Set(displayedRooms.map((room) => room.type))], [displayedRooms])

	const filteredRooms = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase()
		const filtered = displayedRooms.filter((room) => {
			const matchesSearch = !normalizedSearch || `${room.groupName} ${room.type} ${room.amenities?.join(' ')}`.toLowerCase().includes(normalizedSearch)
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

	const activeFilterCount = Number(Boolean(checkIn || checkOut)) + Number(roomType !== 'All Types') + Number(capacity !== 'Any')
	const dateSummary = checkIn && checkOut
		? `${formatShortDate(checkIn)} - ${formatShortDate(checkOut)}${capacity !== 'Any' ? ` · ${capacity} guests` : guestsParam ? ` · ${guestsParam} guests` : ''}`
		: null

	const applyFilters = () => {
		if ((checkIn && !checkOut) || (!checkIn && checkOut) || (checkIn && checkOut && checkOut <= checkIn)) {
			setAvailabilityError(checkIn < minimumDate || checkOut < minimumDate ? 'Bookings must be made at least one day in advance.' : 'Check-out must be after check-in.')
			return
		}
		const params = new URLSearchParams()
		if (checkIn) params.set('checkIn', checkIn)
		if (checkOut) params.set('checkOut', checkOut)
		if (capacity !== 'Any') params.set('capacity', capacity)
		if (guestsParam) params.set('guests', guestsParam)
		if (childrenParam) params.set('children', childrenParam)
		navigate(`/rooms-and-venues${params.toString() ? `?${params.toString()}` : ''}`)
		onApplyFilters?.({ search, roomType, capacity, availability, checkIn, checkOut, sort })
		setMobileFiltersOpen(false)
		requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
	}

	const clearFilters = () => {
		setSearch('')
		setRoomType('All Types')
		setCapacity('Any')
		setAvailability('All')
		setCheckIn('')
		setCheckOut('')
		setSort('default')
		navigate('/rooms-and-venues')
		onApplyFilters?.({ search: '', roomType: 'All Types', capacity: 'Any', availability: 'All', checkIn: '', checkOut: '', sort: 'default' })
		setMobileFiltersOpen(true)
	}

	const clearDateSummary = () => {
		setCheckIn('')
		setCheckOut('')
		const params = new URLSearchParams()
		if (capacity !== 'Any') params.set('capacity', capacity)
		if (guestsParam) params.set('guests', guestsParam)
		if (childrenParam) params.set('children', childrenParam)
		navigate(`/rooms-and-venues${params.toString() ? `?${params.toString()}` : ''}`)
	}

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 py-8 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[1120px]">
				<header className="mb-5">
					<h1 className="text-3xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Lora' }}>Our Rooms & Venues</h1>
					<p className="mt-1 text-sm text-slate-500">Browse and filter our available accommodations</p>
				</header>

				<div className="grid gap-5 lg:grid-cols-[172px_1fr]">
					<aside className="hidden h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:block">
						<h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">☷ Filters</h2>
						<label className="mt-4 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Check-in
							<input type="date" min={minimumDate} value={checkIn} onChange={(event) => setCheckIn(event.target.value < minimumDate ? '' : event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500" />
						</label>
						<label className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
							Check-out
							<input type="date" value={checkOut} min={checkIn ? (checkIn > minimumDate ? checkIn : minimumDate) : minimumDate} onChange={(event) => setCheckOut(event.target.value < minimumDate ? '' : event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500" />
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
						<button type="button" onClick={applyFilters} className="mt-4 w-full rounded-xl bg-sky-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-800">Apply Filters</button>
						<button type="button" onClick={clearFilters} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50">Clear All</button>
					</aside>

					<section ref={resultsRef} className="scroll-mt-20">
						<div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
							<label className="relative flex-1">
								<span className="sr-only">Search</span>
								<span className="pointer-events-none absolute left-3 top-2.5 text-slate-400">⌕</span>
								<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." className="h-10 w-full rounded-xl border border-slate-200 bg-white px-8 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500" />
							</label>
							<div className="flex items-center gap-2 text-xs">
								<button type="button" onClick={() => setMobileFiltersOpen((isOpen) => !isOpen)} aria-expanded={mobileFiltersOpen} aria-controls="mobile-room-filters" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 lg:hidden">
									<span aria-hidden="true">☷</span>
									<span>Filters</span>
									{activeFilterCount > 0 ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-sky-700 px-1.5 py-0.5 text-[10px] font-bold text-white">{activeFilterCount}</span> : null}
								</button>
								<label className="sr-only" htmlFor="room-sort">Sort rooms</label>
								<select id="room-sort" value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-600 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500 sm:px-3">
									<option value="default">Sort: Default</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="capacity">Capacity</option>
								</select>
								<span className="min-w-0 truncate whitespace-nowrap text-slate-500">{filteredRooms.length} rooms found</span>
							</div>
						</div>

						{dateSummary ? (
							<div className="mb-3 flex items-center gap-2 text-xs lg:hidden">
								<span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-sky-200 bg-sky-50 text-sky-700">
									<button type="button" onClick={() => setMobileFiltersOpen(true)} className="min-w-0 truncate rounded-l-full px-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{dateSummary}</button>
									<button type="button" onClick={clearDateSummary} aria-label="Clear dates" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">×</button>
								</span>
							</div>
						) : null}

						<div id="mobile-room-filters" className={`${mobileFiltersOpen ? 'block' : 'hidden'} mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:hidden`}>
							<div className="grid grid-cols-2 gap-2">
								<label htmlFor="mobile-check-in" className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
									Check-in
									<input id="mobile-check-in" type="date" min={minimumDate} value={checkIn} onChange={(event) => setCheckIn(event.target.value < minimumDate ? '' : event.target.value)} className="mt-1 h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500" />
								</label>
								<label htmlFor="mobile-check-out" className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
									Check-out
									<input id="mobile-check-out" type="date" min={checkIn ? (checkIn > minimumDate ? checkIn : minimumDate) : minimumDate} value={checkOut} onChange={(event) => setCheckOut(event.target.value < minimumDate ? '' : event.target.value)} className="mt-1 h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500" />
								</label>
							</div>
							<div className="mt-2 grid grid-cols-2 gap-2">
								<label htmlFor="mobile-room-type" className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
									Type
									<select id="mobile-room-type" value={roomType} onChange={(event) => setRoomType(event.target.value)} className="mt-1 h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500">
										{roomTypes.map((type) => <option key={type}>{type}</option>)}
									</select>
								</label>
								<label htmlFor="mobile-capacity" className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
									Capacity
									<select id="mobile-capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-1 h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm font-normal normal-case tracking-normal text-slate-500 outline-none focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500">
										<option>Any</option><option value="2">2+ Guests</option><option value="4">4+ Guests</option>
									</select>
								</label>
							</div>
							<div className="mt-2 flex gap-2">
								<button type="button" onClick={applyFilters} className="h-10 min-w-0 flex-1 rounded-xl bg-sky-700 px-3 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Apply Filters</button>
								<button type="button" onClick={clearFilters} className="h-10 shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">Clear All</button>
							</div>
						</div>

						{error || availabilityError || roomsError || venuesError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{error || availabilityError || roomsError || venuesError}</p> : null}
						{isLoading || availabilityLoading || roomsLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading rooms...</p> : null}
						{!isLoading && !availabilityLoading && !roomsLoading && !error && !availabilityError && !roomsError ? (
							<div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3">
								{filteredRooms.map((room) => <RoomCard key={room.id} room={room} onSelect={(selectedRoom) => {
									onRoomSelect?.(selectedRoom)
									const params = new URLSearchParams({ roomId: String(selectedRoom.id) })
									if (selectedRoom.grouped) params.set('group', '1')
									if (checkInParam) params.set('checkIn', checkInParam)
									if (checkOutParam) params.set('checkOut', checkOutParam)
									if (guestsParam) params.set('guests', guestsParam)
									if (childrenParam) params.set('children', childrenParam)
									navigate(`/rooms-and-venues-details?${params.toString()}`)
								}} />)}
							</div>
						) : null}
						{!isLoading && !availabilityLoading && !roomsLoading && !error && !availabilityError && !roomsError && filteredRooms.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No rooms match your filters.</p> : null}

						<section className="mt-8">
							<div className="mb-4 flex items-center justify-between">
								<h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>Available Venues</h2>
								<span className="text-xs text-slate-500">{venues.length} venues found</span>
							</div>
							{venuesLoading ? <p className="p-8 text-center text-sm text-slate-500">Loading venues...</p> : null}
							{!venuesLoading && !venuesError && groupedVenues.length > 0 ? (
								<div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3">
									{groupedVenues.map((venue) => <VenueCard key={venue.id} venue={venue} onSelect={(selectedVenue) => navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(selectedVenue.id)}${selectedVenue.booking_mode === 'day_use' ? '&group=1' : ''}`)} />)}
								</div>
							) : null}
							{!venuesLoading && !venuesError && groupedVenues.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No venues are currently available.</p> : null}
						</section>
					</section>
				</div>
			</div>
		</main>
	)
}
