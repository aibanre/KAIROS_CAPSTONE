export default function StarRating({
  value = null,
  reviewCount = null,
  interactive = false,
  onChange,
  label = "Rating",
  showReviewLabel = false,
}) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : null;
  const roundedValue = numericValue === null ? 0 : Math.round(numericValue * 2) / 2;
  const hasReviews = reviewCount === null ? numericValue !== null : Number(reviewCount) > 0;
  const accessibleLabel = hasReviews
    ? reviewCount === null
      ? `Rated ${numericValue?.toFixed(1)} out of 5`
      : `Rated ${numericValue?.toFixed(1)} out of 5 from ${reviewCount} ${Number(reviewCount) === 1 ? "review" : "reviews"}`
    : "No reviews yet";

  return (
    <div className="flex items-center gap-2 whitespace-nowrap" aria-label={interactive ? `${label}: ${numericValue ?? 0} out of 5` : accessibleLabel}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(roundedValue);
        const half = !filled && star - roundedValue === 0.5;
        const content = (
          <span className="relative inline-block leading-none" aria-hidden="true">
            <span className="text-border">★</span>
            {filled ? <span className="absolute inset-0 text-accent">★</span> : null}
            {half ? <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden text-accent">★</span> : null}
          </span>
        );
        return interactive ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className="text-2xl focus-visible:rounded focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`${star} stars`}
          >
            {content}
          </button>
        ) : <span key={star}>{content}</span>;
      })}
      {interactive ? null : hasReviews ? (
        <span className="ml-1 text-sm font-bold text-navy">
          {numericValue?.toFixed(1)} ({reviewCount}{showReviewLabel ? ` ${Number(reviewCount) === 1 ? "review" : "reviews"}` : ""})
        </span>
      ) : (
        <span className="text-xs font-normal text-slate sm:text-sm">No reviews yet</span>
      )}
    </div>
  );
}
