import { useMemo, useState } from 'react'

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

const defaultBookedDates = [
	'2025-07-05',
	'2025-07-06',
	'2025-07-07',
	'2025-07-12',
	'2025-07-13',
	'2025-07-18',
	'2025-07-19',
	'2025-07-20',
	'2025-07-25',
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

export function AvailabilityCalendar({
	initialYear = 2025,
	initialMonth = 6,
	bookedDates = defaultBookedDates,
	selectedDate,
	onDateSelect,
	onMonthChange,
}) {
	const [viewDate, setViewDate] = useState(new Date(initialYear, initialMonth, 1))

	const year = viewDate.getFullYear()
	const month = viewDate.getMonth()

	const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates])
	const calendarCells = useMemo(() => buildCalendarCells(year, month), [year, month])

	const changeMonth = (delta) => {
		const nextDate = new Date(year, month + delta, 1)
		setViewDate(nextDate)
		onMonthChange?.(nextDate)
	}

	const handleDateClick = (dateKey, disabled) => {
		if (disabled) {
			return
		}

		onDateSelect?.(dateKey)
	}

	return (
		<section className="w-full bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<header className="mb-8 text-slate-800">
					<h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: 'Lora' }}>
						Availability Calendar
					</h2>
					<p className="mt-2 text-sm text-slate-500 sm:text-base">Check room availability before booking</p>
				</header>

				<div className="flex justify-center">
					<div className="w-full max-w-[590px] rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-8">
						<div className="mb-6 flex items-center justify-between text-sm font-medium text-slate-400">
							<button
								type="button"
								onClick={() => changeMonth(-1)}
								className="transition hover:text-slate-600"
							>
								<span className="mr-1">‹</span>Prev
							</button>
							<div className="text-xl font-semibold text-slate-800">
								{monthNames[month]} {year}
							</div>
							<button
								type="button"
								onClick={() => changeMonth(1)}
								className="transition hover:text-slate-600"
							>
								Next<span className="ml-1">›</span>
							</button>
						</div>

						<div className="grid grid-cols-7 gap-y-2 text-center text-sm font-medium text-slate-500">
							{weekdayLabels.map((label) => (
								<div key={label} className="py-2">
									{label}
								</div>
							))}

							{calendarCells.map((cell) => {
								if (cell.type === 'empty') {
									return <div key={cell.key} className="h-10" />
								}

								const booked = bookedSet.has(cell.key)
								const selected = selectedDate === cell.key

								return (
									<button
										key={cell.key}
										type="button"
										onClick={() => handleDateClick(cell.key, booked)}
										disabled={booked}
										className={[
											'mx-auto flex h-10 w-18 items-center justify-center rounded-full text-sm font-medium transition',
											booked
												? 'bg-rose-100 text-red-500 cursor-not-allowed'
												: 'text-slate-700 hover:bg-slate-100',
											selected ? 'ring-2 ring-sky-500 ring-offset-2' : '',
										].join(' ')}
										aria-label={`${monthNames[month]} ${cell.day}, ${booked ? 'booked' : 'available'}`}
									>
										{cell.day}
									</button>
								)
							})}
						</div>

						<div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
							<div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded bg-rose-100" />
								<span>Booked</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="h-3 w-3 rounded border border-sky-300 bg-sky-50" />
								<span>Available</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
