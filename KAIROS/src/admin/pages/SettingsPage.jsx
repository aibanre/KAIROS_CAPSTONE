import { useState } from 'react'
import { FaBell, FaBook, FaGlobe, FaLock, FaPen, FaShieldAlt } from 'react-icons/fa'

const defaultRoles = [
    { name: 'Super Admin', description: 'Full system access' },
    { name: 'Admin', description: 'All features except settings' },
    { name: 'Staff', description: 'Reservations, rooms, venues' },
    { name: 'Front Desk', description: 'Check-in / Check-out only' },
]

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

function TextField({ label, name, value, onChange, type = 'text', placeholder }) {
    return (
        <label className="block text-[10px] font-semibold uppercase text-slate-500">
            {label}
            <input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-normal normal-case text-slate-600 outline-none placeholder:text-slate-400 focus:border-sky-500" />
        </label>
    )
}

export default function SettingsPage({ roles = defaultRoles, onSavePaymentSettings, onSaveResortInfo, onEditRole, onEnableTwoFactor, onForcePasswordReset }) {
    const [notifications, setNotifications] = useState(defaultNotifications)
    const [payment, setPayment] = useState({ gcashNumber: '+63 912 345 6789', mayaAccount: 'merchant@kaiazul.com', bankAccount: 'XXXX-XXXX-XXXX-XXXX', taxRate: '12' })
    const [resort, setResort] = useState({ name: 'Kai Azul Beach Resort', address: '123 Shoreline Drive, Beach City', contact: '+63 912 345 6789', email: 'info@kaiazul.com' })
    const [security, setSecurity] = useState({ timeout: '30', attempts: '5', passwordLength: '8' })

    const updateState = (setter) => (event) => setter((current) => ({ ...current, [event.target.name]: event.target.value }))
    const toggleNotification = (name) => setNotifications((current) => ({ ...current, [name]: !current[name] }))

    return (
        <div className="mx-auto max-w-7xl">
            <h1 className="mb-5 text-2xl font-bold text-slate-800">Settings</h1>

            <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="User Roles & Permissions" icon={FaBook}>
                    <div className="mt-4 space-y-2">
                        {roles.map((role) => (
                            <div key={role.name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                                <div><p className="text-sm font-medium text-slate-700">{role.name}</p><p className="text-xs text-slate-400">{role.description}</p></div>
                                <button type="button" onClick={() => onEditRole?.(role)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><FaPen className="h-2.5 w-2.5" />Edit</button>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title="Payment Settings" icon={FaCreditCardIcon}>
                    <form onSubmit={(event) => { event.preventDefault(); onSavePaymentSettings?.(payment) }} className="mt-4 space-y-3">
                        <TextField label="GCash Number" name="gcashNumber" value={payment.gcashNumber} onChange={updateState(setPayment)} />
                        <TextField label="Maya Account" name="mayaAccount" value={payment.mayaAccount} onChange={updateState(setPayment)} />
                        <TextField label="Bank Account (BDO)" name="bankAccount" value={payment.bankAccount} onChange={updateState(setPayment)} />
                        <TextField label="Tax Rate (%)" name="taxRate" value={payment.taxRate} onChange={updateState(setPayment)} type="number" />
                        <button type="submit" className="w-full rounded-xl bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700">Save Payment Settings</button>
                    </form>
                </Panel>

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
                    <form onSubmit={(event) => { event.preventDefault(); onSaveResortInfo?.(resort) }} className="mt-4 space-y-3">
                        <TextField label="Resort Name" name="name" value={resort.name} onChange={updateState(setResort)} />
                        <TextField label="Address" name="address" value={resort.address} onChange={updateState(setResort)} />
                        <TextField label="Contact Number" name="contact" value={resort.contact} onChange={updateState(setResort)} />
                        <TextField label="Email" name="email" value={resort.email} onChange={updateState(setResort)} type="email" />
                        <button type="submit" className="w-full rounded-xl bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700">Save Resort Info</button>
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

function FaCreditCardIcon(props) {
    return <span {...props} className="inline-flex h-3.5 w-3.5 items-center justify-center border border-current rounded-sm" />
}
