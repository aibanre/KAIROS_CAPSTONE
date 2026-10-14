import { getImageUrl, getImageUrls } from "../../public/utils/parseImages.js";
import { request } from "./client";

function normalizeVenue(venue) {
  const image = getImageUrl(venue.images) || "";
  return {
    id: String(venue.venue_id ?? venue.id),
    name: venue.venue_name ?? venue.name ?? "Venue",
    type: venue.venue_type ?? venue.type ?? "Venue",
    price: Number(venue.price ?? venue.price_per_event ?? 0),
    flat_price: Number(venue.flat_price ?? venue.price ?? 0),
    booking_mode: venue.booking_mode ?? "day_use",
    venue_id: venue.venue_id ?? venue.id,
    start_time: venue.start_time,
    end_time: venue.end_time,
    earliest_start: venue.earliest_start,
    latest_end: venue.latest_end,
    capacity: Number(venue.capacity ?? 0),
    size: venue.size ?? "",
    image,
    photos: getImageUrls(venue.images),
    description: venue.description ?? "",
    amenities: typeof venue.amenities === "string"
      ? venue.amenities.split(",").map((item) => item.trim()).filter(Boolean)
      : venue.amenities || [],
    bookedDates: [],
    rating: venue.average_rating == null ? null : Number(venue.average_rating),
    reviewCount: Number(venue.review_count ?? 0),
  };
}

export async function listVenues() {
  const data = await request("/api/venues");
  return (data.venues || []).map(normalizeVenue);
}

export async function getVenue(id) {
  const data = await request(`/api/venues/${encodeURIComponent(id)}`);
  return normalizeVenue(data.venue);
}

export async function getBookedDates(id, year, month) {
  const data = await request(`/api/venues/${encodeURIComponent(id)}/booked-dates?year=${year}&month=${month}`);
  return { bookedDates: data.booked_dates || [] };
}

export async function getVenuePackages(id) {
  const data = await request(`/api/venues/${encodeURIComponent(id)}/packages`, { cache: "no-store" });
  return data.packages || [];
}

export { normalizeVenue };
