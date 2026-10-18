import { Bell, ChevronDown, Menu, UserRound } from "lucide-react";
import { Link } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import BrandLogo from "./BrandLogo";

export default function PortalTopbar({ onMenuOpen }) {
  const { user } = useCustomerAuth();

  return (
    <header id="portal-topbar" className="sticky top-0 z-30 border-b border-border bg-white/90 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button className="shrink-0 rounded-xl border border-border p-2.5 text-navy hover:bg-tint lg:hidden" onClick={onMenuOpen} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="sm:hidden"><BrandLogo size="sm" collapsed /></div>
          <div className="min-w-0">
            <p className="hidden text-xs font-semibold text-slate sm:block">Good morning</p>
            <p className="truncate text-sm font-bold text-navy sm:text-base">{user?.firstName}, ready for your next escape?</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl border border-border p-1.5 sm:gap-2 sm:pr-3 hover:bg-tint">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-white">{user?.firstName?.[0]}</span>
              <span className="hidden text-sm font-bold text-navy sm:block">{user?.firstName}</span>
              <ChevronDown size={15} className="hidden text-slate sm:block" />
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-white p-2 shadow-xl">
              <Link className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-navy hover:bg-tint" to="/portal/profile"><UserRound size={16} />Manage profile</Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
