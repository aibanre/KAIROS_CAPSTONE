import { createContext, useContext, useEffect, useState } from 'react'
import { API_URL } from '../../config/api.js'

const DEFAULT_RESORT_INFO = {
    resort_name: '',
    address: '',
    contact_number: '',
    email: '',
}

const ResortInfoContext = createContext(DEFAULT_RESORT_INFO)

export function ResortInfoProvider({ children }) {
    const [resortInfo, setResortInfo] = useState(DEFAULT_RESORT_INFO)

    useEffect(() => {
        let isMounted = true
        fetch(`${API_URL}/api/resort-info`, { credentials: 'include' })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load resort information.')))
            .then((data) => {
                if (isMounted) setResortInfo({ ...DEFAULT_RESORT_INFO, ...data })
            })
            .catch(() => {})
        return () => { isMounted = false }
    }, [])

    useEffect(() => {
        document.title = resortInfo.resort_name
    }, [resortInfo.resort_name])

    return <ResortInfoContext.Provider value={resortInfo}>{children}</ResortInfoContext.Provider>
}

export function useResortInfo() {
    return useContext(ResortInfoContext)
}

export { DEFAULT_RESORT_INFO }
