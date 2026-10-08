import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMyReservations, createReservation as createReservationRequest } from "../api/reservationsApi";
import { listReviews } from "../api/reviewsApi";
import { countNights } from "../utils/dateHelpers";
import { useCustomerAuth } from "./CustomerAuthContext";

const BookingContext = createContext(null);

const initialBooking = {
  item: null,
  type: "room",
  startDate: "",
  endDate: "",
  guests: 2,
  contact: { name: "", email: "", phone: "", notes: "" },
};

export function useBooking() {
  const value = useContext(BookingContext);
  if (!value) throw new Error("useBooking must be used inside BookingProvider");
  return value;
}

export default function BookingProvider({ children }) {
  const { isAuthenticated } = useCustomerAuth();
  const [booking, setBooking] = useState(initialBooking);
  const [reservations, setReservations] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setReservations([]);
      setReviews([]);
      return;
    }

    Promise.all([getMyReservations(), listReviews()])
      .then(([nextReservations, nextReviews]) => {
        setReservations(nextReservations);
        setReviews(nextReviews);
      })
      .catch(() => {
        setReservations([]);
        setReviews([]);
      });
  }, [isAuthenticated]);

  const value = useMemo(() => {
    const nights = countNights(booking.startDate, booking.endDate);
    const subtotal = (booking.item?.price || 0) * (booking.type === "room" ? nights : 1);
    const serviceFee = Math.round(subtotal * 0.1);

    return {
      booking,
      reservations,
      reviews,
      nights,
      subtotal,
      serviceFee,
      total: subtotal + serviceFee,
      selectItem: (item, type) => setBooking((current) => ({ ...current, item, type })),
      updateBooking: (details) => setBooking((current) => ({ ...current, ...details })),
      resetBooking: () => setBooking(initialBooking),
      getReservation: (id) => reservations.find((reservation) => String(reservation.id) === String(id)),
      createReservation: async () => {
        if (booking.type !== "room") {
          throw new Error("Venue reservations are not available through the customer portal yet.");
        }

        const [firstName = "", ...lastNameParts] = booking.contact.name.trim().split(/\s+/);
        const data = await createReservationRequest({
          room_id: Number(booking.item.id),
          check_in: booking.startDate,
          check_out: booking.endDate,
          num_guests: booking.guests,
          customer: {
            first_name: firstName,
            last_name: lastNameParts.join(" ") || firstName,
            email: booking.contact.email,
            phone_number: booking.contact.phone,
            address: booking.contact.notes || "Customer portal booking",
          },
        });
        const reservation = {
          id: String(data.reservation_id),
          reference: data.booking_reference,
          itemId: String(booking.item.id),
          itemName: booking.item.name,
          image: booking.item.image,
          type: "room",
          startDate: booking.startDate,
          endDate: booking.endDate,
          guests: booking.guests,
          status: "Pending",
          paymentStatus: "Unpaid",
          total: Number(data.total),
          createdAt: new Date().toISOString(),
          reviewed: false,
          raw: data,
        };
        setReservations((current) => [reservation, ...current]);
        return reservation;
      },
      submitPaymentProof: (id, result) => {
        setReservations((current) => current.map((reservation) => (
          String(reservation.id) === String(id)
            ? { ...reservation, paymentStatus: "Proof Submitted", status: "Payment Verified", reference: result?.booking_reference || reservation.reference }
            : reservation
        )));
      },
      addReview: (reservation, review) => {
        setReviews((current) => [{ ...review, id: `mock-${Date.now()}`, reservationId: reservation.id }, ...current]);
      },
    };
  }, [booking, reservations, reviews]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}
