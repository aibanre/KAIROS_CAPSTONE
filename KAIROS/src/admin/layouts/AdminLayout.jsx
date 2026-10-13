import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { FaBars } from 'react-icons/fa'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { AdminNotificationsProvider } from '../context/AdminNotificationsContext.jsx'


export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const location = useLocation()

    useEffect(() => {
        if (!sidebarOpen) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setSidebarOpen(false)
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [sidebarOpen])

    const pageTitle = location.pathname.split('/').filter(Boolean).pop()
    const title = pageTitle === 'admin' ? 'Dashboard' : pageTitle?.replace(/-/g, ' ') || 'Admin Portal'

    return (
        <AdminNotificationsProvider>
            <div className="min-h-screen overflow-x-hidden bg-slate-100">
                {sidebarOpen ? <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden motion-safe:transition-opacity" onClick={() => setSidebarOpen(false)} /> : null}
                <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="min-h-[100dvh] min-w-0 overflow-x-hidden lg:pl-64">
                    <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur sm:px-4 lg:hidden">
                        <button type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <FaBars className="h-5 w-5" />
                        </button>
                        <h1 className="min-w-0 flex-1 truncate text-base font-semibold capitalize text-slate-800">{title}</h1>
                    </header>
                    <div className="min-w-0 p-3 sm:p-4 lg:p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </AdminNotificationsProvider>
    )
}
