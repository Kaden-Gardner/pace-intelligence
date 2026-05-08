import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getTotalCases, getCasesPerHour } from "@/lib/analyticsHelpers";

function Diff({ a, b, higher = "good", fmt = (v) => v }) {
  if (a == null || b == null) return null;
  const diff = b - a;
  if (Math.abs(diff) < 0.01) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="w-3 h-3" /> tie</span>;
  const isGood = higher === "good" ? diff > 0 : diff < 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 font-medium ${isGood ? "text-green-600" : "text-destructive"}`}>
      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {diff > 0 ? "+" : ""}{fmt(diff)}
    </span>
  );
}

function Row({ label, valA, valB, diff }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-border last:border-0">
      <div className="text-right">
        <p className="font-heading font-bold text-base">{valA}</p>
      </div>
      <div className="text-center px-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {diff}
      </div>
      <div className="text-left">
        <p className="font-heading font-bold text-base">{valB}</p>
      </div>
    </div>
  );
}

export default function ShiftComparePanel({ shiftA, shiftB, fsMap, empMap, onClose }) {
  if (!shiftA || !shiftB) return null;

  const casesA = getTotalCases(shiftA);
  const casesB = getTotalCases(shiftB);
  const cphA = getCasesPerHour(shiftA);
  const cphB = getCasesPerHour(shiftB);

  function getCrewSize(s) {
    const ids = [s.filling_employee, s.pulling_employee_1, s.pulling_employee_2, s.pulling_employee_3,
      s.sorting_employee, s.bagging_employee, s.boxing_employee, s.shift_lead].filter(Boolean);
    const trainees = (s.training_employees || []).filter(Boolean);
    return [...new Set([...ids, ...trainees])].length;
  }

  function shiftLabel(s) {
    return new Date(s.shift_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="mt-4 bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-lg">Shift Comparison</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Headers */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 mb-2">
        <div className="text-right">
          <p className="font-heading font-semibold text-sm">{shiftLabel(shiftA)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
            {fsMap[shiftA.flavorset_id]?.color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: fsMap[shiftA.flavorset_id].color }} />}
            {fsMap[shiftA.flavorset_id]?.name || "—"}
          </p>
        </div>
        <div className="text-center">
          <span className="text-xs font-bold text-muted-foreground px-2">VS</span>
        </div>
        <div className="text-left">
          <p className="font-heading font-semibold text-sm">{shiftLabel(shiftB)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {fsMap[shiftB.flavorset_id]?.color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: fsMap[shiftB.flavorset_id].color }} />}
            {fsMap[shiftB.flavorset_id]?.name || "—"}
          </p>
        </div>
      </div>

      <div className="bg-muted rounded-2xl p-4">
        <Row
          label="Cases"
          valA={casesA}
          valB={casesB}
          diff={<Diff a={casesA} b={casesB} fmt={(d) => Math.abs(d)} />}
        />
        <Row
          label="Cases/hr"
          valA={cphA.toFixed(1)}
          valB={cphB.toFixed(1)}
          diff={<Diff a={cphA} b={cphB} fmt={(d) => Math.abs(d).toFixed(1)} />}
        />
        <Row
          label="Duration"
          valA={`${shiftA.shift_duration}h`}
          valB={`${shiftB.shift_duration}h`}
          diff={null}
        />
        <Row
          label="Crew"
          valA={getCrewSize(shiftA)}
          valB={getCrewSize(shiftB)}
          diff={null}
        />
        <Row
          label="Waste (gal)"
          valA={shiftA.waste || 0}
          valB={shiftB.waste || 0}
          diff={<Diff a={shiftA.waste || 0} b={shiftB.waste || 0} higher="bad" fmt={(d) => Math.abs(d)} />}
        />
      </div>

      {/* Winner callout */}
      {casesA !== casesB && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${casesA > casesB ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"}`}>
          <TrendingUp className="w-4 h-4" />
          {casesA > casesB ? shiftLabel(shiftA) : shiftLabel(shiftB)} produced {Math.abs(casesA - casesB)} more cases ({Math.abs(cphA - cphB).toFixed(1)} cases/hr difference)
        </div>
      )}
    </div>
  );
}