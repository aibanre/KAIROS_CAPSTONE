import { request } from "./client";

export async function listPaymentMethods() {
  const data = await request("/api/payment-methods");
  return data.paymentMethods || [];
}

export function submitPaymentProof(reservationId, paymentMethodId, file) {
  const body = new FormData();
  body.append("payment_method_id", String(paymentMethodId));
  body.append("proof_of_payment", file);
  return request(`/api/reservations/${encodeURIComponent(reservationId)}/payment`, {
    method: "POST",
    body,
  });
}

// TODO(backend): Add customer payment history endpoint.
export async function getPaymentHistory() {
  return [];
}
