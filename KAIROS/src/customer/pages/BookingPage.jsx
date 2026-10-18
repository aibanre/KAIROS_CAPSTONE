import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import BookingSummaryCard from "../components/BookingSummaryCard";
import { getRoom } from "../api/roomsApi";
import { getVenue } from "../api/venuesApi";
import { useBooking } from "../context/BookingContext";
import { updateReservationHold } from "../api/reservationsApi";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { isValidEmail, isValidPhone, limitPhoneInput } from "../utils/validators";
import { earliestBookableDate } from "../../public/utils/dateRange.js";
import { API_URL } from "../../config/api.js";
import HoldTimerBar from "../../shared/components/HoldTimerBar.jsx";
import useHoldCountdown from "../../shared/hooks/useHoldCountdown.js";

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { booking, selectItem, updateBooking } = useBooking();
  const [item, setItem] = useState(booking.item);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(!booking.item);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const completedRef = useRef(false);
  const type = searchParams.get("type") === "venue" ? "venue" : "room";
  const id = searchParams.get("id");
  const hold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
  const secondsLeft = useHoldCountdown(hold?.hold_expires_at, hold?.server_time);
  const minimumDate = earliestBookableDate();

  useEffect(() => {
    if (!hold?.reservation_id) {
      navigate(`/portal/rooms/${id}`, {
        replace: true,
        state: { message: "Your booking hold is missing or expired. Please choose your dates again." },
      });
      return;
    }
    if ((hold.check_in || hold.check_in_date || hold.event_date || "") < minimumDate) {
      sessionStorage.removeItem("kairos_reservation_hold");
      navigate(`/portal/${type === "venue" ? "venues" : "rooms"}/${id}`, {
        replace: true,
        state: { message: "Your booking hold is no longer valid because bookings must be made at least one day in advance." },
      });
      return;
    }
    updateBooking({
      startDate: hold.check_in || hold.check_in_date || "",
      endDate: hold.check_out || hold.check_out_date || "",
      guests: Number(hold.adults ?? hold.num_guests ?? booking.guests),
      children: Number(hold.children ?? booking.children ?? 0),
    });
  }, [hold?.reservation_id, hold?.check_in, hold?.check_in_date, hold?.event_date, id, minimumDate, navigate, type]);

  useEffect(() => {
    if (secondsLeft !== 0) return;
    sessionStorage.removeItem("kairos_reservation_hold");
    navigate(`/portal/rooms/${id}`, {
      replace: true,
      state: { message: "Your booking hold expired. Please choose your dates again." },
    });
  }, [id, navigate, secondsLeft]);

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
            phone: limitPhoneInput(booking.contact.phone || user?.phone_number || user?.phone || ""),
            notes: booking.contact.notes,
          },
        });
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, [id, type]);

  useEffect(() => () => {
    if (completedRef.current || !hold?.reservation_id) return;
    fetch(`${API_URL}/api/reservations/${encodeURIComponent(hold.reservation_id)}/hold`, {
      method: "DELETE",
      credentials: "include",
      headers: hold.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
      keepalive: true,
    }).catch(() => {});
  }, [hold?.reservation_id, hold?.access_token]);

  async function submit(event) {
    event.preventDefault();
    if (!booking.startDate || booking.startDate < minimumDate || (type === "room" && !booking.endDate)) return setError("Bookings must be made at least one day in advance.");
    if (type === "room" && booking.endDate <= booking.startDate) return setError("Check-out must be after check-in.");
    if (type === "room" && Number(booking.guests) > Number(item.capacity)) return setError("The number of adults exceeds the room capacity.");
    if (!booking.contact.name.trim()) return setError("Enter the guest name.");
    if (!isValidEmail(booking.contact.email)) return setError("Enter a valid email address.");
    if (!isValidPhone(booking.contact.phone)) return setError("Enter a valid Philippine mobile number.");
    setError("");
    setIsSubmitting(true);
    try {
      const hold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
      const nameParts = booking.contact.name.trim().split(/\s+/);
      const reservation = await updateReservationHold(hold.reservation_id, {
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(" ") || nameParts[0],
        email: booking.contact.email,
        phone_number: booking.contact.phone,
        address: booking.contact.notes || "Customer portal booking",
        num_guests: Number(booking.guests),
        children: Number(booking.children || 0),
      });
      if (!reservation?.reservation_id) throw new Error("The booking hold could not be updated.");
      completedRef.current = true;
      sessionStorage.setItem("kairos_reservation_hold", JSON.stringify({ ...hold, ...reservation }));
      navigate(`/portal/payment/${reservation.reservation_id}`);
    } catch (submitError) {
      if (submitError.status === 410) {
        sessionStorage.removeItem("kairos_reservation_hold");
        navigate(`/portal/rooms/${item.id}`, { replace: true });
        return;
      }
      setError(submitError.message || "We could not update your booking hold. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="page-shell text-slate">Loading booking details...</div>;
  if (!item) return <Navigate to="/portal/browse" replace />;
  if (type === "venue") {
    return <Navigate to={`/portal/venues/${item.id}`} replace />;
  }

  return (
    <div className="page-shell">
      <HoldTimerBar
        secondsLeft={secondsLeft}
        resourceName={item.room_number || item.name || hold?.room_number || hold?.venue_name}
        expiredHref={`/portal/${type === "venue" ? "venues" : "rooms"}/${encodeURIComponent(id || "")}`}
        backLabel={`Back to ${type}`}
        placement="portal"
      />
      <p className="eyebrow">Reserve your place</p><h1 className="page-title">Complete your booking details</h1><p className="mt-3 text-slate">Confirm the dates and guest information before proceeding to payment. <a href="/payment-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Read our Payment Policy</a></p>
      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} noValidate className="space-y-7 rounded-2xl border border-border bg-white p-5 shadow-soft sm:rounded-3xl sm:p-8">
          <section><h2 className="section-title">Dates and guests</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">{type === "room" ? "Check-in" : "Event date"}<input type="date" min={minimumDate} className="form-control" value={booking.startDate} onChange={(event) => updateBooking({ startDate: event.target.value < minimumDate ? "" : event.target.value, ...(type === "venue" ? { endDate: event.target.value } : {}) })} /></label>
            {type === "room" && <label className="filter-label">Check-out<input type="date" min={booking.startDate && booking.startDate > minimumDate ? booking.startDate : minimumDate} className="form-control" value={booking.endDate} onChange={(event) => updateBooking({ endDate: event.target.value < minimumDate ? "" : event.target.value })} /></label>}
            <label className="filter-label">Adults<input min="1" max={item.capacity} type="number" className="form-control" value={booking.guests} onChange={(event) => updateBooking({ guests: Number(event.target.value) })} /></label>
            <label className="filter-label">Children<input min="0" type="number" className="form-control" value={booking.children} onChange={(event) => updateBooking({ children: Number(event.target.value) })} /></label>
          </div></section>
          {booking.startDate && booking.startDate < minimumDate ? <p className="text-sm font-bold text-red-700" role="alert">Bookings must be made at least one day in advance.</p> : null}
          <section className="border-t border-border pt-7"><h2 className="section-title">Guest details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="filter-label">Full name<input className="form-control" value={booking.contact.name} onChange={(event) => updateBooking({ contact: { ...booking.contact, name: event.target.value } })} /></label>
            <label className="filter-label">Email address<input type="email" className="form-control" value={booking.contact.email} onChange={(event) => updateBooking({ contact: { ...booking.contact, email: event.target.value } })} readOnly={Boolean(user)} /></label>
            <label className="filter-label">Mobile number<input type="tel" inputMode="numeric" maxLength={11} pattern="[0-9]{11}" autoComplete="tel" className="form-control" value={booking.contact.phone} onChange={(event) => updateBooking({ contact: { ...booking.contact, phone: limitPhoneInput(event.target.value) } })} /></label>
            <label className="filter-label">Special requests<input className="form-control" value={booking.contact.notes} onChange={(event) => updateBooking({ contact: { ...booking.contact, notes: event.target.value } })} placeholder="Optional" /></label>
          </div></section>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-accent px-6 py-3.5 font-extrabold text-navy hover:bg-accent-hover disabled:opacity-60" type="submit" disabled={isSubmitting || secondsLeft === 0}>{isSubmitting ? "Creating reservation..." : "Create reservation and continue"}</button>
        </form>
        <div className="xl:sticky xl:top-24"><BookingSummaryCard /></div>
      </div>
    </div>
  );
}
