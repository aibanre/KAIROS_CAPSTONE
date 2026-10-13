import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaArrowRight } from 'react-icons/fa'
import { GoogleLogin } from '@react-oauth/google'
import GoogleBirthdayPrompt from '../components/GoogleBirthdayPrompt'
import logo from '../../assets/images/logo/transparent-kaiazul.png'

export default function LoginPage({ onSignIn, onForgotPassword, onGoogleSignIn, onCompleteGoogleSignIn, googleClientId, initialError = '' }) {
	const navigate = useNavigate()
	const location = useLocation()
	const [credentials, setCredentials] = useState({ email: '', password: '' })
	const [showPassword, setShowPassword] = useState(false)
	const [error, setError] = useState(initialError)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [showForgot, setShowForgot] = useState(false)
	const [forgotEmail, setForgotEmail] = useState('')
	const [forgotMessage, setForgotMessage] = useState('')
	const [forgotError, setForgotError] = useState('')
	const [pendingGoogleToken, setPendingGoogleToken] = useState('')

	useEffect(() => {
		setError(initialError)
	}, [initialError])

	const updateCredentials = (event) => {
		const { name, value } = event.target
		setCredentials((current) => ({ ...current, [name]: value }))
	}

	const handleSubmit = (event) => {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)

		Promise.resolve(onSignIn?.(credentials))
			.then((user) => {
				const from = location.state?.from
				const redirect = typeof from?.pathname === 'string'
					? `${from.pathname}${from.search || ''}${from.hash || ''}`
					: null
				navigate(redirect || (user?.role === 'customer' ? '/portal' : '/admin'))
			})
			.catch((submitError) => setError(submitError.message))
			.finally(() => setIsSubmitting(false))
	}

	const handleForgot = (event) => {
		event.preventDefault()
		setForgotError('')
		setForgotMessage('')
		Promise.resolve(onForgotPassword?.(forgotEmail))
			.then((result) => setForgotMessage(result?.message || "If an account exists, we've sent a reset link"))
			.catch((submitError) => setForgotError(submitError.message))
	}

	const handleGoogle = (response) => {
		setError('')
		Promise.resolve(onGoogleSignIn?.(response.credential))
			.then((result) => {
				if (result?.needs_birthday) setPendingGoogleToken(result.pending_token)
				else navigate('/portal')
			})
			.catch((submitError) => setError(submitError.message))
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-4 py-10 text-slate-700">
			<div className="w-full max-w-[402px]">
				<header className="mb-8 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sky-100">
						<img src={logo} alt="Kai Azul Beach Resort logo" className="h-11 w-11 object-contain" />
					</div>
					<h1 className="mt-5 text-2xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>Welcome Back</h1>
					<p className="mt-1 text-sm text-slate-500">Sign in to Kai Azul Beach Resort</p>
				</header>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-6">
					<form onSubmit={handleSubmit} className="space-y-4">
						<label className="block text-xs font-semibold uppercase text-slate-500">
							Email Address
							<input required type="email" name="email" value={credentials.email} onChange={updateCredentials} maxLength={254} autoComplete="email" placeholder="juan@email.com" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white" />
						</label>
						<label className="block text-xs font-semibold uppercase text-slate-500">
							Password
							<input required type={showPassword ? 'text' : 'password'} name="password" value={credentials.password} onChange={updateCredentials} minLength={8} maxLength={128} autoComplete="current-password" placeholder="••••••••" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case tracking-widest text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white" />
						</label>
						<label className="flex items-center gap-2 text-xs text-slate-500">
							<input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="accent-sky-600" />
							<span>Show password</span>
						</label>
						<div className="flex justify-end">
							<button type="button" onClick={() => { setShowForgot(true); setForgotMessage(''); setForgotError('') }} className="text-xs font-medium text-sky-600 hover:text-sky-800">Forgot password?</button>
						</div>
						{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
						<button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
							<FaArrowRight className="h-3 w-3" />
							{isSubmitting ? 'Signing In...' : 'Sign In'}
						</button>
					</form>
					<div className="my-4 border-t border-slate-200" />
					{googleClientId ? <GoogleLogin onSuccess={handleGoogle} onError={() => setError('Google sign-in could not be completed.')} useOneTap={false} /> : null}
					{pendingGoogleToken ? <GoogleBirthdayPrompt pendingToken={pendingGoogleToken} onComplete={(details) => onCompleteGoogleSignIn(details).then(() => navigate('/portal'))} onCancel={() => setPendingGoogleToken('')} /> : null}
					<p className="text-center text-sm text-slate-500">Do not have an account? <a href="/register" className="font-medium text-sky-600 hover:text-sky-800">Register here</a></p>
				</section>
			</div>
			{showForgot ? <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true">
				<div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
					<h2 className="text-lg font-bold text-slate-800">Forgot password?</h2>
					<p className="mt-1 text-xs text-slate-500">Enter your email and we will send a reset link if an account exists.</p>
					<form onSubmit={handleForgot} className="mt-4 space-y-3">
						<input required type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="juan@email.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-sky-500" />
						{forgotMessage ? <p className="text-xs text-emerald-600" role="status">{forgotMessage}</p> : null}
						{forgotError ? <p className="text-xs text-rose-600" role="alert">{forgotError}</p> : null}
						<div className="flex justify-end gap-2">
							<button type="button" onClick={() => setShowForgot(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">Close</button>
							<button type="submit" className="rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white">Send reset link</button>
						</div>
					</form>
				</div>
			</div> : null}
		</main>
	)
}
