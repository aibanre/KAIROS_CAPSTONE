import { request } from "./client";

function normalizeReservation(reservation) {
  const statusMap = {
    payment_pending: "Pending",
    pending_verification: "Payment Verified",
    confirmed: "Confirmed",
    checked_in: "Confirmed",
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
  return {
    id: String(reservation.reservation_id ?? reservation.id),
    reference: reservation.booking_reference ?? reservation.reference ?? "",
    itemId: String(reservation.room_id ?? reservation.venue_id ?? reservation.itemId ?? ""),
    itemName: reservation.room_number ?? reservation.venue_name ?? reservation.itemName ?? "Reservation",
    image: reservation.image ?? "",
    type: reservation.venue_id ? "venue" : "room",
    startDate: reservation.check_in_date ?? reservation.event_date ?? reservation.startDate,
    endDate: reservation.check_out_date ?? reservation.event_date ?? reservation.endDate,
    guests: Number(reservation.num_guests ?? reservation.guests ?? 0),
    status: statusMap[reservation.status] ?? reservation.status ?? "Pending",
    paymentStatus: paymentStatusMap[reservation.payment_status] ?? reservation.payment_status ?? reservation.paymentStatus ?? "Unpaid",
    paymentRejectionReason: reservation.payment_rejection_reason ?? latestPayment.rejection_reason ?? "",
    total: Number(reservation.total_amount ?? reservation.total ?? 0),
    createdAt: reservation.created_at ?? reservation.createdAt ?? "",
    reviewed: Boolean(reservation.reviewed),
    raw: reservation,
  };
}

export async function createReservation(details) {
  const data = await request("/api/reservations", { method: "POST", body: details });
  return data;
}

export async function getReservation(id) {
  const data = await request(`/api/reservations/${encodeURIComponent(id)}`);
  return {
    ...data,
    reservation: normalizeReservation(data.reservation),
  };
}

export async function getMyReservations() {
  const data = await request("/api/customer/reservations");
  return (data.reservations || []).map(normalizeReservation);
}
