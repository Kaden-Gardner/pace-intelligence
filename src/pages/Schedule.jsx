import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, CalendarClock, Sparkles, X, Save } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addYears, isSameMonth } from "date-fns";
import { findDreamTeam } from "../lib/analyticsHelpers";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const MAX_DATE = addYears(TODAY, 1);

export default function Schedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduledShifts, setScheduledShifts] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editShift, setEditShift] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ shift_time: "08:00", shift_duration: 8, assigned_employees: [], notes: "" });

  useEffect(() => {
    async function load() {
      const [ss, avails, emps, prodShifts] = await Promise.all([
        base44.entities.ScheduledShift.list("-shift_date", 500),
        base44.entities.Availability.list("-date", 1000),
        base44.entities.Employee.list("name"),
        base44.entities.Shift.list("-shift_date", 500),
      ]);
      setScheduledShifts(ss);
      setAvailabilities(avails);
      setEmployees(emps);
      setShifts(prodShifts);
      setLoading(false);
    }
    load();
  }, []);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth));

  function getScheduledForDate(date) {
    const ds = format(date, "yyyy-MM-dd");
    return scheduledShifts.filter((s) => s.shift_date === ds);
  }

  function getSuggestedEmployees(date) {
    const ds = format(date, "yyyy-MM-dd");
    const availOnDate = availabilities.filter((a) => a.date === ds && a.is_available);
    const availableEmpNumbers = availOnDate.map((a) => a.employee_number).filter(Boolean);
    const availableEmps = employees.filter((e) => availableEmpNumbers.includes(e.employee_number));

    // Cross-reference with dream team
    const dreamTeam = findDreamTeam(shifts, employees);
    const dreamTeamIds = new Set(dreamTeam.map((e) => e.id));

    // Sort: dream team members first, then others
    const sorted = [
      ...availableEmps.filter((e) => dreamTeamIds.has(e.id)),
      ...availableEmps.filter((e) => !dreamTeamIds.has(e.id)),
    ];

    return sorted.slice(0, 9);
  }

  function openCreate(date) {
    if (!isAdmin) return;
    if (date < TODAY || date > MAX_DATE) return;
    setSelectedDate(date);
    setEditShift(null);
    const suggested = getSuggestedEmployees(date);
    setForm({
      shift_time: "08:00",
      shift_duration: 8,
      assigned_employees: suggested.map((e) => e.id),
      notes: "",
    });
  }

  function openEdit(shift, date) {
    if (!isAdmin) return;
    setSelectedDate(date);
    setEditShift(shift);
    setForm({
      shift_time: shift.shift_time || "08:00",
      shift_duration: shift.shift_duration || 8,
      assigned_employees: shift.assigned_employees || [],
      notes: shift.notes || "",
    });
  }

  function toggleEmployee(empId) {
    setForm((f) => {
      const current = f.assigned_employees || [];
      return {
        ...f,
        assigned_employees: current.includes(empId)
          ? current.filter((id) => id !== empId)
          : [...current, empId].slice(0, 9),
      };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const ds = format(selectedDate, "yyyy-MM-dd");
    const payload = { ...form, shift_date: ds };

    if (editShift) {
      await base44.entities.ScheduledShift.update(editShift.id, payload);
      setScheduledShifts((prev) => prev.map((s) => s.id === editShift.id ? { ...s, ...payload } : s));
    } else {
      const created = await base44.entities.ScheduledShift.create(payload);
      setScheduledShifts((prev) => [...prev, created]);
    }
    setSaving(false);
    setSelectedDate(null);
    setEditShift(null);
  }

  async function handleDelete() {
    if (!editShift) return;
    await base44.entities.ScheduledShift.delete(editShift.id);
    setScheduledShifts((prev) => prev.filter((s) => s.id !== editShift.id));
    setSelectedDate(null);
    setEditShift(null);
  }

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const suggestedForSelected = selectedDate ? getSuggestedEmployees(selectedDate) : [];
  const availOnSelected = selectedDate
    ? availabilities.filter((a) => a.date === format(selectedDate, "yyyy-MM-dd") && a.is_available)
    : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Schedule</h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Plan and manage upcoming shifts" : "View upcoming scheduled shifts"}
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading font-semibold text-lg">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array(startPad).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const dayShifts = getScheduledForDate(day);
            const isPast = day < TODAY;
            const isFuture = day > MAX_DATE;
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            let bgClass = isAdmin && !isPast && !isFuture ? "hover:bg-muted cursor-pointer" : "";
            if (isPast || isFuture) bgClass = "opacity-30";
            if (isSelected) bgClass = "bg-primary/10 ring-2 ring-primary";
            else if (isToday) bgClass += " ring-2 ring-primary/40";

            return (
              <div
                key={day.toISOString()}
                onClick={() => isAdmin && !isPast && !isFuture && openCreate(day)}
                className={`rounded-xl p-2 min-h-[70px] flex flex-col transition-all ${bgClass}`}
              >
                <span className={`text-xs font-medium mb-1 ${isToday && !isSelected ? "text-primary font-bold" : ""}`}>{format(day, "d")}</span>
                {dayShifts.map((s) => (
                  <button
                    key={s.id}
                    onClick={(e) => { e.stopPropagation(); openEdit(s, day); }}
                    className="text-left w-full mb-0.5"
                  >
                    <span className="text-xs px-1 py-0.5 rounded bg-primary/15 text-primary font-medium block truncate">
                      {s.shift_time} · {(s.assigned_employees || []).length} staff
                    </span>
                  </button>
                ))}
                {isAdmin && !isPast && !isFuture && dayShifts.length === 0 && (
                  <span className="text-xs text-muted-foreground/40 mt-auto">+ add</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shift form panel */}
      {isAdmin && selectedDate && (
        <div className="mt-6 bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
            <button onClick={() => { setSelectedDate(null); setEditShift(null); }}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</label>
                <Input type="time" value={form.shift_time} onChange={(e) => setForm((f) => ({ ...f, shift_time: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (hours)</label>
                <Input type="number" min="0.5" step="0.5" value={form.shift_duration} onChange={(e) => setForm((f) => ({ ...f, shift_duration: parseFloat(e.target.value) || 8 }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-medium text-muted-foreground">Assigned Employees (max 9)</label>
                {suggestedForSelected.length > 0 && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, assigned_employees: suggestedForSelected.map((e) => e.id) }))}
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Sparkles className="w-3 h-3" /> Use suggestions
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {employees.map((emp) => {
                  const isChecked = (form.assigned_employees || []).includes(emp.id);
                  const avail = availOnSelected.find((a) => a.employee_number === emp.employee_number);
                  const dreamTeam = findDreamTeam(shifts, employees);
                  const isDream = dreamTeam.some((e) => e.id === emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(emp.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all text-left ${
                        isChecked ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="flex-1 truncate">{emp.name}</span>
                      <span className="flex gap-0.5">
                        {isDream && <span title="Dream team" className="text-yellow-500 text-xs">★</span>}
                        {avail ? <span title="Available" className="text-green-500 text-xs">✓</span> : <span title="No availability set" className="text-muted-foreground text-xs">?</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">★ = Dream team · ✓ = Available that day</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : editShift ? "Update" : "Schedule Shift"}
              </Button>
              {editShift && (
                <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>
              )}
              <Button type="button" variant="outline" onClick={() => { setSelectedDate(null); setEditShift(null); }}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* View-only shift details for non-admins */}
      {!isAdmin && (
        <div className="mt-6 space-y-3">
          {scheduledShifts.filter((s) => s.shift_date >= format(TODAY, "yyyy-MM-dd")).slice(0, 20).map((s) => {
            const assignedEmps = (s.assigned_employees || []).map((id) => empMap[id]).filter(Boolean);
            return (
              <div key={s.id} className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarClock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold">
                      {new Date(s.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.shift_time} · {s.shift_duration}h</p>
                  </div>
                </div>
                {assignedEmps.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {assignedEmps.map((emp) => (
                      <span key={emp.id} className="text-xs px-2 py-1 bg-muted rounded-lg">{emp.name}</span>
                    ))}
                  </div>
                )}
                {s.notes && <p className="text-xs text-muted-foreground mt-2">{s.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}