import { Outlet, Link, useLocation } from "react-router-dom";
import { BarChart3, Users, Calendar, IceCreamCone, Plus, Menu, X, Package, CalendarDays, CalendarClock } from "lucide-react";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import EmployeeNumberSetup from "./EmployeeNumberSetup";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { path: "/", label: "Dashboard", icon: BarChart3 },
  { path: "/shifts", label: "Shifts", icon: Calendar },
  { path: "/employees", label: "Employees", icon: Users },
  { path: "/flavors", label: "Flavors", icon: IceCreamCone },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/availability", label: "Availability", icon: CalendarDays },
  { path: "/schedule", label: "Schedule", icon: CalendarClock },
];

const userNavItems = [
  { path: "/availability", label: "Availability", icon: CalendarDays },
  { path: "/schedule", label: "Schedule", icon: CalendarClock },
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? adminNavItems : userNavItems;
  const [needsEmployeeNumber, setNeedsEmployeeNumber] = useState(false);

  useEffect(() => {
    if (user && !user.employee_number) {
      setNeedsEmployeeNumber(true);
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {needsEmployeeNumber && (
        <EmployeeNumberSetup user={user} onComplete={() => setNeedsEmployeeNumber(false)} />
      )}
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <IceCreamCone className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-sidebar-foreground text-lg">Pace Intelligence</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-sidebar flex-shrink-0 border-r border-sidebar-border flex flex-col",
        "lg:flex",
        mobileOpen ? "flex absolute inset-0 top-[65px] z-50" : "hidden"
      )}>
        <div className="p-6 hidden lg:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <IceCreamCone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-sidebar-foreground text-lg leading-tight">Pace</h1>
              <p className="text-xs text-sidebar-foreground/60 font-medium">Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
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

        <div className="p-3 mt-auto">
          <Link
            to="/shifts/new"
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            New Shift
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}