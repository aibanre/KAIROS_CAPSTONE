import { Link, useLocation } from "react-router";
import { useEffect } from "react";
import EmptyState from "../components/EmptyState";
import StarRating from "../../shared/StarRating";
import { useBooking } from "../context/BookingContext";
import { formatReviewDate } from "../utils/dateHelpers";
import { compactCardContent, compactCardImage, compactCardShell, compactCardThumbnail, compactCardTitle } from "../components/compactCardClasses";
import ResourceImage from "../../shared/ResourceImage";

export default function ReviewsPage() {
  const { reservations, reviews, refresh } = useBooking();
  const location = useLocation();
  useEffect(() => {
    if (location.state?.reviewed) refresh();
  }, [location.state?.reviewed, refresh]);
  const mine = reviews.filter((review) => review.reservationId);
  const pending = reservations.filter((item) => item.status === "Completed" && !item.reviewed);

  return (
    <div className="page-shell">
      <p className="eyebrow">Your feedback</p><h1 className="page-title">My reviews</h1><p className="mt-3 text-slate">Share what made your experience memorable and revisit what you have written.</p>{location.state?.message ? <p className="mt-4 text-sm font-bold text-emerald-700" role="status">{location.state.message}</p> : null}
      <section className="mt-6 sm:mt-10"><h2 className="section-title">Waiting for your review</h2><div className="mt-4 grid gap-3 md:mt-5 md:grid-cols-2 md:gap-4">{pending.map((item) => <article key={item.id} className={`${compactCardShell} min-w-0 items-stretch sm:items-center sm:gap-4 sm:p-4`}><div className={`${compactCardThumbnail} sm:h-24 sm:w-24 sm:rounded-xl`}><ResourceImage src={item.image} alt="" type={item.type} wrapperClassName="aspect-[4/3] sm:aspect-auto" className={`${compactCardImage} sm:aspect-auto`} /></div><div className={`${compactCardContent} gap-1`}><h3 className={`${compactCardTitle} sm:text-base`}>{item.itemName}</h3><p className={`${compactCardInfo} sm:text-sm`}>Completed reservation</p><Link className="mt-auto inline-flex h-9 self-end items-center justify-center rounded-lg bg-accent px-4 text-sm font-extrabold text-navy hover:bg-accent-hover sm:mt-4 sm:h-auto sm:self-start sm:py-2" to={`/portal/reviews/new/${item.id}`} state={{ from: "/portal/reviews" }}>Write review</Link></div></article>)}</div>{!pending.length && <div className="mt-5"><EmptyState title="No reviews waiting" message="Completed stays that need feedback will appear here." /></div>}</section>
      <section className="mt-10"><h2 className="section-title">Reviews you have written</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{mine.map((review) => { const date = formatReviewDate(review.date); return <article key={review.id} className="rounded-2xl border border-border bg-white p-5"><div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between"><div><h3 className="font-bold text-navy">{review.itemName}</h3>{date ? <p className="mt-1 text-xs text-slate">{date}</p> : null}</div><StarRating value={review.rating} /></div><p className="mt-4 text-sm leading-6 text-slate">{review.comment}</p></article> })}</div>{!mine.length && <div className="mt-5"><EmptyState title="No reviews yet" message="Your submitted reviews will be collected here." /></div>}</section>
    </div>
  );
}
