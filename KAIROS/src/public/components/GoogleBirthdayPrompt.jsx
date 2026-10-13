import { useState } from 'react'

function today() {
	const date = new Date()
	return new Intl.DateTimeFormat('en-CA').format(date)
}

export default function GoogleBirthdayPrompt({ pendingToken, onComplete, onCancel }) {
	const [dateOfBirth, setDateOfBirth] = useState('')
	const [error, setError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)

	const submit = (event) => {
		event.preventDefault()
		setError('')
		setIsSubmitting(true)
		Promise.resolve(onComplete({ pending_token: pendingToken, date_of_birth: dateOfBirth }))
			.catch((submitError) => setError(submitError.message))
			.finally(() => setIsSubmitting(false))
	}

	return (
		<div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
			<h2 className="text-sm font-bold text-slate-800">One more step</h2>
			<p className="mt-1 text-xs text-slate-600">Enter your date of birth to finish setting up your account. You must be 18 or older.</p>
			<form onSubmit={submit} className="mt-3 space-y-3">
				<label className="block text-xs font-semibold uppercase text-slate-500">
					Date of Birth
					<input required type="date" value={dateOfBirth} max={today()} onChange={(event) => setDateOfBirth(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal normal-case text-slate-700 outline-none focus:border-sky-500" />
				</label>
				{error ? <p className="text-xs text-rose-600" role="alert">{error}</p> : null}
				<div className="flex gap-2">
					<button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl bg-sky-700 px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-60">{isSubmitting ? 'Saving...' : 'Continue'}</button>
					<button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600">Cancel</button>
				</div>
			</form>
		</div>
	)
}
