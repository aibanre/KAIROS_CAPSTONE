import { Component, useState } from "react";
import { Outlet } from "react-router";
import ChatbotWidget from "../components/ChatbotWidget";
import PortalSidebar from "../components/PortalSidebar";
import PortalTopbar from "../components/PortalTopbar";

class PortalErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="page-shell">
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-soft">
          <h1 className="text-2xl font-bold text-navy">Something went wrong</h1>
          <p className="mt-3 text-slate">We could not load this page. Please reload and try again.</p>
          <button className="mt-6 rounded-xl bg-primary px-5 py-3 font-bold text-white hover:bg-sky" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-page text-navy"
      style={{
        "--portal-sidebar-width": "18rem",
      }}
    >
      <PortalSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[var(--portal-sidebar-width)]">
        <PortalTopbar onMenuOpen={() => setSidebarOpen(true)} />
        <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] [&_.page-shell]:pt-3 [&_.page-shell]:pb-20 sm:pb-16 sm:[&_.page-shell]:pt-8 sm:[&_.page-shell]:pb-16"><PortalErrorBoundary><Outlet /></PortalErrorBoundary></main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
