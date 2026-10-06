import { createContext, useContext, useEffect, useState } from 'react'
import { API_URL } from '../config/api.js'

const DEFAULT_RESORT_INFO = {
    resort_name: 'Kai Azul Beach Resort',
    address: '123 Shoreline Drive, Beach City',
    contact_number: '+63 912 345 6789',
    email: 'info@kaiazul.com',
}

const ResortInfoContext = createContext(DEFAULT_RESORT_INFO)

export function ResortInfoProvider({ children }) {
    const [resortInfo, setResortInfo] = useState(DEFAULT_RESORT_INFO)

    useEffect(() => {
        let isMounted = true
        fetch(`${API_URL}/api/resort-info`)
            .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load resort information.')))
            .then((data) => {
                if (isMounted) setResortInfo({ ...DEFAULT_RESORT_INFO, ...data })
            })
            .catch(() => {
                // Keep the built-in values when the API or migration is unavailable.
            })
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
