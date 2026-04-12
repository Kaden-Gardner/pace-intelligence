import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Calendar, Plus, Pencil, Trash2, Clock, Package, FlaskConical, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "../components/EmptyState";
import { getTotalCases, getCasesPerHour } from "../lib/analyticsHelpers";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [baseMixShifts, setBaseMixShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewMenu, setShowNewMenu] = useState(false);

  useEffect(() => {
    async function load() {
      const [s, bms, e, fs] = await Promise.all([
        base44.entities.Shift.list("-shift_date", 200),
        base44.entities.BaseMixingShift.list("-shift_date", 200),
        base44.entities.Employee.list(),
        base44.entities.FlavorSet.list(),
      ]);
      setShifts(s);
      setBaseMixShifts(bms);
      setEmployees(e);
      setFlavorSets(fs);
      setLoading(false);
    }
    load();
  }, []);

  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e.name; });
  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs.name; });

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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold">Shifts</h1>
          <p className="text-muted-foreground mt-1">Manage and review shift data</p>
        </div>
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
                  return (
                    <div key={shift.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-heading font-semibold">
                              {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {shift.shift_time} · {shift.shift_duration}h
                              {shift.flavorset_id && fsMap[shift.flavorset_id] ? ` · ${fsMap[shift.flavorset_id]}` : ""}
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
                {baseMixShifts.map((shift) => (
                  <div key={shift.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                          <FlaskConical className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="font-heading font-semibold">
                            {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {shift.shift_time} · {shift.shift_duration}h
                            {shift.flavorset_id && fsMap[shift.flavorset_id] ? ` · ${fsMap[shift.flavorset_id]}` : ""}
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}