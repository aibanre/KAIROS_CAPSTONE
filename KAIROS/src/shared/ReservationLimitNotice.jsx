import { Link } from "react-router-dom";

export default function ReservationLimitNotice({ holds = [], portal = false }) {
  if (!holds.length) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" aria-label="Reservations in progress">
      <p className="font-bold">Continue a reservation in progress</p>
      <p className="mt-1">You can resume an active hold below. Proofs already submitted are waiting for staff review.</p>
      <ul className="mt-3 space-y-2">
        {holds.map((hold) => {
          const reservationId = Number(hold.reservation_id);
          const canResumePayment = hold.status === "payment_pending" && Number.isInteger(reservationId) && reservationId > 0;
          const href = portal
            ? `/portal/payment/${reservationId}`
            : `/payment/${reservationId}`;
          return (
            <li key={reservationId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
              <span>
                <span className="font-semibold">{hold.booking_reference || "Reservation"}</span>
                {hold.status === "pending_verification" ? <span className="ml-2 text-amber-800">Proof pending review</span> : null}
              </span>
              {canResumePayment ? (
                <Link
                  to={href}
                  state={hold.access_token ? { access_token: hold.access_token } : undefined}
                  onClick={() => {
                    if (hold.access_token) {
                      sessionStorage.setItem(`reservation_token_${reservationId}`, hold.access_token);
                    }
                  }}
                  className="font-bold text-sky-800 underline underline-offset-2 hover:text-sky-950"
                >
                  Continue held reservation
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
