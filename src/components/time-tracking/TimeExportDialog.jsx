import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { exportTimeTrackingPdf } from "@/components/time-tracking/timeTrackingPdf";

function fmtHours(h) {
  if (h == null) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function entryHours(e) {
  if (e.total_hours != null) return e.total_hours;
  if (e.clock_in && e.clock_out) {
    return Math.max(0, (new Date(e.clock_out) - new Date(e.clock_in)) / 3600000);
  }
  return null;
}

function matches(entry, emp) {
  if (entry.employee_id) return entry.employee_id === emp.id;
  if (entry.employee_number) return entry.employee_number === emp.employee_number;
  return entry.employee_name === emp.name;
}

function safeName(s) {
  return (s || "Employee").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function entryRow(e) {
  const h = entryHours(e);
  return {
    date: format(parseISO(e.clock_in), "EEE, MMM d, yyyy"),
    in: format(parseISO(e.clock_in), "h:mm a"),
    out: e.clock_out ? format(parseISO(e.clock_out), "h:mm a") : "Active",
    hours: h != null ? fmtHours(h) : "—",
    notes: e.notes || "",
  };
}

function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function periodRangeLabel(p) {
  return `${format(p.start, "MMM d")} – ${format(p.end, "MMM d, yyyy")}`;
}

const MODES = [
  { key: "all", label: "All employees", hint: "Everyone with hours in the selected period" },
  { key: "one", label: "One employee", hint: "One employee's hours for the selected period" },
  { key: "history", label: "Full history", hint: "Every clock-in, one per line, with totals per pay period" },
];

const ENTRY_COLUMNS = [
  { key: "date", label: "Date", w: 32 },
  { key: "in", label: "Clock In", w: 26 },
  { key: "out", label: "Clock Out", w: 26 },
  { key: "hours", label: "Hours", w: 26, align: "right" },
  { key: "notes", label: "Notes", w: 76 },
];

export default function TimeExportDialog({ open, onOpenChange, employees, periodEntries, allEntries, periodLabel }) {
  const [mode, setMode] = useState("all");
  const [empId, setEmpId] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(undefined);
  const [anchorKey, setAnchorKey] = useState("");

  // Pay period settings are only needed for the full-history export
  useEffect(() => {
    if (!open || mode !== "history" || settings !== undefined) return;
    base44.entities.PayPeriodSettings.list()
      .then((list) => setSettings(list[0] || null))
      .catch(() => setSettings(null));
  }, [open, mode, settings]);

  const empById = useMemo(() => {
    const m = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

  // Every configured pay period, generated back-to-back from the start date
  const payPeriods = useMemo(() => {
    if (!settings?.start_date) return [];
    const periodDays = settings.period_days || 14;
    const start = new Date(settings.start_date + "T12:00:00");
    if (isNaN(start)) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = [];
    let s = new Date(start);
    let guard = 0;
    while (s <= today && guard < 2000) {
      guard++;
      const end = new Date(s);
      end.setDate(end.getDate() + periodDays - 1);
      list.push({ key: dateKey(s), start: new Date(s), end, days: periodDays });
      s = new Date(s);
      s.setDate(s.getDate() + periodDays);
    }
    return list;
  }, [settings]);

  const anchorIdx = useMemo(() => {
    if (payPeriods.length === 0) return -1;
    const i = payPeriods.findIndex((p) => p.key === anchorKey);
    return i >= 0 ? i : payPeriods.length - 1;
  }, [payPeriods, anchorKey]);
  const anchor = anchorIdx >= 0 ? payPeriods[anchorIdx] : null;

  const selectedEmp = empId ? empById[empId] : null;
  const needsEmployee = mode !== "all";
  const canExport = mode === "all" ? periodEntries.length > 0 : !!selectedEmp;

  // ---- All employees, selected period -------------------------------------
  function buildAll() {
    const groups = {};
    periodEntries.forEach((e) => {
      if (!e.clock_in) return;
      const emp = e.employee_id ? empById[e.employee_id] : null;
      const key = e.employee_id || e.employee_number || e.employee_name || "unknown";
      if (!groups[key]) {
        const fullName = emp?.name || e.employee_name || "Unknown";
        const lastName = emp?.last_name || fullName.trim().split(/\s+/).slice(1).join(" ") || fullName;
        groups[key] = {
          name: fullName,
          last: lastName,
          number: emp?.employee_number || e.employee_number || "",
          entries: 0,
          hours: 0,
        };
      }
      groups[key].entries += 1;
      groups[key].hours += entryHours(e) || 0;
    });

    // Alphabetical by last name, then first name
    const list = Object.values(groups)
      .filter((g) => g.hours > 0)
      .sort((a, b) => a.last.localeCompare(b.last) || a.name.localeCompare(b.name));

    const totalHours = list.reduce((s, g) => s + g.hours, 0);
    const totalEntries = list.reduce((s, g) => s + g.entries, 0);

    return {
      title: "Time Tracking — All Employees",
      subtitle: `${periodLabel} · ${list.length} employee${list.length === 1 ? "" : "s"} with hours`,
      columns: [
        { key: "name", label: "Employee", w: 96 },
        { key: "number", label: "Emp #", w: 24 },
        { key: "entries", label: "Entries", w: 30, align: "right" },
        { key: "hours", label: "Hours", w: 36, align: "right" },
      ],
      rows: list.map((g) => ({
        name: g.name,
        number: g.number,
        entries: g.entries,
        hours: fmtHours(g.hours),
      })),
      totalsRow: {
        name: "Total",
        number: "",
        entries: totalEntries,
        hours: fmtHours(totalHours),
      },
      filename: "Time-Tracking-All-Employees.pdf",
    };
  }

  // ---- One employee, selected period --------------------------------------
  function buildEmployee() {
    const emp = selectedEmp;
    const list = periodEntries
      .filter((e) => e.clock_in && matches(e, emp))
      .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));

    const totalHours = list.reduce((s, e) => s + (entryHours(e) || 0), 0);

    return {
      title: `Time Tracking — ${emp.name}`,
      subtitle: `${emp.employee_number ? `#${emp.employee_number} · ` : ""}${periodLabel} · ${list.length} entr${list.length === 1 ? "y" : "ies"}`,
      columns: ENTRY_COLUMNS,
      rows: list.map(entryRow),
      totalsRow: { date: "Total", in: "", out: "", hours: fmtHours(totalHours), notes: "" },
      filename: `Time-Tracking-${safeName(emp.name)}.pdf`,
    };
  }

  // ---- One employee, every clock-in, totalled per pay period --------------
  function buildHistory() {
    const emp = selectedEmp;
    const anchorEnd = anchor
      ? new Date(anchor.end.getFullYear(), anchor.end.getMonth(), anchor.end.getDate(), 23, 59, 59)
      : null;

    const list = allEntries
      .filter((e) => e.clock_in && matches(e, emp) && (!anchorEnd || parseISO(e.clock_in) <= anchorEnd))
      .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));

    const totalHours = list.reduce((s, e) => s + (entryHours(e) || 0), 0);

    // Pay periods chained back-to-back from the selected one, down to the
    // employee's first entry.
    let breakdown = null;
    if (anchor && list.length > 0) {
      const periodDays = anchor.days || 14;
      const earliest = parseISO(list[0].clock_in);
      const chain = [];
      let end = anchorEnd;
      let guard = 0;
      while (end >= earliest && guard < 500) {
        guard++;
        const start = new Date(end);
        start.setDate(start.getDate() - periodDays + 1);
        start.setHours(0, 0, 0, 0);
        chain.push({ start, end });
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevEnd.setHours(23, 59, 59, 0);
        end = prevEnd;
      }

      const periodRows = chain.reverse().map((p) => {
        const hrs = list.reduce((s, e) => {
          const d = parseISO(e.clock_in);
          return d >= p.start && d <= p.end ? s + (entryHours(e) || 0) : s;
        }, 0);
        return { period: periodRangeLabel(p), hours: fmtHours(hrs) };
      });

      breakdown = {
        title: "Pay Period Totals",
        columns: [
          { key: "period", label: "Pay Period", w: 110 },
          { key: "hours", label: "Hours", w: 76, align: "right" },
        ],
        rows: periodRows,
        totalsRow: { period: "Total", hours: fmtHours(totalHours) },
      };
    }

    return {
      title: `Time Tracking — ${emp.name}`,
      subtitle: `${emp.employee_number ? `#${emp.employee_number} · ` : ""}${anchor ? `Through ${format(anchor.end, "MMM d, yyyy")}` : "All time"} · ${list.length} entr${list.length === 1 ? "y" : "ies"}`,
      columns: ENTRY_COLUMNS,
      rows: list.map(entryRow),
      totalsRow: breakdown ? null : { date: "Total", in: "", out: "", hours: fmtHours(totalHours), notes: "" },
      breakdown,
      filename: `Time-Tracking-${safeName(emp.name)}-Full-History.pdf`,
    };
  }

  async function handleExport() {
    if (!canExport) return;
    setBusy(true);
    try {
      const payload = mode === "all" ? buildAll() : mode === "history" ? buildHistory() : buildEmployee();
      await exportTimeTrackingPdf(payload);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Export Hours PDF</DialogTitle>
          <DialogDescription>
            {periodLabel}. Choose what to include, then download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                mode === m.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              }`}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.hint}</p>
            </button>
          ))}
        </div>

        {needsEmployee && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Employee</p>
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an employee..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "history" && payPeriods.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Pay period (previous periods run back-to-back from here)
            </p>
            <Select value={anchor?.key || ""} onValueChange={setAnchorKey}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a pay period..." />
              </SelectTrigger>
              <SelectContent>
                {[...payPeriods].reverse().map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {periodRangeLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleExport} disabled={!canExport || busy} className="gap-2 w-full">
          <Download className="w-4 h-4" /> {busy ? "Building PDF..." : "Download PDF"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}