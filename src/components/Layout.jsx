import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { BarChart3, Users, Calendar, IceCreamCone, Package, CalendarDays, CalendarClock, Clock, UserCircle, DollarSign, LogOut } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import EmployeeNumberSetup from "./EmployeeNumberSetup";
import MobileHeader from "./MobileHeader";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { path: "/my-info", label: "My Info", icon: UserCircle },
  { path: "/schedule", label: "Schedule", icon: CalendarClock },
  { path: "/availability", label: "Availability", icon: CalendarDays },
  { path: "/time-tracking", label: "Time Tracking", icon: Clock },
  { path: "/shifts", label: "Shifts", icon: Calendar },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/employees", label: "Employees", icon: Users },
  { path: "/flavors", label: "Flavors", icon: IceCreamCone },
  { path: "/financials", label: "Financials", icon: DollarSign },
];

const userNavItems = [
  { path: "/my-info", label: "My Info", icon: UserCircle },
  { path: "/schedule", label: "Schedule", icon: CalendarClock },
  { path: "/availability", label: "Availability", icon: CalendarDays },
  { path: "/time-tracking", label: "Time Tracking", icon: Clock },
  { path: "/employees", label: "Employees", icon: Users },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNavItems : userNavItems;
  const [needsEmployeeNumber, setNeedsEmployeeNumber] = useState(false);

  // Tab stack memory: remembers last visited sub-route and scroll position per root tab
  const tabMemory = useRef({}); // { [rootPath]: { path, scroll } }
  const mainRef = useRef(null);

  useEffect(() => {
    if (user && !user.employee_number) {
      setNeedsEmployeeNumber(true);
    }
  }, [user]);

  // Save scroll position when navigating away
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const rootTab = navItems.find(
      (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
    );
    if (!rootTab) return;
    // On each path change, store the current scroll before it updates
    return () => {
      tabMemory.current[rootTab.path] = {
        path: location.pathname + location.search,
        scroll: el.scrollTop,
      };
    };
  }, [location.pathname, location.search]);

  // Restore scroll position after navigation
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const rootTab = navItems.find(
      (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
    );
    if (!rootTab) return;
    const saved = tabMemory.current[rootTab.path];
    const savedScroll = saved?.path === location.pathname + location.search ? saved.scroll : 0;
    requestAnimationFrame(() => { el.scrollTop = savedScroll; });
  }, [location.pathname]);

  const handleMobileTabPress = useCallback((item) => {
    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
    if (isActive) {
      // Reset: clear memory for this tab and go to root
      tabMemory.current[item.path] = null;
      if (location.pathname !== item.path) navigate(item.path);
      else if (mainRef.current) mainRef.current.scrollTop = 0;
    } else {
      // Restore last remembered sub-route for this tab
      const memory = tabMemory.current[item.path];
      navigate(memory?.path || item.path);
    }
  }, [location.pathname, navigate]);

  if (user?.role === "terminated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm mx-auto p-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2">Access Revoked</h1>
          <p className="text-muted-foreground text-sm">Your employment has been terminated and your access to this app has been revoked. Please contact your manager if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col xl:flex-row bg-background">
      {needsEmployeeNumber && (
        <EmployeeNumberSetup user={user} onComplete={() => setNeedsEmployeeNumber(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden xl:flex w-64 bg-sidebar flex-shrink-0 border-r border-sidebar-border flex-col">
        <div className="p-6">
          <img src="https://media.base44.com/images/public/69daba0a36b037ad40a9ae2d/4ee4e771c_PaceL-removebg-preview.png" alt="Pace Bars" className="w-full h-auto" />
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 select-none",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all select-none"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 overflow-auto pb-[calc(64px+env(safe-area-inset-bottom))] xl:pb-0">
        <div className="max-w-7xl mx-auto p-4 xl:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation — horizontally scrollable */}
      <nav
        className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border overflow-x-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", scrollbarWidth: "none" }}
      >
        <div className="flex items-stretch min-w-max">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => handleMobileTabPress(item)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium transition-colors select-none min-w-[72px]",
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/60 active:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}