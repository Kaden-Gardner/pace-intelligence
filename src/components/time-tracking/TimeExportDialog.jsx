import { useState, useMemo } from "react";
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

const MODES = [
  { key: "all", label: "All employees", hint: "Everyone with hours in the selected period" },
  { key: "one", label: "One employee", hint: "One employee's hours for the selected period" },
  { key: "history", label: "Full history", hint: "Every clock-in for one employee, one per line" },
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

  const empById = useMemo(() => {
    const m = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

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
        groups[key] = {
          name: emp?.name || e.employee_name || "Unknown",
          number: emp?.employee_number || e.employee_number || "",
          entries: 0,
          hours: 0,
        };
      }
      groups[key].entries += 1;
      groups[key].hours += entryHours(e) || 0;
    });

    const list = Object.values(groups)
      .filter((g) => g.hours > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

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

  // ---- One employee, selected period or full history ----------------------
  function buildEmployee(source) {
    const emp = selectedEmp;
    const list = source
      .filter((e) => e.clock_in && matches(e, emp))
      .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));

    const totalHours = list.reduce((s, e) => s + (entryHours(e) || 0), 0);

    return {
      title: `Time Tracking — ${emp.name}`,
      subtitle: `${emp.employee_number ? `#${emp.employee_number} · ` : ""}${periodLabel} · ${list.length} entr${list.length === 1 ? "y" : "ies"}`,
      columns: ENTRY_COLUMNS,
      rows: list.map((e) => ({
        date: format(parseISO(e.clock_in), "EEE, MMM d, yyyy"),
        in: format(parseISO(e.clock_in), "h:mm a"),
        out: e.clock_out ? format(parseISO(e.clock_out), "h:mm a") : "Active",
        hours: entryHours(e) != null ? fmtHours(entryHours(e)) : "—",
        notes: e.notes || "",
      })),
      totalsRow: { date: "Total", in: "", out: "", hours: fmtHours(totalHours), notes: "" },
      filename:
        mode === "history"
          ? `Time-Tracking-${safeName(emp.name)}-Full-History.pdf`
          : `Time-Tracking-${safeName(emp.name)}.pdf`,
    };
  }

  async function handleExport() {
    if (!canExport) return;
    setBusy(true);
    try {
      const payload =
        mode === "all"
          ? buildAll()
          : mode === "history"
            ? buildEmployee(allEntries)
            : buildEmployee(periodEntries);
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

        <Button onClick={handleExport} disabled={!canExport || busy} className="gap-2 w-full">
          <Download className="w-4 h-4" /> {busy ? "Building PDF..." : "Download PDF"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}