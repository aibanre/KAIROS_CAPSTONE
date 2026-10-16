export function safeAdminRedirect(value, currentOrigin) {
    if (typeof value !== 'string'
        || !value.startsWith('/admin/')
        || value.startsWith('//')
        || value.includes('//')
        || value.includes('\\')
        || value.includes('%')
        || /[\u0000-\u0020]/.test(value)) return null

    try {
        const parsed = new URL(value, currentOrigin)
        const rawPath = value.split(/[?#]/, 1)[0]
        if (parsed.origin !== currentOrigin
            || parsed.pathname !== rawPath
            || !parsed.pathname.startsWith('/admin/')) return null
        return value
    } catch {
        return null
    }
}
