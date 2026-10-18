import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_URL } from '../../config/api.js'
import { getImageUrl } from '../utils/parseImages.js'
import StarRating from '../../shared/StarRating.jsx'
import VenueSelectionCard from '../components/VenueSelectionCard'
import { addDays, earliestBookableDate, rangeHasBooked, selectRangeDate, isValidDateKey } from '../utils/dateRange.js'
import { ensureReservationVisitor } from '../../shared/api/reservationVisitor.js'
import ReservationLimitNotice from '../../shared/ReservationLimitNotice.jsx'

const defaultRoom = {
	id: 1,
	name: 'Room Type #1',
	type: 'Deluxe Ocean View Room',
	pricePerNight: 4500,
	capacity: 2,
	capacityLabel: '2 Guests',
	capacity: '2 Adults',
	rating: null,
	reviewCount: 0,
	description: 'Experience stunning panoramic views of the ocean from your private balcony. This elegantly appointed room features modern furnishings, premium bedding, and all the comforts of home with a touch of tropical luxury.',
	amenities: ['Daily Housekeeping', 'Flat Screen TV', 'Air Conditioning', 'Room Service (24/7)'],
	gallery: [
		{ label: '[ Main Room Photo — Gallery View ]' },
		{ label: '[ Photo 2 ]' },
		{ label: '[ Photo 3 ]' },
		{ label: '[ Photo 4 ]' },
		{ label: '[ Photo 5 ]' },
	],
}

const defaultBookedDates = ['2025-07-04', '2025-07-05', '2025-07-06', '2025-07-13', '2025-07-14', '2025-07-22', '2025-07-23']
const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

async function readJsonResponse(response, fallbackMessage) {
	const contentType = response.headers.get('content-type') || ''
	const data = contentType.includes('application/json')
		? await response.json().catch(() => ({}))
		: {}
	if (!response.ok) {
		const error = new Error(data.error || data.message || fallbackMessage)
		error.status = response.status
		error.existingHolds = Array.isArray(data.existing_holds) ? data.existing_holds : []
		throw error
	}
	return data
}

function dateKey(year, month, day) {
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isPastDate(dateKey) {
	return dateKey < earliestBookableDate()
}

function todayKey() { return earliestBookableDate() }

function CompactCalendar({
	roomId,
	venueId,
	grouped = false,
	bookedDates: initialBookedDates,
	selectedDate,
	onDateSelect,
	checkIn,
	checkOut,
	onRangeSelect,
	onBookedDatesChange,
	refreshToken,
}) {
	const [viewDate, setViewDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
	const [bookedDates, setBookedDates] = useState(initialBookedDates)
	const bookedDatesRef = useRef(new Set(initialBookedDates))
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const year = viewDate.getFullYear()
	const month = viewDate.getMonth()
	const firstDay = new Date(year, month, 1).getDay()
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const booked = new Set(bookedDates)

	useEffect(() => {
		if (!roomId && !venueId) return undefined

		const controller = new AbortController()
		setLoading(true)
		setError('')

		const endpoint = roomId
			? `${API_URL}/api/rooms/${encodeURIComponent(roomId)}/booked-dates`
			: `${API_URL}/api/venues/${encodeURIComponent(venueId)}/booked-dates`

		const months = [{ year, month: month + 1 }]
		if (roomId && checkIn) {
			const nextMonth = new Date(year, month + 1, 1)
			months.push({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 })
		}
		Promise.all(months.map(({ year: requestYear, month: requestMonth }) => fetch(
			`${endpoint}?year=${requestYear}&month=${requestMonth}${grouped ? '&group=1' : ''}`,
			{ signal: controller.signal, credentials: 'include' }
		)))
			.then((responses) => Promise.all(responses.map((response) => readJsonResponse(response, 'Failed to load availability.'))))
			.then((data) => {
				const dates = data.flatMap((response) => response.bookedDates || response.booked_dates || [])
				const mergedDates = roomId
					? Array.from(new Set([...bookedDatesRef.current, ...dates]))
					: dates
				bookedDatesRef.current = new Set(mergedDates)
				setBookedDates(mergedDates)
				onBookedDatesChange?.(new Set(mergedDates))
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') {
					setBookedDates([])
					setError('Could not load availability.')
				}
			})
			.finally(() => setLoading(false))

		return () => controller.abort()
	}, [roomId, venueId, grouped, year, month, refreshToken])
	const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
		if (index < firstDay) return null
		return index - firstDay + 1
	})

	const moveMonth = (delta) => setViewDate(new Date(year, month + delta, 1))

	const handleDateSelect = (key, disabled) => {
		if (disabled) return

		if (roomId) {
			const [nextCheckIn, nextCheckOut] = selectRangeDate(key, checkIn, checkOut)
			onRangeSelect?.(nextCheckIn, nextCheckOut)
			return
		}

		onDateSelect?.(key)
	}

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4">
			<div className="mb-4 flex items-center justify-between gap-2 whitespace-nowrap text-xs text-slate-400">
				<button type="button" onClick={() => moveMonth(-1)} className="shrink-0 hover:text-slate-700">‹ Prev</button>
				<strong className="min-w-0 whitespace-nowrap text-center text-sm text-slate-700">{viewDate.toLocaleString('en-US', { month: 'long' })} {year}{loading ? ' …' : ''}</strong>
				<button type="button" onClick={() => moveMonth(1)} className="shrink-0 hover:text-slate-700">Next ›</button>
			</div>
			<div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
				{weekdays.map((day, index) => <div key={`${day}-${index}`} className="py-1 font-semibold">{day}</div>)}
				{cells.map((day, index) => {
					if (!day) return <div key={`empty-${index}`} className="h-9" />
					const key = dateKey(year, month, day)
					const isBooked = booked.has(key)
					const isPast = isPastDate(key)
					const checkoutOnly = Boolean(roomId && checkIn && !checkOut && isBooked && key > checkIn && !rangeHasBooked(checkIn, key, booked))
					const disabled = isPast || (isBooked && !checkoutOnly)
					const isSelected = selectedDate === key
					const isCheckIn = checkIn === key
					const isCheckOut = checkOut === key
					const isInRange = Boolean(checkIn && checkOut && key > checkIn && key < checkOut)

					return (
						<button
							key={key}
							type="button"
							disabled={disabled}
							onClick={() => handleDateSelect(key, disabled)}
							className={`mx-auto h-9 w-full rounded text-[10px] ${disabled ? (isBooked ? 'cursor-not-allowed bg-red-100 text-red-600' : 'cursor-not-allowed text-slate-300') : checkoutOnly ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-300' : isCheckIn || isCheckOut || isSelected ? 'bg-sky-100 text-slate-700 ring-2 ring-sky-500 ring-offset-1' : isInRange ? 'bg-sky-50 text-slate-700' : 'text-slate-600 hover:bg-slate-100'}`}
							aria-label={`${key} ${checkoutOnly ? 'checkout only' : isBooked ? 'unavailable' : isPast ? 'past date' : 'available'}`}
						>
							{day}
						</button>
					)
				})}
			</div>
			{error ? <p className="mt-2 text-[10px] text-red-600" role="alert">{error}</p> : null}
			<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
				<span><i className="mr-1 inline-block h-2 w-2 rounded bg-red-100" />Unavailable</span>
				{roomId && checkIn && !checkOut ? <span><i className="mr-1 inline-block h-2 w-2 rounded bg-amber-50 ring-1 ring-amber-300" />Checkout only</span> : null}
				<span><i className="mr-1 inline-block h-2 w-2 rounded border border-slate-200" />Available</span>
				<span><i className="mr-1 inline-block h-2 w-2 rounded bg-sky-100" />Selected</span>
			</div>
		</div>
	)
}

export function RoomsAndVenuesDetailsPage({
	room = defaultRoom,
	bookedDates = defaultBookedDates,
	onReserve,
}) {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const roomId = searchParams.get('roomId')
	const venueId = searchParams.get('venueId')
	const grouped = searchParams.get('group') === '1'
	const selectionMessage = searchParams.get('message')
	const [roomDetails, setRoomDetails] = useState(null)
	const [venueDetails, setVenueDetails] = useState(null)
	const [roomLoading, setRoomLoading] = useState(Boolean(roomId || venueId))
	const [roomError, setRoomError] = useState(null)
	const [reservationLimitHolds, setReservationLimitHolds] = useState([])
	const [activeImage, setActiveImage] = useState(0)
	const initialCheckIn = searchParams.get('checkIn') || ''
	const initialCheckOut = searchParams.get('checkOut') || ''
	const [checkIn, setCheckIn] = useState(() => isValidDateKey(initialCheckIn) ? initialCheckIn : '')
	const [checkOut, setCheckOut] = useState(() => isValidDateKey(initialCheckOut) ? initialCheckOut : '')
	const [guests, setGuests] = useState(() => Number(searchParams.get('guests')) || 2)
	const [children, setChildren] = useState(() => Number(searchParams.get('children')) || 0)
	const [selectedDate, setSelectedDate] = useState('')
	const [venuePackages, setVenuePackages] = useState([])
	const [selectedPackageId, setSelectedPackageId] = useState(() => searchParams.get('package_id') || '')
	const [loadedBookedDates, setLoadedBookedDates] = useState(() => new Set(bookedDates))
	const [rangeError, setRangeError] = useState('')
	const [isHolding, setIsHolding] = useState(false)
	const [availabilityRefresh, setAvailabilityRefresh] = useState(0)
	const currentRoom = roomDetails || room
	const currentVenue = venueDetails
	const isVenue = Boolean(venueId)
	const currentItem = isVenue ? currentVenue : currentRoom
	const rangeHasInvalidNights = rangeHasBooked(checkIn, checkOut, loadedBookedDates)
	const capacityError = Number(currentRoom.capacity) > 0 && guests > Number(currentRoom.capacity)
		? 'The number of adults exceeds this room capacity.'
		: ''
	const rangeIsInvalid = !checkIn || !checkOut || checkIn < todayKey() || checkOut <= checkIn || rangeHasInvalidNights || Boolean(capacityError)

	useEffect(() => {
		if (!roomId || !initialCheckIn || !initialCheckOut) return
		if (!isValidDateKey(initialCheckIn) || !isValidDateKey(initialCheckOut) || initialCheckIn < todayKey() || initialCheckOut <= initialCheckIn) {
			setCheckIn('')
			setCheckOut('')
			setRangeError('The selected dates are not valid. Please choose a future check-in and check-out.')
		} else if (rangeHasBooked(initialCheckIn, initialCheckOut, loadedBookedDates)) {
			setCheckIn('')
			setCheckOut('')
			setRangeError('The selected dates include already-booked nights.')
		}
	}, [roomId, initialCheckIn, initialCheckOut, loadedBookedDates])

	useEffect(() => {
		if (!roomId && !venueId) return undefined

		const controller = new AbortController()
		setRoomLoading(true)
		setRoomError(null)

		const endpoint = isVenue
			? `${API_URL}/api/venues/${encodeURIComponent(venueId)}${grouped ? '?group=1' : ''}`
			: `${API_URL}/api/rooms/${encodeURIComponent(roomId)}`

		fetch(endpoint, { signal: controller.signal, credentials: 'include' })
			.then((response) => readJsonResponse(response, `Failed to load ${isVenue ? 'venue' : 'room'} details.`))
			.then((data) => {
				if (isVenue) {
					const databaseVenue = data.venue
					setVenueDetails({
						id: databaseVenue.venue_id,
						venue_id: databaseVenue.venue_id,
						name: databaseVenue.venue_name,
						type: databaseVenue.venue_type,
						capacity: Number(databaseVenue.capacity),
						description: databaseVenue.description,
						amenities: typeof databaseVenue.amenities === 'string' ? databaseVenue.amenities.split(',').map((amenity) => amenity.trim()).filter(Boolean) : [],
						gallery: [{ url: getImageUrl(databaseVenue.images), label: `[ ${databaseVenue.venue_type} ]` }],
						booking_mode: databaseVenue.booking_mode,
						start_time: databaseVenue.start_time,
						end_time: databaseVenue.end_time,
						earliest_start: databaseVenue.earliest_start,
						latest_end: databaseVenue.latest_end,
						slot_step_minutes: databaseVenue.slot_step_minutes,
						buffer_minutes: databaseVenue.buffer_minutes,
						flat_price: Number(databaseVenue.flat_price || 0),
						rating: databaseVenue.average_rating == null ? null : Number(databaseVenue.average_rating),
						reviewCount: Number(databaseVenue.review_count ?? 0),
					})
					fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/packages`, { credentials: 'include' })
						.then((response) => readJsonResponse(response, 'Failed to load venue packages.'))
						.then((packageData) => {
							const nextPackages = packageData.packages || []
							setVenuePackages(nextPackages)
							setSelectedPackageId((current) => (
								nextPackages.some((item) => String(item.package_id) === String(current))
									? current
									: String(nextPackages[0]?.package_id || '')
							))
						})
						.catch((packageError) => setRoomError(packageError.message))
					return
				}
				const databaseRoom = data.room
				setRoomDetails({
					...databaseRoom,
					id: databaseRoom.room_id,
					name: databaseRoom.room_number,
					type: databaseRoom.room_type,
					pricePerNight: Number(databaseRoom.price_per_night),
					capacity: Number(databaseRoom.capacity),
					capacityLabel: `${databaseRoom.capacity} Guests`,
					description: databaseRoom.description,
					amenities: typeof databaseRoom.amenities === 'string' ? databaseRoom.amenities.split(',').map((amenity) => amenity.trim()).filter(Boolean) : [],
						rating: databaseRoom.average_rating == null ? null : Number(databaseRoom.average_rating),
						reviewCount: Number(databaseRoom.review_count ?? 0),
						gallery: [{ url: getImageUrl(databaseRoom.images), label: `[ ${databaseRoom.room_type} ]` }],
				})
				setGuests((current) => Math.min(Math.max(1, current), Number(databaseRoom.capacity)))
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') setRoomError(fetchError.message)
			})
			.finally(() => setRoomLoading(false))

		return () => controller.abort()
	}, [roomId, venueId, isVenue, grouped])

	useEffect(() => {
		if (venueId) setSelectedDate('')
	}, [venueId])


	const nights = useMemo(() => {
		if (!checkIn || !checkOut) return 0
		const difference = new Date(checkOut) - new Date(checkIn)
		return Math.max(1, Math.ceil(difference / 86400000))
	}, [checkIn, checkOut])

	const roomTotal = currentRoom.pricePerNight * nights
	const total = roomTotal

	const reserve = async (event) => {
		event.preventDefault()
		if (isHolding) return
		if (rangeIsInvalid) {
			setRoomError(capacityError || (rangeHasInvalidNights
				? 'Selected dates include already-booked nights.'
				: 'Choose a valid check-in and check-out date.'))
			return
		}
		setRoomError(null)
		setReservationLimitHolds([])
		setIsHolding(true)
		try {
			await ensureReservationVisitor()
			const previous = JSON.parse(sessionStorage.getItem('kairos_reservation_hold') || 'null')
			if (previous?.reservation_id) {
				await fetch(`${API_URL}/api/reservations/${encodeURIComponent(previous.reservation_id)}/hold`, {
					method: 'DELETE',
					credentials: 'include',
					headers: previous.access_token ? { 'X-Reservation-Token': previous.access_token } : undefined,
					keepalive: true,
				})
				sessionStorage.removeItem('kairos_reservation_hold')
			}
			const response = await fetch(`${API_URL}/api/reservations/hold`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					room_id: Number(currentRoom.id),
					check_in: checkIn,
					check_out: checkOut,
					num_guests: guests,
					children,
					...(grouped ? { resolve_group: true } : {}),
				}),
			})
			const data = await readJsonResponse(response, 'Could not hold the selected dates.')
			data.server_time_received_at = Date.now()
			const assignedRoomId = Number(data.room_id || currentRoom.id)
			sessionStorage.setItem('kairos_reservation_hold', JSON.stringify({
				...data,
				check_in: checkIn,
				check_out: checkOut,
				adults: Number(guests),
				children: Number(children),
				room_id: assignedRoomId,
			}))
			const params = new URLSearchParams({
				check_in: checkIn, check_out: checkOut, guests: String(guests), children: String(children),
				reservation_id: String(data.reservation_id),
			})
			navigate(`/book/room/${assignedRoomId}?${params.toString()}`, { state: data })
		} catch (error) {
			if (error.status === 409) {
				setAvailabilityRefresh((value) => value + 1)
				setRoomError(error.message || 'These dates were just taken. Please choose other dates.')
			} else if (error.status === 429) {
				setRoomError('There is a limit on reservations in progress. Continue an existing hold below or try again later.')
				setReservationLimitHolds(error.existingHolds || [])
			} else {
				setRoomError(error.message)
			}
		} finally {
			setIsHolding(false)
		}
	}

	const reserveVenue = async ({ eventDate, startTime, pax, extraHours, packageId }) => {
		if (isHolding) return
		if (!currentVenue?.venue_id) {
			setRoomError('Venue details are still loading. Please try again.')
			return
		}
		if (!eventDate) {
			setRoomError('Choose an event date before planning your booking.')
			return
		}
		setRoomError(null)
		setReservationLimitHolds([])
		setIsHolding(true)
		try {
			await ensureReservationVisitor()
			const effectivePackage = packageId || selectedPackageId || venuePackages[0]?.package_id
			const selectedPackage = venuePackages.find((item) => String(item.package_id) === String(effectivePackage))
			const effectiveStartTime = startTime || String(currentVenue.start_time || currentVenue.earliest_start || '08:00').slice(0, 5)
			const effectivePax = Number(pax || selectedPackage?.min_pax || 1)
			if (currentVenue.booking_mode === 'packaged' && !effectivePackage) {
				throw new Error('A venue package is required for Conference Hall bookings.')
			}
			const previous = JSON.parse(sessionStorage.getItem('kairos_reservation_hold') || 'null')
			if (previous?.reservation_id) {
				await fetch(`${API_URL}/api/reservations/${encodeURIComponent(previous.reservation_id)}/hold`, {
					method: 'DELETE', credentials: 'include', keepalive: true,
					headers: previous.access_token ? { 'X-Reservation-Token': previous.access_token } : undefined,
				})
				sessionStorage.removeItem('kairos_reservation_hold')
			}
			const response = await fetch(`${API_URL}/api/reservations/hold`, {
				method: 'POST', credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					venue_id: Number(currentVenue.venue_id), event_date: eventDate, start_time: effectiveStartTime,
					package_id: effectivePackage || undefined, pax: effectivePax, extra_hours: Number(extraHours || 0),
					...(grouped && currentVenue.booking_mode === 'day_use' ? { resolve_group: true } : {}),
				}),
			})
			const data = await readJsonResponse(response, 'Could not hold the selected date.')
			data.server_time_received_at = Date.now()
			if (!data?.reservation_id) throw new Error('The venue hold was not created. Please try again.')
			const assignedVenueId = Number(data.venue_id || currentVenue.venue_id)
			sessionStorage.setItem('kairos_reservation_hold', JSON.stringify({
				...data,
				event_date: eventDate,
				start_time: effectiveStartTime,
				pax: effectivePax,
				venue_id: assignedVenueId,
				package_id: effectivePackage || null,
			}))
			const params = new URLSearchParams({ event_date: eventDate, start_time: effectiveStartTime, pax: String(effectivePax), extra_hours: String(extraHours || 0), reservation_id: String(data.reservation_id) })
			if (effectivePackage) params.set('package_id', String(effectivePackage))
			navigate(`/book/venue/${assignedVenueId}?${params.toString()}`, { state: data })
		} catch (error) {
			if (error.status === 409) {
				setAvailabilityRefresh((value) => value + 1)
				setRoomError(error.message || 'These dates were just taken. Please choose another time.')
			} else if (error.status === 429) {
				setRoomError('There is a limit on reservations in progress. Continue an existing hold below or try again later.')
				setReservationLimitHolds(error.existingHolds || [])
			} else {
				setRoomError(error.message)
			}
		} finally {
			setIsHolding(false)
		}
	}

	const updateRange = (nextCheckIn, nextCheckOut) => {
		if (nextCheckOut && rangeHasBooked(nextCheckIn, nextCheckOut, loadedBookedDates)) {
			setCheckIn(nextCheckIn)
			setCheckOut('')
			setRangeError('Selected dates include already-booked nights.')
			return
		}

		setRangeError('')
		if (nextCheckOut && nextCheckIn && nextCheckOut <= nextCheckIn) {
			setCheckIn(nextCheckIn)
			setCheckOut('')
			return
		}
		setCheckIn(nextCheckIn)
		setCheckOut(nextCheckOut || '')
	}

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[1120px]">
				{roomLoading ? <p className="rounded-xl bg-white p-6 text-sm text-slate-500">Loading {isVenue ? 'venue' : 'room'} details...</p> : null}
				{roomError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600" role="alert">{roomError}</p> : null}
				<ReservationLimitNotice holds={reservationLimitHolds} />
				{selectionMessage ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600" role="alert">{selectionMessage}</p> : null}
				<p className="mb-4 text-[11px] text-slate-400">{isVenue ? 'Venues' : 'Rooms'} / {currentItem?.name}</p>
				<div className="grid gap-5 lg:grid-cols-[1fr_230px]">
					<div className="space-y-5">
						<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
							<div className="flex h-48 items-center justify-center bg-slate-200 text-center text-[11px] tracking-[0.16em] text-slate-400 sm:h-64">
								{currentItem?.gallery?.[activeImage]?.url ? <img src={currentItem.gallery[activeImage].url} alt={currentItem.type} className="h-full w-full object-cover" /> : currentItem?.gallery?.[activeImage]?.label}
							</div>
							<div className="grid grid-cols-4 gap-1 p-1">
								{currentItem?.gallery?.slice(1, 5).map((image, index) => (
									<button key={image.label ?? image.url} type="button" onClick={() => setActiveImage(index + 1)} className={`flex h-12 items-center justify-center overflow-hidden rounded-lg bg-slate-200 text-[9px] text-slate-400 ${activeImage === index + 1 ? 'ring-2 ring-sky-500' : ''}`}>
										{image.url ? <img src={image.url} alt={`${currentItem.type} view ${index + 2}`} className="h-full w-full object-cover" /> : image.label}
									</button>
								))}
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
							<h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>{currentItem?.name}</h1>
							<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
								<span>♧ {currentItem?.capacityLabel || `${currentItem?.capacity} Guests`}</span><span>◉ {isVenue ? currentItem?.type : 'Ocean View'}</span><StarRating value={currentItem?.rating} reviewCount={currentItem?.reviewCount} showReviewLabel /><span>◷ Check-in 2 PM / Check-out 12 PM</span>
							</div>
							<p className="mt-4 text-xs leading-5 text-slate-600">{currentItem?.description}</p>
						</section>


						{currentItem?.amenities?.length ? <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
							<h2 className="text-sm font-bold text-slate-700">{isVenue ? 'Venue Amenities' : 'Room Amenities'}</h2>
							<ul className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
								{currentItem?.amenities?.map((amenity) => <li key={amenity} className="before:mr-2 before:text-sky-500 before:content-['✓']">{amenity}</li>)}
							</ul>
						</section> : null}

						<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
							<h2 className="mb-3 text-sm font-bold text-slate-700">Availability Calendar</h2>
							<CompactCalendar
								roomId={roomId}
								venueId={venueId}
								grouped={grouped}
								bookedDates={bookedDates}
								selectedDate={selectedDate}
								onDateSelect={setSelectedDate}
								checkIn={checkIn}
								checkOut={checkOut}
								onRangeSelect={(nextCheckIn, nextCheckOut) => {
									updateRange(nextCheckIn, nextCheckOut)
								}}
								onBookedDatesChange={setLoadedBookedDates}
								refreshToken={availabilityRefresh}
							/>
						</section>
					</div>

					{isVenue && currentVenue ? <VenueSelectionCard
						venue={currentVenue}
						selectedDate={selectedDate}
						onSelectDate={setSelectedDate}
						onReserve={reserveVenue}
						packages={venuePackages}
						selectedPackageId={selectedPackageId}
						onPackageChange={(item) => setSelectedPackageId(String(item.package_id))}
						bookedDates={loadedBookedDates}
						isHolding={isHolding}
					/> : <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
						<>
						<div className="border-b border-slate-100 pb-4">
							<div className="text-xl font-bold text-sky-700">{formatPrice(currentRoom.pricePerNight)} <span className="text-xs font-normal text-slate-400">/ night</span></div>
							<span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Available</span>
						</div>
						<form onSubmit={reserve} className="mt-4 space-y-3">
							<label className="block text-[10px] font-semibold uppercase text-slate-500">Check-in<input required type="date" min={todayKey()} value={checkIn} onChange={(event) => updateRange(event.target.value < todayKey() ? '' : event.target.value, checkOut)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-sky-500" /></label>
							<label className="block text-[10px] font-semibold uppercase text-slate-500">Check-out<input required type="date" min={checkIn ? addDays(checkIn, 1) : todayKey()} value={checkOut} onChange={(event) => updateRange(checkIn, event.target.value < todayKey() ? '' : event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-sky-500" /></label>
							<div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-slate-600">
								<div className="flex justify-between"><span>{formatPrice(currentRoom.pricePerNight)} × {nights} nights</span><span>{formatPrice(roomTotal)}</span></div>
								<div className="mt-3 flex justify-between border-t border-sky-100 pt-2 font-bold text-slate-700"><span>Total</span><span>{formatPrice(total)}</span></div>
							</div>
							{rangeError || rangeHasInvalidNights ? <p className="text-xs text-rose-600" role="alert">{rangeError || 'Selected dates include already-booked nights.'}</p> : null}
							{capacityError ? <p className="text-xs text-rose-600" role="alert">{capacityError}</p> : null}
							<button type="submit" disabled={rangeIsInvalid || isHolding} className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isHolding ? 'Holding dates...' : 'Reserve Now'}</button>
							<p className="text-center text-[10px] text-slate-400">No charge until check-in confirmation</p>
						</form>
						</>
					</aside>}
				</div>
			</div>
		</main>
	)
}

function formatPrice(price) {
	return `₱${Number(price).toLocaleString('en-PH')}`
}
