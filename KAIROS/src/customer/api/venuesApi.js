import { getImageUrl } from "../../public/utils/parseImages.js";
import { request } from "./client";

function normalizeVenue(venue) {
  const image = getImageUrl(venue.images) || "";
  return {
    id: String(venue.venue_id ?? venue.id),
    name: venue.venue_name ?? venue.name ?? "Venue",
    type: venue.venue_type ?? venue.type ?? "Venue",
    price: Number(venue.price ?? venue.price_per_event ?? 0),
    capacity: Number(venue.capacity ?? 0),
    size: venue.size ?? "",
    image,
    photos: Array.isArray(venue.images) ? venue.images : [image].filter(Boolean),
    description: venue.description ?? "",
    amenities: typeof venue.amenities === "string"
      ? venue.amenities.split(",").map((item) => item.trim()).filter(Boolean)
      : venue.amenities || [],
    bookedDates: [],
    rating: Number(venue.rating ?? 0),
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

export { normalizeVenue };
