import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Pencil, Check, X, Trash2, MapPin, CalendarRange } from "lucide-react";
import { format, parseISO, differenceInMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";

const PERIODS = [
  { label: "This Week", key: "week" },
  { label: "Last Week", key: "lastweek" },
  { label: "This Month", key: "month" },
  { label: "Last Month", key: "lastmonth" },
  { label: "All Time", key: "all" },
  { label: "Custom Range", key: "custom" },
];

function getPeriodRange(key) {
  const now = new Date();
  if (key === "week") return [startOfWeek(now), endOfWeek(now)];
  if (key === "lastweek") {
    const s = startOfWeek(new Date(now - 7 * 86400000));
    return [s, endOfWeek(s)];
  }
  if (key === "month") return [startOfMonth(now), endOfMonth(now)];
  if (key === "lastmonth") {
    const lm = subMonths(now, 1);
    return [startOfMonth(lm), endOfMonth(lm)];
  }
  return [null, null];
}

function fmtHours(h) {
  if (!h && h !== 0) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function fmtDatetime(iso) {
  if (!iso) return "—";
  return format(parseISO(iso), "MMM d, h:mm a");
}

function calcHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const mins = differenceInMinutes(parseISO(clockOut), parseISO(clockIn));
  return Math.max(0, mins / 60);
}

export default function TimeTracking() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ clock_in: "", clock_out: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [checkingGeo, setCheckingGeo] = useState(false);
  const [adminView, setAdminView] = useState("my"); // "my" | "all" | "terminal"
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const GEOFENCE = { lat: 40.856180, lng: -111.927465, radiusMeters: 27.4 }; // 30 yards

  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState(false);

  // Admin terminal state
  const [terminalEmpNum, setTerminalEmpNum] = useState("");
  const [terminalStatus, setTerminalStatus] = useState(null); // { type: "success"|"error", message }
  const [terminalSaving, setTerminalSaving] = useState(false);

  async function handleTerminalClockIn() {
    const num = terminalEmpNum.trim();
    if (!num) return;
    setTerminalSaving(true);
    setTerminalStatus(null);
    try {
      const emp = employees.find((e) => e.employee_number === num);
      if (!emp) {
        setTerminalStatus({ type: "error", message: `No employee found with number #${num}.` });
        setTerminalSaving(false);
        return;
      }
      const activeEmpEntry = entries.find((e) =>
        (e.employee_id === emp.id || e.employee_number === emp.employee_number) &&
        e.clock_in && !e.clock_out
      );
      if (activeEmpEntry) {
        const res = await base44.functions.invoke("terminalClockIn", {
          action: "clock_out",
          entry_id: activeEmpEntry.id,
          clock_in: activeEmpEntry.clock_in,
        });
        const { time, total_hours } = res.data;
        setEntries((prev) => prev.map((e) => e.id === activeEmpEntry.id ? { ...e, clock_out: time, total_hours } : e));
        setTerminalStatus({ type: "success", message: `${emp.name} clocked out at ${format(new Date(time), "h:mm a")}.` });
      } else {
        const res = await base44.functions.invoke("terminalClockIn", {
          action: "clock_in",
          employee_id: emp.id,
          employee_name: emp.name,
          employee_number: emp.employee_number,
        });
        const { entry } = res.data;
        setEntries((prev) => [entry, ...prev]);
        setTerminalStatus({ type: "success", message: `${emp.name} clocked in at ${format(new Date(entry.clock_in), "h:mm a")}.` });
      }
      setTerminalEmpNum("");
    } catch (err) {
      console.error("Terminal clock-in error:", err);
      setTerminalStatus({ type: "error", message: `Something went wrong: ${err.message || "Unknown error"}` });
    }
    setTerminalSaving(false);
  }

  useEffect(() => {
    async function load() {
      const [ents, emps] = await Promise.all([
        base44.entities.TimeEntry.list("-clock_in", 1000),
        base44.entities.Employee.list("name"),
      ]);
      setEntries(ents);
      setEmployees(emps);
      setLoading(false);
    }
    load();
  }, []);

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });

  // Find this user's active (clocked-in, no clock-out) entry
  const activeEntry = entries.find((e) => e.user_id === user?.id && e.clock_in && !e.clock_out);

  async function handleClockInWithGeo() {
    setCheckingGeo(true);
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser.");
      setCheckingGeo(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, GEOFENCE.lat, GEOFENCE.lng);
        setCheckingGeo(false);
        if (dist > GEOFENCE.radiusMeters) {
          setGeoError(`You must be at the facility to clock in. (${Math.round(dist)} m away)`);
        } else {
          handleClockIn();
        }
      },
      () => {
        setCheckingGeo(false);
        setGeoError("Location access denied. Please enable location permissions.");
      },
      { timeout: 10000, maximumAge: 0, enableHighAccuracy: true }
    );
  }

  async function handleClockIn() {
    setSaving(true);
    const linkedEmp = employees.find((e) => e.employee_number === user?.employee_number);
    const now = new Date().toISOString();
    const optimisticEntry = {
      id: `optimistic-${Date.now()}`,
      user_id: user.id,
      employee_id: linkedEmp?.id || "",
      employee_name: linkedEmp?.name || user?.full_name || "",
      employee_number: linkedEmp?.employee_number || user?.employee_number || "",
      clock_in: now,
      clock_out: null,
      total_hours: null,
    };
    // Optimistic update: show clocked-in state immediately
    setEntries((prev) => [optimisticEntry, ...prev]);
    const created = await base44.entities.TimeEntry.create({
      user_id: optimisticEntry.user_id,
      employee_id: optimisticEntry.employee_id,
      employee_name: optimisticEntry.employee_name,
      employee_number: optimisticEntry.employee_number,
      clock_in: now,
    });
    // Replace optimistic entry with real one
    setEntries((prev) => prev.map((e) => e.id === optimisticEntry.id ? created : e));
    setSaving(false);
  }

  async function handleClockOut() {
    if (!activeEntry) return;
    setSaving(true);
    const clockOut = new Date().toISOString();
    const total_hours = calcHours(activeEntry.clock_in, clockOut);
    // Optimistic update: reflect clocked-out state immediately
    setEntries((prev) => prev.map((e) => e.id === activeEntry.id ? { ...e, clock_out: clockOut, total_hours } : e));
    await base44.entities.TimeEntry.update(activeEntry.id, { clock_out: clockOut, total_hours });
    setSaving(false);
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditForm({
      clock_in: entry.clock_in ? entry.clock_in.slice(0, 16) : "",
      clock_out: entry.clock_out ? entry.clock_out.slice(0, 16) : "",
      notes: entry.notes || "",
    });
  }

  async function handleDelete(entry) {
    if (deletePassword !== "ecap") {
      setDeleteError(true);
      return;
    }
    try {
      await base44.entities.TimeEntry.delete(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setDeleteTarget(null);
      setDeletePassword("");
      setDeleteError(false);
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleteError("failed");
    }
  }

  async function saveEdit(entry) {
    setSaving(true);
    const clockIn = editForm.clock_in ? new Date(editForm.clock_in).toISOString() : entry.clock_in;
    const clockOut = editForm.clock_out ? new Date(editForm.clock_out).toISOString() : entry.clock_out;
    const total_hours = clockIn && clockOut ? calcHours(clockIn, clockOut) : entry.total_hours;
    const updated = { clock_in: clockIn, clock_out: clockOut || null, total_hours, notes: editForm.notes };
    await base44.entities.TimeEntry.update(entry.id, updated);
    setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, ...updated } : e));
    setEditingId(null);
    setSaving(false);
  }

  function filterByPeriod(list) {
    if (period === "custom") {
      if (!customStart && !customEnd) return list;
      return list.filter((e) => {
        if (!e.clock_in) return false;
        const d = parseISO(e.clock_in);
        if (customStart && d < new Date(customStart + "T00:00:00")) return false;
        if (customEnd && d > new Date(customEnd + "T23:59:59")) return false;
        return true;
      });
    }
    const [start, end] = getPeriodRange(period);
    if (!start) return list;
    return list.filter((e) => {
      if (!e.clock_in) return false;
      const d = parseISO(e.clock_in);
      return d >= start && d <= end;
    });
  }

  const myEntries = filterByPeriod(entries.filter((e) => e.user_id === user?.id));
  const allEntries = filterByPeriod(entries);

  const myTotalHours = myEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

  // Admin summary: group by employee
  const empSummary = {};
  allEntries.forEach((e) => {
    const key = e.user_id || e.employee_name;
    if (!empSummary[key]) {
      empSummary[key] = {
        employee_name: e.employee_name,
        employee_number: e.employee_number,
        totalHours: 0,
        shifts: 0,
      };
    }
    empSummary[key].totalHours += e.total_hours || 0;
    empSummary[key].shifts += 1;
  });
  const summaryList = Object.values(empSummary).sort((a, b) => b.totalHours - a.totalHours);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const displayEntries = (isAdmin && adminView === "all") ? allEntries : myEntries;
  const displayLabel = (isAdmin && adminView === "all") ? "All Employees" : "My Hours";

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Time Tracking</h1>
          <p className="text-muted-foreground mt-1">Clock in and out, view your hours</p>
        </div>
        {/* Clock In/Out buttons */}
        <div className="flex gap-3 items-center">
          {activeEntry ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-medium">
                <Clock className="w-4 h-4 animate-pulse" />
                Clocked in at {format(parseISO(activeEntry.clock_in), "h:mm a")}
              </div>
              <Button onClick={handleClockOut} disabled={saving} variant="destructive" className="gap-2">
                <LogOut className="w-4 h-4" /> Clock Out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleClockInWithGeo} disabled={saving || checkingGeo} className="gap-2">
                {checkingGeo ? <MapPin className="w-4 h-4 animate-pulse" /> : <LogIn className="w-4 h-4" />}
                {checkingGeo ? "Checking location..." : "Clock In"}
              </Button>
              {geoError && (
                <p className="text-xs text-destructive max-w-xs text-right">{geoError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-muted/50 rounded-xl border border-border">
          <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium">From</label>
            <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium">To</label>
            <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          {(customStart || customEnd) && (
            <button onClick={() => { setCustomStart(""); setCustomEnd(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>
          )}
        </div>
      )}
      {period !== "custom" && <div className="mb-6" />}

      {/* Admin tabs */}
      {isAdmin && (
        <div className="flex gap-2 mb-6">
          {[{ key: "my", label: "My Hours" }, { key: "all", label: "All Employees" }, { key: "terminal", label: "Clock-In Terminal" }].map((v) => (
            <button key={v.key} onClick={() => setAdminView(v.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${adminView === v.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Admin clock-in terminal tab */}
      {isAdmin && adminView === "terminal" && (() => {
        const activeEmployees = entries.filter((e) => e.clock_in && !e.clock_out);
        // Last 12 clock actions: entries sorted by most recent action (clock_out if present, else clock_in)
        const recentActions = [...entries]
          .flatMap((e) => {
            const actions = [{ time: e.clock_in, type: "in", name: e.employee_name, number: e.employee_number }];
            if (e.clock_out) actions.push({ time: e.clock_out, type: "out", name: e.employee_name, number: e.employee_number });
            return actions;
          })
          .sort((a, b) => new Date(b.time) - new Date(a.time))
          .slice(0, 12);

        return (
          <div className="space-y-6">
            {/* Input row */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="font-heading font-semibold text-xl mb-1">Clock-In Terminal</h2>
              <p className="text-sm text-muted-foreground mb-4">Enter an employee number to clock them in or out.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Employee #"
                  value={terminalEmpNum}
                  onChange={(e) => { setTerminalEmpNum(e.target.value); setTerminalStatus(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleTerminalClockIn()}
                  className="font-mono text-lg h-11 max-w-[200px]"
                  disabled={terminalSaving}
                  autoFocus
                />
                <Button onClick={handleTerminalClockIn} disabled={terminalSaving || !terminalEmpNum.trim()} className="gap-2 h-11 px-5">
                  <Clock className="w-4 h-4" /> {terminalSaving ? "Processing..." : "Submit"}
                </Button>
              </div>
              {terminalStatus && (
                <p className={`text-sm mt-3 font-medium ${terminalStatus.type === "success" ? "text-green-600" : "text-destructive"}`}>
                  {terminalStatus.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Currently clocked in */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <h3 className="font-heading font-semibold">Currently Clocked In</h3>
                  <span className="ml-auto text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{activeEmployees.length}</span>
                </div>
                {activeEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees currently clocked in.</p>
                ) : (
                  <div className="space-y-2">
                    {activeEmployees.map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{e.employee_name || "Unknown"}</p>
                          {e.employee_number && <p className="text-xs text-muted-foreground">#{e.employee_number}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-green-600 font-medium">Since {fmtDatetime(e.clock_in)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent history */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-heading font-semibold mb-4">Recent Activity</h3>
                {recentActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity.</p>
                ) : (
                  <div className="space-y-2">
                    {recentActions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${action.type === "in" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                          {action.type === "in" ? <LogIn className="w-3.5 h-3.5" /> : <LogOut className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{action.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{action.type === "in" ? "Clocked in" : "Clocked out"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground text-right shrink-0">{fmtDatetime(action.time)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin summary table */}
      {isAdmin && adminView === "all" && (
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-heading font-semibold mb-4">Employee Summary</h2>
          {summaryList.length === 0 ? (
            <p className="text-muted-foreground text-sm">No entries in this period.</p>
          ) : (
            <div className="space-y-2">
              {summaryList.map((emp, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{emp.employee_name || "Unknown"}</p>
                    {emp.employee_number && <p className="text-xs text-muted-foreground">#{emp.employee_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-heading font-bold text-primary">{fmtHours(emp.totalHours)}</p>
                    <p className="text-xs text-muted-foreground">{emp.shifts} {emp.shifts === 1 ? "entry" : "entries"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My/All entries */}
      {adminView === "terminal" ? null : <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold">{displayLabel}</h2>
          {adminView === "my" && (
            <div className="text-right">
              <p className="text-2xl font-heading font-bold text-primary">{fmtHours(myTotalHours)}</p>
              <p className="text-xs text-muted-foreground">total this period</p>
            </div>
          )}
        </div>

        {displayEntries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No time entries found for this period.</p>
        ) : (
          <div className="space-y-3">
            {displayEntries.map((entry) => (
              <div key={entry.id} className="border border-border rounded-xl p-4">
                {editingId === entry.id ? (
                  <div className="space-y-3">
                    {isAdmin && adminView === "all" && (
                      <p className="text-sm font-medium">{entry.employee_name}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Clock In</label>
                        <Input type="datetime-local" value={editForm.clock_in} onChange={(e) => setEditForm((f) => ({ ...f, clock_in: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Clock Out</label>
                        <Input type="datetime-local" value={editForm.clock_out} onChange={(e) => setEditForm((f) => ({ ...f, clock_out: e.target.value }))} />
                      </div>
                    </div>
                    <Input placeholder="Notes..." value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(entry)} disabled={saving} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      {isAdmin && adminView === "all" && (
                        <p className="text-sm font-medium mb-1">{entry.employee_name || "Unknown"}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span><span className="text-muted-foreground text-xs">In: </span>{fmtDatetime(entry.clock_in)}</span>
                        <span><span className="text-muted-foreground text-xs">Out: </span>{entry.clock_out ? fmtDatetime(entry.clock_out) : <span className="text-green-600 font-medium">Active</span>}</span>
                        <span className="font-medium text-primary">{entry.total_hours != null ? fmtHours(entry.total_hours) : "—"}</span>
                      </div>
                      {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(isAdmin || entry.user_id === user?.id) && (
                        <Button variant="ghost" size="sm" onClick={() => startEdit(entry)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteTarget(entry); setDeletePassword(""); setDeleteError(false); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>}
      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold mb-1">Delete Time Entry</h3>
            <p className="text-sm text-muted-foreground mb-4">Enter the admin password to delete this entry for <span className="font-medium text-foreground">{deleteTarget.employee_name}</span>.</p>
            <Input
              type="password"
              placeholder="Password"
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleDelete(deleteTarget)}
              className={deleteError ? "border-destructive" : ""}
            />
            {deleteError === true && <p className="text-xs text-destructive mt-1">Incorrect password.</p>}
            {deleteError === "failed" && <p className="text-xs text-destructive mt-1">Delete failed — you may not have permission to delete this entry.</p>}
            <div className="flex gap-2 mt-4">
              <Button variant="destructive" onClick={() => handleDelete(deleteTarget)} className="gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeletePassword(""); setDeleteError(false); }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}