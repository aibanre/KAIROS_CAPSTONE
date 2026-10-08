import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import RoomCard from "../components/RoomCard";
import VenueCard from "../components/VenueCard";
import { listRooms } from "../api/roomsApi";
import { listVenues } from "../api/venuesApi";

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "venues" ? "venues" : "rooms";
  const [search, setSearch] = useState("");
  const [capacity, setCapacity] = useState("Any");
  const [rooms, setRooms] = useState([]);
  const [venues, setVenues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listRooms(), listVenues()])
      .then(([nextRooms, nextVenues]) => {
        setRooms(nextRooms);
        setVenues(nextVenues);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, []);

  const inventory = tab === "rooms" ? rooms : venues;
  const filtered = useMemo(
    () => inventory.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()) && (capacity === "Any" || item.capacity >= Number(capacity))),
    [inventory, search, capacity],
  );

  return (
    <div className="page-shell">
      <p className="eyebrow">Find your place</p>
      <h1 className="page-title">Rooms for resting. Venues for gathering.</h1>
      <p className="mt-3 max-w-2xl text-slate">Compare thoughtful stays and memorable spaces, then book in a few simple steps.</p>
      <div className="mt-8 grid w-full grid-cols-2 rounded-xl bg-tint p-1 sm:w-fit">
        {["rooms", "venues"].map((value) => <button key={value} onClick={() => setSearchParams({ tab: value })} className={`rounded-lg px-4 py-2.5 text-sm font-bold capitalize sm:px-5 ${tab === value ? "bg-white text-primary shadow-sm" : "text-slate"}`}>{value}</button>)}
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-white p-4 shadow-soft sm:grid-cols-[1fr_14rem]">
        <label className="filter-label">Search<div className="relative"><Search className="absolute left-3 top-3.5 text-slate" size={18} /><input className="form-control pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tab}`} /></div></label>
        <label className="filter-label">Minimum capacity<select className="form-control" value={capacity} onChange={(event) => setCapacity(event.target.value)}><option value="Any">Any capacity</option><option value="2">2+ guests</option><option value="5">5+ guests</option><option value="40">40+ guests</option><option value="100">100+ guests</option></select></label>
      </div>
      {isLoading && <p className="mt-7 text-sm text-slate">Loading {tab}...</p>}
      {error && <p className="mt-7 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}
      {!isLoading && !error && <><p className="mt-7 text-sm font-bold text-slate">{filtered.length} {tab} found</p>{filtered.length ? <div className="mt-4 grid gap-6 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((item) => tab === "rooms" ? <RoomCard key={item.id} room={item} /> : <VenueCard key={item.id} venue={item} />)}</div> : <div className="mt-4"><EmptyState title={`No ${tab} found`} message="Try a broader search or change the capacity filter." /></div>}</>}
    </div>
  );
}
