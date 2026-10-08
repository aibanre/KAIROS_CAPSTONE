import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PaymentMethodSelector from "../components/PaymentMethodSelector";
import ProofOfPaymentUploader from "../components/ProofOfPaymentUploader";
import { getReservation } from "../api/reservationsApi";
import { listPaymentMethods, submitPaymentProof } from "../api/paymentsApi";
import { useBooking } from "../context/BookingContext";
import { formatDateRange } from "../utils/dateHelpers";
import formatCurrency from "../utils/formatCurrency";

export default function PaymentPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { getReservation: getLocalReservation, submitPaymentProof: savePayment } = useBooking();
  const [reservation, setReservation] = useState(getLocalReservation(reservationId));
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState("");
  const [proof, setProof] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(!reservation);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      reservation ? Promise.resolve({ reservation }) : getReservation(reservationId),
      listPaymentMethods(),
    ])
      .then(([reservationData, paymentMethods]) => {
        if (!reservation) setReservation(reservationData.reservation);
        setMethods(paymentMethods);
        setMethod(paymentMethods[0]?.method_name || "");
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [reservationId]);

  async function submit(event) {
    event.preventDefault();
    if (!method) return setError("Select a payment method.");
    if (!proof) return setError("Upload your proof of payment.");
    setError("");
    setIsSubmitting(true);
    try {
      const selectedMethod = methods.find((item) => item.method_name === method);
      const result = await submitPaymentProof(reservation.id, selectedMethod.payment_method_id, proof);
      savePayment(reservation.id, result);
      navigate(`/portal/confirmation/${reservation.id}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="page-shell text-slate">Loading payment details...</div>;
  if (!reservation) return <Navigate to="/portal/reservations" replace />;

  return (
    <div className="page-shell">
      <p className="eyebrow">Secure your reservation</p><h1 className="page-title">Payment and proof</h1><p className="mt-3 text-slate">This is a demo payment flow. No real charge will be made.</p><p className="mt-2 text-sm text-slate">All bookings are final. Cancellations, refunds, and rebooking are not available.</p>
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} className="space-y-8 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          <PaymentMethodSelector value={method} onChange={setMethod} methods={methods.map((item) => ({ name: item.method_name, detail: item.account_number || item.method_type }))} />
          <div className="rounded-2xl bg-tint p-5 text-sm leading-6 text-navy"><p className="font-bold">{method} instructions</p><p className="mt-1 text-slate">Follow the payment instructions for your selected method, then upload your receipt.</p></div>
          <div><h2 className="mb-4 text-xl font-bold text-navy">Proof of payment</h2><ProofOfPaymentUploader file={proof} onChange={setProof} /></div>
          {reservation.paymentRejectionReason && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">Payment proof rejected: {reservation.paymentRejectionReason}</p>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60" type="submit" disabled={isSubmitting || reservation.status !== "Pending" || reservation.paymentStatus !== "Unpaid"}>{isSubmitting ? "Submitting payment proof..." : "Submit payment proof"}</button>
        </form>
        <aside className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">Payment summary</p><img className="mt-4 h-40 w-full rounded-2xl object-cover" src={reservation.image} alt="" /><h2 className="mt-4 text-xl font-bold text-navy">{reservation.itemName}</h2><p className="mt-2 text-sm text-slate">{formatDateRange(reservation.startDate, reservation.endDate)}</p><div className="mt-5 flex justify-between border-t border-border pt-5 font-extrabold text-navy"><span>Total</span><span>{formatCurrency(reservation.total)}</span></div></aside>
      </div>
    </div>
  );
}
