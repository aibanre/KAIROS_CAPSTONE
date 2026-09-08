import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {Header} from './components/Header.jsx'
import {HeroSection} from './components/HeroSection.jsx'
import {RoomsAndVenuesSection} from './components/RoomsAndVenuesSection.jsx'
import {ResortAmenities} from './components/ResortAmenities.jsx'
import {Reviews} from './components/Reviews.jsx'
import {Footer} from './components/Footer.jsx'
import {AvailabilityCalendar} from './components/AvailabilityCalendar.jsx'
import {RoomsAndVenuesDetailsPage} from './pages/RoomsAndVenuesDetailsPage.jsx'
import {RoomsAndVenuesPage} from './pages/RoomsAndVenuesPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import AdminRoutes from './admin/routes/AdminRoutes.jsx'

function PublicSite() {
	const navigate = useNavigate()
	const [checkIn, setCheckIn] = useState(null)
	const [checkOut, setCheckOut] = useState(null)
    const [numberOfGuests, setNumberOfGuests] = useState('2 Adults')

	const searchAvailability = () => {
		if (!checkIn || !checkOut) return

        const guests = Number.parseInt(numberOfGuests, 10)
        const params = new URLSearchParams({ checkIn, checkOut, guests: String(guests) })
		navigate(`/rooms-and-venues?${params.toString()}`)
	}

    return (
        <>
            <Header />
            <HeroSection numberOfGuests={numberOfGuests} onNumberOfGuestsChange={setNumberOfGuests} />
            <div id="availability-calendar" className="bg-slate-50">
                <AvailabilityCalendar
                    mode="general"
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onRangeSelect={(newCheckIn, newCheckOut) => {
                        setCheckIn(newCheckIn)
                        setCheckOut(newCheckOut)
                    }}
                    action={checkIn && checkOut ? (
                        <button
                            type="button"
                            onClick={searchAvailability}
                            className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800"
                        >
                            Search Availability
                        </button>
                    ) : null}
                />
            </div>
            <RoomsAndVenuesSection />
            <ResortAmenities />
            <Reviews />
            <Footer />
        </>
    )
}

function RoomsAndVenuesDetails() {
    return (
        <>
            <Header />
            <RoomsAndVenuesDetailsPage />
        </>
    )
}

function Login() {
    return <LoginPage />
}

function Register() {
	return <RegisterPage />
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/admin/*" element={<AdminRoutes />} />
                <Route path="/rooms-and-venues" element={<RoomsAndVenuesPage />} />
                <Route path="/rooms-and-venues-details" element={<RoomsAndVenuesDetails />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<PublicSite />} />
            </Routes>
        </BrowserRouter>
    );
}
