import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { API_URL } from '../../config/api.js'
import { getImageUrl } from '../utils/parseImages.js'

function formatPrice(value) {
	return `₱${Number(value || 0).toLocaleString('en-PH')}`
}

function calculateDeposit(value) {
	return Math.round(Number(value || 0) * 50) / 100
}

export function BookingInformationPage() {
	const { roomId } = useParams()
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const [room, setRoom] = useState(null)
	const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' })
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [bookingDetails, setBookingDetails] = useState({
		checkIn: searchParams.get('check_in') || '',
		checkOut: searchParams.get('check_out') || '',
		guests: Number(searchParams.get('guests')) || 1,
	})

	useEffect(() => {
		const controller = new AbortController()
		fetch(`${API_URL}/api/rooms/${encodeURIComponent(roomId)}`, { signal: controller.signal })
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Failed to load room details.')
				setRoom(data.room)
			})
			.catch((fetchError) => {
				if (fetchError.name !== 'AbortError') setError(fetchError.message)
			})
			.finally(() => setIsLoading(false))
		return () => controller.abort()
	}, [roomId])

	const nights = useMemo(() => {
		if (!bookingDetails.checkIn || !bookingDetails.checkOut) return 0
		return Math.max(0, Math.round((Date.parse(`${bookingDetails.checkOut}T00:00:00Z`) - Date.parse(`${bookingDetails.checkIn}T00:00:00Z`)) / 86400000))
	}, [bookingDetails.checkIn, bookingDetails.checkOut])
	const total = Number(room?.price_per_night || 0) * nights

	const updateCustomer = (event) => {
		const { name, value } = event.target
		const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 11) : value
		setCustomer((current) => ({ ...current, [name]: nextValue }))
	}

	const updateBooking = (event) => {
		const { name, value } = event.target
		const nextValue = name === 'guests' ? value.replace(/\D/g, '').slice(0, 11) : value
		setBookingDetails((current) => ({ ...current, [name]: name === 'guests' ? Number(nextValue) || 0 : nextValue }))
	}

	const submitReservation = async (event) => {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)
		try {
			const response = await fetch(`${API_URL}/api/reservations`, {
				method: 'POST',
				credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					room_id: Number(roomId),
					check_in: bookingDetails.checkIn,
					check_out: bookingDetails.checkOut,
					num_guests: bookingDetails.guests,
					customer: {
						first_name: customer.firstName,
						last_name: customer.lastName,
						email: customer.email,
						phone_number: customer.phone,
						address: customer.address,
					},
				}),
			})
			const data = await response.json()
	if (data.access_token) {
		sessionStorage.setItem(`reservation_token_${data.reservation_id}`, data.access_token);
	}
			if (!response.ok) throw new Error(data.error || 'Failed to create reservation.')
			navigate(`/payment/${data.reservation_id}`, { state: data })
		} catch (submitError) {
			setError(submitError.message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (isLoading) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-slate-600">Loading room details...</main>
	if (!room) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-rose-600">{error || 'Room not found.'}</main>

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[1120px]">
				<header className="mb-5">
					<h1 className="text-3xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Lora' }}>Book Your Stay</h1>
					<p className="mt-1 text-sm text-slate-500">Complete your reservation - no account required</p>
				</header>
				{error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
				<form onSubmit={submitReservation} className="grid gap-5 lg:grid-cols-[1fr_230px]">
					<div className="space-y-4">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
							<h2 className="text-base font-bold text-slate-700">Customer Information</h2>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<Field label="First Name" name="firstName" placeholder="Juan" value={customer.firstName} onChange={updateCustomer} pattern="[A-Za-zÀ-ÿ' -]+" maxLength={50} autoComplete="given-name" required />
								<Field label="Last Name" name="lastName" placeholder="Dela Cruz" value={customer.lastName} onChange={updateCustomer} pattern="[A-Za-zÀ-ÿ' -]+" maxLength={50} autoComplete="family-name" required />
								<Field label="Email Address" name="email" type="email" placeholder="juan@email.com" value={customer.email} onChange={updateCustomer} maxLength={254} autoComplete="email" required />
								<Field label="Phone Number" name="phone" type="tel" inputMode="numeric" placeholder="09123456789" value={customer.phone} onChange={updateCustomer} maxLength={11} pattern="[0-9]{11}" autoComplete="tel" required />
								<Field label="Address" name="address" placeholder="Your address" value={customer.address} onChange={updateCustomer} maxLength={200} autoComplete="street-address" required />
							</div>
						</section>
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
							<h2 className="text-base font-bold text-slate-700">Booking Details</h2>
							<div className="mt-4 grid gap-3 sm:grid-cols-2">
								<Field label="Check-in Date" name="checkIn" type="date" value={bookingDetails.checkIn} onChange={updateBooking} required />
								<Field label="Check-out Date" name="checkOut" type="date" value={bookingDetails.checkOut} onChange={updateBooking} required />
								<Field label="Number of Guests" name="guests" type="number" min="1" max="99999999999" inputMode="numeric" value={bookingDetails.guests} onChange={updateBooking} required />
								<div className="block text-[10px] font-semibold uppercase text-slate-500">Room<div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600">{room.room_number} - {room.room_type}</div></div>
							</div>
						</section>
					</div>
					<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
						<h2 className="text-base font-bold text-slate-700">Booking Summary</h2>
						<div className="mt-4 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-[10px] text-slate-400">{getImageUrl(room.images) ? <img src={getImageUrl(room.images)} alt={room.room_type} className="h-full w-full object-cover" /> : 'Room photo unavailable'}</div>
						<p className="mt-3 text-xs font-medium text-slate-700">{room.room_number}</p>
						<div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{bookingDetails.checkIn} - {bookingDetails.checkOut}</span><span>{nights} nights</span></div>
						<div className="my-4 border-t border-slate-100" />
						<div className="space-y-2 text-xs text-slate-600"><div className="flex justify-between"><span>{formatPrice(room.price_per_night)} x {nights}</span><span>{formatPrice(total)}</span></div></div>
						<div className="my-4 border-t border-slate-100" />
						<div className="flex justify-between text-sm font-bold text-slate-700"><span>Total</span><span>{formatPrice(total)}</span></div>
						<div className="mt-3 space-y-1 text-xs text-slate-600"><div className="flex justify-between"><span>Pay now (50%)</span><span>{formatPrice(calculateDeposit(total))}</span></div><div className="flex justify-between"><span>Pay on arrival (50%)</span><span>{formatPrice(total - calculateDeposit(total))}</span></div></div>
						<p className="mt-3 text-[10px] text-slate-500">The 50% deposit confirms your reservation and is non-refundable. Extra beds are arranged and charged on arrival.</p>
						<button type="submit" disabled={isSubmitting} className="mt-4 w-full rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? 'Creating reservation...' : 'Continue to Payment'}</button>
					</aside>
				</form>
			</div>
		</main>
	)
}

function Field({ label, name, type = 'text', value, onChange, placeholder, required = false, min, max, maxLength, pattern, inputMode, autoComplete }) {
	return <label className="block text-[10px] font-semibold uppercase text-slate-500">{label}<input required={required} min={min} max={max} maxLength={maxLength} pattern={pattern} inputMode={inputMode} autoComplete={autoComplete} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none placeholder:text-slate-400 focus:border-sky-500" /></label>
}
