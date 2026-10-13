import { API_URL } from '../../config/api.js'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FaLock, FaWater } from 'react-icons/fa'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import logo from '../../assets/images/logo/transparent-kaiazul.png'


export default function LoginPage({ onSignIn }) {
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const { refreshUser } = useAdminAuth()
	const [credentials, setCredentials] = useState({ email: '', password: '' })
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

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
			body: JSON.stringify({ ...credentials, portal: 'staff' }),
		})
			.then(async (response) => {
				const data = await response.json()
				if (!response.ok) throw new Error(data.error || 'Unable to sign in.')
				onSignIn?.(credentials, data.user)
				const currentUser = await refreshUser()
				const redirect = searchParams.get('redirect')
				const safeRedirect = redirect && redirect.startsWith('/admin/') ? redirect : null
				if (data.user.must_change_password || currentUser?.must_change_password) {
					navigate('/admin/change-password', { replace: true, state: { redirect: safeRedirect } })
					return
				}
				navigate(safeRedirect || ((currentUser || data.user).role === 'receptionist' ? '/admin/walk-in' : '/admin'))
			})
			.catch((submitError) => setError(submitError.message))
			.finally(() => setIsSubmitting(false))
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-10 text-slate-200">
			<div className="w-full max-w-[400px]">
				<header className="mb-8 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sky-100">
						<img src={logo} alt="Kai Azul Beach Resort logo" className="h-11 w-11 object-contain" />
					</div>
					<h1 className="mt-5 text-2xl font-bold text-white" style={{ fontFamily: 'Lora' }}>Admin Portal</h1>
					<p className="mt-1 text-sm text-slate-400">KAIROS — Kai Azul Resort Management System</p>
				</header>

				<section className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
					<form onSubmit={handleSubmit} className="space-y-5">
						<label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
							Admin Email
							<input required type="email" name="email" value={credentials.email} onChange={updateCredentials} placeholder="admin@kaiazul.com" className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-3 text-sm font-normal normal-case text-white outline-none placeholder:text-slate-400 focus:border-sky-500" />
						</label>
						<label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
							Password
							<input required type={showPassword ? 'text' : 'password'} name="password" value={credentials.password} onChange={updateCredentials} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-3 text-sm font-normal normal-case tracking-widest text-white outline-none placeholder:text-slate-400 focus:border-sky-500" />
						</label>
						<label className="flex items-center gap-2 text-xs text-slate-400">
							<input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="accent-sky-500" />
							<span>Show password</span>
						</label>
						{error ? <p className="text-xs text-rose-300" role="alert">{error}</p> : null}
						<button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60">
							<FaLock className="h-3 w-3" />
							{isSubmitting ? 'Signing In...' : 'Sign In to Admin Portal'}
						</button>
					</form>
					<p className="mt-5 text-center text-xs text-slate-500">Restricted access — authorized personnel only</p>
				</section>
			</div>
		</main>
	)
}
