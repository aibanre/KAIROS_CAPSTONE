import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from '../context/AdminAuthContext.jsx'
import AdminLayout from '../layouts/AdminLayout.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import ReservationsPage from '../pages/ReservationsPage.jsx'
import WalkInBookingsPage from '../pages/WalkInBookingsPage.jsx'
import RoomsPage from '../pages/RoomsPage.jsx'
import VenuesPage from '../pages/VenuesPage.jsx'
import PaymentsPage from '../pages/PaymentsPage.jsx'
import CustomersPage from '../pages/CustomersPage.jsx'
import ChatbotPage from '../pages/ChatbotPage.jsx'
import ReportsPage from '../pages/ReportsPage.jsx'
import AuditLogsPage from '../pages/AuditLogsPage.jsx'
import SettingsPage from '../pages/SettingsPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import ChangePasswordPage from '../pages/ChangePasswordPage.jsx'

function RequireRole({ allowedRoles, children }) {
    const { user, role, loading } = useAdminAuth()
    const location = useLocation()

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">Loading admin session...</div>
    if (!user) {
        const redirect = `${location.pathname}${location.search}`
        return <Navigate to={`/admin/login?redirect=${encodeURIComponent(redirect)}`} replace />
    }
    if (user.must_change_password && location.pathname !== '/admin/change-password') {
        return <Navigate to="/admin/change-password" replace state={{ redirect: `${location.pathname}${location.search}` }} />
    }
    if (!allowedRoles.includes(role)) return <Navigate to={role === 'receptionist' ? '/admin/walk-in' : '/admin/login'} replace />

    return children
}

export default function AdminRoutes() {
    return (
        <AdminAuthProvider>
            <Routes>
                <Route path="login" element={<LoginPage />} />
                <Route path="change-password" element={<RequireRole allowedRoles={['admin', 'receptionist']}><ChangePasswordPage /></RequireRole>} />
                <Route element={<RequireRole allowedRoles={['admin', 'receptionist']}><AdminLayout /></RequireRole>}>
                    <Route index element={<DashboardPage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                </Route>
                <Route element={<RequireRole allowedRoles={['admin', 'receptionist']}><AdminLayout /></RequireRole>}>
                    <Route path="reservations" element={<ReservationsPage />} />
                    <Route path="walk-in" element={<WalkInBookingsPage />} />
                </Route>
                <Route element={<RequireRole allowedRoles={['admin']}><AdminLayout /></RequireRole>}>
                    <Route path="rooms" element={<RoomsPage />} />
                    <Route path="venues" element={<VenuesPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="chatbot" element={<ChatbotPage />} />
                    <Route path="audit-logs" element={<AuditLogsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                </Route>
            </Routes>
        </AdminAuthProvider>
    )
}
