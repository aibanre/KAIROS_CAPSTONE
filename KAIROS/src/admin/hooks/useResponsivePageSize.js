import { useEffect, useState } from 'react'

export const DESKTOP_PAGE_SIZE = 20
export const MOBILE_PAGE_SIZE = 10

export default function useResponsivePageSize() {
    const [pageSize, setPageSize] = useState(MOBILE_PAGE_SIZE)

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

        const mediaQuery = window.matchMedia('(min-width: 1024px)')
        const updatePageSize = () => setPageSize(mediaQuery.matches ? DESKTOP_PAGE_SIZE : MOBILE_PAGE_SIZE)

        updatePageSize()
        mediaQuery.addEventListener('change', updatePageSize)
        return () => mediaQuery.removeEventListener('change', updatePageSize)
    }, [])

    return pageSize
}
