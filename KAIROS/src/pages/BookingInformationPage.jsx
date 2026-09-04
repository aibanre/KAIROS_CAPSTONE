import { useMemo, useState } from 'react'

const defaultBooking = {
	roomName: 'Deluxe Ocean View',
	roomImage: null,
	checkIn: '2025-07-15',
	checkOut: '2025-07-18',
	guests: '2 Adults, 0 Children',
	pricePerNight: 4500,
}

function formatPrice(value) {
	return `₱${Number(value).toLocaleString('en-PH')}`
}

export function BookingInformationPage({ booking = defaultBooking, onContinueToPayment }) {
	const [customer, setCustomer] = useState({
		firstName: '',
		lastName: '',
		email: '',
		phone: '',
		nationality: '',
		idType: '',
		specialRequests: '',
	})
	const [bookingDetails, setBookingDetails] = useState({
		checkIn: booking.checkIn,
		checkOut: booking.checkOut,
		guests: booking.guests,
		room: booking.roomName,
	})

	const nights = useMemo(() => {
		if (!bookingDetails.checkIn || !bookingDetails.checkOut) return 0
		const difference = new Date(bookingDetails.checkOut) - new Date(bookingDetails.checkIn)
		return Math.max(0, Math.ceil(difference / 86400000))
	}, [bookingDetails.checkIn, bookingDetails.checkOut])

	const roomTotal = booking.pricePerNight * nights
	const serviceFee = Math.round(roomTotal * 0.037)
	const vat = Math.round(roomTotal * 0.12)
	const total = roomTotal + serviceFee + vat

	const updateCustomer = (event) => {
		const { name, value } = event.target
		setCustomer((current) => ({ ...current, [name]: value }))
	}

	const updateBooking = (event) => {
		const { name, value } = event.target
		setBookingDetails((current) => ({ ...current, [name]: value }))
	}

	const continueToPayment = (event) => {
		event.preventDefault()
		onContinueToPayment?.({ customer, booking: bookingDetails, nights, roomTotal, serviceFee, vat, total })
	}

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[1120px]">
				<header className="mb-5">
					<h1 className="text-3xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Lora' }}>Book Your Stay</h1>
					<p className="mt-1 text-sm text-slate-500">Complete your reservation — no account required</p>
				</header>

				<div className="mb-5 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
					<span className="flex h-4 w-4 items-center justify-center rounded-full border border-sky-500 text-[10px] font-bold">i</span>
					<span>Booking as a guest. <a href="#register" className="font-semibold underline">Create an account</a> for easier booking management, exclusive member benefits, and faster checkouts.</span>
				</div>

				<form onSubmit={continueToPayment} className="grid gap-5 lg:grid-cols-[1fr_230px]">
					<div className="space-y-4">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
							<h2 className="text-base font-bold text-slate-700">Customer Information</h2>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<Field label="First Name" name="firstName" placeholder="Juan" value={customer.firstName} onChange={updateCustomer} required />
								<Field label="Last Name" name="lastName" placeholder="Dela Cruz" value={customer.lastName} onChange={updateCustomer} required />
								<Field label="Email Address" name="email" type="email" placeholder="juan@email.com" value={customer.email} onChange={updateCustomer} required />
								<Field label="Phone Number" name="phone" type="tel" placeholder="+63 912 345 6789" value={customer.phone} onChange={updateCustomer} required />
								<Field label="Nationality" name="nationality" placeholder="Filipino" value={customer.nationality} onChange={updateCustomer} />
								<SelectField label="ID Type" name="idType" value={customer.idType} onChange={updateCustomer} options={['Passport', 'Driver License', 'National ID']} placeholder="Select ID" />
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
							<h2 className="text-base font-bold text-slate-700">Booking Details</h2>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<Field label="Check-in Date" name="checkIn" type="date" value={bookingDetails.checkIn} onChange={updateBooking} required />
								<Field label="Check-out Date" name="checkOut" type="date" value={bookingDetails.checkOut} onChange={updateBooking} required />
								<Field label="Number of Guests" name="guests" value={bookingDetails.guests} onChange={updateBooking} required />
								<SelectField label="Room / Venue" name="room" value={bookingDetails.room} onChange={updateBooking} options={[booking.roomName]} />
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
							<h2 className="text-base font-bold text-slate-700">Special Requests</h2>
							<label className="mt-4 block text-[10px] font-semibold uppercase text-slate-500">
								Any special requests or notes for the resort
								<textarea name="specialRequests" value={customer.specialRequests} onChange={updateCustomer} rows="4" placeholder="Any special requests or notes for the resort..." className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none placeholder:text-slate-400 focus:border-sky-500" />
							</label>
							<p className="mt-2 text-[10px] text-slate-400">Special requests are subject to availability and cannot be guaranteed.</p>
						</section>
					</div>

					<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
						<h2 className="text-base font-bold text-slate-700">Booking Summary</h2>
						<div className="mt-4 flex h-28 items-center justify-center rounded-xl bg-slate-200 text-[10px] tracking-[0.16em] text-slate-400">
							{booking.roomImage ? <img src={booking.roomImage} alt={booking.roomName} className="h-full w-full rounded-xl object-cover" /> : '[ Room Photo ]'}
						</div>
						<p className="mt-3 text-xs font-medium text-slate-700">{booking.roomName}</p>
						<div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{bookingDetails.checkIn} → {bookingDetails.checkOut}</span><span>{nights} nights</span></div>
						<p className="mt-2 text-[10px] text-slate-500">{bookingDetails.guests}</p>
						<div className="my-4 border-t border-slate-100" />
						<div className="space-y-2 text-xs text-slate-600">
							<div className="flex justify-between"><span>{formatPrice(booking.pricePerNight)} × {nights}</span><span>{formatPrice(roomTotal)}</span></div>
							<div className="flex justify-between"><span>Service fee</span><span>{formatPrice(serviceFee)}</span></div>
							<div className="flex justify-between"><span>VAT (12%)</span><span>{formatPrice(vat)}</span></div>
						</div>
						<div className="my-4 border-t border-slate-100" />
						<div className="flex justify-between text-sm font-bold text-slate-700"><span>Total</span><span>{formatPrice(total)}</span></div>
						<button type="submit" className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-sky-800">Continue to Payment</button>
					</aside>
				</form>
			</div>
		</main>
	)
}

function Field({ label, name, type = 'text', value, onChange, placeholder, required = false }) {
	return (
		<label className="block text-[10px] font-semibold uppercase text-slate-500">
			{label}
			<input required={required} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none placeholder:text-slate-400 focus:border-sky-500" />
		</label>
	)
}

function SelectField({ label, name, value, onChange, options, placeholder }) {
	return (
		<label className="block text-[10px] font-semibold uppercase text-slate-500">
			{label}
			<select name={name} value={value} onChange={onChange} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500">
				{placeholder ? <option value="">{placeholder}</option> : null}
				{options.map((option) => <option key={option} value={option}>{option}</option>)}
			</select>
		</label>
	)
}
