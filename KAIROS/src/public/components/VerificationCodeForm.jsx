import { useEffect, useRef, useState } from 'react'

export default function VerificationCodeForm({ email, onVerify, onResend, onBack, title = 'Verify your email' }) {
	const [code, setCode] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [secondsLeft, setSecondsLeft] = useState(60)
	const inputRef = useRef(null)

	useEffect(() => {
		inputRef.current?.focus()
		const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000)
		return () => window.clearInterval(timer)
	}, [])

	const submit = (value) => {
		if (value.length !== 6 || isSubmitting) return
		setIsSubmitting(true)
		setError('')
		Promise.resolve(onVerify?.(value))
			.catch((submitError) => setError(submitError.message || 'Invalid or expired code.'))
			.finally(() => setIsSubmitting(false))
	}

	const handleChange = (event) => {
		const nextCode = event.target.value.replace(/\D/g, '').slice(0, 6)
		setCode(nextCode)
		setError('')
		if (nextCode.length === 6) submit(nextCode)
	}

	const handleResend = () => {
		if (secondsLeft > 0 || isSubmitting) return
		setError('')
		Promise.resolve(onResend?.())
			.then(() => {
				setCode('')
				setSecondsLeft(60)
				inputRef.current?.focus()
			})
			.catch((resendError) => setError(resendError.message || 'Unable to resend code.'))
	}

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-6">
			<button type="button" onClick={onBack} className="text-xs font-semibold text-sky-700 hover:underline">← Back</button>
			<h2 className="mt-5 text-xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>{title}</h2>
			<p className="mt-2 text-sm text-slate-500">Enter the 6-digit code sent to <span className="font-semibold text-slate-700">{email}</span>.</p>
			<p className="mt-2 text-xs text-slate-500">If you requested another code, use the code from the most recent email. Earlier codes are no longer valid.</p>
			<form onSubmit={(event) => { event.preventDefault(); submit(code) }} className="mt-5 space-y-4">
				<label className="block text-xs font-semibold uppercase text-slate-500">
					Verification code
					<input
						ref={inputRef}
						type="text"
						value={code}
						onChange={handleChange}
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						pattern="[0-9]{6}"
						aria-label="Six-digit verification code"
						className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-center text-2xl font-semibold tracking-[0.45em] text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
					/>
				</label>
				{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
				<button type="submit" disabled={code.length !== 6 || isSubmitting} className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Checking...' : 'Verify code'}</button>
				<button type="button" onClick={handleResend} disabled={secondsLeft > 0 || isSubmitting} className="w-full text-sm font-medium text-sky-700 disabled:text-slate-400">
					{secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
				</button>
			</form>
		</section>
	)
}
