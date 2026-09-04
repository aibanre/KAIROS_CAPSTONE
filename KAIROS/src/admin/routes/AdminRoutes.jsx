import { Route, Routes } from 'react-router-dom'
import AdminLayout from '../layouts/AdminLayout.jsx'
import DashboardPage from '../pages/DashboardPage.jsx'
import ReservationsPage from '../pages/ReservationsPage.jsx'
import RoomsPage from '../pages/RoomsPage.jsx'
import VenuesPage from '../pages/VenuesPage.jsx'
import PaymentsPage from '../pages/PaymentsPage.jsx'
import CustomersPage from '../pages/CustomersPage.jsx'
import ChatbotPage from '../pages/ChatbotPage.jsx'
import ReportsPage from '../pages/ReportsPage.jsx'
import AuditLogsPage from '../pages/AuditLogsPage.jsx'
import SettingsPage from '../pages/SettingsPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'

export default function AdminRoutes() {
    return (
        <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="reservations" element={<ReservationsPage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="venues" element={<VenuesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="chatbot" element={<ChatbotPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
        </Routes>
    )
}
