import { useState } from 'react'

const defaultOrder = {
	roomName: 'Deluxe Ocean View',
	checkIn: '2025-07-15',
	checkOut: '2025-07-18',
	guests: '2 Adults',
	nights: 3,
	roomTotal: 13500,
	fees: 500,
	vat: 1620,
	total: 15620,
	reference: 'KAB-2025-07-4821',
}

function formatPrice(value) {
	return `₱${Number(value).toLocaleString('en-PH')}`
}

export function PaymentDetailsPage({ order = defaultOrder, qrCodeUrl, onConfirmPayment }) {
	const [paymentMethod, setPaymentMethod] = useState('gcash')
	const [proof, setProof] = useState(null)
	const [isDragging, setIsDragging] = useState(false)

	const handleFile = (file) => {
		if (file && file.type.startsWith('image/')) {
			setProof(file)
		}
	}

	const handleDrop = (event) => {
		event.preventDefault()
		setIsDragging(false)
		handleFile(event.dataTransfer.files[0])
	}

	const confirmPayment = (event) => {
		event.preventDefault()
		onConfirmPayment?.({ order, paymentMethod, proof })
	}

	return (
		<main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
			<div className="mx-auto max-w-[955px]">
				<header className="mb-4">
					<h1 className="text-2xl font-bold tracking-tight text-slate-800" style={{ fontFamily: 'Lora' }}>Online Payment</h1>
					<p className="mt-1 text-xs text-slate-500">Complete your payment to confirm your reservation</p>
				</header>

				<div className="mb-5 flex items-center gap-5 text-[10px] text-slate-400">
					<span className="flex items-center gap-2"><i className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">✓</i>Booking Details</span>
					<span className="h-px w-5 bg-slate-300" />
					<span className="flex items-center gap-2 font-semibold text-slate-700"><i className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-700 text-white">2</i>Payment</span>
					<span className="h-px w-5 bg-slate-300" />
					<span className="flex items-center gap-2"><i className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-400">3</i>Confirmation</span>
				</div>

				<form onSubmit={confirmPayment} className="grid gap-5 lg:grid-cols-[1fr_175px]">
					<div className="space-y-4">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
							<h2 className="text-sm font-bold text-slate-700">Select Payment Method</h2>
							<div className="mt-3 space-y-2">
								<label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${paymentMethod === 'gcash' ? 'border-sky-400 bg-sky-50 text-slate-700' : 'border-slate-200'}`}>
									<input type="radio" name="paymentMethod" value="gcash" checked={paymentMethod === 'gcash'} onChange={(event) => setPaymentMethod(event.target.value)} className="accent-sky-600" />
									GCash (QR Code)
								</label>
								<label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${paymentMethod === 'bank' ? 'border-sky-400 bg-sky-50 text-slate-700' : 'border-slate-200'}`}>
									<input type="radio" name="paymentMethod" value="bank" checked={paymentMethod === 'bank'} onChange={(event) => setPaymentMethod(event.target.value)} className="accent-sky-600" />
									Bank Transfer
								</label>
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
							<h2 className="text-sm font-bold text-slate-700">Scan QR to Pay</h2>
							<div className="mt-3 flex flex-col items-center">
								<div className="flex h-32 w-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-[9px] tracking-[0.12em] text-slate-400">
									{qrCodeUrl ? <img src={qrCodeUrl} alt="Payment QR code" className="h-full w-full rounded-xl object-contain" /> : '[ QR Code Placeholder ]'}
								</div>
								<p className="mt-3 text-[10px] text-slate-500">Scan with GCash or Maya to pay <strong className="text-slate-700">{formatPrice(order.total)}</strong></p>
								<p className="mt-2 text-[9px] text-slate-400">Reference: {order.reference}</p>
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
							<h2 className="text-sm font-bold text-slate-700">Upload Proof of Payment</h2>
							<label
								onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
								onDragLeave={() => setIsDragging(false)}
								onDrop={handleDrop}
								className={`mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-white'}`}
							>
								<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleFile(event.target.files[0])} className="sr-only" />
								<span className="text-xl text-slate-400">⇧</span>
								<span className="mt-1 text-[10px] text-slate-400">{proof ? proof.name : 'Click or drag to upload screenshot / receipt'}</span>
								<span className="mt-1 text-[9px] text-slate-400">PNG, JPG, PDF — up to 10MB</span>
							</label>
						</section>

						<button type="submit" className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!proof}>
							✓ Confirm Payment
						</button>
					</div>

					<aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
						<h2 className="text-sm font-bold text-slate-700">Order Summary</h2>
						<p className="mt-4 text-[10px] font-medium text-slate-700">{order.roomName}</p>
						<p className="mt-1 text-[10px] text-slate-500">{order.checkIn} → {order.checkOut}</p>
						<p className="mt-2 text-[10px] text-slate-500">{order.guests} · {order.nights} Nights</p>
						<div className="my-4 border-t border-slate-100" />
						<div className="space-y-2 text-[10px] text-slate-600">
							<div className="flex justify-between"><span>Room</span><span>{formatPrice(order.roomTotal)}</span></div>
							<div className="flex justify-between"><span>Fees</span><span>{formatPrice(order.fees)}</span></div>
							<div className="flex justify-between"><span>VAT</span><span>{formatPrice(order.vat)}</span></div>
						</div>
						<div className="my-4 border-t border-slate-100" />
						<div className="flex justify-between text-sm font-bold text-slate-700"><span>Total</span><span>{formatPrice(order.total)}</span></div>
					</aside>
				</form>
			</div>
		</main>
	)
}
