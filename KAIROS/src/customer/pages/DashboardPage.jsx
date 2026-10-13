import { ArrowRight, Bot, CalendarCheck, CheckCircle2, CreditCard, MessageSquareText, Star } from "lucide-react";
import { Link, useLocation } from "react-router";
import EmptyState from "../components/EmptyState";
import ReservationRow from "../components/ReservationRow";
import RoomCard from "../components/RoomCard";
import StatCard from "../components/StatCard";
import UpcomingReservationCard from "../components/UpcomingReservationCard";
import VenueCard from "../components/VenueCard";
import { useEffect, useState } from "react";
import { listRooms } from "../api/roomsApi";
import { listVenues } from "../api/venuesApi";
import { useBooking } from "../context/BookingContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useResortInfo } from "../../public/context/ResortInfoContext";

function reservationDateValue(reservation) {
  const value = reservation.type === "venue" ? reservation.eventDate : reservation.startDate;
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : Number.POSITIVE_INFINITY;
}

export default function DashboardPage() {
  const { user } = useCustomerAuth();
  const { reservations, refresh } = useBooking();
  const location = useLocation();
  const { resort_name: resortName } = useResortInfo();
  const [recommendations, setRecommendations] = useState({ rooms: [], venues: [] });
  useEffect(() => {
    if (location.state?.reviewed) refresh();
  }, [location.state?.reviewed, refresh]);
  useEffect(() => {
    Promise.all([listRooms(), listVenues()]).then(([rooms, venues]) => setRecommendations({ rooms, venues }));
  }, []);
  const active = reservations.filter((item) => !["Completed", "Cancelled"].includes(item.status));
  const nextReservation = [...active].sort((a, b) => reservationDateValue(a) - reservationDateValue(b))[0];
  const pendingPayments = reservations.filter((item) => item.isActiveHold && item.paymentStatus === "Unpaid");
  const reviewPending = reservations.filter((item) => item.status === "Completed" && !item.reviewed);
  const actionItems = [
    ...pendingPayments.map((item) => ({ ...item, action: "Complete payment", to: `/portal/payment/${item.id}`, message: "Payment is required to confirm this reservation." })),
    ...reviewPending.map((item) => ({ ...item, action: "Write review", to: `/portal/reviews/new/${item.id}`, message: "Tell us about your completed experience.", from: "/portal" })),
  ];
  const recent = [...reservations].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  }).slice(0, 5);

  return (
    <div className="page-shell space-y-4 sm:space-y-10">
      <section className="relative overflow-hidden rounded-2xl bg-navy p-4 text-white shadow-soft sm:rounded-3xl sm:px-9 sm:py-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/45 blur-2xl" />
        <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-accent">Your {resortName} dashboard</p>
            <h1 className="mt-2 font-serif text-2xl font-bold sm:text-4xl">Welcome back, {user.firstName}</h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-white/65 sm:mt-3 sm:text-sm sm:leading-6">Everything for your next stay or celebration, organized in one calm place.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
            <Link className="h-10 rounded-xl bg-accent px-2 py-2.5 text-center text-xs font-extrabold text-navy hover:bg-accent-hover sm:h-auto sm:px-5 sm:py-3 sm:text-sm" to="/portal/browse?tab=rooms">Book a Room</Link>
            <Link className="h-10 rounded-xl border border-white/25 px-2 py-2.5 text-center text-xs font-bold text-white hover:bg-white/10 sm:h-auto sm:px-5 sm:py-3 sm:text-sm" to="/portal/browse?tab=venues">Book a Venue</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4" aria-label="Reservation summary">
        <StatCard label="Upcoming Reservations" value={active.length} icon={CalendarCheck} />
        <StatCard label="Pending Payments" value={pendingPayments.length} icon={CreditCard} tone="yellow" />
        <StatCard label="Completed Stays" value={reservations.filter((item) => item.status === "Completed").length} icon={CheckCircle2} tone="green" />
        <StatCard label="Reviews to Write" value={reviewPending.length} icon={Star} tone="sky" />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="eyebrow">Coming up</p><h2 className="section-title">Your next reservation</h2></div></div>
        {nextReservation ? <UpcomingReservationCard reservation={nextReservation} /> : <EmptyState title="Nothing scheduled yet" message={`Browse our rooms and venues to plan your next ${resortName} experience.`} actionLabel="Browse stays" to="/portal/browse" />}
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_1.15fr]">
        <section>
          <div className="mb-4"><p className="eyebrow">Your attention</p><h2 className="section-title">Action needed</h2></div>
          <div className="space-y-3">
            {actionItems.slice(0, 4).map((item) => (
              <article key={`${item.id}-${item.action}`} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/30 text-navy"><MessageSquareText size={19} /></span>
                  <div className="min-w-0 flex-1"><h3 className="font-bold text-navy">{item.itemName}</h3><p className="mt-1 text-sm leading-6 text-slate">{item.message}</p></div>
                </div>
                <Link className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:text-sky" to={item.to} state={item.from ? { from: item.from } : undefined}>{item.action}<ArrowRight size={15} /></Link>
              </article>
            ))}
            {actionItems.length === 0 && <EmptyState title="You're all caught up" message="There are no payments or reviews waiting for you." />}
          </div>
        </section>
        <section>
          <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Latest activity</p><h2 className="section-title">Recent reservations</h2></div><Link className="text-sm font-bold text-primary" to="/portal/reservations">View all</Link></div>
          <div className="space-y-3">{recent.map((item) => <ReservationRow key={item.id} reservation={item} />)}</div>
        </section>
      </div>

      <section>
        <div className="mb-5 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Picked for you</p><h2 className="section-title">Recommended escapes</h2></div><Link className="text-sm font-bold text-primary" to="/portal/browse">Browse all</Link></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.rooms[0] && <RoomCard room={recommendations.rooms[0]} />}
          {recommendations.venues[1] && <VenueCard venue={recommendations.venues[1]} />}
          {recommendations.rooms[2] && <RoomCard room={recommendations.rooms[2]} />}
        </div>
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-primary p-7 text-white sm:flex-row sm:items-center">
        <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Bot size={24} /></span><div><h2 className="text-xl font-extrabold">Need help? Ask our AI assistant</h2><p className="mt-1 text-sm text-white/70">Get quick answers about rooms, payments, and your reservations.</p></div></div>
        <Link className="w-full rounded-xl bg-accent px-5 py-3 text-center text-sm font-extrabold text-navy hover:bg-accent-hover sm:w-auto" to="/portal/chat">Start a chat</Link>
      </section>
    </div>
  );
}
