import { useState } from 'react'
import { FaArrowRight, FaUserPlus, FaWaveSquare } from 'react-icons/fa'

const initialForm = {
	firstName: '',
	lastName: '',
	email: '',
	phone: '',
	dateOfBirth: '',
	password: '',
	confirmPassword: '',
	termsAccepted: false,
}

export default function RegisterPage({ onRegister }) {
	const [form, setForm] = useState(initialForm)
	const [error, setError] = useState('')

	const updateForm = (event) => {
		const { name, value, type, checked } = event.target
		setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
		setError('')
	}

	const handleSubmit = (event) => {
		event.preventDefault()
		if (form.password !== form.confirmPassword) {
			setError('Passwords do not match.')
			return
		}
		if (!form.termsAccepted) {
			setError('Please accept the Terms of Service and Privacy Policy.')
			return
		}
		onRegister?.(form)
	}

	return (
		<main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-4 py-8 text-slate-700">
			<div className="w-full max-w-[465px]">
				<header className="mb-6 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-700 text-white shadow-sm"><FaWaveSquare className="h-6 w-6" /></div>
					<h1 className="mt-4 text-2xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>Create Account</h1>
					<p className="mt-1 text-sm text-slate-500">Join Kai Azul Beach Resort as a member</p>
				</header>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-6">
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="First Name" name="firstName" placeholder="Juan" value={form.firstName} onChange={updateForm} required />
							<Field label="Last Name" name="lastName" placeholder="Dela Cruz" value={form.lastName} onChange={updateForm} required />
						</div>
						<Field label="Email Address" name="email" type="email" placeholder="juan@email.com" value={form.email} onChange={updateForm} required />
						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Phone Number" name="phone" type="tel" placeholder="+63 912 345 6789" value={form.phone} onChange={updateForm} required />
							<Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={updateForm} required />
						</div>
						<Field label="Password" name="password" type="password" placeholder="Create a strong password" value={form.password} onChange={updateForm} required />
						<Field label="Confirm Password" name="confirmPassword" type="password" placeholder="Repeat your password" value={form.confirmPassword} onChange={updateForm} required />
						<label className="flex items-start gap-2 text-xs text-slate-500">
							<input type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={updateForm} className="mt-0.5 accent-sky-600" />
							<span>I agree to the Terms of Service and Privacy Policy</span>
						</label>
						{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
						<button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800"><FaUserPlus className="h-3 w-3" />Create Account</button>
					</form>
					<p className="mt-4 text-center text-sm text-slate-500">Already have an account? <a href="/login" className="font-medium text-sky-600 hover:text-sky-800">Sign in</a></p>
				</section>
			</div>
		</main>
	)
}

function Field({ label, name, type = 'text', value, onChange, placeholder, required = false }) {
	return (
		<label className="block text-xs font-semibold uppercase text-slate-500">
			{label}
			<input required={required} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white" />
		</label>
	)
}
