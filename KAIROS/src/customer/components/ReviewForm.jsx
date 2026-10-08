import { useState } from "react";
import StarRating from "./StarRating";

export default function ReviewForm({ reservation, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!comment.trim()) return setError("Tell us a little about your experience.");
    if (comment.trim().length < 12) return setError("Please share at least 12 characters.");
    setError("");
    onSubmit?.({ rating, comment, reservation });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-border bg-white p-6 shadow-soft">
      <label className="block text-sm font-bold text-navy">Your rating</label>
      <div className="mt-2"><StarRating value={rating} interactive onChange={setRating} /></div>
      <label className="mt-6 block text-sm font-bold text-navy" htmlFor="review-comment">Tell us about your stay</label>
      <textarea id="review-comment" required rows="5" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What stood out during your experience?" className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-navy outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      {error && <p className="mt-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
      <button className="mt-5 rounded-xl bg-accent px-6 py-3 font-extrabold text-navy hover:bg-accent-hover" type="submit">Submit review</button>
    </form>
  );
}
