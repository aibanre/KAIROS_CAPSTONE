function normalizeReview(review) {
  return {
    ...review,
    id: String(review.review_id ?? review.id),
    reservationId: String(review.reservation_id ?? review.reservationId ?? ""),
    name: review.name ?? ([review.first_name, review.last_name].filter(Boolean).join(" ") || "Guest"),
    date: review.date ?? review.created_at,
    comment: review.comment ?? "",
    rating: Number(review.rating ?? 0),
  };
}

export async function listReviews() {
  const data = await request("/api/reviews");
  return (data.reviews || []).map(normalizeReview);
}

export async function getResourceReviews({ roomId, venueId, limit = 6 }) {
  const params = new URLSearchParams();
  if (roomId !== undefined) params.set("room_id", String(roomId));
  if (venueId !== undefined) params.set("venue_id", String(venueId));
  params.set("limit", String(limit));
  const data = await request(`/api/reviews?${params.toString()}`);
  return (data.reviews || []).map(normalizeReview);
}

export async function listMyReviews() {
  const data = await request("/api/customer/reviews");
  return (data.reviews || []).map(normalizeReview);
}

export async function submitReview(review) {
  return request("/api/customer/reviews", { method: "POST", body: review });
}
import { request } from "./client";
