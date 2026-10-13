function formatPrice(value) {
	return `₱${Number(value || 0).toLocaleString('en-PH')}`
}

function todayKey() {
	const today = new Date()
	return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

// Venue sidebar card. Package selection is NOT done here anymore:
// packaged venues only pick a date, and choose the package on the booking page.
export default function VenueSelectionCard({
	venue,
	selectedDate,
	onSelectDate,
	onReserve,
	packages = [],
	bookedDates = new Set(),
	isHolding = false,
}) {
	const isPackaged = venue?.booking_mode === 'packaged'
	const today = todayKey()
	const dateIsBooked = Boolean(selectedDate && bookedDates.has(selectedDate))
	const dateIsPast = Boolean(selectedDate && selectedDate < today)
	const dateError = dateIsBooked
		? 'This date is already booked.'
		: dateIsPast
			? 'Choose a date that is today or later.'
			: ''

	// Packaged venues show "From ₱X" using the cheapest package.
	const prices = packages.map((item) => Number(item.price || 0)).filter((price) => price > 0)
	const lowestPrice = prices.length ? Math.min(...prices) : 0
	const units = new Set(packages.map((item) => (item.pricing_type === 'per_person' ? '/ person' : '/ package')))
	const packagedUnit = units.size === 1 ? [...units][0] : ''
	const flatPrice = Number(venue?.flat_price || 0)

	const canReserve = Boolean(selectedDate) && !dateError && !isHolding

	const handleSubmit = (event) => {
		event.preventDefault()
		if (!canReserve) return
		onReserve?.({ eventDate: selectedDate })
	}

	return (
		<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
			<div className="border-b border-slate-100 pb-4">
				{isPackaged ? (
					<div className="text-xl font-bold text-sky-700">
						{lowestPrice > 0 ? <><span className="text-xs font-normal text-slate-400">From </span>{formatPrice(lowestPrice)} <span className="text-xs font-normal text-slate-400">{packagedUnit}</span></> : <span className="text-base">Package pricing</span>}
					</div>
				) : (
					<div className="text-xl font-bold text-sky-700">{formatPrice(flatPrice)} <span className="text-xs font-normal text-slate-400">/ day</span></div>
				)}
				<span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Available</span>
			</div>

			<form onSubmit={handleSubmit} className="mt-4 space-y-3">
				<label className="block text-[10px] font-semibold uppercase text-slate-500">
					Event date
					<input
						required
						type="date"
						min={today}
						value={selectedDate || ''}
						onChange={(event) => onSelectDate?.(event.target.value)}
						className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-sky-500"
					/>
				</label>

				{isPackaged ? (
					<p className="rounded-xl bg-sky-50 p-3 text-xs text-slate-600">
						Choose your package, guests and start time on the next step.
					</p>
				) : (
					<div className="rounded-xl bg-sky-50 p-3 text-xs text-slate-600">
						<div className="flex justify-between"><span>Venue rental × 1 day</span><span>{formatPrice(flatPrice)}</span></div>
						<div className="mt-3 flex justify-between border-t border-sky-100 pt-2 font-bold text-slate-700"><span>Total</span><span>{formatPrice(flatPrice)}</span></div>
					</div>
				)}

				{dateError ? <p className="text-xs text-rose-600" role="alert">{dateError}</p> : null}

				<button type="submit" disabled={!canReserve} className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300">
					{isHolding ? 'Holding date...' : 'Plan your event'}
				</button>
				<p className="text-center text-[10px] text-slate-400">You'll pick a start time on the next step</p>
			</form>
		</aside>
	)
}