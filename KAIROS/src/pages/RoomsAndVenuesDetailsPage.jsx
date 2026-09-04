import { useMemo, useState } from 'react'

const defaultRoom = {
	id: 1,
	name: 'Room Type #1',
	type: 'Deluxe Ocean View Room',
	pricePerNight: 4500,
	capacity: '2 Adults',
	rating: 4.8,
	reviewCount: 124,
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

function dateKey(year, month, day) {
	return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function CompactCalendar({ bookedDates, selectedDate, onDateSelect }) {
	const [viewDate, setViewDate] = useState(new Date(2025, 6, 1))
	const year = viewDate.getFullYear()
	const month = viewDate.getMonth()
	const firstDay = new Date(year, month, 1).getDay()
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const booked = new Set(bookedDates)
	const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
		if (index < firstDay) return null
		return index - firstDay + 1
	})

	const moveMonth = (delta) => setViewDate(new Date(year, month + delta, 1))

	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4">
			<div className="mb-4 flex items-center justify-between text-xs text-slate-400">
				<button type="button" onClick={() => moveMonth(-1)} className="hover:text-slate-700">‹ Prev</button>
				<strong className="text-sm text-slate-700">{viewDate.toLocaleString('en-US', { month: 'long' })} {year}</strong>
				<button type="button" onClick={() => moveMonth(1)} className="hover:text-slate-700">Next ›</button>
			</div>
			<div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
				{weekdays.map((day, index) => <div key={`${day}-${index}`} className="py-1 font-semibold">{day}</div>)}
				{cells.map((day, index) => {
					if (!day) return <div key={`empty-${index}`} className="h-7" />
					const key = dateKey(year, month, day)
					const isBooked = booked.has(key)
					const isSelected = selectedDate === key

					return (
						<button
							key={key}
							type="button"
							disabled={isBooked}
							onClick={() => onDateSelect(key)}
							className={`h-7 rounded text-[10px] ${isBooked ? 'cursor-not-allowed bg-rose-100 text-rose-500' : 'text-slate-600 hover:bg-slate-100'} ${isSelected ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`}
							aria-label={`${key} ${isBooked ? 'unavailable' : 'available'}`}
						>
							{day}
						</button>
					)
				})}
			</div>
			<div className="mt-3 flex gap-4 text-[10px] text-slate-500">
				<span><i className="mr-1 inline-block h-2 w-2 rounded bg-rose-100" />Unavailable</span>
				<span><i className="mr-1 inline-block h-2 w-2 rounded border border-slate-200" />Available</span>
			</div>
		</div>
	)
}

export function RoomsAndVenuesDetailsPage({
	room = defaultRoom,
	bookedDates = defaultBookedDates,
	onReserve,
}) {
	const [activeImage, setActiveImage] = useState(0)
	const [checkIn, setCheckIn] = useState('')
	const [checkOut, setCheckOut] = useState('')
	const [guests, setGuests] = useState(2)
	const [selectedDate, setSelectedDate] = useState('')

	const nights = useMemo(() => {
		if (!checkIn || !checkOut) return 3
		const difference = new Date(checkOut) - new Date(checkIn)
		return Math.max(1, Math.ceil(difference / 86400000))
	}, [checkIn, checkOut])

	const roomTotal = room.pricePerNight * nights
	const serviceFee = Math.round(roomTotal * 0.04)
	const vat = Math.round(roomTotal * 0.12)
	const total = roomTotal + serviceFee + vat

	const reserve = (event) => {
		event.preventDefault()
		onReserve?.({ roomId: room.id, checkIn, checkOut, guests: Number(guests), nights, total })
	}

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[1120px]">
				<p className="mb-4 text-[11px] text-slate-400">Rooms / {room.type}</p>
				<div className="grid gap-5 lg:grid-cols-[1fr_230px]">
					<div className="space-y-5">
						<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
							<div className="flex h-48 items-center justify-center bg-slate-200 text-center text-[11px] tracking-[0.16em] text-slate-400 sm:h-64">
								{room.gallery?.[activeImage]?.url ? <img src={room.gallery[activeImage].url} alt={room.type} className="h-full w-full object-cover" /> : room.gallery?.[activeImage]?.label}
							</div>
							<div className="grid grid-cols-4 gap-1 p-1">
								{room.gallery?.slice(1, 5).map((image, index) => (
									<button key={image.label ?? image.url} type="button" onClick={() => setActiveImage(index + 1)} className={`flex h-12 items-center justify-center overflow-hidden rounded-lg bg-slate-200 text-[9px] text-slate-400 ${activeImage === index + 1 ? 'ring-2 ring-sky-500' : ''}`}>
										{image.url ? <img src={image.url} alt={`${room.type} view ${index + 2}`} className="h-full w-full object-cover" /> : image.label}
									</button>
								))}
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
							<h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>{room.name}</h1>
							<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
								<span>♧ {room.capacity}</span><span>◉ Ocean View</span><span className="text-amber-500">★ <span className="text-slate-500">{room.rating} ({room.reviewCount} reviews)</span></span><span>◷ Check-in 2 PM / Check-out 12 PM</span>
							</div>
							<p className="mt-4 text-xs leading-5 text-slate-600">{room.description}</p>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
							<h2 className="text-sm font-bold text-slate-700">Room Amenities</h2>
							<ul className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
								{room.amenities?.map((amenity) => <li key={amenity} className="before:mr-2 before:text-sky-500 before:content-['✓']">{amenity}</li>)}
							</ul>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
							<h2 className="mb-3 text-sm font-bold text-slate-700">Availability Calendar</h2>
							<CompactCalendar bookedDates={bookedDates} selectedDate={selectedDate} onDateSelect={setSelectedDate} />
						</section>
					</div>

					<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
						<div className="border-b border-slate-100 pb-4">
							<div className="text-xl font-bold text-sky-700">{formatPrice(room.pricePerNight)} <span className="text-xs font-normal text-slate-400">/ night</span></div>
							<span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Available</span>
						</div>
						<form onSubmit={reserve} className="mt-4 space-y-3">
							<label className="block text-[10px] font-semibold uppercase text-slate-500">Check-in<input required type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-sky-500" /></label>
							<label className="block text-[10px] font-semibold uppercase text-slate-500">Check-out<input required type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-sky-500" /></label>
							<label className="block text-[10px] font-semibold uppercase text-slate-500">Guests<select value={guests} onChange={(event) => setGuests(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500"><option value="1">1 Adult</option><option value="2">2 Adults</option><option value="3">3 Adults</option><option value="4">4 Adults</option></select></label>
							<div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-slate-600">
								<div className="flex justify-between"><span>{formatPrice(room.pricePerNight)} × {nights} nights</span><span>{formatPrice(roomTotal)}</span></div>
								<div className="mt-2 flex justify-between"><span>Service fee</span><span>{formatPrice(serviceFee)}</span></div>
								<div className="mt-1 flex justify-between"><span>VAT (12%)</span><span>{formatPrice(vat)}</span></div>
								<div className="mt-3 flex justify-between border-t border-sky-100 pt-2 font-bold text-slate-700"><span>Total</span><span>{formatPrice(total)}</span></div>
							</div>
							<button type="submit" className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800">Reserve Now</button>
							<p className="text-center text-[10px] text-slate-400">No charge until check-in confirmation</p>
						</form>
					</aside>
				</div>
			</div>
		</main>
	)
}

function formatPrice(price) {
	return `₱${Number(price).toLocaleString('en-PH')}`
}
