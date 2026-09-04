import { useState } from 'react'
import { FaLock, FaWater } from 'react-icons/fa'

export default function LoginPage({ onSignIn }) {
	const [credentials, setCredentials] = useState({ email: '', password: '' })

	const updateCredentials = (event) => {
		const { name, value } = event.target
		setCredentials((current) => ({ ...current, [name]: value }))
	}

	const handleSubmit = (event) => {
		event.preventDefault()
		onSignIn?.(credentials)
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-10 text-slate-200">
			<div className="w-full max-w-[400px]">
				<header className="mb-8 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
						<FaWater className="h-6 w-6" />
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
							<input required type="password" name="password" value={credentials.password} onChange={updateCredentials} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-3 text-sm font-normal normal-case tracking-widest text-white outline-none placeholder:text-slate-400 focus:border-sky-500" />
						</label>
						<button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500">
							<FaLock className="h-3 w-3" />
							Sign In to Admin Portal
						</button>
					</form>
					<p className="mt-5 text-center text-xs text-slate-500">Restricted access — authorized personnel only</p>
				</section>
			</div>
		</main>
	)
}
