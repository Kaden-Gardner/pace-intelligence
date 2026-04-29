import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, parseISO, addYears, isBefore } from "date-fns";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const MAX_DATE = addYears(TODAY, 1);

export default function Availability() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availabilities, setAvailabilities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ is_available: true, available_from: "08:00", available_until: "17:00", notes: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const [avails, emps] = await Promise.all([
        base44.entities.Availability.list("-date", 500),
        base44.entities.Employee.list("name"),
      ]);
      setAvailabilities(avails);
      setEmployees(emps);
      setLoading(false);
    }
    load();
  }, []);

  const myAvailabilities = availabilities.filter((a) => a.user_id === user?.id);
  const displayAvailabilities = isAdmin
    ? (selectedEmployeeFilter === "all" ? availabilities : availabilities.filter((a) => a.user_id === selectedEmployeeFilter))
    : myAvailabilities;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth));

  function getAvailForDate(date) {
    const ds = format(date, "yyyy-MM-dd");
    return displayAvailabilities.filter((a) => a.date === ds);
  }

  function getMyAvailForDate(date) {
    const ds = format(date, "yyyy-MM-dd");
    return myAvailabilities.find((a) => a.date === ds);
  }

  const [adminSelectedDate, setAdminSelectedDate] = useState(null);

  function openSubmitForm(date) {
    setSelectedDate(date);
    const existing = getMyAvailForDate(date);
    if (existing) {
      setForm({
        is_available: existing.is_available ?? true,
        available_from: existing.available_from || "08:00",
        available_until: existing.available_until || "17:00",
        notes: existing.notes || "",
      });
    } else {
      setForm({ is_available: true, available_from: "08:00", available_until: "17:00", notes: "" });
    }
  }

  async function handleDayClick(date) {
    if (date < TODAY || date > MAX_DATE) return;
    if (isAdmin) {
      setAdminSelectedDate(isSameDay(adminSelectedDate, date) ? null : date);
      return;
    }
    openSubmitForm(date);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const ds = format(selectedDate, "yyyy-MM-dd");
    const existing = myAvailabilities.find((a) => a.date === ds);
    const linkedEmployee = employees.find((emp) => emp.employee_number === user?.employee_number);

    const payload = {
      ...form,
      date: ds,
      user_id: user.id,
      employee_id: linkedEmployee?.id || "",
      employee_number: linkedEmployee?.employee_number || user.employee_number || "",
      employee_name: linkedEmployee?.name || user?.full_name || "",
    };

    if (existing) {
      // Optimistic update immediately
      setAvailabilities((prev) => prev.map((a) => a.id === existing.id ? { ...a, ...payload } : a));
      setSelectedDate(null);
      setSaving(false);
      await base44.entities.Availability.update(existing.id, payload);
    } else {
      const optimisticId = `optimistic-${Date.now()}`;
      // Optimistic insert immediately
      setAvailabilities((prev) => [...prev, { ...payload, id: optimisticId }]);
      setSelectedDate(null);
      setSaving(false);
      const created = await base44.entities.Availability.create(payload);
      // Replace optimistic entry with real one
      setAvailabilities((prev) => prev.map((a) => a.id === optimisticId ? created : a));
    }
  }

  async function handleDelete() {
    const ds = format(selectedDate, "yyyy-MM-dd");
    const existing = myAvailabilities.find((a) => a.date === ds);
    if (existing) {
      // Optimistic remove immediately
      setAvailabilities((prev) => prev.filter((a) => a.id !== existing.id));
      setSelectedDate(null);
      await base44.entities.Availability.delete(existing.id);
    } else {
      setSelectedDate(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Unique users who submitted availability (for admin filter) - key by user_id
  const availableUserIds = [...new Set(availabilities.map((a) => a.user_id).filter(Boolean))];
  // Build a display list: employee name if linked, or availability record name/email
  const availableFilters = availableUserIds.map((uid) => {
    const sample = availabilities.find((a) => a.user_id === uid);
    return {
      user_id: uid,
      label: sample?.employee_name || sample?.created_by?.split("@")[0] || uid,
    };
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Availability</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "View all employee availability" : "Submit your availability up to one year in advance"}
        </p>
      </div>

      {isAdmin && availableFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedEmployeeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedEmployeeFilter === "all" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            All Employees
          </button>
          {availableFilters.map((f) => (
            <button
              key={f.user_id}
              onClick={() => setSelectedEmployeeFilter(f.user_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedEmployeeFilter === f.user_id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6">
        {/* Calendar header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-semibold text-lg">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              disabled={currentMonth >= addMonths(MAX_DATE, 0) && isSameMonth(currentMonth, MAX_DATE)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
          const avails = getAvailForDate(day);
          const myAvail = getMyAvailForDate(day);
          const isPast = day < TODAY;
          const isFuture = day > MAX_DATE;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          let bgClass = "hover:bg-muted cursor-pointer";
          if (isPast || isFuture) bgClass = "opacity-30 cursor-default";
          if (isSelected) bgClass = "bg-primary/10 ring-2 ring-primary";
          else if (isToday) bgClass = "ring-2 ring-primary";

            return (
              <div
                key={day.toISOString()}
                onClick={() => (isAdmin || (!isPast && !isFuture)) && handleDayClick(day)}
                className={`rounded-xl p-2 min-h-[60px] flex flex-col transition-all ${bgClass}`}
              >
                <span className="text-xs font-medium mb-1">{format(day, "d")}</span>
                {isAdmin ? (
                  avails.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {avails.slice(0, 3).map((a, i) => (
                        <span key={i} className={`text-xs px-1 rounded truncate ${a.is_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {a.employee_name?.split(" ")[0] || a.employee_number || a.created_by?.split("@")[0] || "?"}
                        </span>
                      ))}
                      {avails.length > 3 && <span className="text-xs text-muted-foreground">+{avails.length - 3}</span>}
                    </div>
                  )
                ) : (
                  myAvail && (
                    <span className={`text-xs px-1 rounded ${myAvail.is_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {myAvail.is_available ? "Available" : "Unavailable"}
                    </span>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin: show employee availability details for selected day */}
      {isAdmin && adminSelectedDate && (() => {
        const ds = format(adminSelectedDate, "yyyy-MM-dd");
        const dayAvails = availabilities.filter((a) => a.date === ds);
        return (
          <div className="mt-6 bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold">{format(adminSelectedDate, "EEEE, MMMM d, yyyy")}</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => { openSubmitForm(adminSelectedDate); setAdminSelectedDate(null); }}>
                  My Availability
                </Button>
                <button onClick={() => setAdminSelectedDate(null)}><XCircle className="w-5 h-5 text-muted-foreground" /></button>
              </div>
            </div>
            {dayAvails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees have submitted availability for this day.</p>
            ) : (
              <div className="space-y-3">
                {dayAvails.map((a) => (
                  <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${a.is_available ? "border-green-300 bg-green-100" : "border-red-300 bg-red-100"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.is_available ? "bg-green-200" : "bg-red-200"}`}>
                      {a.is_available ? <CheckCircle className="w-4 h-4 text-green-800" /> : <XCircle className="w-4 h-4 text-red-800" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900">{a.employee_name || a.employee_number || "Unknown"}</p>
                      {a.is_available && (a.available_from || a.available_until) && (
                        <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {a.available_from || "?"} – {a.available_until || "?"}
                        </p>
                      )}
                      {!a.is_available && <p className="text-xs text-red-700 font-medium mt-0.5">Unavailable</p>}
                      {a.notes && <p className="text-xs text-gray-600 mt-1 italic">"{a.notes}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Form panel for all users including admins */}
      {selectedDate && (
        <div className="mt-6 bg-card rounded-2xl border border-border p-6 max-w-md">
          <h3 className="font-heading font-semibold mb-4">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm((f) => ({ ...f, is_available: true }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.is_available ? "bg-green-500 text-white border-green-500" : "border-border hover:bg-muted"}`}>
                <CheckCircle className="w-4 h-4" /> Available
              </button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, is_available: false }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${!form.is_available ? "bg-destructive text-white border-destructive" : "border-border hover:bg-muted"}`}>
                <XCircle className="w-4 h-4" /> Unavailable
              </button>
            </div>
            {form.is_available && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                  <Input type="time" value={form.available_from} onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Until</label>
                  <Input type="time" value={form.available_until} onChange={(e) => setForm((f) => ({ ...f, available_until: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. available after noon" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              {myAvailabilities.find((a) => a.date === format(selectedDate, "yyyy-MM-dd")) && (
                <Button type="button" variant="destructive" onClick={handleDelete}>Remove</Button>
              )}
              <Button type="button" variant="outline" onClick={() => setSelectedDate(null)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Unavailable</span>
        {!isAdmin && <span className="text-muted-foreground">Click a future date to set your availability</span>}
      </div>
    </div>
  );
}