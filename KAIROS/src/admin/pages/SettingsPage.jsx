import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBell, FaBook, FaCheck, FaCopy, FaEdit, FaGlobe, FaLock, FaPlus, FaShieldAlt, FaTimes, FaTrash } from 'react-icons/fa'

const defaultNotifications = {
    'New booking alerts': true,
    'Payment verifications': true,
    'Cancellation notices': true,
    'Daily summary report': true,
}

function Panel({ title, icon: Icon, children, className = '' }) {
    return (
        <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.10)] sm:p-5 ${className}`}>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700"><Icon className="h-3.5 w-3.5" />{title}</h2>
            {children}
        </section>
    )
}

function TextField({ label, name, value, defaultValue, onChange, type = 'text', placeholder, required = false, disabled = false, error }) {
    return (
        <label className="block text-[10px] font-semibold uppercase text-slate-500">
            {label}
            <input name={name} type={type} value={value} defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} required={required} disabled={disabled} aria-invalid={Boolean(error)} className={`mt-1 w-full rounded-xl border ${error ? 'border-rose-400' : 'border-slate-200'} bg-slate-50 px-3 py-2 text-xs font-normal normal-case text-slate-600 outline-none placeholder:text-slate-400 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60`} />
            {error ? <span className="mt-1 block text-[10px] font-normal normal-case text-rose-600">{error}</span> : null}
        </label>
    )
}

const PAYMENT_METHODS_API = `${API_BASE_URL}/api/admin/payment-methods`
const STAFF_USERS_API = `${API_BASE_URL}/api/admin/users`
const RESORT_API = `${API_BASE_URL}/api/admin/settings/resort`
const DEFAULT_RESORT = { resortName: 'Kai Azul Beach Resort', address: '123 Shoreline Drive, Beach City', contactNumber: '+63 912 345 6789', email: 'info@kaiazul.com' }

export default function SettingsPage({ onSaveResortInfo, onEnableTwoFactor, onForcePasswordReset }) {
    const [notifications, setNotifications] = useState(defaultNotifications)
    const [resort, setResort] = useState(DEFAULT_RESORT)
    const [savedResort, setSavedResort] = useState(DEFAULT_RESORT)
    const [resortLoading, setResortLoading] = useState(true)
    const [resortSaving, setResortSaving] = useState(false)
    const [resortError, setResortError] = useState('')
    const [resortNotice, setResortNotice] = useState('')
    const [resortFieldErrors, setResortFieldErrors] = useState({})
    const [security, setSecurity] = useState({ timeout: '30', attempts: '5', passwordLength: '8' })
    const navigate = useNavigate()

    const updateState = (setter) => (event) => setter((current) => ({ ...current, [event.target.name]: event.target.value }))
    const toggleNotification = (name) => setNotifications((current) => ({ ...current, [name]: !current[name] }))
    const resortIsDirty = JSON.stringify(resort) !== JSON.stringify(savedResort)

    useEffect(() => {
        let isMounted = true
        fetch(RESORT_API, { credentials: 'include' })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}))
                if (response.status === 401 || response.status === 403) {
                    navigate('/admin/login', { replace: true })
                    throw new Error('Your admin session has expired.')
                }
                if (!response.ok) throw new Error(data.error || 'Unable to load resort information.')
                return data
            })
            .then((data) => {
                if (!isMounted) return
                const mapped = { resortName: data.resort_name, address: data.address, contactNumber: data.contact_number, email: data.email }
                setResort(mapped)
                setSavedResort(mapped)
            })
            .catch((error) => { if (isMounted) setResortError(error.message) })
            .finally(() => { if (isMounted) setResortLoading(false) })
        return () => { isMounted = false }
    }, [navigate])

    const validateResort = () => {
        const errors = {}
        if (!resort.resortName.trim()) errors.resortName = 'This field is required.'
        else if (resort.resortName.trim().length > 150) errors.resortName = 'Must be 150 characters or fewer.'
        if (!resort.address.trim()) errors.address = 'This field is required.'
        else if (resort.address.trim().length > 255) errors.address = 'Must be 255 characters or fewer.'
        const digits = (resort.contactNumber.match(/\d/g) || []).length
        if (!resort.contactNumber.trim()) errors.contactNumber = 'This field is required.'
        else if (!/^[\d\s+()-]+$/.test(resort.contactNumber) || digits < 7 || resort.contactNumber.length > 30) errors.contactNumber = 'Enter a valid contact number.'
        if (!resort.email.trim()) errors.email = 'This field is required.'
        else if (resort.email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resort.email)) errors.email = 'Enter a valid email address.'
        return errors
    }

    const saveResort = async (event) => {
        event.preventDefault()
        const validationErrors = validateResort()
        setResortFieldErrors(validationErrors)
        setResortError('')
        setResortNotice('')
        if (Object.keys(validationErrors).length > 0) return
        setResortSaving(true)
        try {
            const response = await fetch(RESORT_API, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resort_name: resort.resortName.trim(), address: resort.address.trim(), contact_number: resort.contactNumber.trim(), email: resort.email.trim() }),
            })
            const data = await response.json().catch(() => ({}))
            if (response.status === 401 || response.status === 403) {
                navigate('/admin/login', { replace: true })
                return
            }
            if (!response.ok) {
                const serverFields = data.fields || {}
                setResortFieldErrors({
                    resortName: serverFields.resort_name,
                    address: serverFields.address,
                    contactNumber: serverFields.contact_number,
                    email: serverFields.email,
                })
                throw new Error(data.error || 'Unable to save resort information.')
            }
            const saved = { resortName: data.resort_name, address: data.address, contactNumber: data.contact_number, email: data.email }
            setResort(saved)
            setSavedResort(saved)
            setResortNotice('Resort information saved successfully.')
            onSaveResortInfo?.(saved)
        } catch (error) {
            setResortError(error.message)
        } finally {
            setResortSaving(false)
        }
    }

    return (
        <div className="mx-auto max-w-7xl">
            <h1 className="mb-5 text-2xl font-bold text-slate-800">Settings</h1>

            <div className="grid gap-5 lg:grid-cols-2">
                <StaffAccountsPanel />

                <PaymentMethodsPanel />

                <Panel title="Notification Settings" icon={FaBell} className="min-h-[280px]">
                    <div className="mt-4 space-y-4">
                        {Object.entries(notifications).map(([name, enabled]) => (
                            <label key={name} className="flex cursor-pointer items-center justify-between text-sm text-slate-600">
                                {name}
                                <input type="checkbox" checked={enabled} onChange={() => toggleNotification(name)} className="peer sr-only" />
                                <span className={`relative h-5 w-8 rounded-full transition ${enabled ? 'bg-sky-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${enabled ? 'left-3.5' : 'left-0.5'}`} /></span>
                            </label>
                        ))}
                    </div>
                </Panel>

                <Panel title="Resort Information" icon={FaGlobe}>
                    <form onSubmit={saveResort} className="mt-4 space-y-3">
                        {resortLoading ? <p className="text-xs text-slate-500">Loading resort information...</p> : null}
                        {resortError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{resortError}</p> : null}
                        {resortNotice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{resortNotice}</p> : null}
                        <TextField label="Resort Name" name="resortName" value={resort.resortName} onChange={updateState(setResort)} disabled={resortLoading || resortSaving} error={resortFieldErrors.resortName} />
                        <TextField label="Address" name="address" value={resort.address} onChange={updateState(setResort)} disabled={resortLoading || resortSaving} error={resortFieldErrors.address} />
                        <TextField label="Contact Number" name="contactNumber" value={resort.contactNumber} onChange={updateState(setResort)} disabled={resortLoading || resortSaving} error={resortFieldErrors.contactNumber} />
                        <TextField label="Email" name="email" value={resort.email} onChange={updateState(setResort)} type="email" disabled={resortLoading || resortSaving} error={resortFieldErrors.email} />
                        <button type="submit" disabled={resortLoading || resortSaving || !resortIsDirty} className="w-full rounded-xl bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">{resortSaving ? 'Saving...' : 'Save Resort Info'}</button>
                    </form>
                </Panel>

                <Panel title="Security Settings" icon={FaShieldAlt} className="lg:col-span-2">
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <TextField label="Session Timeout (minutes)" name="timeout" value={security.timeout} onChange={updateState(setSecurity)} type="number" />
                        <TextField label="Max Login Attempts" name="attempts" value={security.attempts} onChange={updateState(setSecurity)} type="number" />
                        <TextField label="Password Min. Length" name="passwordLength" value={security.passwordLength} onChange={updateState(setSecurity)} type="number" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={onEnableTwoFactor} className="inline-flex items-center gap-2 rounded-lg border border-sky-500 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50"><FaLock className="h-3 w-3" />Enable Two-Factor Authentication</button>
                        <button type="button" onClick={onForcePasswordReset} className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-medium text-white hover:bg-rose-600">Force Password Reset All Users</button>
                    </div>
                </Panel>
            </div>
        </div>
    )
}

function StaffAccountsPanel() {
    const navigate = useNavigate()
    const [users, setUsers] = useState([])
    const [form, setForm] = useState(null)
    const [temporaryPassword, setTemporaryPassword] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, credentials: 'include' })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete the staff account request.')
        return data
    }

    const loadUsers = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(STAFF_USERS_API)
            setUsers(data.users || [])
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadUsers() }, [])

    const closeModal = () => {
        setForm(null)
        setTemporaryPassword('')
    }

    const saveUser = async (event) => {
        event.preventDefault()
        setIsSaving(true)
        setError('')
        setNotice('')
        try {
            const values = Object.fromEntries(new FormData(event.currentTarget).entries())
            const userId = form?.user_id
            const data = await request(userId ? `${STAFF_USERS_API}/${userId}` : STAFF_USERS_API, {
                method: userId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })
            if (userId) {
                setNotice(data.message || 'Staff account updated successfully.')
                closeModal()
            } else {
                setTemporaryPassword(data.temporary_password || '')
                setNotice(data.message || 'Staff account created successfully.')
                setForm(data.user)
            }
            await loadUsers()
        } catch (saveError) {
            setError(saveError.message)
        } finally {
            setIsSaving(false)
        }
    }

    const changeActiveState = async (user) => {
        setError('')
        setNotice('')
        const action = user.status === 'active' ? 'deactivate' : 'reactivate'
        try {
            const data = await request(`${STAFF_USERS_API}/${user.user_id}/${action}`, { method: 'PATCH' })
            setNotice(data.message || `Staff account ${action}d successfully.`)
            await loadUsers()
        } catch (stateError) {
            setError(stateError.message)
        }
    }

    return <Panel title="User Roles & Permissions" icon={FaBook}>
        <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Manage administrator and receptionist staff accounts.</p>
            <button type="button" onClick={() => { setError(''); setTemporaryPassword(''); setForm({ username: '', email: '', full_name: '', role: 'receptionist' }) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"><FaPlus className="h-2.5 w-2.5" />Add Staff Account</button>
        </div>
        {notice ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p> : null}
        <div className="mt-4 space-y-2">
            {isLoading ? <p className="py-5 text-center text-xs text-slate-500">Loading staff accounts...</p> : null}
            {!isLoading && users.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">No staff accounts found.</p> : null}
            {!isLoading && users.map((user) => <StaffAccountRow key={user.user_id} user={user} onEdit={() => { setError(''); setTemporaryPassword(''); setForm(user) }} onToggle={() => changeActiveState(user)} />)}
        </div>
        {form ? <StaffAccountModal form={form} temporaryPassword={temporaryPassword} isSaving={isSaving} onCancel={closeModal} onSubmit={saveUser} /> : null}
    </Panel>
}

function StaffAccountRow({ user, onEdit, onToggle }) {
    const isActive = user.status === 'active'
    return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-700">{user.full_name}</p><p className="truncate text-xs text-slate-500">@{user.username} · {user.email}</p></div>
        <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold capitalize text-sky-700">{user.role}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isActive ? 'Active' : 'Inactive'}</span>
        <div className="flex items-center gap-2"><button type="button" aria-label={`Edit ${user.full_name}`} title="Edit staff account" onClick={onEdit} className="text-sky-600 hover:text-sky-800"><FaEdit className="h-3 w-3" /></button><button type="button" aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${user.full_name}`} title={isActive ? 'Deactivate staff account' : 'Reactivate staff account'} onClick={onToggle} className={isActive ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-800'}>{isActive ? <FaTrash className="h-3 w-3" /> : <FaCheckIcon />}</button></div>
    </div>
}

function StaffAccountModal({ form, temporaryPassword, isSaving, onCancel, onSubmit }) {
    const isEditing = Boolean(form.user_id)
    const [copied, setCopied] = useState(false)

    const copyPassword = async () => {
        await navigator.clipboard.writeText(temporaryPassword)
        setCopied(true)
    }

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={isEditing ? 'Edit staff account' : 'Add staff account'}>
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-800">{isEditing ? 'Edit staff account' : 'Add staff account'}</h3><button type="button" aria-label="Close" title="Close" onClick={onCancel} className="text-slate-400 hover:text-slate-700"><FaTimes /></button></div>
            <div className="space-y-3">
                <TextField label="Username" name="username" defaultValue={form.username || ''} required={!isEditing} disabled={isEditing} />
                <TextField label="Email" name="email" type="email" defaultValue={form.email || ''} required />
                <TextField label="Full Name" name="full_name" defaultValue={form.full_name || ''} required />
                <label className="block text-[10px] font-semibold uppercase text-slate-500">Role<select name="role" defaultValue={form.role || 'receptionist'} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500"><option value="admin">Admin</option><option value="receptionist">Receptionist</option></select></label>
            </div>
            {temporaryPassword ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><p className="font-semibold">Temporary password: <span className="select-all font-mono">{temporaryPassword}</span></p><p className="mt-1">Share this with the new staff member now. It will not be shown again.</p><button type="button" onClick={copyPassword} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-medium text-amber-800 hover:bg-amber-100"><FaCopy className="h-2.5 w-2.5" />{copied ? 'Copied' : 'Copy password'}</button></div> : null}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">{temporaryPassword ? 'Done' : 'Cancel'}</button>{!temporaryPassword ? <button type="submit" disabled={isSaving} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Create account'}</button> : null}</div>
        </form>
    </div>
}

function FaCreditCardIcon(props) {
    return <span {...props} className="inline-flex h-3.5 w-3.5 items-center justify-center border border-current rounded-sm" />
}

function PaymentMethodsPanel() {
    const navigate = useNavigate()
    const [paymentMethods, setPaymentMethods] = useState([])
    const [form, setForm] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, credentials: 'include' })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete the payment method request.')
        return data
    }

    const loadPaymentMethods = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(PAYMENT_METHODS_API)
            setPaymentMethods(data.paymentMethods || [])
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadPaymentMethods() }, [])

    const savePaymentMethod = async (event) => {
        event.preventDefault()
        setIsSaving(true)
        setError('')
        setNotice('')
        try {
            const formData = new FormData(event.currentTarget)
            const methodId = form?.payment_method_id
            const data = await request(methodId ? `${PAYMENT_METHODS_API}/${methodId}` : PAYMENT_METHODS_API, {
                method: methodId ? 'PUT' : 'POST',
                body: formData,
            })
            setNotice(data.message || `Payment method ${methodId ? 'updated' : 'created'} successfully.`)
            setForm(null)
            await loadPaymentMethods()
        } catch (saveError) {
            setError(saveError.message)
        } finally {
            setIsSaving(false)
        }
    }

    const changeActiveState = async (paymentMethod) => {
        setError('')
        setNotice('')
        const action = paymentMethod.is_active ? 'deactivate' : 'reactivate'
        try {
            const data = await request(`${PAYMENT_METHODS_API}/${paymentMethod.payment_method_id}/${action}`, { method: 'PATCH' })
            setNotice(data.message || `Payment method ${action}d successfully.`)
            await loadPaymentMethods()
        } catch (stateError) {
            setError(stateError.message)
        }
    }

    return <Panel title="Payment Settings" icon={FaCreditCardIcon}>
        <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Manage QR payment methods available to guests.</p>
            <button type="button" onClick={() => setForm({ method_name: '', method_type: 'gcash', account_name: '', account_number: '' })} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"><FaPlus className="h-2.5 w-2.5" />Add Payment Method</button>
        </div>
        {notice ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p> : null}
        <div className="mt-4 space-y-2">
            {isLoading ? <p className="py-5 text-center text-xs text-slate-500">Loading payment methods...</p> : null}
            {!isLoading && paymentMethods.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">No payment methods configured.</p> : null}
            {!isLoading && paymentMethods.map((paymentMethod) => <PaymentMethodRow key={paymentMethod.payment_method_id} paymentMethod={paymentMethod} onEdit={() => setForm(paymentMethod)} onToggle={() => changeActiveState(paymentMethod)} />)}
        </div>
        {form ? <PaymentMethodModal form={form} isSaving={isSaving} onCancel={() => setForm(null)} onSubmit={savePaymentMethod} /> : null}
    </Panel>
}

function PaymentMethodRow({ paymentMethod, onEdit, onToggle }) {
    const isActive = paymentMethod.is_active === true || paymentMethod.is_active === 1
    return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
        {paymentMethod.qr_image_url ? <img src={paymentMethod.qr_image_url} alt={`${paymentMethod.method_name} QR code`} className="h-14 w-14 rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">No QR</div>}
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-700">{paymentMethod.method_name}</p><p className="text-xs text-slate-500">{paymentMethod.method_type} {paymentMethod.account_name ? `· ${paymentMethod.account_name}` : ''}</p><p className="truncate text-xs text-slate-400">{paymentMethod.account_number || 'No account number'}</p></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isActive ? 'Active' : 'Inactive'}</span>
        <div className="flex items-center gap-2"><button type="button" aria-label={`Edit ${paymentMethod.method_name}`} title="Edit payment method" onClick={onEdit} className="text-sky-600 hover:text-sky-800"><FaEdit className="h-3 w-3" /></button><button type="button" aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${paymentMethod.method_name}`} title={isActive ? 'Deactivate payment method' : 'Reactivate payment method'} onClick={onToggle} className={isActive ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-800'}>{isActive ? <FaTrash className="h-3 w-3" /> : <FaCheckIcon />}</button></div>
    </div>
}

function PaymentMethodModal({ form, isSaving, onCancel, onSubmit }) {
    const [preview, setPreview] = useState(form.qr_image_url || '')

    const handleFileChange = (event) => {
        const file = event.target.files[0]
        if (file) setPreview(URL.createObjectURL(file))
    }

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={form.payment_method_id ? 'Edit payment method' : 'Add payment method'}>
        <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-800">{form.payment_method_id ? 'Edit payment method' : 'Add payment method'}</h3><button type="button" aria-label="Close" title="Close" onClick={onCancel} className="text-slate-400 hover:text-slate-700"><FaTimes /></button></div>
            <div className="space-y-3">
                <TextField label="Method Name" name="method_name" defaultValue={form.method_name || ''} required />
                <label className="block text-[10px] font-semibold uppercase text-slate-500">Method Type<select name="method_type" defaultValue={form.method_type || 'gcash'} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500"><option value="gcash">GCash</option><option value="bank">Bank</option><option value="other">Other</option><option value="cash">Cash</option><option value="card">Card</option></select></label>
                <TextField label="Account Name" name="account_name" defaultValue={form.account_name || ''} />
                <TextField label="Account Number" name="account_number" defaultValue={form.account_number || ''} />
                <label className="block text-[10px] font-semibold uppercase text-slate-500">QR Image<input name="qr_image" type="file" accept="image/jpeg,image/png,image/webp" required={!form.payment_method_id && !['cash', 'card'].includes(form.method_type)} onChange={handleFileChange} className="mt-1 block w-full text-xs font-normal normal-case text-slate-600" /></label>
                {preview ? <img src={preview} alt="QR code preview" className="mx-auto h-32 w-32 rounded-lg border border-slate-200 object-contain" /> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">Cancel</button><button type="submit" disabled={isSaving} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{isSaving ? 'Saving...' : 'Save payment method'}</button></div>
        </form>
    </div>
}

function FaCheckIcon() {
    return <FaCheck className="h-3 w-3" />
}
