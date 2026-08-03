import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { base44 } from "@/api/base44Client";
import PullToRefresh from "@/components/PullToRefresh";
import { Link } from "react-router-dom";
import { Calendar, Plus, Pencil, Trash2, Clock, Package, FlaskConical, ChevronDown, BarChart2, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "../components/EmptyState";
import { getTotalCases, getCasesPerHour } from "../lib/analyticsHelpers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ShiftStatsPanel from "@/components/shifts/ShiftStatsPanel";
import ShiftComparePanel from "@/components/shifts/ShiftComparePanel";
import ShiftDiagnosticDialog from "@/components/financials/ShiftDiagnosticDialog";

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [baseMixShifts, setBaseMixShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [matDefaults, setMatDefaults] = useState({});
  const [loading, setLoading] = useState(true);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [statsShift, setStatsShift] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [compareMode, setCompareMode] = useState(false);

  const loadData = useCallback(async () => {
    const [s, bms, e, fs, md] = await Promise.all([
      base44.entities.Shift.list("-shift_date", 200),
      base44.entities.BaseMixingShift.list("-shift_date", 200),
      base44.entities.Employee.list(),
      base44.entities.FlavorSet.list(),
      base44.entities.MaterialDefaults.list(),
    ]);
    setShifts(s);
    setBaseMixShifts(bms);
    setEmployees(e);
    setFlavorSets(fs);
    const mdMap = {};
    md.forEach((d) => { mdMap[d.material_key] = d; });
    setMatDefaults(mdMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useAutoRefresh(loadData);

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e.name; });
  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });

  async function handleDelete(id) {
    await base44.entities.Shift.delete(id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleDeleteBaseMix(id) {
    await base44.entities.BaseMixingShift.delete(id);
    setBaseMixShifts((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadData}>
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold">Shifts</h1>
          <p className="text-muted-foreground mt-1">Manage and review shift data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setCompareMode((v) => !v); setCompareA(null); setCompareB(null); setStatsShift(null); }}>
            <GitCompare className="w-4 h-4" /> {compareMode ? "Cancel Compare" : "Compare"}
          </Button>
          <ShiftDiagnosticDialog
            productionShifts={shifts}
            baseMixShifts={baseMixShifts}
          />
          <div className="relative">
          <Button className="gap-2" onClick={() => setShowNewMenu((v) => !v)}>
            <Plus className="w-4 h-4" /> New Shift <ChevronDown className="w-3 h-3" />
          </Button>
          {showNewMenu && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[200px]">
              <Link to="/shifts/new" onClick={() => setShowNewMenu(false)}>
                <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted text-sm cursor-pointer">
                  <Package className="w-4 h-4 text-primary" /> Production Shift
                </div>
              </Link>
              <Link to="/shifts/new-base-mix" onClick={() => setShowNewMenu(false)}>
                <div className="flex items-center gap-2 px-4 py-3 hover:bg-muted text-sm cursor-pointer">
                  <FlaskConical className="w-4 h-4 text-primary" /> Base Mixing Shift
                </div>
              </Link>
            </div>
          )}
          </div>
        </div>
      </div>

      {compareMode && (
        <div className="mb-4 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary font-medium flex items-center gap-2">
          <GitCompare className="w-4 h-4" />
          {!compareA ? "Select the first shift (A) to compare" : !compareB ? "Now select the second shift (B)" : "Both shifts selected — see comparison below"}
        </div>
      )}

      {shifts.length === 0 && baseMixShifts.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No shifts recorded"
          description="Add your first shift to start tracking production data."
          actionLabel="Add First Shift"
          actionTo="/shifts/new"
        />
      ) : (
        <div className="space-y-6">
          {shifts.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-base mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" /> Production Shifts
              </h2>
              <div className="space-y-3">
                {shifts.map((shift) => {
                  const totalCases = getTotalCases(shift);
                  const cph = getCasesPerHour(shift);
                  const dotColor = shift.us_foods ? "#22c55e" : fsMap[shift.flavorset_id]?.color;

                  // ROI dot — same thresholds as Financials page (ratio = revenue/cost)
                  // We use cases/hr as a proxy since we don't have rates here
                  // Use cph tiers: >=18 purple, >=14 green, >=10 yellow, >=6 orange, else red
                  const roiColor = cph >= 18 ? "#a855f7"
                    : cph >= 14 ? "#22c55e"
                    : cph >= 10 ? "#eab308"
                    : cph >= 6  ? "#f97316"
                    : "#ef4444";

                  return (
                    <div key={shift.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md active:bg-muted/50 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center relative">
                            <Calendar className="w-5 h-5 text-primary" />
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-card" style={{ backgroundColor: roiColor }} />
                          </div>
                          <div>
                            <p className="font-heading font-semibold flex items-center gap-2">
                              {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                              {shift.us_foods && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">U.S. Foods</span>}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {shift.shift_time} · {shift.shift_duration}h
                              {shift.flavorset_id && fsMap[shift.flavorset_id] && (
                                <>
                                  {" · "}
                                  {dotColor && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dotColor }} />}
                                  {fsMap[shift.flavorset_id].name}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">{totalCases}</span>
                            <span className="text-muted-foreground">cases</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">{cph.toFixed(1)}</span>
                            <span className="text-muted-foreground">cases/hr</span>
                          </div>
                          {shift.shift_lead && (
                            <div className="text-muted-foreground">Lead: <span className="text-foreground font-medium">{empMap[shift.shift_lead] || "—"}</span></div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {compareMode ? (
                          <Button
                            size="sm"
                            variant={compareA?.id === shift.id || compareB?.id === shift.id ? "default" : "outline"}
                            className="text-xs"
                            onClick={() => {
                              if (compareA?.id === shift.id) { setCompareA(null); return; }
                              if (compareB?.id === shift.id) { setCompareB(null); return; }
                              if (!compareA) { setCompareA(shift); } else if (!compareB) { setCompareB(shift); }
                            }}
                            disabled={compareA && compareB && compareA.id !== shift.id && compareB.id !== shift.id}
                          >
                            {compareA?.id === shift.id ? "A ✓" : compareB?.id === shift.id ? "B ✓" : compareA ? "Pick B" : "Pick A"}
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-9 w-9" title="View Stats" onClick={() => setStatsShift(statsShift?.id === shift.id ? null : shift)}>
                            <BarChart2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Link to={`/shifts/edit?id=${shift.id}`}>
                          <Button variant="ghost" size="icon" className="h-9 w-9"><Pencil className="w-4 h-4" /></Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete Shift</AlertDialogTitle><AlertDialogDescription>This will permanently remove this shift record.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(shift.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {baseMixShifts.length > 0 && (
            <div>
              <h2 className="font-heading font-semibold text-base mb-3 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" /> Base Mixing Shifts
              </h2>
              <div className="space-y-3">
                {baseMixShifts.map((shift) => {
                  const dotColor = fsMap[shift.flavorset_id]?.color;
                  return (
                  <div key={shift.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md active:bg-muted/50 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                          <FlaskConical className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-heading font-semibold">
                            {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {shift.shift_time} · {shift.shift_duration}h
                            {shift.flavorset_id && fsMap[shift.flavorset_id] && (
                              <>
                                {" · "}
                                {dotColor && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dotColor }} />}
                                {fsMap[shift.flavorset_id].name}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{shift.batch_size}</span>
                          <span className="text-muted-foreground">batch{shift.batch_size !== 1 ? "es" : ""} ({(shift.batch_size || 0) * 240} gal)</span>
                        </div>
                        {shift.shift_lead && (
                          <div className="text-muted-foreground">Lead: <span className="text-foreground font-medium">{empMap[shift.shift_lead] || "—"}</span></div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/shifts/edit-base-mix?id=${shift.id}`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9"><Pencil className="w-4 h-4" /></Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Base Mixing Shift</AlertDialogTitle><AlertDialogDescription>This will permanently remove this shift record.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBaseMix(shift.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {statsShift && !compareMode && (
        <ShiftStatsPanel shift={statsShift} fsMap={fsMap} empMap={empMap} matDefaults={matDefaults} onClose={() => setStatsShift(null)} />
      )}

      {compareMode && compareA && compareB && (
        <ShiftComparePanel shiftA={compareA} shiftB={compareB} fsMap={fsMap} empMap={empMap} onClose={() => { setCompareA(null); setCompareB(null); }} />
      )}
    </div>
    </PullToRefresh>
  );
}