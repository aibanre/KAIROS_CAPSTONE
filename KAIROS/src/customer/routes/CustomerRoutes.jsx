import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "../../public/pages/LoginPage";
import RegisterPage from "../../public/pages/RegisterPage";
import LandingPage from "../../public/pages/LandingPage";
import { RoomsAndVenuesPage } from "../../public/pages/RoomsAndVenuesPage";
import { RoomsAndVenuesDetailsPage } from "../../public/pages/RoomsAndVenuesDetailsPage";
import { BookingInformationPage } from "../../public/pages/BookingInformationPage";
import { PaymentDetailsPage } from "../../public/pages/PaymentDetailsPage";
import PublicLayout from "../../public/layouts/PublicLayout";
import BookingProvider from "../context/BookingContext";
import CustomerAuthProvider, { useCustomerAuth } from "../context/CustomerAuthContext";
import PortalLayout from "../layouts/PortalLayout";
import BookingConfirmationPage from "../pages/BookingConfirmationPage";
import BookingPage from "../pages/BookingPage";
import BrowsePage from "../pages/BrowsePage";
import ChatbotPage from "../pages/ChatbotPage";
import DashboardPage from "../pages/DashboardPage";
import MyReservationsPage from "../pages/MyReservationsPage";
import PaymentPage from "../pages/PaymentPage";
import ProfilePage from "../pages/ProfilePage";
import ReservationDetailsPage from "../pages/ReservationDetailsPage";
import ReviewsPage from "../pages/ReviewsPage";
import RoomDetailsPage from "../pages/RoomDetailsPage";
import SubmitReviewPage from "../pages/SubmitReviewPage";
import VenueDetailsPage from "../pages/VenueDetailsPage";
import { ResortInfoProvider } from "../../public/context/ResortInfoContext";

function RequireCustomer() {
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const location = useLocation();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading customer session...</div>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

function CustomerLoginPage() {
  const { login, sessionMessage } = useCustomerAuth();
  return <LoginPage initialError={sessionMessage} onSignIn={(credentials) => login(credentials)} />;
}

function CustomerRegisterPage() {
  const { register } = useCustomerAuth();
  return <RegisterPage onRegister={(details) => register(details)} />;
}

export default function CustomerRoutes() {
  return (
    <ResortInfoProvider>
      <CustomerAuthProvider>
        <BookingProvider>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<CustomerLoginPage />} />
          <Route path="/register" element={<CustomerRegisterPage />} />
          <Route element={<PublicLayout />}>
            <Route path="/rooms-and-venues" element={<RoomsAndVenuesPage />} />
            <Route path="/rooms-and-venues-details" element={<RoomsAndVenuesDetailsPage />} />
          </Route>
          <Route element={<RequireCustomer />}>
            <Route path="/booking-information" element={<BookingInformationPage />} />
            <Route path="/book/room/:roomId" element={<BookingInformationPage />} />
            <Route path="/payment/:reservationId" element={<PaymentDetailsPage />} />
          </Route>
          <Route element={<RequireCustomer />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="browse" element={<BrowsePage />} />
              <Route path="rooms/:id" element={<RoomDetailsPage />} />
              <Route path="venues/:id" element={<VenueDetailsPage />} />
              <Route path="book" element={<BookingPage />} />
              <Route path="payment/:reservationId" element={<PaymentPage />} />
              <Route path="confirmation/:reservationId" element={<BookingConfirmationPage />} />
              <Route path="reservations" element={<MyReservationsPage />} />
              <Route path="reservations/:id" element={<ReservationDetailsPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="reviews/new/:reservationId" element={<SubmitReviewPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="chat" element={<ChatbotPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BookingProvider>
      </CustomerAuthProvider>
    </ResortInfoProvider>
  );
}
