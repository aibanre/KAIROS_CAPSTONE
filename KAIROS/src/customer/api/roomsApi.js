import { getImageUrl } from "../../public/utils/parseImages.js";
import { request } from "./client";

function normalizeRoom(room) {
  return {
    id: String(room.room_id ?? room.id),
    name: room.room_number ?? room.name ?? "Room",
    type: room.room_type ?? room.type ?? "Room",
    price: Number(room.price_per_night ?? room.price ?? 0),
    capacity: Number(room.capacity ?? 0),
    size: room.size ?? "",
    bed: room.bed ?? "Comfortable bedding",
    image: getImageUrl(room.images) || "",
    photos: Array.isArray(room.images) ? room.images : [getImageUrl(room.images)].filter(Boolean),
    description: room.description ?? "",
    amenities: typeof room.amenities === "string"
      ? room.amenities.split(",").map((item) => item.trim()).filter(Boolean)
      : room.amenities || [],
    bookedDates: [],
    rating: room.average_rating == null ? null : Number(room.average_rating),
    reviewCount: Number(room.review_count ?? 0),
  };
}

export async function listRooms() {
  const data = await request("/api/rooms");
  return (data.rooms || []).map(normalizeRoom);
}

export async function getRoom(id) {
  const data = await request(`/api/rooms/${encodeURIComponent(id)}`);
  return normalizeRoom(data.room);
}

export function checkAvailability(params) {
  const query = new URLSearchParams(params);
  return request(`/api/rooms/availability?${query.toString()}`);
}

export function getBookedDates(id, year, month) {
  return request(`/api/rooms/${encodeURIComponent(id)}/booked-dates?year=${year}&month=${month}`);
}

export { normalizeRoom };
