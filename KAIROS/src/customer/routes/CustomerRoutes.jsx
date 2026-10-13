import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "../../public/pages/LoginPage";
import RegisterPage from "../../public/pages/RegisterPage";
import LandingPage from "../../public/pages/LandingPage";
import { RoomsAndVenuesPage } from "../../public/pages/RoomsAndVenuesPage";
import { RoomsAndVenuesDetailsPage } from "../../public/pages/RoomsAndVenuesDetailsPage";
import { BookingInformationPage } from "../../public/pages/BookingInformationPage";
import VenueBookingInformationPage from "../../public/pages/VenueBookingInformationPage";
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
import VenueBookingDetailsPage from "../pages/VenueBookingDetailsPage";
import { ResortInfoProvider } from "../../public/context/ResortInfoContext";
import PolicyPage from "../../public/components/PolicyPage";
import ResetPasswordPage from "../../public/pages/ResetPasswordPage";
import { GoogleOAuthProvider } from "@react-oauth/google";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

function RequireCustomer() {
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const location = useLocation();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading customer session...</div>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

function CustomerLoginPage() {
  const { login, forgotPassword, googleSignIn, completeGoogleSignIn, sessionMessage } = useCustomerAuth();
  return <LoginPage initialError={sessionMessage} onSignIn={(credentials) => login(credentials)} onForgotPassword={forgotPassword} onGoogleSignIn={googleSignIn} onCompleteGoogleSignIn={completeGoogleSignIn} googleClientId={googleClientId} />;
}

function CustomerRegisterPage() {
  const { register, googleSignIn, completeGoogleSignIn } = useCustomerAuth();
  return <RegisterPage onRegister={(details) => register(details)} onGoogleSignIn={googleSignIn} onCompleteGoogleSignIn={completeGoogleSignIn} googleClientId={googleClientId} />;
}

function CustomerResetPasswordPage() {
  const { resetPassword } = useCustomerAuth();
  return <ResetPasswordPage onResetPassword={resetPassword} />;
}

function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    let frameId;
    let timeoutId;
    const startedAt = Date.now();
    const scroll = () => {
      if (location.hash) {
        const element = document.getElementById(location.hash.slice(1));
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (Date.now() - startedAt < 2000) {
          frameId = requestAnimationFrame(scroll);
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };

    frameId = requestAnimationFrame(scroll);
    timeoutId = window.setTimeout(() => cancelAnimationFrame(frameId), 2100);
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.key, location.pathname, location.hash]);

  return null;
}

export default function CustomerRoutes() {
  return (
    <GoogleOAuthProvider clientId={googleClientId || "disabled"}>
      <ResortInfoProvider>
      <CustomerAuthProvider>
        <BookingProvider>
          <ScrollToHash />
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<CustomerLoginPage />} />
          <Route path="/register" element={<CustomerRegisterPage />} />
          <Route path="/reset-password" element={<CustomerResetPasswordPage />} />
          <Route element={<PublicLayout />}>
            <Route path="/rooms-and-venues" element={<RoomsAndVenuesPage />} />
            <Route path="/rooms-and-venues-details" element={<RoomsAndVenuesDetailsPage />} />
            <Route path="/terms" element={<PolicyPage policy="terms" />} />
            <Route path="/privacy" element={<PolicyPage policy="privacy" />} />
            <Route path="/payment-policy" element={<PolicyPage policy="payment-policy" />} />
          </Route>
          <Route path="/booking-information" element={<BookingInformationPage />} />
          <Route path="/book/room/:roomId" element={<BookingInformationPage />} />
          <Route path="/book/venue/:venueId" element={<VenueBookingInformationPage />} />
          <Route path="/payment/:reservationId" element={<PaymentDetailsPage />} />
          <Route element={<RequireCustomer />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="browse" element={<BrowsePage />} />
              <Route path="rooms/:id" element={<RoomDetailsPage />} />
              <Route path="venues/:id" element={<VenueDetailsPage />} />
              <Route path="book/venue/:venueId" element={<VenueBookingDetailsPage />} />
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
    </GoogleOAuthProvider>
  );
}
