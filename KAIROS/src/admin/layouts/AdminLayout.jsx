import { Outlet } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { AdminNotificationsProvider } from '../context/AdminNotificationsContext.jsx'

export default function AdminLayout() {
    return (
        <AdminNotificationsProvider>
            <div className="min-h-screen bg-slate-100">
                <AdminSidebar />
                <main className="min-h-screen pl-64">
                    <div className="p-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </AdminNotificationsProvider>
    )
}
