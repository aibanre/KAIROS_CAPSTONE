import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import BookingSummaryCard from "../components/BookingSummaryCard";
import { getRoom } from "../api/roomsApi";
import { getVenue } from "../api/venuesApi";
import { useBooking } from "../context/BookingContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { isValidEmail, isValidPhone } from "../utils/validators";

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { booking, selectItem, updateBooking, createReservation } = useBooking();
  const [item, setItem] = useState(booking.item);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(!booking.item);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const type = searchParams.get("type") === "venue" ? "venue" : "room";
  const id = searchParams.get("id");

  useEffect(() => {
    const loadItem = type === "venue" ? getVenue(id) : getRoom(id);
    loadItem
      .then((nextItem) => {
        setItem(nextItem);
        selectItem(nextItem, type);
        updateBooking({
          contact: {
            name: booking.contact.name || `${user?.full_name || ""}`.trim(),
            email: booking.contact.email || user?.email || "",
            phone: booking.contact.phone || user?.phone_number || "",
            notes: booking.contact.notes,
          },
        });
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [id, type]);

  async function submit(event) {
    event.preventDefault();
    if (!booking.startDate || (type === "room" && !booking.endDate)) return setError("Choose valid reservation dates.");
    if (type === "room" && booking.endDate <= booking.startDate) return setError("Check-out must be after check-in.");
    if (!booking.contact.name.trim()) return setError("Enter the guest name.");
    if (!isValidEmail(booking.contact.email)) return setError("Enter a valid email address.");
    if (!isValidPhone(booking.contact.phone)) return setError("Enter a valid Philippine mobile number.");
    setError("");
    setIsSubmitting(true);
    try {
      const reservation = await createReservation();
      navigate(`/portal/payment/${reservation.id}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="page-shell text-slate">Loading booking details...</div>;
  if (!item) return <Navigate to="/portal/browse" replace />;

  return (
    <div className="page-shell">
      <p className="eyebrow">Reserve your place</p><h1 className="page-title">Complete your booking details</h1><p className="mt-3 text-slate">Confirm the dates and guest information before proceeding to payment.</p>
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} noValidate className="space-y-7 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          <section><h2 className="section-title">Dates and guests</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">{type === "room" ? "Check-in" : "Event date"}<input type="date" className="form-control" value={booking.startDate} onChange={(event) => updateBooking({ startDate: event.target.value, ...(type === "venue" ? { endDate: event.target.value } : {}) })} /></label>
            {type === "room" && <label className="filter-label">Check-out<input type="date" min={booking.startDate} className="form-control" value={booking.endDate} onChange={(event) => updateBooking({ endDate: event.target.value })} /></label>}
            <label className="filter-label">Guests<input min="1" max={item.capacity} type="number" className="form-control" value={booking.guests} onChange={(event) => updateBooking({ guests: Number(event.target.value) })} /></label>
          </div></section>
          <section className="border-t border-border pt-7"><h2 className="section-title">Guest details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">Full name<input className="form-control" value={booking.contact.name} onChange={(event) => updateBooking({ contact: { ...booking.contact, name: event.target.value } })} /></label>
            <label className="filter-label">Email address<input type="email" className="form-control" value={booking.contact.email} onChange={(event) => updateBooking({ contact: { ...booking.contact, email: event.target.value } })} /></label>
            <label className="filter-label">Mobile number<input className="form-control" value={booking.contact.phone} onChange={(event) => updateBooking({ contact: { ...booking.contact, phone: event.target.value } })} /></label>
            <label className="filter-label">Special requests<input className="form-control" value={booking.contact.notes} onChange={(event) => updateBooking({ contact: { ...booking.contact, notes: event.target.value } })} placeholder="Optional" /></label>
          </div></section>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60" type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating reservation..." : "Create reservation and continue"}</button>
        </form>
        <div className="xl:sticky xl:top-24"><BookingSummaryCard /></div>
      </div>
    </div>
  );
}
