import { Link } from "react-router";
import formatCurrency from "../utils/formatCurrency";
import StarRating from "./StarRating";

export default function VenueCard({ venue }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative overflow-hidden">
        <img className="h-58 w-full object-cover transition duration-500 group-hover:scale-105" src={venue.image} alt={venue.name} />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy backdrop-blur">{venue.type}</span>
      </div>
      <div className="p-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div>
            <h3 className="font-serif text-xl font-bold text-navy">{venue.name}</h3>
            <p className="mt-1 text-sm text-slate">{venue.size} · Up to {venue.capacity} guests</p>
          </div>
          <StarRating value={venue.rating} />
        </div>
        <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p><span className="text-xl font-extrabold text-navy">{formatCurrency(venue.price)}</span><span className="text-sm text-slate"> / event</span></p>
          <Link className="w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-sky sm:w-auto" to={`/portal/venues/${venue.id}`}>View venue</Link>
        </div>
      </div>
    </article>
  );
}
