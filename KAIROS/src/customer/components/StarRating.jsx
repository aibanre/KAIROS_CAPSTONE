export default function StarRating({ value = 0, interactive = false, onChange, label = "Rating" }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${label}: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) =>
        interactive ? (
          <button
            key={star}
            type="button"
            onClick={() => onChange?.(star)}
            className={`text-2xl leading-none focus-visible:rounded focus-visible:outline-2 focus-visible:outline-primary ${star <= value ? "text-accent" : "text-border"}`}
            aria-label={`${star} stars`}
          >
            ★
          </button>
        ) : (
          <span key={star} className={star <= Math.round(value) ? "text-accent" : "text-border"} aria-hidden="true">★</span>
        ),
      )}
      {!interactive && <span className="ml-1 text-sm font-bold text-navy">{value}</span>}
    </div>
  );
}
