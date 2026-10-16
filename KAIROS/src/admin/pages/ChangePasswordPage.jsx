import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FaLock, FaWater } from 'react-icons/fa'
import { API_URL } from '../../config/api.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import logo from '../../assets/images/logo/transparent-kaiazul.png'

export default function ChangePasswordPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, refreshUser } = useAdminAuth()
    const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
    const [error, setError] = useState('')
    const [fieldErrors, setFieldErrors] = useState({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

    const submit = async (event) => {
        event.preventDefault()
        const errors = {}
        if (!user?.must_change_password && !form.current_password) errors.current_password = 'Enter your current password.'
        if (form.new_password.length < 8 || form.new_password.length > 128) errors.new_password = 'Password must be between 8 and 128 characters.'
        if (form.new_password !== form.confirm_password) errors.confirm_password = 'Passwords do not match.'
        setFieldErrors(errors)
        setError('')
        if (Object.keys(errors).length > 0) return

        setIsSubmitting(true)
        try {
            const response = await fetch(`${API_URL}/api/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    current_password: form.current_password,
                    new_password: form.new_password,
                }),
            })
            const data = await response.json().catch(() => ({}))
            if (response.status === 401 || response.status === 403) {
                navigate('/admin/login', { replace: true })
                return
            }
            if (!response.ok) throw new Error(data.error || 'Unable to change password.')
            const updatedUser = await refreshUser()
            const redirect = location.state?.redirect
            const safeRedirect = redirect && redirect.startsWith('/admin/') && redirect !== '/admin/change-password' ? redirect : null
            navigate(safeRedirect || (updatedUser?.role === 'receptionist' ? '/admin/walk-in' : '/admin'), { replace: true })
        } catch (submitError) {
            setError(submitError.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-10 text-slate-200">
        <div className="w-full max-w-[400px]">
            <header className="mb-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
                    <img src={logo} alt="Kai Azul Beach Resort logo" className="h-11 w-11 object-contain" />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-white" style={{ fontFamily: 'Lora' }}>Change your password</h1>
                <p className="mt-1 text-sm text-slate-400">A new password is required before continuing.</p>
            </header>
            <section className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
                <form onSubmit={submit} className="space-y-5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">{user?.must_change_password ? 'Temporary password' : 'Current password'}<input required name="current_password" type="password" value={form.current_password} onChange={updateForm} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-3 text-sm font-normal normal-case text-white outline-none focus:border-sky-500" />{user?.must_change_password ? <span className="mt-1 block text-xs font-normal normal-case text-amber-200">Enter the temporary password provided by your administrator.</span> : null}{fieldErrors.current_password ? <span className="mt-1 block text-xs font-normal normal-case text-rose-300">{fieldErrors.current_password}</span> : null}</label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">New password<input required name="new_password" type="password" value={form.new_password} onChange={updateForm} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-3 text-sm font-normal normal-case text-white outline-none focus:border-sky-500" />{fieldErrors.new_password ? <span className="mt-1 block text-xs font-normal normal-case text-rose-300">{fieldErrors.new_password}</span> : null}</label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Confirm new password<input required name="confirm_password" type="password" value={form.confirm_password} onChange={updateForm} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-700 px-3 py-3 text-sm font-normal normal-case text-white outline-none focus:border-sky-500" />{fieldErrors.confirm_password ? <span className="mt-1 block text-xs font-normal normal-case text-rose-300">{fieldErrors.confirm_password}</span> : null}</label>
                    {error ? <p className="text-xs text-rose-300" role="alert">{error}</p> : null}
                    <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"><FaLock className="h-3 w-3" />{isSubmitting ? 'Saving...' : 'Change password'}</button>
                </form>
            </section>
        </div>
    </main>
}
