import { API_URL as API_BASE_URL } from '../../config/api.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBook, FaCheck, FaClipboardList, FaCopy, FaEdit, FaGlobe, FaKey, FaLock, FaPlus, FaTimes, FaTrash } from 'react-icons/fa'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { useAdminToast } from '../context/AdminNotificationsContext.jsx'
import { notifyAdminActionError } from '../utils/adminToastMessages.js'
import AdminModal from '../components/AdminModal.jsx'

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

export default function SettingsPage({ onSaveResortInfo }) {
    const [resort, setResort] = useState(DEFAULT_RESORT)
    const [savedResort, setSavedResort] = useState(DEFAULT_RESORT)
    const [resortLoading, setResortLoading] = useState(true)
    const [resortSaving, setResortSaving] = useState(false)
    const [resortError, setResortError] = useState('')
    const [resortFieldErrors, setResortFieldErrors] = useState({})
    const navigate = useNavigate()
    const toast = useAdminToast()

    const updateState = (setter) => (event) => setter((current) => ({ ...current, [event.target.name]: event.target.value }))
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
            onSaveResortInfo?.(saved)
            toast.success('Resort information saved successfully.')
        } catch (error) {
            setResortError(error.message)
            notifyAdminActionError(toast, error, 'Unable to save resort information.')
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

                <Panel title="Resort Information" icon={FaGlobe}>
                    <form onSubmit={saveResort} className="mt-4 space-y-3">
                        {resortLoading ? <p className="text-xs text-slate-500">Loading resort information...</p> : null}
                        {resortError ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{resortError}</p> : null}
                        <TextField label="Resort Name" name="resortName" value={resort.resortName} onChange={updateState(setResort)} disabled={resortLoading || resortSaving} error={resortFieldErrors.resortName} />
                        <TextField label="Address" name="address" value={resort.address} onChange={updateState(setResort)} disabled={resortLoading || resortSaving} error={resortFieldErrors.address} />
                        <TextField label="Contact Number" name="contactNumber" value={resort.contactNumber} onChange={updateState(setResort)} disabled={resortLoading || resortSaving} error={resortFieldErrors.contactNumber} />
                        <TextField label="Email" name="email" value={resort.email} onChange={updateState(setResort)} type="email" disabled={resortLoading || resortSaving} error={resortFieldErrors.email} />
                        <button type="submit" disabled={resortLoading || resortSaving || !resortIsDirty} className="w-full rounded-xl bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">{resortSaving ? 'Saving...' : 'Save Resort Info'}</button>
                    </form>
                </Panel>

                <InventoryChecklistSettingsPanel />
            </div>
        </div>
    )
}

function StaffAccountsPanel() {
    const navigate = useNavigate()
    const { user: signedInUser } = useAdminAuth()
    const toast = useAdminToast()
    const [users, setUsers] = useState([])
    const [form, setForm] = useState(null)
    const [temporaryPassword, setTemporaryPassword] = useState('')
    const [resetTarget, setResetTarget] = useState(null)
    const [resetTemporaryPassword, setResetTemporaryPassword] = useState('')
    const [isResetting, setIsResetting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

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
        setResetTarget(null)
        setResetTemporaryPassword('')
    }

    const saveUser = async (event) => {
        event.preventDefault()
        setIsSaving(true)
        setError('')
        try {
            const values = Object.fromEntries(new FormData(event.currentTarget).entries())
            const userId = form?.user_id
            const data = await request(userId ? `${STAFF_USERS_API}/${userId}` : STAFF_USERS_API, {
                method: userId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })
            const successMessage = userId ? 'Staff account updated successfully.' : 'Staff account created successfully.'
            if (userId) {
                closeModal()
            } else {
                setTemporaryPassword(data.temporary_password || '')
                setForm(data.user)
            }
            await loadUsers()
            toast.success(successMessage)
        } catch (saveError) {
            notifyAdminActionError(toast, saveError, 'Unable to save the staff account.')
        } finally {
            setIsSaving(false)
        }
    }

    const changeActiveState = async (user) => {
        setError('')
        const action = user.status === 'active' ? 'deactivate' : 'reactivate'
        try {
            await request(`${STAFF_USERS_API}/${user.user_id}/${action}`, { method: 'PATCH' })
            await loadUsers()
            toast.success(`Staff account ${action}d successfully.`)
        } catch (stateError) {
            notifyAdminActionError(toast, stateError, 'Unable to update the staff account.')
        }
    }

    const resetUserPassword = async () => {
        if (!resetTarget) return
        setIsResetting(true)
        setError('')
        try {
            const data = await request(`${STAFF_USERS_API}/${resetTarget.user_id}/reset-password`, { method: 'PATCH' })
            setResetTemporaryPassword(data.temporary_password || '')
        } catch (resetError) {
            notifyAdminActionError(toast, resetError, 'Unable to reset the staff password.')
            setResetTarget(null)
        } finally {
            setIsResetting(false)
        }
    }

    return <Panel title="User Roles & Permissions" icon={FaBook}>
        <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Manage administrator and receptionist staff accounts.</p>
            <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => navigate('/admin/change-password')} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50"><FaLock className="h-2.5 w-2.5" />Change My Password</button>
                <button type="button" onClick={() => { setError(''); setTemporaryPassword(''); setForm({ username: '', email: '', full_name: '', role: 'receptionist' }) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"><FaPlus className="h-2.5 w-2.5" />Add Staff Account</button>
            </div>
        </div>
        {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p> : null}
        <div className="mt-4 space-y-2">
            {isLoading ? <p className="py-5 text-center text-xs text-slate-500">Loading staff accounts...</p> : null}
            {!isLoading && users.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">No staff accounts found.</p> : null}
            {!isLoading && users.map((user) => <StaffAccountRow key={user.user_id} user={user} isCurrentUser={String(user.user_id) === String(signedInUser?.user_id)} onEdit={() => { setError(''); setTemporaryPassword(''); setForm(user) }} onToggle={() => changeActiveState(user)} onReset={() => { setError(''); setResetTemporaryPassword(''); setResetTarget(user) }} />)}
        </div>
        {form ? <StaffAccountModal form={form} temporaryPassword={temporaryPassword} isSaving={isSaving} onCancel={closeModal} onSubmit={saveUser} /> : null}
        {resetTarget && !resetTemporaryPassword ? <ResetConfirmModal user={resetTarget} isSaving={isResetting} onCancel={() => setResetTarget(null)} onConfirm={resetUserPassword} /> : null}
        {resetTemporaryPassword ? <ResetPasswordModal password={resetTemporaryPassword} onClose={closeModal} /> : null}
    </Panel>
}

const INVENTORY_ITEMS_API = `${API_BASE_URL}/api/admin/inventory-items`

function InventoryChecklistSettingsPanel() {
    const navigate = useNavigate()
    const toast = useAdminToast()
    const [items, setItems] = useState([])
    const [form, setForm] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

    const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers } })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401 || response.status === 403) {
            navigate('/admin/login', { replace: true })
            throw new Error('Your admin session has expired.')
        }
        if (!response.ok) throw new Error(data.error || 'Unable to complete the inventory item request.')
        return data
    }

    const loadItems = async () => {
        setIsLoading(true)
        setError('')
        try {
            const data = await request(`${INVENTORY_ITEMS_API}?include_inactive=1`)
            setItems(data.items || [])
        } catch (loadError) {
            setError(loadError.message)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => { loadItems() }, [])

    const saveItem = async (event) => {
        event.preventDefault()
        const name = form.name.trim()
        const pesos = Number(form.charge)
        setError('')
        if (!name) return setError('Item name is required.')
        if (!Number.isFinite(pesos) || pesos < 0) return setError('Charge must be zero or greater.')
        if (items.some((item) => item.item_id !== form.item_id && item.item_name.trim().toLowerCase() === name.toLowerCase())) {
            return setError('An inventory item with that name already exists.')
        }
        setIsSaving(true)
        try {
            const data = await request(form.item_id ? `${INVENTORY_ITEMS_API}/${form.item_id}` : INVENTORY_ITEMS_API, {
                method: form.item_id ? 'PUT' : 'POST',
                body: JSON.stringify({ item_name: name, default_charge_cents: Math.round(pesos * 100) }),
            })
            setForm(null)
            await loadItems()
            toast.success(data.message || `Inventory item ${form.item_id ? 'updated' : 'added'} successfully.`)
        } catch (saveError) {
            setError(saveError.message)
            notifyAdminActionError(toast, saveError, 'Unable to save the inventory item.')
        } finally {
            setIsSaving(false)
        }
    }

    const changeActiveState = async (item) => {
        setError('')
        try {
            const action = item.is_active ? 'deactivate' : 'reactivate'
            const data = await request(`${INVENTORY_ITEMS_API}/${item.item_id}/${action}`, { method: 'PATCH' })
            await loadItems()
            setForm(null)
            toast.success(data.message || `Inventory item ${action}d successfully.`)
        } catch (stateError) {
            setError(stateError.message)
            notifyAdminActionError(toast, stateError, 'Unable to update the inventory item.')
        }
    }

    const activeItems = items.filter((item) => Boolean(item.is_active))
    return <Panel title="Room Inventory Checklist" icon={FaClipboardList}>
        <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Manage the items and default charges used during room checkout.</p>
            <button type="button" onClick={() => { setError(''); setForm({ name: '', charge: '0' }) }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"><FaPlus className="h-2.5 w-2.5" />Add item</button>
        </div>
        {error && !form ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p> : null}
        {!isLoading && !error && activeItems.length === 0 ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Checkout is blocked until at least one active checklist item exists.</p> : null}
        <div className="mt-4 space-y-2">
            {isLoading ? <p className="py-5 text-center text-xs text-slate-500">Loading checklist items...</p> : null}
            {!isLoading && !error && items.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">No checklist items found.</p> : null}
            {!isLoading && items.map((item) => <button type="button" key={item.item_id} onClick={() => { setError(''); setForm({ item_id: item.item_id, name: item.item_name, charge: (Number(item.default_charge_cents) / 100).toFixed(2) }) }} className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-sky-300 hover:bg-sky-50">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.item_name}</span>
                <span className="text-sm text-slate-600">PHP {(Number(item.default_charge_cents) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
            </button>)}
        </div>
        {form ? <InventoryItemModal form={form} items={items} isSaving={isSaving} error={error} onChange={(event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))} onCancel={() => { if (!isSaving) setForm(null) }} onSubmit={saveItem} onToggle={() => changeActiveState(items.find((item) => item.item_id === form.item_id))} /> : null}
    </Panel>
}

function InventoryItemModal({ form, items, isSaving, error, onChange, onCancel, onSubmit, onToggle }) {
    const currentItem = items.find((item) => item.item_id === form.item_id)
    return <AdminModal title={form.item_id ? 'Edit checklist item' : 'Add checklist item'} labelledBy="inventory-item-modal-title" onClose={onCancel} footer={<>
        {currentItem ? <div className="flex-1"><button type="button" disabled={isSaving} onClick={onToggle} className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${currentItem.is_active ? 'border-rose-300 text-rose-600 hover:bg-rose-50' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>{currentItem.is_active ? 'Deactivate item' : 'Reactivate item'}</button></div> : null}
        <div className="flex gap-3"><button type="button" disabled={isSaving} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50">Cancel</button><button type="submit" form="inventory-item-form" disabled={isSaving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button></div>
    </>}>
        <form id="inventory-item-form" onSubmit={onSubmit} className="space-y-4">
            {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{error}</p> : null}
            <label className="block text-xs font-semibold text-slate-600">Item name<input name="name" value={form.name} onChange={onChange} required maxLength="150" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>
            <label className="block text-xs font-semibold text-slate-600">Default charge (PHP)<input name="charge" value={form.charge} onChange={onChange} required type="number" min="0" step="0.01" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-sky-500" /></label>
            <p className="text-xs text-slate-500">Charges are saved as integer centavos.</p>
        </form>
    </AdminModal>
}

function StaffAccountRow({ user, isCurrentUser, onEdit, onToggle, onReset }) {
    const isActive = user.status === 'active'
    return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-700">{user.full_name}</p><p className="truncate text-xs text-slate-500">@{user.username} · {user.email}</p></div>
        <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold capitalize text-sky-700">{user.role}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isActive ? 'Active' : 'Inactive'}</span>
        <div className="flex items-center gap-2"><button type="button" aria-label={`Edit ${user.full_name}`} title="Edit staff account" onClick={onEdit} className="text-sky-600 hover:text-sky-800"><FaEdit className="h-3 w-3" /></button>{!isCurrentUser ? <button type="button" aria-label={`Reset password for ${user.full_name}`} title="Reset password" onClick={onReset} className="text-sky-600 hover:text-sky-800"><FaKey className="h-3 w-3" /></button> : null}<button type="button" aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${user.full_name}`} title={isActive ? 'Deactivate staff account' : 'Reactivate staff account'} onClick={onToggle} className={isActive ? 'text-rose-500 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-800'}>{isActive ? <FaTrash className="h-3 w-3" /> : <FaCheckIcon />}</button></div>
    </div>
}

function ResetConfirmModal({ user, isSaving, onCancel, onConfirm }) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm password reset">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-800">Reset password?</h3><button type="button" aria-label="Close" title="Close" onClick={onCancel} className="text-slate-400 hover:text-slate-700"><FaTimes /></button></div>
            <p className="text-sm text-slate-600">Generate a new temporary password for <strong>{user.full_name}</strong> ({user.email})? Their current password and open sessions will stop working.</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600">Cancel</button><button type="button" onClick={onConfirm} disabled={isSaving} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60">{isSaving ? 'Resetting...' : 'Reset password'}</button></div>
        </div>
    </div>
}

function ResetPasswordModal({ password, onClose }) {
    const [copied, setCopied] = useState(false)
    const copyPassword = async () => {
        await navigator.clipboard.writeText(password)
        setCopied(true)
    }
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Temporary password">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Temporary password</h3>
            <p className="mt-2 text-sm text-slate-600">This password is shown only once. The user will be asked to change it at next login.</p>
            <p className="mt-4 select-all rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center font-mono text-lg font-semibold tracking-wide text-amber-900">{password}</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={copyPassword} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600"><FaCopy className="h-2.5 w-2.5" />{copied ? 'Copied' : 'Copy'}</button><button type="button" onClick={onClose} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white">Done</button></div>
        </div>
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
    const toast = useAdminToast()
    const [paymentMethods, setPaymentMethods] = useState([])
    const [form, setForm] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState('')

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
        try {
            const formData = new FormData(event.currentTarget)
            const methodId = form?.payment_method_id
            const data = await request(methodId ? `${PAYMENT_METHODS_API}/${methodId}` : PAYMENT_METHODS_API, {
                method: methodId ? 'PUT' : 'POST',
                body: formData,
            })
            setForm(null)
            await loadPaymentMethods()
            toast.success(data.message || `Payment method ${methodId ? 'updated' : 'created'} successfully.`)
        } catch (saveError) {
            notifyAdminActionError(toast, saveError, 'Unable to save the payment method.')
        } finally {
            setIsSaving(false)
        }
    }

    const changeActiveState = async (paymentMethod) => {
        setError('')
        const action = paymentMethod.is_active ? 'deactivate' : 'reactivate'
        try {
            const data = await request(`${PAYMENT_METHODS_API}/${paymentMethod.payment_method_id}/${action}`, { method: 'PATCH' })
            await loadPaymentMethods()
            toast.success(data.message || `Payment method ${action}d successfully.`)
        } catch (stateError) {
            notifyAdminActionError(toast, stateError, 'Unable to update the payment method.')
        }
    }

    return <Panel title="Payment Settings" icon={FaCreditCardIcon}>
        <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Manage QR payment methods available to guests.</p>
            <button type="button" onClick={() => setForm({ method_name: '', method_type: 'gcash', account_name: '', account_number: '' })} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-700"><FaPlus className="h-2.5 w-2.5" />Add Payment Method</button>
        </div>
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
