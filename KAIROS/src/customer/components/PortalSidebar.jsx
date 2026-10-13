import { Bot, CalendarRange, Compass, LayoutDashboard, LogOut, Star, UserRound, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import BrandLogo from "./BrandLogo";

const links = [
  { label: "Dashboard", to: "/portal", icon: LayoutDashboard, end: true },
  { label: "Browse Rooms & Venues", to: "/portal/browse", icon: Compass },
  { label: "My Reservations", to: "/portal/reservations", icon: CalendarRange },
  { label: "My Reviews", to: "/portal/reviews", icon: Star },
  { label: "Chat Assistant", to: "/portal/chat", icon: Bot },
  { label: "Profile", to: "/portal/profile", icon: UserRound },
];

export default function PortalSidebar({ open, onClose }) {
  const { logout } = useCustomerAuth();
  const navigate = useNavigate();
  const linkClass = ({ isActive }) =>
    `relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
      isActive ? "bg-primary text-white" : "text-white/65 hover:bg-white/8 hover:text-white"
    }`;

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
    onClose?.();
  }

  return (
    <>
      {open && <button className="fixed inset-0 z-40 bg-navy/55 lg:hidden" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col overflow-y-auto bg-navy px-4 py-5 text-white shadow-2xl transition-transform sm:px-5 sm:py-6 lg:w-72 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
          </div>
          <button className="rounded-lg p-2 text-white/70 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="mt-8 flex-1 space-y-1 sm:mt-10" aria-label="Portal navigation">
          {links.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} onClick={onClose}>
              <Icon size={19} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-5">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/65 hover:bg-white/8 hover:text-white">
            <LogOut size={19} />Logout
          </button>
        </div>
      </aside>
    </>
  );
}
