import { useState } from 'react'
import { API_URL } from '../config/api.js'
import { useNavigate } from 'react-router-dom'
import { FaArrowRight, FaWaveSquare } from 'react-icons/fa'

export default function LoginPage({ onSignIn, onForgotPassword }) {
	const navigate = useNavigate()
	const [credentials, setCredentials] = useState({ email: '', password: '' })
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	const updateCredentials = (event) => {
		const { name, value } = event.target
		setCredentials((current) => ({ ...current, [name]: value }))
	}

	const handleSubmit = (event) => {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)

		fetch(`${API_URL}/api/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(credentials),
		})
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Unable to sign in.')
				onSignIn?.(credentials, data.user)
				navigate(data.user?.role === 'customer' ? '/' : '/admin')
			})
			.catch((submitError) => setError(submitError.message))
			.finally(() => setIsSubmitting(false))
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-4 py-10 text-slate-700">
			<div className="w-full max-w-[402px]">
				<header className="mb-8 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-700 text-white shadow-sm">
						<FaWaveSquare className="h-6 w-6" />
					</div>
					<h1 className="mt-5 text-2xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>Welcome Back</h1>
					<p className="mt-1 text-sm text-slate-500">Sign in to Kai Azul Beach Resort</p>
				</header>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-6">
					<form onSubmit={handleSubmit} className="space-y-4">
						<label className="block text-xs font-semibold uppercase text-slate-500">
							Email Address
							<input required type="email" name="email" value={credentials.email} onChange={updateCredentials} placeholder="juan@email.com" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white" />
						</label>
						<label className="block text-xs font-semibold uppercase text-slate-500">
							Password
							<input required type="password" name="password" value={credentials.password} onChange={updateCredentials} placeholder="••••••••" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case tracking-widest text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white" />
						</label>
						<div className="flex justify-end">
							<button type="button" onClick={onForgotPassword} className="text-xs font-medium text-sky-600 hover:text-sky-800">Forgot password?</button>
						</div>
						{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
						<button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
							<FaArrowRight className="h-3 w-3" />
							{isSubmitting ? 'Signing In...' : 'Sign In'}
						</button>
					</form>
					<div className="my-4 border-t border-slate-200" />
					<p className="text-center text-sm text-slate-500">Do not have an account? <a href="/register" className="font-medium text-sky-600 hover:text-sky-800">Register here</a></p>
				</section>
			</div>
		</main>
	)
}
