import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { API_URL } from "../../config/api.js";
import { useCustomerAuth } from "../../customer/context/CustomerAuthContext";
import formatCurrency from "../../customer/utils/formatCurrency";
import { isValidEmail, isValidPhone, limitPhoneInput } from "../../customer/utils/validators";
import { formatVenueWindow } from "../../customer/utils/dateHelpers";
import { getImageUrl } from "../utils/parseImages.js";

function Field({ label, ...props }) {
  return <label className="block text-[10px] font-semibold uppercase text-slate-500">{label}<input {...props} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-normal normal-case text-slate-600 outline-none focus:border-sky-500" /></label>;
}

export default function VenueBookingInformationPage() {
  const { venueId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [venue, setVenue] = useState(null);
  const [packages, setPackages] = useState([]);
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState({ firstName: user?.full_name?.split(" ")[0] || "", lastName: user?.full_name?.split(" ").slice(1).join(" ") || "", email: user?.email || "", phone: limitPhoneInput(user?.phone_number || user?.phone || ""), address: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eventDate = searchParams.get("event_date") || "";
  const startTime = searchParams.get("start_time") || "";
  const packageId = searchParams.get("package_id") || "";
  const pax = Number(searchParams.get("pax") || 1);
  const extraHours = Number(searchParams.get("extra_hours") || 0);
  const selectedPackage = packages.find((item) => String(item.package_id) === String(packageId));
  const hold = JSON.parse(sessionStorage.getItem("kairos_reservation_hold") || "null");
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!hold?.hold_expires_at) return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(hold.hold_expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (!remaining) navigate(`/rooms-and-venues-details?venueId=${encodeURIComponent(venueId)}&message=${encodeURIComponent("Your hold expired. Please choose a new date.")}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hold?.hold_expires_at, navigate, venueId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}`, { signal: controller.signal, credentials: 'include' }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load venue details.");
        return data.venue;
      }),
      fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/packages`, { signal: controller.signal, credentials: 'include' }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load venue packages.");
        return data.packages || [];
      }),
    ])
      .then(([nextVenue, nextPackages]) => {
        setVenue(nextVenue);
        setPackages(nextPackages);
      })
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [venueId]);

  useEffect(() => {
    if (!eventDate || !startTime || !venue) return undefined;
    const params = new URLSearchParams({ date: eventDate, start: startTime, pax: String(pax), extra_hours: String(extraHours) });
    if (venue.booking_mode === "packaged") params.set("package_id", packageId);
    if (hold?.reservation_id) params.set("hold_id", String(hold.reservation_id));
    const controller = new AbortController();
    fetch(`${API_URL}/api/venues/${encodeURIComponent(venueId)}/quote?${params}`, {
      signal: controller.signal,
      credentials: "include",
      headers: hold?.access_token ? { "X-Reservation-Token": hold.access_token } : undefined,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.reason || data.error || "Failed to verify quote.");
        setQuote(data);
      })
      .catch((quoteError) => {
        if (quoteError.name !== "AbortError") setQuote({ valid: false, reason: quoteError.message });
      });
    return () => controller.abort();
  }, [eventDate, extraHours, hold?.access_token, hold?.reservation_id, packageId, pax, startTime, venue, venueId]);

  const endTime = quote?.endTime || "";
  const updateCustomer = (event) => {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: name === "phone" ? value.replace(/\D/g, "").slice(0, 11) : value }));
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!quote?.valid) return setError("Please review your booking selection and try again.");
    if (!customer.firstName.trim() || !customer.lastName.trim()) return setError("Enter your first and last name.");
    if (!isValidEmail(customer.email)) return setError("Enter a valid email address.");
    if (!isValidPhone(customer.phone)) return setError("Enter a valid Philippine mobile number.");
    setIsSubmitting(true);
    try {
      if (!hold?.reservation_id) throw new Error("Your booking hold is missing. Please choose the date again.");
      const response = await fetch(`${API_URL}/api/reservations/${encodeURIComponent(hold.reservation_id)}/hold`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json", ...(hold.access_token ? { "X-Reservation-Token": hold.access_token } : {}) },
        body: JSON.stringify({
          event_date: eventDate, start_time: startTime,
          package_id: venue.booking_mode === "packaged" ? Number(packageId) : undefined,
          pax, extra_hours: extraHours, num_guests: pax,
          first_name: customer.firstName, last_name: customer.lastName, email: customer.email,
          phone_number: customer.phone, address: customer.address,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const holdError = new Error(data.error || "Could not update your booking hold.");
        holdError.status = response.status;
        throw holdError;
      }
      if (data.access_token) sessionStorage.setItem(`reservation_token_${data.reservation_id}`, data.access_token);
      navigate(user ? `/portal/payment/${data.reservation_id}` : `/payment/${data.reservation_id}`, { state: user ? undefined : { access_token: data.access_token } });
    } catch (submitError) {
      if (submitError.status === 409) {
        setError("That time slot is no longer available. Choose another time.");
      } else if (submitError.status === 410) {
        setError("Your booking hold has expired. Please choose the date again.");
      } else {
        setError("We could not update your booking right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-20 text-slate-600">Loading venue details...</main>;
  if (!venue) return <main className="min-h-screen bg-slate-50 px-4 pb-12 pt-20 text-rose-600">{error || "Venue not found."}</main>;

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 pb-12 pt-20 text-slate-700 sm:px-6 lg:px-5">
      <div className="mx-auto max-w-[1120px]">
        <header className="mb-5"><h1 className="text-3xl font-bold tracking-tight text-slate-800" style={{ fontFamily: "Lora" }}>Book Your Venue</h1><p className="mt-1 text-sm text-slate-500">Complete your reservation - no account required</p></header>
        {error ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600" role="alert">{error}</p> : null}
        <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_230px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:p-5">
            <h2 className="text-base font-bold text-slate-700">Customer Information</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="First Name" name="firstName" value={customer.firstName} onChange={updateCustomer} pattern="[A-Za-zÀ-ÿ'\\- ]+" maxLength="50" autoComplete="given-name" required />
              <Field label="Last Name" name="lastName" value={customer.lastName} onChange={updateCustomer} pattern="[A-Za-zÀ-ÿ'\\- ]+" maxLength="50" autoComplete="family-name" required />
              <Field label="Email Address" name="email" type="email" value={customer.email} onChange={updateCustomer} readOnly={Boolean(user)} autoComplete="email" required />
              <Field label="Phone Number" name="phone" type="tel" inputMode="numeric" value={customer.phone} onChange={updateCustomer} maxLength="11" pattern="[0-9]{11}" autoComplete="tel" required />
              <Field label="Address" name="address" value={customer.address} onChange={updateCustomer} maxLength="200" autoComplete="street-address" required />
            </div>
            <p className="mt-5 text-xs text-slate-500">All bookings are final. Cancellations, refunds, and rebooking are not available. <a href="/payment-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">Read our Payment Policy</a></p>
            <button type="submit" disabled={isSubmitting || !quote?.valid} className="mt-5 w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Creating reservation..." : "Continue to payment"}</button>
          </section>
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.08)] lg:sticky lg:top-20">
            <h2 className="text-base font-bold text-slate-700">Booking Summary</h2>
            <div className="mt-4 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-slate-200 text-[10px] text-slate-400">{getImageUrl(venue.images) ? <img src={getImageUrl(venue.images)} alt={venue.venue_name} className="h-full w-full object-cover" /> : "Venue photo unavailable"}</div>
            <p className="mt-3 text-xs font-medium text-slate-700">{venue.venue_name}</p>
            <p className="mt-1 text-[10px] text-slate-500">{formatVenueWindow(eventDate, startTime, endTime)}</p>
            <p className="mt-2 text-[10px] text-slate-500">{selectedPackage?.package_name || "Day-use venue"} · {pax} pax</p>
            <div className="my-4 border-t border-slate-100" />
            <div className="flex justify-between text-sm font-bold text-slate-700"><span>Total</span><span>{quote?.valid ? formatCurrency(quote.total) : "—"}</span></div>
            {quote && !quote.valid ? <p className="mt-3 text-xs font-bold text-rose-600">{quote.reason}</p> : null}
          </aside>
        </form>
      </div>
    </main>
  );
}
