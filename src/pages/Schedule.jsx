import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PullToRefresh from "@/components/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, CalendarClock, Sparkles, X, Save, FlaskConical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [scheduledBaseMix, setScheduledBaseMix] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [editShift, setEditShift] = useState(null);
  const [editBaseMix, setEditBaseMix] = useState(null);
  const [activeTab, setActiveTab] = useState("production"); // "production" | "basemix"
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    shift_time: "08:00", flavorset_id: "", mixer_employee: "",
    assigned_employees: [], on_call_employees: [], special_order: false, special_order_name: "", notes: "",
  });
  const [baseMixForm, setBaseMixForm] = useState({
    flavorset_id: "", batch_size: 1, admin_employee: "", mixer_1: "", mixer_2: "", mixer_3: "", shift_lead: "", notes: "",
  });

  function getMixerArrivalTime(shiftTime) {
    if (!shiftTime) return "";
    const [h, m] = shiftTime.split(":").map(Number);
    const totalMins = h * 60 + m - 90;
    const hh = Math.floor(((totalMins % 1440) + 1440) % 1440 / 60);
    const mm = ((totalMins % 60) + 60) % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  const loadData = useCallback(async () => {
    const [ss, sbm, avails, emps, prodShifts, fs] = await Promise.all([
      base44.entities.ScheduledShift.list("-shift_date", 500),
      base44.entities.ScheduledBaseMixShift.list("-shift_date", 500),
      base44.entities.Availability.list("-date", 1000),
      base44.entities.Employee.list("name"),
      base44.entities.Shift.list("-shift_date", 500),
      base44.entities.FlavorSet.list("name"),
    ]);
    setScheduledShifts(ss);
    setScheduledBaseMix(sbm);
    setAvailabilities(avails);
    setEmployees(emps);
    setShifts(prodShifts);
    setFlavorSets(fs);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth));

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });
  const adminEmployees = employees.filter((e) => e.app_role === "admin" || e.terminated !== true);

  function getScheduledForDate(date) {
    const ds = format(date, "yyyy-MM-dd");
    return scheduledShifts.filter((s) => s.shift_date === ds);
  }

  function getBaseMixForDate(date) {
    const ds = format(date, "yyyy-MM-dd");
    return scheduledBaseMix.filter((s) => s.shift_date === ds);
  }

  function getSuggestedEmployees(date) {
    const ds = format(date, "yyyy-MM-dd");
    const availOnDate = availabilities.filter((a) => a.date === ds && a.is_available);
    const availableEmps = employees.filter((e) =>
      availOnDate.some((a) =>
        (a.employee_id && a.employee_id === e.id) ||
        (a.employee_number && a.employee_number === e.employee_number)
      )
    );
    const dreamTeam = findDreamTeam(shifts, employees);
    const dreamTeamIds = new Set(dreamTeam.map((e) => e.id));
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
    setEditBaseMix(null);
    setActiveTab("production");
    const suggested = getSuggestedEmployees(date);
    setForm({
      shift_time: "08:00", flavorset_id: "", mixer_employee: "",
      assigned_employees: suggested.map((e) => e.id), on_call_employees: [], us_foods: false, notes: "",
    });
    setBaseMixForm({ flavorset_id: "", batch_size: 1, admin_employee: "", notes: "" });
  }

  function openEdit(shift, date) {
    if (!isAdmin) return;
    setSelectedDate(date);
    setEditShift(shift);
    setEditBaseMix(null);
    setActiveTab("production");
    setForm({
      shift_time: shift.shift_time || "08:00",
      flavorset_id: shift.flavorset_id || "",
      mixer_employee: shift.mixer_employee || "",
      assigned_employees: shift.assigned_employees || [],
      on_call_employees: shift.on_call_employees || [],
      special_order: shift.special_order || false,
      special_order_name: shift.special_order_name || "",
      notes: shift.notes || "",
    });
  }

  function openEditBaseMix(bm, date) {
    if (!isAdmin) return;
    setSelectedDate(date);
    setEditBaseMix(bm);
    setEditShift(null);
    setActiveTab("basemix");
    setBaseMixForm({
      flavorset_id: bm.flavorset_id || "",
      batch_size: bm.batch_size || 1,
      admin_employee: bm.admin_employee || "",
      mixer_1: bm.mixer_1 || "",
      mixer_2: bm.mixer_2 || "",
      mixer_3: bm.mixer_3 || "",
      shift_lead: bm.shift_lead || "",
      notes: bm.notes || "",
    });
  }

  function toggleEmployee(empId, type) {
    setForm((f) => {
      if (type === "oncall") {
        const current = f.on_call_employees || [];
        return { ...f, on_call_employees: current.includes(empId) ? current.filter((id) => id !== empId) : [...current, empId] };
      } else {
        const current = f.assigned_employees || [];
        if (current.includes(empId)) return { ...f, assigned_employees: current.filter((id) => id !== empId) };
        if (current.length >= 9) return f;
        return { ...f, assigned_employees: [...current, empId] };
      }
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

  async function handleSaveBaseMix(e) {
    e.preventDefault();
    setSaving(true);
    const ds = format(selectedDate, "yyyy-MM-dd");
    const payload = { ...baseMixForm, shift_date: ds, batch_size: Number(baseMixForm.batch_size) };
    if (editBaseMix) {
      await base44.entities.ScheduledBaseMixShift.update(editBaseMix.id, payload);
      setScheduledBaseMix((prev) => prev.map((s) => s.id === editBaseMix.id ? { ...s, ...payload } : s));
    } else {
      const created = await base44.entities.ScheduledBaseMixShift.create(payload);
      setScheduledBaseMix((prev) => [...prev, created]);
    }
    setSaving(false);
    setSelectedDate(null);
    setEditBaseMix(null);
  }

  async function handleDelete() {
    if (!editShift) return;
    await base44.entities.ScheduledShift.delete(editShift.id);
    setScheduledShifts((prev) => prev.filter((s) => s.id !== editShift.id));
    setSelectedDate(null);
    setEditShift(null);
  }

  async function handleDeleteBaseMix() {
    if (!editBaseMix) return;
    await base44.entities.ScheduledBaseMixShift.delete(editBaseMix.id);
    setScheduledBaseMix((prev) => prev.filter((s) => s.id !== editBaseMix.id));
    setSelectedDate(null);
    setEditBaseMix(null);
  }

  function closePanel() {
    setSelectedDate(null);
    setEditShift(null);
    setEditBaseMix(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const suggestedForSelected = selectedDate ? getSuggestedEmployees(selectedDate) : [];
  const availOnSelected = selectedDate
    ? availabilities.filter((a) => a.date === format(selectedDate, "yyyy-MM-dd") && a.is_available)
    : [];

  // All upcoming production + base mix shifts merged and sorted
  const todayStr = format(TODAY, "yyyy-MM-dd");
  const upcomingProduction = scheduledShifts.filter((s) => s.shift_date >= todayStr);
  const upcomingBaseMix = scheduledBaseMix.filter((s) => s.shift_date >= todayStr);
  const allUpcoming = [
    ...upcomingProduction.map((s) => ({ ...s, _type: "production" })),
    ...upcomingBaseMix.map((s) => ({ ...s, _type: "basemix" })),
  ].sort((a, b) => a.shift_date.localeCompare(b.shift_date)).slice(0, 30);

  return (
    <PullToRefresh onRefresh={loadData}>
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
            const dayBaseMix = getBaseMixForDate(day);
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
                {dayShifts.map((s) => {
                  const prodDotColor = s.special_order ? "#22c55e" : fsMap[s.flavorset_id]?.color;
                  return (
                  <button key={s.id} onClick={(e) => { e.stopPropagation(); openEdit(s, day); }} className="text-left w-full mb-0.5">
                    <span className="text-xs px-1 py-0.5 rounded bg-primary/15 text-primary font-medium flex items-center gap-1 truncate">
                      {prodDotColor && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: prodDotColor }} />
                      )}
                      {s.shift_time} · {(s.assigned_employees || []).length}w
                    </span>
                  </button>
                  );
                })}
                {dayBaseMix.map((bm) => {
                  const fs = fsMap[bm.flavorset_id];
                  const dotColor = fs?.color;
                  return (
                    <button key={bm.id} onClick={(e) => { e.stopPropagation(); openEditBaseMix(bm, day); }} className="text-left w-full mb-0.5">
                      <span className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-medium flex items-center gap-1 truncate">
                        {dotColor && <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: dotColor }} />}
                        <FlaskConical className="w-2.5 h-2.5 flex-shrink-0" />
                        {bm.batch_size}b
                      </span>
                    </button>
                  );
                })}
                {isAdmin && !isPast && !isFuture && dayShifts.length === 0 && dayBaseMix.length === 0 && (
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
            <button onClick={closePanel}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => { setActiveTab("production"); setEditBaseMix(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "production" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
            >
              Production Shift
            </button>
            <button
              onClick={() => { setActiveTab("basemix"); setEditShift(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === "basemix" ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground"}`}
            >
              <FlaskConical className="w-3.5 h-3.5" /> Base Mix Shift
            </button>
          </div>

          {/* Production shift form */}
          {activeTab === "production" && (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</label>
                  <Input type="time" value={form.shift_time} onChange={(e) => setForm((f) => ({ ...f, shift_time: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset</label>
                  <Select value={form.flavorset_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, flavorset_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select flavorset..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mixer</label>
                <Select value={form.mixer_employee || ""} onValueChange={(v) => setForm((f) => ({ ...f, mixer_employee: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select mixer..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.mixer_employee && (
                  <p className="text-xs text-muted-foreground mt-1">Mixer arrives at <span className="font-medium text-foreground">{getMixerArrivalTime(form.shift_time)}</span> (1.5 hrs before shift)</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Working Employees ({(form.assigned_employees || []).length}/9)</label>
                  {suggestedForSelected.length > 0 && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, assigned_employees: suggestedForSelected.map((e) => e.id) }))}
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Sparkles className="w-3 h-3" /> Use suggestions
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {employees.map((emp) => {
                    const isWorking = (form.assigned_employees || []).includes(emp.id);
                    const isOnCall = (form.on_call_employees || []).includes(emp.id);
                    const avail = availOnSelected.find((a) =>
                      (a.employee_id && a.employee_id === emp.id) ||
                      (a.employee_number && a.employee_number === emp.employee_number)
                    );
                    const dreamTeam = findDreamTeam(shifts, employees);
                    const isDream = dreamTeam.some((e) => e.id === emp.id);
                    return (
                      <div key={emp.id} className={`flex flex-col rounded-xl border transition-all ${isWorking ? "bg-primary/10 border-primary" : isOnCall ? "bg-yellow-50 border-yellow-300" : "border-border"}`}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="flex-1 truncate text-sm font-medium">{emp.name}</span>
                          <span className="flex gap-0.5">
                            {isDream && <span title="Dream team" className="text-yellow-500 text-xs">★</span>}
                            {avail ? <span title="Available" className="text-green-500 text-xs">✓</span> : <span title="No availability set" className="text-muted-foreground text-xs">?</span>}
                          </span>
                        </div>
                        <div className="flex border-t border-border">
                          <button type="button" onClick={() => toggleEmployee(emp.id, "working")}
                            disabled={!isWorking && (form.assigned_employees || []).length >= 9}
                            className={`flex-1 text-xs py-1 rounded-bl-xl transition-all ${isWorking ? "bg-primary text-primary-foreground" : "hover:bg-primary/10 text-muted-foreground disabled:opacity-30"}`}>
                            Working
                          </button>
                          <button type="button" onClick={() => toggleEmployee(emp.id, "oncall")}
                            className={`flex-1 text-xs py-1 rounded-br-xl border-l border-border transition-all ${isOnCall ? "bg-yellow-400 text-yellow-900" : "hover:bg-yellow-50 text-muted-foreground"}`}>
                            On Call
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">★ = Dream team · ✓ = Available · Max 9 working, unlimited on call</p>
              </div>

              {/* Special Order toggle */}
              <div className="flex items-start gap-3 p-3 rounded-xl border border-green-200 bg-green-50">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, special_order: !f.special_order, special_order_name: f.special_order ? "" : f.special_order_name }))}
                  className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${form.special_order ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.special_order ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 mb-1">Special Order</p>
                  {form.special_order && (
                    <input
                      type="text"
                      value={form.special_order_name}
                      onChange={(e) => setForm((f) => ({ ...f, special_order_name: e.target.value }))}
                      placeholder="e.g. U.S. Foods, Whole Foods..."
                      className="w-full text-sm px-2 py-1 rounded-lg border border-green-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                    />
                  )}
                </div>
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
                {editShift && <Button type="button" variant="destructive" onClick={handleDelete}>Delete</Button>}
                <Button type="button" variant="outline" onClick={closePanel}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Base mix shift form */}
          {activeTab === "basemix" && (
            <form onSubmit={handleSaveBaseMix} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset</label>
                  <Select value={baseMixForm.flavorset_id || ""} onValueChange={(v) => setBaseMixForm((f) => ({ ...f, flavorset_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select flavorset..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {flavorSets.map((fs) => (
                        <SelectItem key={fs.id} value={fs.id}>
                          <span className="flex items-center gap-2">
                            {fs.color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: fs.color }} />}
                            {fs.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Number of Batches</label>
                  <Input type="number" min="0.25" step="0.25" value={baseMixForm.batch_size}
                    onChange={(e) => setBaseMixForm((f) => ({ ...f, batch_size: e.target.value }))} required />
                  {baseMixForm.batch_size > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">= {Number(baseMixForm.batch_size) * 240} gallons</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Admin Working</label>
                  <Select value={baseMixForm.admin_employee || ""} onValueChange={(v) => setBaseMixForm((f) => ({ ...f, admin_employee: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select admin..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {employees.filter((e) => e.app_role === "admin").map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mixer 1</label>
                  <Select value={baseMixForm.mixer_1 || ""} onValueChange={(v) => setBaseMixForm((f) => ({ ...f, mixer_1: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select mixer..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mixer 2</label>
                  <Select value={baseMixForm.mixer_2 || ""} onValueChange={(v) => setBaseMixForm((f) => ({ ...f, mixer_2: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select mixer..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mixer 3</label>
                  <Select value={baseMixForm.mixer_3 || ""} onValueChange={(v) => setBaseMixForm((f) => ({ ...f, mixer_3: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select mixer..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Lead</label>
                  <Select value={baseMixForm.shift_lead || ""} onValueChange={(v) => setBaseMixForm((f) => ({ ...f, shift_lead: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Select shift lead..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                  <Input value={baseMixForm.notes} onChange={(e) => setBaseMixForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : editBaseMix ? "Update" : "Schedule Base Mix"}
                </Button>
                {editBaseMix && <Button type="button" variant="destructive" onClick={handleDeleteBaseMix}>Delete</Button>}
                <Button type="button" variant="outline" onClick={closePanel}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Upcoming shifts list — visible to all */}
      <div className="mt-6 space-y-3">
        {allUpcoming.map((s) => {
          if (s._type === "production") {
            const assignedEmps = (s.assigned_employees || []).map((id) => empMap[id]).filter(Boolean);
            return (
              <div key={`p-${s.id}`} className="bg-card rounded-2xl border border-border p-5 active:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarClock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold flex items-center gap-2">
                      {new Date(s.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      {s.special_order && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Special: {s.special_order_name || "Order"}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {s.flavorset_id && fsMap[s.flavorset_id]?.color && (
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: fsMap[s.flavorset_id]?.color }} />
                      )}
                      {s.shift_time}{s.flavorset_id && fsMap[s.flavorset_id] ? ` · ${fsMap[s.flavorset_id].name}` : ""}
                    </p>
                  </div>
                </div>
                {s.mixer_employee && empMap[s.mixer_employee] && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Mixer</p>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-lg">
                      {empMap[s.mixer_employee].name} · arrives {getMixerArrivalTime(s.shift_time)}
                    </span>
                  </div>
                )}
                {assignedEmps.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Working</p>
                    <div className="flex flex-wrap gap-2">
                      {assignedEmps.map((emp) => (
                        <span key={emp.id} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg">{emp.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(s.on_call_employees || []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">On Call</p>
                    <div className="flex flex-wrap gap-2">
                      {(s.on_call_employees || []).map((id) => empMap[id]).filter(Boolean).map((emp) => (
                        <span key={emp.id} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg">{emp.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {s.notes && <p className="text-xs text-muted-foreground mt-2">{s.notes}</p>}
              </div>
            );
          } else {
            // Base mix shift
            const fs = fsMap[s.flavorset_id];
            const dotColor = fs?.color;
            const adminEmp = s.admin_employee ? empMap[s.admin_employee] : null;
            return (
              <div key={`bm-${s.id}`} className="bg-card rounded-2xl border border-border p-5 active:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold">
                      {new Date(s.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {dotColor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: dotColor }} />}
                      Base Mix · {fs?.name || "Unknown"} · {s.batch_size} batch{s.batch_size !== 1 ? "es" : ""} ({Number(s.batch_size) * 240} gal)
                    </p>
                  </div>
                </div>
                {adminEmp && (
                  <p className="text-xs text-muted-foreground">Admin: <span className="font-medium text-foreground">{adminEmp.name}</span></p>
                )}
                {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
              </div>
            );
          }
        })}
      </div>
    </div>
    </PullToRefresh>
  );
}