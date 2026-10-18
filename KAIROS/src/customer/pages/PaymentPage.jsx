import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PaymentMethodSelector from "../components/PaymentMethodSelector";
import ProofOfPaymentUploader from "../components/ProofOfPaymentUploader";
import { getReservation, releaseReservationHold } from "../api/reservationsApi";
import { listPaymentMethods, submitPaymentProof } from "../api/paymentsApi";
import { useBooking } from "../context/BookingContext";
import { formatDateRange, formatVenueWindow } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";
import { API_URL } from "../../config/api.js";
import ReservationLimitNotice from "../../shared/ReservationLimitNotice.jsx";
import HoldTimerBar from "../../shared/components/HoldTimerBar.jsx";
import useHoldCountdown from "../../shared/hooks/useHoldCountdown.js";

export default function PaymentPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { getReservation: getLocalReservation, submitPaymentProof: savePayment } = useBooking();
  const [reservation, setReservation] = useState(getLocalReservation(reservationId));
  const activeHold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentImageError, setPaymentImageError] = useState(false);
  const secondsLeft = useHoldCountdown(
    reservation?.holdExpiresAt,
    reservation?.serverTime || activeHold?.server_time,
    reservation?.serverTimeReceivedAt || activeHold?.server_time_received_at,
  );
  const [reservationLimitHolds, setReservationLimitHolds] = useState([]);
  const paymentCompleted = useRef(false);
  const reservationStatusRef = useRef(reservation?.rawStatus ?? null);
  const selectedMethod = methods.find((item) => item.method_name === method);

  useEffect(() => {
    setPaymentImageError(false);
  }, [method]);

  useEffect(() => {
    Promise.all([
      getReservation(reservationId),
      listPaymentMethods(),
    ])
      .then(([reservationData, paymentMethods]) => {
        reservationStatusRef.current = reservationData.reservation.rawStatus;
        setReservation({
          ...reservationData.reservation,
          serverTime: reservationData.reservation.serverTime || activeHold?.server_time,
        });
        setMethods(paymentMethods);
        setMethod(paymentMethods[0]?.method_name || "");
      })
      .catch((loadError) => {
        if ([401, 403, 404].includes(loadError.status)) {
          setIsRedirecting(true);
          navigate(`/portal/reservations/${encodeURIComponent(reservationId)}`, { replace: true });
          return;
        }
        setError(loadError.message);
      })
      .finally(() => setIsLoading(false));
  }, [navigate, reservationId]);

  useEffect(() => {
    if (!isLoading && reservation && reservation.rawStatus !== "payment_pending") {
      setIsRedirecting(true);
      navigate(`/portal/reservations/${encodeURIComponent(reservation.id)}`, { replace: true });
    }
  }, [isLoading, navigate, reservation]);

  useEffect(() => {
    if (secondsLeft !== 0 || !reservation) return;
    sessionStorage.removeItem("kairos_reservation_hold");
    navigate(reservation.type === "venue" ? `/portal/venues/${reservation.itemId}` : `/portal/rooms/${reservation.itemId}`, {
      replace: true,
      state: { message: "Your payment hold expired. Please choose your dates again." },
    });
  }, [navigate, reservation, secondsLeft]);

  useEffect(() => () => {
    if (paymentCompleted.current || !reservationId || reservationStatusRef.current !== "payment_pending") return;
    const url = `${API_URL}/api/reservations/${encodeURIComponent(reservationId)}/hold`;
    const body = JSON.stringify({});
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    else releaseReservationHold(reservationId).catch(() => {});
  }, [reservationId]);

  async function submit(event) {
    event.preventDefault();
    if (!method) return setError("Select a payment method.");
    if (!proof) return setError("Upload your proof of payment.");
    setError("");
    setIsSubmitting(true);
    try {
      const result = await submitPaymentProof(reservation.id, selectedMethod.payment_method_id, proof);
      paymentCompleted.current = true;
      sessionStorage.removeItem("kairos_reservation_hold");
      savePayment(reservation.id, result);
      navigate(`/portal/confirmation/${reservation.id}`);
    } catch (submitError) {
      if (submitError.status === 410) {
        setError("Your payment hold has expired. Please start a new booking.");
        return;
      }
      if (submitError.status === 429) {
        setError("There is a limit on reservations in progress. Continue an existing hold below or try again later.");
        setReservationLimitHolds(submitError.existingHolds || []);
        return;
      }
      setError("We could not submit your payment proof right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || isRedirecting || (reservation && reservation.rawStatus !== "payment_pending")) return <div className="page-shell text-slate">Loading payment details...</div>;
  if (!reservation) return <Navigate to="/portal/reservations" replace />;

  return (
    <div className="page-shell">
      <HoldTimerBar
        secondsLeft={secondsLeft}
        resourceName={reservation.itemName}
        expiredHref={`/portal/${reservation.type === "venue" ? "venues" : "rooms"}/${encodeURIComponent(reservation.itemId)}`}
        backLabel={`Back to ${reservation.type}`}
      />
      <p className="eyebrow">Secure your reservation</p><h1 className="page-title">Payment and proof</h1>      
      <div className="mt-4"><ReservationLimitNotice holds={reservationLimitHolds} portal /></div>
      <p className="mt-2 text-sm text-slate">All bookings are final. Cancellations, refunds, and rebooking are not available. <a href="/payment-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Read our Payment Policy</a></p>
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} className="space-y-8 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          <PaymentMethodSelector value={method} onChange={setMethod} methods={methods.map((item) => ({ name: item.method_name, detail: item.account_number || item.method_type }))} />
          {selectedMethod ? <section className="rounded-2xl bg-tint p-5 text-sm leading-6 text-navy"><div className="flex flex-col gap-5 sm:flex-row sm:items-start"><div className="shrink-0">{selectedMethod.qr_image_url && !paymentImageError ? <a href={selectedMethod.qr_image_url} target="_blank" rel="noreferrer" download={`${selectedMethod.method_name}-payment-qr`}><img className="size-52 rounded-xl bg-white object-contain p-3 shadow-sm" src={selectedMethod.qr_image_url} alt={`${selectedMethod.method_name} payment QR code`} onError={() => setPaymentImageError(true)} /></a> : <div className="grid size-52 place-items-center rounded-xl bg-white p-5 text-center text-sm text-slate">Payment QR/photo is not available for this method.</div>}<p className="mt-2 text-center text-xs text-slate">{selectedMethod.qr_image_url && !paymentImageError ? "Tap the image to open or save it." : "Use the account details shown beside this panel."}</p></div><div><p className="font-bold">{selectedMethod.method_name} instructions</p><p className="mt-1 text-slate">{selectedMethod.account_name || "Payment account"}</p><p className="text-slate">{selectedMethod.account_number || "Follow the selected payment method instructions."}</p>{reservation.hasPaymentSummary ? <p className="mt-4 font-bold text-navy">Amount due now: {formatCurrency(reservation.depositDue)}</p> : null}</div></div></section> : null}
          <div><h2 className="mb-4 text-xl font-bold text-navy">Proof of payment</h2><ProofOfPaymentUploader file={proof} onChange={setProof} /></div>
          {reservation.paymentRejectionReason && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">Payment proof rejected: {reservation.paymentRejectionReason}</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60" type="submit" disabled={isSubmitting || secondsLeft === 0 || reservation.status !== "Pending" || reservation.paymentStatus !== "Unpaid"}>{isSubmitting ? "Submitting payment proof..." : "Submit payment proof"}</button>
        </form>
        <aside className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">Payment summary</p>{reservation.image ? <img className="mt-4 h-40 w-full rounded-2xl object-cover" src={reservation.image} alt="" /> : <div className="mt-4 h-40 w-full rounded-2xl bg-tint" aria-label="No reservation image available" />}<h2 className="mt-4 text-xl font-bold text-navy">{reservation.itemName}</h2><p className="mt-2 text-sm text-slate">{reservation.type === "venue" ? formatVenueWindow(reservation.startDate, reservation.startTime, reservation.endTime) : formatDateRange(reservation.startDate, reservation.endDate)}</p>{reservation.type === "venue" ? <p className="mt-2 text-sm text-slate">{reservation.packageName} · {reservation.pax} pax</p> : null}<div className="mt-5 border-t border-border pt-5 font-extrabold text-navy"><div className="flex justify-between"><span>Total</span><span>{formatCurrency(reservation.total)}</span></div>{reservation.hasPaymentSummary ? <><div className="mt-2 flex justify-between text-primary"><span>Amount due now</span><span>{formatCurrency(reservation.depositDue)}</span></div><div className="mt-2 flex justify-between text-slate"><span>Balance due</span><span>{formatCurrency(reservation.balanceDue)}</span></div></> : null}</div></aside>
      </div>
    </div>
  );
}
