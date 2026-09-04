import { BrowserRouter, Route, Routes } from 'react-router-dom'
import {Header} from './components/Header.jsx'
import {HeroSection} from './components/HeroSection.jsx'
import {RoomsAndVenuesSection} from './components/RoomsAndVenuesSection.jsx'
import {ResortAmenities} from './components/ResortAmenities.jsx'
import {Reviews} from './components/Reviews.jsx'
import {Footer} from './components/Footer.jsx'
import {AvailabilityCalendar} from './components/AvailabilityCalendar.jsx'
import {RoomsAndVenuesDetailsPage} from './pages/RoomsAndVenuesDetailsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import AdminRoutes from './admin/routes/AdminRoutes.jsx'

function PublicSite() {
    return (
        <>
            <Header />
            <HeroSection />
            <AvailabilityCalendar />
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
                <Route path="/rooms-and-venues-details" element={<RoomsAndVenuesDetails />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="*" element={<PublicSite />} />
            </Routes>
        </BrowserRouter>
    );
}
