import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import ReviewForm from "../components/ReviewForm";
import { useBooking } from "../context/BookingContext";
import { submitReview } from "../api/reviewsApi";

export default function SubmitReviewPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { getReservation, isLoading, markReviewed, refresh } = useBooking();
  const location = useLocation();
  const reservation = getReservation(reservationId);

  if (isLoading) return <div className="page-shell text-slate">Loading reservation...</div>;
  if (!reservation || reservation.status !== "Completed" || reservation.reviewed) {
    return <Navigate to="/portal/reviews" replace state={{ message: "You've already reviewed this stay." }} />;
  }

  async function handleSubmit(review) {
    try {
      await submitReview({ reservation_id: reservation.id, rating: review.rating, comment: review.comment });
      markReviewed(reservation.id, {
        reservation_id: reservation.id,
        rating: review.rating,
        comment: review.comment,
      });
      await refresh();
      navigate(location.state?.from || "/portal/reviews", {
        replace: true,
        state: { reviewed: reservation.id, message: "Review submitted successfully." },
      });
    } catch (error) {
      if (error.status === 409) {
        markReviewed(reservation.id);
        await refresh();
        navigate("/portal/reviews", {
          replace: true,
          state: { reviewed: reservation.id, message: "You've already reviewed this stay." },
        });
        return;
      }
      throw new Error("We could not submit your review. Please try again.");
    }
  }

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-2xl"><p className="eyebrow">Share your experience</p><h1 className="page-title">How was {reservation.itemName}?</h1><p className="mb-8 mt-3 text-slate">Your review helps future guests plan with confidence.</p><ReviewForm reservation={reservation} onSubmit={handleSubmit} /></div>
    </div>
  );
}
