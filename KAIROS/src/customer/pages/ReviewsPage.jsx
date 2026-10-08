import { Link } from "react-router";
import EmptyState from "../components/EmptyState";
import StarRating from "../components/StarRating";
import { useBooking } from "../context/BookingContext";

export default function ReviewsPage() {
  const { reservations, reviews } = useBooking();
  const mine = reviews.filter((review) => review.reservationId);
  const pending = reservations.filter((item) => item.status === "Completed" && !item.reviewed);

  return (
    <div className="page-shell">
      <p className="eyebrow">Your feedback</p><h1 className="page-title">My reviews</h1><p className="mt-3 text-slate">Share what made your experience memorable and revisit what you have written.</p>
      <section className="mt-10"><h2 className="section-title">Waiting for your review</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{pending.map((item) => <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-soft sm:flex-row"><img className="h-40 w-full rounded-xl object-cover sm:size-24" src={item.image} alt="" /><div><h3 className="font-bold text-navy">{item.itemName}</h3><p className="mt-1 text-sm text-slate">Completed reservation</p><Link className="mt-4 inline-flex w-full justify-center rounded-lg bg-accent px-4 py-2 text-sm font-extrabold text-navy sm:w-auto" to={`/portal/reviews/new/${item.id}`}>Write review</Link></div></article>)}</div>{!pending.length && <div className="mt-5"><EmptyState title="No reviews waiting" message="Completed stays that need feedback will appear here." /></div>}</section>
      <section className="mt-10"><h2 className="section-title">Reviews you have written</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{mine.map((review) => <article key={review.id} className="rounded-2xl border border-border bg-white p-5"><div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><h3 className="font-bold text-navy">{review.itemName}</h3><p className="mt-1 text-xs text-slate">{review.date}</p></div><StarRating value={review.rating} /></div><p className="mt-4 text-sm leading-6 text-slate">{review.comment}</p></article>)}</div>{!mine.length && <div className="mt-5"><EmptyState title="No reviews yet" message="Your submitted reviews will be collected here." /></div>}</section>
    </div>
  );
}
