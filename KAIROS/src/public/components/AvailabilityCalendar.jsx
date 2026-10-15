import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../../config/api.js'
import { earliestBookableDate, rangeHasBooked, selectRangeDate } from '../utils/dateRange.js'
import { Reveal } from './Reveal.jsx'

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const monthNames = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]


function createDateKey(year, month, day) {
	const monthValue = String(month + 1).padStart(2, '0')
	const dayValue = String(day).padStart(2, '0')

	return `${year}-${monthValue}-${dayValue}`
}

function buildCalendarCells(year, month) {
	const firstDay = new Date(year, month, 1).getDay()
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const cells = []

	for (let index = 0; index < firstDay; index += 1) {
		cells.push({ type: 'empty', key: `empty-${index}` })
	}

	for (let day = 1; day <= daysInMonth; day += 1) {
		cells.push({
			type: 'day',
			day,
			key: createDateKey(year, month, day),
		})
	}

	return cells
}

/**
 * AvailabilityCalendar
 *
 * Props:
 *  - roomId (required): which room's bookings to display
 *  - checkIn / checkOut: currently selected range (controlled from parent)
 *  - onRangeSelect(checkIn, checkOut): called whenever the range changes
 *  - initialYear / initialMonth: which month to open the calendar on
 */
export function AvailabilityCalendar({
	roomId,
	venueId,
	checkIn,
	checkOut,
	onRangeSelect,
	selectionMode = 'range',
	selectedDate,
	onSelectDate,
	initialYear = Number(earliestBookableDate().slice(0, 4)),
	action,
	initialMonth = Number(earliestBookableDate().slice(5, 7)) - 1,
	compact = false,
}) {
	const [viewDate, setViewDate] = useState(new Date(initialYear, initialMonth, 1))
	const [bookedDates, setBookedDates] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const minimumDate = earliestBookableDate()
	const currentMonth = new Date(Number(minimumDate.slice(0, 4)), Number(minimumDate.slice(5, 7)) - 1, 1)

	const year = viewDate.getFullYear()
	const month = viewDate.getMonth()

	// Fetch booked dates from the backend whenever the room or viewed month changes.
	// The landing calendar uses resort-wide bookings; detail pages use one room.
	useEffect(() => {
		const controller = new AbortController()
		const endpoint = roomId
			? `${API_URL}/api/rooms/${encodeURIComponent(roomId)}/booked-dates`
			: venueId
				? `${API_URL}/api/venues/${encodeURIComponent(venueId)}/booked-dates`
			: `${API_URL}/api/availability/booked-dates`

		async function fetchBookedDates() {
			setLoading(true)
			setError(null)

			try {
				const months = [{ year, month: month + 1 }]
				if (roomId && checkIn) {
					months.push({ year: new Date(year, month + 1, 1).getFullYear(), month: new Date(year, month + 1, 1).getMonth() + 1 })
				}
				const responses = await Promise.all(months.map(({ year: requestYear, month: requestMonth }) => fetch(
					`${endpoint}?year=${requestYear}&month=${requestMonth}`,
					{ signal: controller.signal }
				)))
				const data = await Promise.all(responses.map(async (response) => {
					const responseData = await response.json()
					if (!response.ok) throw new Error(responseData.error || 'Failed to load availability.')
					return responseData
				}))
				const dates = data.flatMap((responseData) => responseData.bookedDates || responseData.booked_dates || [])
				setBookedDates((current) => roomId ? Array.from(new Set([...current, ...dates])) : dates)
			} catch (err) {
				if (err.name !== 'AbortError') {
					setError(err.message || 'Could not load availability. Please try again.')
					setBookedDates([])
				}
			} finally {
				setLoading(false)
			}
		}

		fetchBookedDates()

		return () => controller.abort()
	}, [roomId, venueId, year, month, checkIn])

	const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates])
	const calendarCells = useMemo(() => buildCalendarCells(year, month), [year, month])

	const changeMonth = (delta) => {
		setViewDate(new Date(year, month + delta, 1))
	}

	// Range-select logic: first click sets check-in, second click sets check-out.
	// Clicking before an existing check-in restarts the selection.
	const handleDateClick = (dateKey, disabled) => {
		if (disabled) return

		if (selectionMode === 'single') {
			onSelectDate?.(dateKey)
			return
		}

		const [nextCheckIn, nextCheckOut] = selectRangeDate(dateKey, checkIn, checkOut)
		if (nextCheckOut && rangeHasBooked(nextCheckIn, nextCheckOut, bookedSet)) return
		onRangeSelect?.(nextCheckIn, nextCheckOut || null)
	}

	const isDateInSelectedRange = (dateKey) => {
		if (!checkIn || !checkOut) return false
		return dateKey > checkIn && dateKey < checkOut
	}

	return (
		<section className={compact ? 'w-full' : 'scroll-mt-20 w-full bg-slate-50 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20'}>
				<div className={compact ? 'w-full' : 'mx-auto max-w-7xl'}>
				<Reveal as="header" className="mb-8 text-slate-800">
					<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Plan your stay</div>
					<h2 className={compact ? 'text-base font-bold tracking-tight' : "font-['Lora'] text-3xl font-bold tracking-tight sm:text-4xl"}>
						{compact ? 'Select event date' : 'Availability Calendar'}
					</h2>
					<p className="mt-2 text-sm text-slate-500 sm:text-base">
						{selectionMode === 'single'
							? 'Choose an available date'
							: checkIn && !checkOut
							? 'Select your check-out date'
							: 'Select your check-in date'}
					</p>
					<p className="mt-1 text-xs font-medium text-slate-500">Reservations must be made at least one day in advance.</p>
					{error && <p className="mt-2 text-sm text-red-500">{error}</p>}
				</Reveal>

				<div className="flex justify-center">
					<div className={compact ? 'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 sm:p-4' : 'w-full max-w-[590px] rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:p-8'}>
						<div className="mb-5 flex items-center justify-between gap-2 text-sm font-medium text-slate-500">
							<button
								type="button"
								onClick={() => changeMonth(-1)}
								disabled={year === currentMonth.getFullYear() && month === currentMonth.getMonth()}
								className={`inline-flex min-h-11 items-center justify-center rounded-lg transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${compact ? 'min-w-[52px]' : 'min-w-[68px]'}`}
							>
								<span className="mr-1">‹</span>Prev
							</button>
							<div className="min-w-0 text-center text-sm font-semibold text-slate-800 sm:text-xl">
								{monthNames[month]} {year} {loading && <span className="text-xs text-slate-400">(loading…)</span>}
							</div>
							<button
								type="button"
								onClick={() => changeMonth(1)}
								className={`inline-flex min-h-11 items-center justify-center rounded-lg transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${compact ? 'min-w-[52px]' : 'min-w-[68px]'}`}
							>
								Next<span className="ml-1">›</span>
							</button>
						</div>

						<div key={`${year}-${month}`} className="motion-safe:animate-calendar-fade grid grid-cols-7 gap-y-1 text-center text-xs font-medium text-slate-500 sm:gap-y-2 sm:text-sm">
							{weekdayLabels.map((label) => (
								<div key={label} className="py-2">
									{label}
								</div>
							))}

							{calendarCells.map((cell) => {
								if (cell.type === 'empty') {
									return <div key={cell.key} className="h-10 sm:h-11" />
								}

								const past = cell.key < minimumDate
								const booked = bookedSet.has(cell.key)
								const checkoutOnly = Boolean(checkIn && !checkOut && booked && cell.key > checkIn && !rangeHasBooked(checkIn, cell.key, bookedSet))
								const disabled = past || (booked && !checkoutOnly)

								const isCheckIn = checkIn === cell.key
								const isCheckOut = checkOut === cell.key
								const isSelected = selectionMode === 'single' && selectedDate === cell.key
								const inRange = isDateInSelectedRange(cell.key)

								return (
									<button
										key={cell.key}
										type="button"
										onClick={() => handleDateClick(cell.key, disabled)}
										disabled={disabled}
										className={[
											'mx-auto flex h-10 w-full max-w-11 items-center justify-center rounded-full text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1',
											disabled
												? past
													? 'text-slate-300 cursor-not-allowed'
													: booked
													? 'bg-red-100 text-red-600 cursor-not-allowed'
													: 'text-slate-300 cursor-not-allowed'
												: 'text-slate-700 hover:bg-slate-100',
											inRange ? 'bg-sky-50' : '',
											isCheckIn || isCheckOut || isSelected ? 'ring-2 ring-sky-500 ring-offset-2 bg-sky-100 motion-safe:animate-selection-pulse' : '',
										].join(' ')}
										aria-label={`${monthNames[month]} ${cell.day}, ${past ? 'past date' : checkoutOnly ? 'checkout only' : booked ? 'fully booked' : 'available'}`}
									>
										{cell.day}
									</button>
								)
							})}
						</div>

						<div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500 sm:gap-6 sm:text-sm">
							<div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded bg-red-100" />
								<span>Fully booked</span>
							</div>
							{roomId && checkIn && !checkOut ? <div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded border border-amber-300 bg-amber-50" />
								<span>Checkout only</span>
							</div> : null}
							<div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded border border-sky-300 bg-sky-50" />
								<span>{selectionMode === 'single' ? 'Selected date' : 'Selected range'}</span>
							</div>
						</div>

						{selectionMode === 'single' && selectedDate ? (
							<div className="mt-4 text-sm leading-6 text-slate-600">
								Event date: <strong>{selectedDate}</strong>
							</div>
						) : checkIn && (
							<div className="mt-4 text-sm leading-6 text-slate-600">
								Check-in: <strong>{checkIn}</strong>
								{checkOut && (
									<>
										{' '}
										&nbsp;→&nbsp; Check-out: <strong>{checkOut}</strong>
									</>
								)}
							</div>
						)}
						{action ? <div className="mt-6 flex justify-end">{action}</div> : null}
					</div>
				</div>
			</div>
		</section>
	)
}