import { NavLink, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import {
    FaBed,
    FaBuilding,
    FaCalendarCheck,
    FaChartBar,
    FaClipboardList,
    FaComments,
    FaCog,
    FaCreditCard,
    FaSignOutAlt,
    FaTachometerAlt,
    FaUsers,
} from 'react-icons/fa'

const navigation = [
    { label: 'Dashboard', path: '/admin', icon: FaTachometerAlt, end: true, roles: ['admin', 'receptionist'] },
    { label: 'Reservations', path: '/admin/reservations', icon: FaCalendarCheck, roles: ['admin', 'receptionist'] },
    { label: 'Walk-in Bookings', path: '/admin/walk-in', icon: FaCalendarCheck, roles: ['admin', 'receptionist'] },
    { label: 'Rooms', path: '/admin/rooms', icon: FaBed, roles: ['admin'] },
    { label: 'Venues', path: '/admin/venues', icon: FaBuilding, roles: ['admin'] },
    { label: 'Payments', path: '/admin/payments', icon: FaCreditCard, roles: ['admin', 'receptionist'] },
    { label: 'Customers', path: '/admin/customers', icon: FaUsers, roles: ['admin'] },
    { label: 'Chatbot', path: '/admin/chatbot', icon: FaComments, roles: ['admin'] },
    { label: 'Reports', path: '/admin/reports', icon: FaChartBar, roles: ['admin', 'receptionist'] },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: FaClipboardList, roles: ['admin'] },
    { label: 'Settings', path: '/admin/settings', icon: FaCog, roles: ['admin'] },
]

export default function AdminSidebar({ open = false, onClose }) {
	const navigate = useNavigate()
	const { user, role, logout } = useAdminAuth()
	const visibleNavigation = navigation.filter(({ roles }) => roles.includes(role))
	const initials = user?.full_name?.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'AU'

	const handleLogout = async () => {
		await logout()
		navigate('/admin/login', { replace: true })
	}

    return (
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-slate-300 transition-transform motion-reduce:transition-none lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="border-b border-white/10 px-6 py-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">KAIROS</p>
                <h1 className="mt-1 text-lg font-bold text-white">Admin Portal</h1>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
                {visibleNavigation.map(({ label, path, icon: Icon, end }) => (
                    <NavLink
                        key={label}
                        to={path}
                        end={end}
                        onClick={onClose}
                        className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div className="border-t border-white/10 p-4">
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">{initials}</div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{user?.full_name || 'Admin User'}</p>
                        <p className="truncate text-xs capitalize text-slate-400">{role || 'Staff'}</p>
                    </div>
                </div>
                <button type="button" onClick={handleLogout} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">
                    <FaSignOutAlt className="h-3 w-3" />
                    Logout
                </button>
            </div>
        </aside>
    )
}
