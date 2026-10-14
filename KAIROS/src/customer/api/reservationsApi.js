import { request } from "./client";
import { getImageUrl } from "../../public/utils/parseImages.js";

function normalizeInclusions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }

}

export function normalizeReservation(reservation) {
  const statusMap = {
    payment_pending: "Pending",
    pending_verification: "Payment Verified",
    confirmed: "Confirmed",
    checked_in: "Checked In",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
  };
  const paymentStatusMap = {
    pending: "Unpaid",
    pending_verification: "Proof Submitted",
    verified: "Verified",
    rejected: "Rejected",
  };
  const latestPayment = reservation.latest_payment || {};
  const holdExpiresAt = reservation.hold_expires_at ?? reservation.holdExpiresAt ?? null;
  const isActiveHold = reservation.status === "payment_pending"
    && (!holdExpiresAt || new Date(holdExpiresAt).getTime() > Date.now());
  const image = getImageUrl(reservation.images ?? reservation.image) ?? "";
  return {
    id: String(reservation.reservation_id ?? reservation.id),
    reference: reservation.booking_reference ?? reservation.reference ?? "",
    itemId: String(reservation.room_id ?? reservation.venue_id ?? reservation.itemId ?? ""),
    itemName: reservation.room_number ?? reservation.venue_name ?? reservation.itemName ?? "Reservation",
    image: typeof image === "string" ? image.trim() : "",
    type: reservation.venue_id ? "venue" : "room",
    eventDate: reservation.event_date ?? reservation.eventDate ?? "",
    startDate: reservation.check_in_date ?? reservation.event_date ?? reservation.startDate,
    endDate: reservation.check_out_date ?? reservation.event_date ?? reservation.endDate,
    guests: Number(reservation.num_guests ?? reservation.guests ?? 0),
    children: Number(reservation.children ?? 0),
    startTime: reservation.start_time ?? reservation.startTime ?? "",
    endTime: reservation.end_time ?? reservation.endTime ?? "",
    durationHours: Number(reservation.duration_hours ?? 0),
    pax: Number(reservation.pax ?? reservation.num_guests ?? 0),
    packageName: reservation.package_name ?? reservation.packageName ?? "",
    packageInclusions: normalizeInclusions(reservation.package_inclusions ?? reservation.packageInclusions),
    pricingType: reservation.pricing_type ?? reservation.pricingType ?? "",
    unitPrice: Number(reservation.unit_price ?? 0),
    extraHours: Number(reservation.extra_hours ?? 0),
    status: statusMap[reservation.status] ?? reservation.status ?? "Pending",
    paymentStatus: paymentStatusMap[reservation.payment_status] ?? reservation.payment_status ?? reservation.paymentStatus ?? "Unpaid",
    paymentRejectionReason: reservation.payment_rejection_reason ?? latestPayment.rejection_reason ?? "",
    total: Number(reservation.total_amount ?? reservation.total ?? 0),
    depositDue: Number(reservation.deposit_due ?? reservation.depositDue ?? 0),
    checkinQr: reservation.checkin_qr ?? reservation.checkinQr ?? null,
    createdAt: reservation.created_at ?? reservation.createdAt ?? "",
    reviewed: Boolean(reservation.reviewed),
    holdExpiresAt,
    isActiveHold,
    rawStatus: reservation.status ?? "",
    serverTime: reservation.server_time ?? null,
    raw: reservation,
  };
}

export async function createReservation(details) {
  const data = await request("/api/reservations", { method: "POST", body: details, handle401: false });
  return data;
}

export async function createReservationHold(details) {
  return request("/api/reservations/hold", { method: "POST", body: details, handle401: false });
}

export async function updateReservationHold(id, details) {
  return request(`/api/reservations/${encodeURIComponent(id)}/hold`, { method: "PATCH", body: details, handle401: false });
}

export async function releaseReservationHold(id) {
  return request(`/api/reservations/${encodeURIComponent(id)}/hold`, { method: "DELETE", handle401: false });
}

export async function getReservation(id) {
  const data = await request(`/api/reservations/${encodeURIComponent(id)}`);
  const resource = data.reservation?.venue_id ? data.venue : data.room;
  return {
    ...data,
    reservation: normalizeReservation({
      ...data.reservation,
      images: data.reservation?.images ?? resource?.images,
      room_number: data.reservation?.room_number ?? data.room?.room_number,
      venue_name: data.reservation?.venue_name ?? data.venue?.venue_name,
    }),
  };
}

export async function getMyReservations() {
  const data = await request("/api/customer/reservations");
  return (data.reservations || [])
    .filter((reservation) => !(reservation.status === "payment_pending"
      && reservation.hold_expires_at
      && new Date(reservation.hold_expires_at).getTime() <= Date.now()))
    .map(normalizeReservation);
}
