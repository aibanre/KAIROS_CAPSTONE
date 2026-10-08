import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../../config/api.js'

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

function isPastDate(dateKey) {
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	return new Date(dateKey) < today
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
	checkIn,
	checkOut,
	onRangeSelect,
	initialYear = new Date().getFullYear(),
	action,
	initialMonth = new Date().getMonth(),
}) {
	const [viewDate, setViewDate] = useState(new Date(initialYear, initialMonth, 1))
	const [bookedDates, setBookedDates] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)

	const year = viewDate.getFullYear()
	const month = viewDate.getMonth()

	// Fetch booked dates from the backend whenever the room or viewed month changes.
	// The landing calendar uses resort-wide bookings; detail pages use one room.
	useEffect(() => {
		const controller = new AbortController()
		const endpoint = roomId
			? `${API_URL}/api/rooms/${encodeURIComponent(roomId)}/booked-dates`
			: `${API_URL}/api/availability/booked-dates`

		async function fetchBookedDates() {
			setLoading(true)
			setError(null)

			try {
				const response = await fetch(
					`${endpoint}?year=${year}&month=${month + 1}`,
					{ signal: controller.signal }
				)

				if (!response.ok) {
					throw new Error('Failed to load availability.')
				}

				const data = await response.json()
				setBookedDates(data.bookedDates || [])
			} catch (err) {
				if (err.name !== 'AbortError') {
					setError('Could not load availability. Please try again.')
					setBookedDates([])
				}
			} finally {
				setLoading(false)
			}
		}

		fetchBookedDates()

		return () => controller.abort()
	}, [roomId, year, month])

	const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates])
	const calendarCells = useMemo(() => buildCalendarCells(year, month), [year, month])

	const changeMonth = (delta) => {
		setViewDate(new Date(year, month + delta, 1))
	}

	// Range-select logic: first click sets check-in, second click sets check-out.
	// Clicking before an existing check-in restarts the selection.
	const handleDateClick = (dateKey, disabled) => {
		if (disabled) return

		if (!checkIn || (checkIn && checkOut)) {
			// Start a new selection
			onRangeSelect?.(dateKey, null)
			return
		}

		if (checkIn && !checkOut) {
			if (dateKey <= checkIn) {
				// Picked an earlier date than check-in — restart with this as check-in
				onRangeSelect?.(dateKey, null)
			} else {
				onRangeSelect?.(checkIn, dateKey)
			}
		}
	}

	const isDateInSelectedRange = (dateKey) => {
		if (!checkIn || !checkOut) return false
		return dateKey > checkIn && dateKey < checkOut
	}

	return (
		<section className="scroll-mt-20 w-full bg-slate-50 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
			<div className="mx-auto max-w-7xl">
				<header className="mb-8 text-slate-800">
					<div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Plan your stay</div>
					<h2 className="font-['Lora'] text-3xl font-bold tracking-tight sm:text-4xl">
						Availability Calendar
					</h2>
					<p className="mt-2 text-sm text-slate-500 sm:text-base">
						{checkIn && !checkOut
							? 'Select your check-out date'
							: 'Select your check-in date'}
					</p>
					{error && <p className="mt-2 text-sm text-red-500">{error}</p>}
				</header>

				<div className="flex justify-center">
					<div className="w-full max-w-[590px] rounded-3xl border border-slate-200 bg-white p-4 shadow-lg sm:p-8">
						<div className="mb-5 flex items-center justify-between gap-2 text-sm font-medium text-slate-500">
							<button
								type="button"
								onClick={() => changeMonth(-1)}
								className="inline-flex min-h-11 min-w-[68px] items-center justify-center rounded-lg transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
							>
								<span className="mr-1">‹</span>Prev
							</button>
							<div className="text-center text-base font-semibold text-slate-800 sm:text-xl">
								{monthNames[month]} {year} {loading && <span className="text-xs text-slate-400">(loading…)</span>}
							</div>
							<button
								type="button"
								onClick={() => changeMonth(1)}
								className="inline-flex min-h-11 min-w-[68px] items-center justify-center rounded-lg transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
							>
								Next<span className="ml-1">›</span>
							</button>
						</div>

						<div className="grid grid-cols-7 gap-y-1 text-center text-xs font-medium text-slate-500 sm:gap-y-2 sm:text-sm">
							{weekdayLabels.map((label) => (
								<div key={label} className="py-2">
									{label}
								</div>
							))}

							{calendarCells.map((cell) => {
								if (cell.type === 'empty') {
									return <div key={cell.key} className="h-10 sm:h-11" />
								}

								const booked = bookedSet.has(cell.key)
								const past = isPastDate(cell.key)
								const disabled = booked || past

								const isCheckIn = checkIn === cell.key
								const isCheckOut = checkOut === cell.key
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
												? booked
													? 'bg-red-100 text-red-600 cursor-not-allowed'
													: 'text-slate-300 cursor-not-allowed'
												: 'text-slate-700 hover:bg-slate-100',
											inRange ? 'bg-sky-50' : '',
											isCheckIn || isCheckOut ? 'ring-2 ring-sky-500 ring-offset-2 bg-sky-100' : '',
										].join(' ')}
										aria-label={`${monthNames[month]} ${cell.day}, ${booked ? 'booked' : past ? 'past date' : 'available'}`}
									>
										{cell.day}
									</button>
								)
							})}
						</div>

						<div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-slate-500 sm:gap-6 sm:text-sm">
							<div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded bg-red-100" />
								<span>Booked</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded border border-sky-300 bg-sky-50" />
								<span>Selected range</span>
							</div>
						</div>

						{checkIn && (
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