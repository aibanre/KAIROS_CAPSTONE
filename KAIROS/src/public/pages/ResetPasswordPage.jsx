import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../../assets/images/logo/transparent-kaiazul.png'

export default function ResetPasswordPage({ onResetPassword }) {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const [token, setToken] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [message, setMessage] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		const nextToken = searchParams.get('token') || ''
		setToken(nextToken)
		window.history.replaceState({}, document.title, '/reset-password')
	}, [searchParams])

	const submit = (event) => {
		event.preventDefault()
		setError('')
		if (password !== confirmPassword) {
			setError('Passwords do not match.')
			return
		}
		if (password.length < 8 || password.length > 128) {
			setError('Password must be between 8 and 128 characters long.')
			return
		}
		if (!token) {
			setError('This password reset link is invalid or expired.')
			return
		}
		setIsSubmitting(true)
		Promise.resolve(onResetPassword({ token, password }))
			.then(() => {
				setMessage('Your password has been reset successfully. Redirecting to login...')
				window.setTimeout(() => navigate('/login'), 1500)
			})
			.catch((submitError) => setError(submitError.message || 'This password reset link is invalid or expired.'))
			.finally(() => setIsSubmitting(false))
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-4 py-10 text-slate-700">
			<div className="w-full max-w-[402px]">
				<header className="mb-8 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sky-100"><img src={logo} alt="Kai Azul Beach Resort logo" className="h-11 w-11 object-contain" /></div>
					<h1 className="mt-5 text-2xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>Reset Password</h1>
				</header>
				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-6">
					<form onSubmit={submit} className="space-y-4">
						<label className="block text-xs font-semibold uppercase text-slate-500">New Password<input required type="password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none focus:border-sky-500" /></label>
						<label className="block text-xs font-semibold uppercase text-slate-500">Confirm Password<input required type="password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none focus:border-sky-500" /></label>
						{message ? <p className="text-xs text-emerald-600" role="status">{message}</p> : null}
						{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
						<button type="submit" disabled={isSubmitting || Boolean(message)} className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{isSubmitting ? 'Saving...' : 'Reset Password'}</button>
					</form>
				</section>
			</div>
		</main>
	)
}
