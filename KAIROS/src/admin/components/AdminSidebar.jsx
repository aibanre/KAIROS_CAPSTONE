import { NavLink } from 'react-router-dom'
import {
    FaBed,
    FaBuilding,
    FaCalendarCheck,
    FaChartBar,
    FaClipboardList,
    FaComments,
    FaCog,
    FaCreditCard,
    FaTachometerAlt,
    FaUsers,
} from 'react-icons/fa'

const navigation = [
    { label: 'Dashboard', path: '/admin', icon: FaTachometerAlt, end: true },
    { label: 'Reservations', path: '/admin/reservations', icon: FaCalendarCheck },
    { label: 'Rooms', path: '/admin/rooms', icon: FaBed },
    { label: 'Venues', path: '/admin/venues', icon: FaBuilding },
    { label: 'Payments', path: '/admin/payments', icon: FaCreditCard },
    { label: 'Customers', path: '/admin/customers', icon: FaUsers },
    { label: 'Chatbot', path: '/admin/chatbot', icon: FaComments },
    { label: 'Reports', path: '/admin/reports', icon: FaChartBar },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: FaClipboardList },
    { label: 'Settings', path: '/admin/settings', icon: FaCog },
]

export default function AdminSidebar() {
    return (
        <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-slate-300">
            <div className="border-b border-white/10 px-6 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">KAIROS</p>
                <h1 className="mt-1 text-lg font-bold text-white">Admin Portal</h1>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
                {navigation.map(({ label, path, icon: Icon, end }) => (
                    <NavLink
                        key={label}
                        to={path}
                        end={end}
                        className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div className="border-t border-white/10 p-4">
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">AU</div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">Admin User</p>
                        <p className="truncate text-xs text-slate-400">Administrator</p>
                    </div>
                </div>
            </div>
        </aside>
    )
}
