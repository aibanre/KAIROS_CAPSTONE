import { Route, Routes } from 'react-router-dom'
import PublicLayout from '../layouts/PublicLayout.jsx'
import LandingPage from '../pages/LandingPage.jsx'
import { RoomsAndVenuesPage } from '../pages/RoomsAndVenuesPage.jsx'
import { RoomsAndVenuesDetailsPage } from '../pages/RoomsAndVenuesDetailsPage.jsx'
import { BookingInformationPage } from '../pages/BookingInformationPage.jsx'
import { PaymentDetailsPage } from '../pages/PaymentDetailsPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import RegisterPage from '../pages/RegisterPage.jsx'

export default function PublicRoutes() {
	return (
		<Routes>
			<Route element={<PublicLayout />}>
				<Route path="/rooms-and-venues" element={<RoomsAndVenuesPage />} />
				<Route path="/rooms-and-venues-details" element={<RoomsAndVenuesDetailsPage />} />
				<Route path="/booking-information" element={<BookingInformationPage />} />
				<Route path="/book/room/:roomId" element={<BookingInformationPage />} />
				<Route path="/payment/:reservationId" element={<PaymentDetailsPage />} />
			</Route>
			<Route path="/login" element={<LoginPage />} />
			<Route path="/register" element={<RegisterPage />} />
			<Route path="/" element={<LandingPage />} />
			<Route path="*" element={<LandingPage />} />
		</Routes>
	)
}
