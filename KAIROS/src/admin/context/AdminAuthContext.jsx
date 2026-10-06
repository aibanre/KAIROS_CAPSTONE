import { createContext, useContext, useEffect, useState } from 'react'
import { API_URL } from '../../config/api.js'

export { API_URL }
const AUTH_API_URL = `${API_URL}/api/auth`
const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const refreshUser = async () => {
        try {
            const response = await fetch(`${AUTH_API_URL}/me`, { credentials: 'include' })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) {
                setUser(null)
                return null
            }
            setUser(data.user ?? null)
            return data.user ?? null
        } catch {
            setUser(null)
            return null
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refreshUser()
    }, [])

    const logout = async () => {
        try {
            await fetch(`${AUTH_API_URL}/logout`, { method: 'POST', credentials: 'include' })
        } catch {
        } finally {
            setUser(null)
        }
    }

    return <AdminAuthContext.Provider value={{ user, role: user?.role ?? null, loading, logout, refreshUser }}>
        {children}
    </AdminAuthContext.Provider>
}

export function useAdminAuth() {
    const context = useContext(AdminAuthContext)
    if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider.')
    return context
}
