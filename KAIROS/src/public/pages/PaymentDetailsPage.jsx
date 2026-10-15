import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { API_URL } from '../../config/api.js'
import { countNights, formatDateRange, formatVenueWindow } from '../../customer/utils/dateHelpers'


function formatPrice(value) {
	return `₱${Number(value || 0).toLocaleString('en-PH')}`
}

function formatCountdown(seconds) {
	return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function PaymentDetailsPage() {
	const { reservationId } = useParams()
	const location = useLocation()
	const navigate = useNavigate()
	const [reservation, setReservation] = useState(null)
	const [paymentMethods, setPaymentMethods] = useState([])
	const [selectedMethod, setSelectedMethod] = useState(null)
	const [proof, setProof] = useState(null)
	const storedHold = JSON.parse(sessionStorage.getItem('kairos_reservation_hold') || 'null')
	const reservationToken = location.state?.access_token ?? storedHold?.access_token ?? sessionStorage.getItem(`reservation_token_${reservationId}`);
	const [secondsLeft, setSecondsLeft] = useState(null)
	const [error, setError] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [isRedirecting, setIsRedirecting] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [confirmation, setConfirmation] = useState(null)
	const completedRef = useRef(false)
	const reservationStatusRef = useRef(null)

	useEffect(() => {
		Promise.all([
			fetch(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}`, {
				headers: reservationToken ? { 'X-Reservation-Token': reservationToken } : undefined,
				credentials: 'include',
			}),
			fetch(`${API_URL}/api/payment-methods`),
		])
			.then(async ([reservationResponse, methodsResponse]) => {
				const reservationData = await reservationResponse.json()
				const methodsData = await methodsResponse.json()
				if ([401, 403, 404].includes(reservationResponse.status)) {
					setIsRedirecting(true)
					navigate('/', { replace: true })
					return
				}
				if (!reservationResponse.ok) throw new Error(reservationData.error || 'Failed to load reservation.')
				if (!methodsResponse.ok) throw new Error(methodsData.error || 'Failed to load payment methods.')
				reservationStatusRef.current = reservationData.reservation?.status ?? null
				setReservation(reservationData)
				setPaymentMethods(methodsData.paymentMethods || [])
				setSelectedMethod(methodsData.paymentMethods?.[0] || null)
			})
			.catch((fetchError) => setError(fetchError.message))
			.finally(() => setIsLoading(false))
	}, [navigate, reservationId, reservationToken])

	useEffect(() => {
		if (!isLoading && reservation && reservation.reservation.status !== 'payment_pending') {
			setIsRedirecting(true)
			navigate('/', { replace: true })
		}
	}, [isLoading, navigate, reservation])

	useEffect(() => {
		if (!reservation?.reservation?.hold_expires_at) return undefined
		const updateCountdown = () => {
			const serverOffset = reservation.server_time ? new Date(reservation.server_time).getTime() - Date.now() : 0
			const remaining = Math.max(0, Math.floor((new Date(reservation.reservation.hold_expires_at).getTime() - (Date.now() + serverOffset)) / 1000))
			setSecondsLeft(remaining)
		}
		updateCountdown()
		const timer = window.setInterval(updateCountdown, 1000)
		return () => window.clearInterval(timer)
	}, [reservation])

	useEffect(() => () => {
		if (completedRef.current || !reservationId || reservationStatusRef.current !== 'payment_pending') return
		const body = JSON.stringify({ access_token: reservationToken || '' })
		if (navigator.sendBeacon) {
			navigator.sendBeacon(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/hold/release`, new Blob([body], { type: 'application/json' }))
		} else {
			fetch(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/hold`, {
				method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(reservationToken ? { 'X-Reservation-Token': reservationToken } : {}) }, keepalive: true,
			})
		}
	}, [reservationId, reservationToken])

	useEffect(() => {
		if (secondsLeft === 0) navigate(`/rooms-and-venues-details?roomId=${encodeURIComponent(reservation?.room?.room_id || '')}`, { replace: true })
	}, [secondsLeft, navigate, reservation?.room?.room_id])

	const handleFile = (file) => {
		if (file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) setProof(file)
	}

	const submitPayment = async (event) => {
		event.preventDefault()
		if (!selectedMethod || !proof || secondsLeft === 0) return
		setError('')
		setIsSubmitting(true)
		const formData = new FormData()
		formData.append('payment_method_id', String(selectedMethod.payment_method_id))
		formData.append('proof_of_payment', proof)
		try {
			const response = await fetch(`${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/payment`, {
				method: 'POST',
				headers: reservationToken ? { 'X-Reservation-Token': reservationToken } : undefined,
				credentials: 'include',
				body: formData,
			})
			const data = await response.json()
			if (response.status === 410) throw new Error(data.error || 'Your hold has expired, please start a new booking.')
			if (!response.ok) throw new Error(data.error || 'Failed to submit payment proof.')
			completedRef.current = true
			sessionStorage.removeItem('kairos_reservation_hold')
			sessionStorage.removeItem(`reservation_token_${reservationId}`)
			setConfirmation(data)
		} catch (submitError) {
			setError(submitError.message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (isLoading || isRedirecting || (reservation && reservation.reservation.status !== 'payment_pending')) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-slate-600">Loading payment details...</main>
	if (confirmation) return <Confirmation reference={confirmation.booking_reference} />
	if (!reservation) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-24 text-rose-600">{error || 'Reservation not found.'}</main>

	const details = reservation.reservation
	const room = reservation.room
	const isExpired = secondsLeft === 0
	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[955px]">
				<header className="mb-4"><h1 className="text-2xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Lora' }}>Online Payment</h1><p className="mt-1 text-xs text-slate-500">Complete your payment to confirm your reservation</p></header>
				{error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
				<div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${isExpired ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
					{isExpired ? 'Your hold has expired, please start a new booking.' : `Your dates are held for ${formatCountdown(secondsLeft ?? 0)}`}
				</div>
				<form onSubmit={submitPayment} className="grid gap-5 lg:grid-cols-[1fr_230px]">
					<div className="space-y-4">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"><h2 className="text-sm font-bold text-slate-700">Select Payment Method</h2><div className="mt-3 space-y-2">{paymentMethods.map((method) => <label key={method.payment_method_id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${selectedMethod?.payment_method_id === method.payment_method_id ? 'border-sky-400 bg-sky-50' : 'border-slate-200'}`}><input type="radio" name="paymentMethod" checked={selectedMethod?.payment_method_id === method.payment_method_id} onChange={() => setSelectedMethod(method)} className="accent-sky-600" />{method.method_name}</label>)}</div></section>
						<section className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs text-slate-600"><h2 className="font-bold text-slate-700">Important reminders</h2><ul className="mt-2 list-disc space-y-1 pl-4"><li>Bookers must be 18 years old or above.</li><li>A valid ID may be requested upon check-in.</li><li>Pets are allowed in rooms only if they wear diapers and have their own bed.</li></ul><a href="/terms" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold text-sky-700 hover:underline">Read our Terms and Conditions</a></section>
						{selectedMethod ? <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"><h2 className="text-sm font-bold text-slate-700">Payment Instructions</h2><div className="mt-3 flex flex-col items-center">{selectedMethod.qr_image_url ? <img src={selectedMethod.qr_image_url} alt={`${selectedMethod.method_name} QR code`} className="h-32 w-32 rounded-xl object-contain" /> : null}<p className="mt-3 text-xs font-semibold text-slate-700">{selectedMethod.account_name || selectedMethod.method_name}</p><p className="text-xs text-slate-500">{selectedMethod.account_number || 'Follow the selected payment method instructions.'}</p></div></section> : null}
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"><h2 className="text-sm font-bold text-slate-700">Upload Proof of Payment</h2><label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-4 text-center"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFile(event.target.files[0])} className="sr-only" /><span className="text-xl text-slate-400">⇧</span><span className="mt-1 text-[10px] text-slate-400">{proof ? proof.name : 'Click to upload screenshot / receipt'}</span><span className="mt-1 text-[9px] text-slate-400">PNG, JPG, or WebP - up to 5MB</span></label></section>
						<button type="submit" disabled={!proof || !selectedMethod || isExpired || isSubmitting} className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isSubmitting ? 'Submitting...' : 'Confirm Payment'}</button>
					</div>
					<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20"><h2 className="text-sm font-bold text-slate-700">Order Summary</h2><p className="mt-4 text-[10px] font-medium text-slate-700">{details.venue_name || room.room_number}</p><p className="mt-1 text-[10px] text-slate-500">{details.venue_id ? formatVenueWindow(details.event_date, details.start_time, details.end_time) : <>{formatDateRange(details.check_in_date, details.check_out_date)}{details.check_in_date && details.check_out_date ? ` (${countNights(details.check_in_date, details.check_out_date)} nights)` : ''}</>}</p><p className="mt-2 text-[10px] text-slate-500">{details.venue_id ? `${details.pax || details.num_guests} guests` : `${details.num_guests} adults${details.children ? `, ${details.children} ${details.children === 1 ? 'child' : 'children'}` : ''}`}</p>{details.venue_id && details.package_name ? <p className="mt-2 text-[10px] text-slate-500">{details.package_name}</p> : null}<div className="my-4 border-t border-slate-100" /><div className="flex justify-between text-sm font-bold text-slate-700"><span>Total</span><span>{formatPrice(details.payment_summary?.total ?? details.total_amount)}</span></div>{details.payment_summary?.deposit_due != null && details.payment_summary?.balance_due != null ? <div className="mt-3 space-y-1 text-[10px] text-slate-600"><div className="flex justify-between"><span>Pay now</span><span>{formatPrice(details.payment_summary.deposit_due)}</span></div><div className="flex justify-between"><span>Pay on arrival</span><span>{formatPrice(details.payment_summary.balance_due)}</span></div></div> : null}<p className="mt-3 text-[10px] text-slate-500">The deposit confirms your reservation and is non-refundable. Extra beds are arranged and charged on arrival. <a href="/payment-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">Read our Payment Policy</a></p><p className="mt-3 text-[10px] text-slate-500">All bookings are final. Cancellations, refunds, and rebooking are not available.</p><p className="mt-3 text-[10px] text-slate-400">Reference: {details.booking_reference || location.state?.booking_reference}</p></aside>
				</form>
			</div>
		</main>
	)
}

function Confirmation({ reference }) {
	const navigate = useNavigate()
	const [copyStatus, setCopyStatus] = useState('')

	useEffect(() => {
		const handleKeyDown = (event) => {
		if (event.key === 'Escape') navigate('/', { replace: true })
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [navigate])

	const handleCopy = async () => {
		try {
			if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.')
			await navigator.clipboard.writeText(reference)
			setCopyStatus('Copied!')
			window.setTimeout(() => setCopyStatus(''), 2000)
		} catch (copyError) {
			console.error('Failed to copy booking reference.', copyError)
			setCopyStatus('Copy failed')
		}
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
			<section className="relative w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
				<button
					type="button"
					onClick={() => navigate('/', { replace: true })}
					aria-label="Close confirmation and return to home"
					className="absolute right-4 top-4 rounded-lg p-2 text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
				>
					<span aria-hidden="true">×</span>
				</button>
				<div className="text-3xl text-emerald-500">✓</div>
				<h1 className="mt-3 text-2xl font-bold text-slate-800">Payment submitted</h1>
				<p className="mt-2 text-sm text-slate-600">Your proof of payment is pending verification.</p>
				<p className="mt-5 text-sm text-slate-600">Your booking reference is</p>
				<div className="mt-1 flex items-center justify-center gap-2">
					<strong className="text-sm text-slate-800">{reference}</strong>
					<button
						type="button"
						onClick={handleCopy}
						className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
					>
						{copyStatus || 'Copy'}
					</button>
				</div>
				<p className="mt-1 text-sm text-slate-600">Keep it to track your reservation later.</p>
				<p className="mt-4 text-sm text-slate-600">Please check your email for updates on your reservation. We'll notify you once your payment has been verified.</p>
				<div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
					<button
						type="button"
						onClick={() => navigate('/', { replace: true })}
						className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
					>
						Back to Home
					</button>
				</div>
			</section>
		</main>
	)
}
