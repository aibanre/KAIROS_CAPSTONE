import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaUserPlus } from 'react-icons/fa'
import { GoogleLogin } from '@react-oauth/google'
import GoogleBirthdayPrompt from '../components/GoogleBirthdayPrompt'
import logo from '../../assets/images/logo/transparent-kaiazul.png'

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

export default function RegisterPage({ onRegister, onGoogleSignIn, onCompleteGoogleSignIn, googleClientId }) {
	const navigate = useNavigate()
	const [form, setForm] = useState(initialForm)
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [pendingGoogleToken, setPendingGoogleToken] = useState('')

	const updateForm = (event) => {
		const { name, value, type, checked } = event.target
		const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 11) : value
		setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : nextValue }))
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
		if (form.password.length < 8) {
			setError('Password must be at least 8 characters long.')
			return
		}

		setIsSubmitting(true)
		Promise.resolve(onRegister?.(form))
			.then(() => navigate('/login'))
			.catch((submitError) => setError(submitError.message))
			.finally(() => setIsSubmitting(false))
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
		<main className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-sky-50 via-white to-cyan-50 px-4 py-8 text-slate-700">
			<div className="w-full max-w-[465px]">
				<header className="mb-6 text-center">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-sky-100"><img src={logo} alt="Kai Azul Beach Resort logo" className="h-11 w-11 object-contain" /></div>
					<h1 className="mt-4 text-2xl font-bold text-slate-800" style={{ fontFamily: 'Lora' }}>Create Account</h1>
					<p className="mt-1 text-sm text-slate-500">Join Kai Azul Beach Resort as a member</p>
				</header>

				<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.12)] sm:p-6">
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="First Name" name="firstName" placeholder="Juan" value={form.firstName} onChange={updateForm} pattern="[A-Za-zÀ-ÿ' -]+" maxLength={50} autoComplete="given-name" required />
							<Field label="Last Name" name="lastName" placeholder="Dela Cruz" value={form.lastName} onChange={updateForm} pattern="[A-Za-zÀ-ÿ' -]+" maxLength={50} autoComplete="family-name" required />
						</div>
						<Field label="Email Address" name="email" type="email" placeholder="juan@email.com" value={form.email} onChange={updateForm} maxLength={254} autoComplete="email" required />
						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Phone Number" name="phone" type="tel" inputMode="numeric" placeholder="09123456789" value={form.phone} onChange={updateForm} maxLength={11} pattern="[0-9]{11}" autoComplete="tel" required />
							<Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={updateForm} max={new Date().toISOString().slice(0, 10)} required />
						</div>
						<p className="-mt-2 text-xs text-slate-500">You must be 18 or older to create an account.</p>
						<Field label="Password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Create a strong password" value={form.password} onChange={updateForm} minLength={8} maxLength={128} autoComplete="new-password" required />
						<Field label="Confirm Password" name="confirmPassword" type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirmPassword} onChange={updateForm} minLength={8} maxLength={128} autoComplete="new-password" required />
						<label className="flex items-center gap-2 text-xs text-slate-500">
							<input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="accent-sky-600" />
							<span>Show passwords</span>
						</label>
						<label className="flex items-start gap-2 text-xs text-slate-500">
							<input type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={updateForm} className="mt-0.5 accent-sky-600" />
							<span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">Privacy Policy</a></span>
						</label>
						{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
						<button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"><FaUserPlus className="h-3 w-3" />{isSubmitting ? 'Creating Account...' : 'Create Account'}</button>
					</form>
					{googleClientId ? <div className="mt-4"><GoogleLogin onSuccess={handleGoogle} onError={() => setError('Google sign-in could not be completed.')} useOneTap={false} /></div> : null}
					{pendingGoogleToken ? <GoogleBirthdayPrompt pendingToken={pendingGoogleToken} onComplete={(details) => onCompleteGoogleSignIn(details).then(() => navigate('/portal'))} onCancel={() => setPendingGoogleToken('')} /> : null}
					<p className="mt-4 text-center text-sm text-slate-500">Already have an account? <a href="/login" className="font-medium text-sky-600 hover:text-sky-800">Sign in</a></p>
				</section>
			</div>
		</main>
	)
}

function Field({ label, name, type = 'text', value, onChange, placeholder, required = false, pattern, maxLength, minLength, inputMode, autoComplete, max }) {
	return (
		<label className="block text-xs font-semibold uppercase text-slate-500">
			{label}
			<input required={required} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} pattern={pattern} maxLength={maxLength} minLength={minLength} inputMode={inputMode} autoComplete={autoComplete} max={max} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:bg-white" />
		</label>
	)
}
