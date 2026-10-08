import { useState } from "react";
import { Outlet } from "react-router";
import ChatbotWidget from "../components/ChatbotWidget";
import PortalSidebar from "../components/PortalSidebar";
import PortalTopbar from "../components/PortalTopbar";

export default function PortalLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page text-navy">
      <PortalSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-72">
        <PortalTopbar onMenuOpen={() => setSidebarOpen(true)} />
        <main><Outlet /></main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
