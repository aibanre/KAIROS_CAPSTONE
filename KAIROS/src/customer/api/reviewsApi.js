function normalizeReview(review) {
  return {
    ...review,
    id: String(review.review_id ?? review.id),
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

export async function submitReview(review) {
  return request("/api/customer/reviews", { method: "POST", body: review });
}
import { request } from "./client";
