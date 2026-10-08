import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import ReservationRow from "../components/ReservationRow";
import { useBooking } from "../context/BookingContext";

const tabs = ["All", "Upcoming", "Completed", "Cancelled"];

export default function MyReservationsPage() {
  const { reservations } = useBooking();
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => reservations.filter((item) => {
      const matchesSearch = `${item.itemName} ${item.reference}`.toLowerCase().includes(search.toLowerCase());
      const matchesTab = tab === "All" || (tab === "Upcoming" ? !["Completed", "Cancelled"].includes(item.status) : item.status === tab);
      return matchesSearch && matchesTab;
    }),
    [reservations, tab, search],
  );

  return (
    <div className="page-shell">
      <p className="eyebrow">Your plans</p><h1 className="page-title">My reservations</h1><p className="mt-3 text-slate">Track every stay, event, payment, and confirmation in one place.</p>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-tint p-1">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${tab === item ? "bg-white text-primary shadow-sm" : "text-slate"}`}>{item}</button>)}</div>
        <label className="relative w-full sm:w-auto"><span className="sr-only">Search reservations</span><Search className="absolute left-3 top-3 text-slate" size={18} /><input className="form-control w-full pl-10 sm:min-w-64" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or name" /></label>
      </div>
      <div className="mt-6 space-y-3">{filtered.map((item) => <ReservationRow key={item.id} reservation={item} />)}</div>
      {!filtered.length && <div className="mt-6"><EmptyState title="No reservations here" message="Try another status or book a new room or venue." actionLabel="Browse stays" to="/portal/browse" /></div>}
    </div>
  );
}
