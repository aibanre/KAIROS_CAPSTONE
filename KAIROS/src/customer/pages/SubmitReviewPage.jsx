import { Navigate, useNavigate, useParams } from "react-router";
import ReviewForm from "../components/ReviewForm";
import { useBooking } from "../context/BookingContext";
import { submitReview } from "../api/reviewsApi";

export default function SubmitReviewPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { getReservation } = useBooking();
  const reservation = getReservation(reservationId);

  if (!reservation || reservation.status !== "Completed" || reservation.reviewed) {
    return <Navigate to="/portal/reviews" replace />;
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-2xl"><p className="eyebrow">Share your experience</p><h1 className="page-title">How was {reservation.itemName}?</h1><p className="mb-8 mt-3 text-slate">Your review helps future guests plan with confidence.</p><ReviewForm reservation={reservation} onSubmit={async (review) => { await submitReview({ reservation_id: reservation.id, rating: review.rating, comment: review.comment }); navigate("/portal/reviews"); }} /></div>
    </div>
  );
}
