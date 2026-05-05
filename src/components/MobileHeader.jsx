import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";

const PAGE_TITLES = {
  "/": "Schedule",
  "/schedule": "Schedule",
  "/dashboard": "Dashboard",
  "/shifts": "Shifts",
  "/shifts/new": "New Production Shift",
  "/shifts/edit": "Edit Production Shift",
  "/shifts/new-base-mix": "New Base Mix Shift",
  "/shifts/edit-base-mix": "Edit Base Mix Shift",
  "/employees": "Employees",
  "/flavors": "Flavors",
  "/inventory": "Inventory",
  "/availability": "Availability",
  "/time-tracking": "Time Tracking",
  "/my-info": "My Info",
  "/financials": "Financials",
};

const ROOT_PATHS = new Set(["/", "/schedule", "/dashboard", "/shifts", "/employees", "/flavors", "/inventory", "/availability", "/time-tracking", "/my-info", "/financials"]);

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const isRoot = ROOT_PATHS.has(path);
  const title = PAGE_TITLES[path] || "Pace Bars";

  return (
    <header className="xl:hidden sticky top-0 z-40 bg-sidebar border-b border-sidebar-border flex items-center h-14 px-3 gap-2 flex-shrink-0">
      {!isRoot ? (
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-sidebar-foreground/70 active:bg-sidebar-accent transition-colors select-none"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <div className="w-9" />
      )}
      <div className="flex-1 flex items-center justify-center">
        {isRoot ? (
          <img
            src="https://media.base44.com/images/public/69daba0a36b037ad40a9ae2d/4ee4e771c_PaceL-removebg-preview.png"
            alt="Pace Bars"
            className="h-7 w-auto object-contain"
          />
        ) : (
          <span className="font-heading font-semibold text-sidebar-foreground text-base">{title}</span>
        )}
      </div>
      {isRoot ? (
        <button
          onClick={() => base44.auth.logout()}
          className="p-2 rounded-lg text-sidebar-foreground/70 active:bg-sidebar-accent transition-colors select-none"
          aria-label="Log out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      ) : (
        <div className="w-9" />
      )}
    </header>
  );
}