import { useMemo } from "react";
import {
  getEmployeePosition,
  getPositionProduction,
  getTotalCases,
  POSITION_PRODUCTION,
} from "@/lib/analyticsHelpers";
import { positionColor, positionLabel } from "@/lib/positions";
import { Crown } from "lucide-react";

const PALLET_CASES = 66; // cases per completed pallet (matches inventory pallet math)

// Each award — five production MVPs plus MVL for shift leads (pallets completed).
const MVP_AWARDS = [
  { key: "pulling", abbr: "MVP", title: "Most Valuable Puller", kind: "production" },
  { key: "boxing", abbr: "MVC", title: "Most Valuable Boxer", kind: "production" },
  { key: "filling", abbr: "MVF", title: "Most Valuable Filler", kind: "production" },
  { key: "sorting", abbr: "MVS", title: "Most Valuable Sorter", kind: "production" },
  { key: "bagging", abbr: "MVB", title: "Most Valuable Bagger", kind: "production" },
  { key: "shift_lead", abbr: "MVL", title: "Most Valuable Leader", kind: "leader", label: "Shift Lead", unit: "pallets", color: "bg-emerald-100 text-emerald-800" },
];

export default function PositionMVPsCard({ shifts, employees, packConstants }) {
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);

  const mvps = useMemo(() => {
    const totals = {}; // award key -> { empId -> total }
    shifts.forEach((shift) => {
      // Production positions
      employees.forEach((emp) => {
        const positions = getEmployeePosition(shift, emp.id);
        if (positions.length === 0) return;
        positions.forEach((pos) => {
          const key = pos.toLowerCase();
          if (!POSITION_PRODUCTION[key]) return;
          const prod = getPositionProduction(shift, pos, packConstants);
          if (prod == null) return;
          if (!totals[key]) totals[key] = {};
          totals[key][emp.id] = (totals[key][emp.id] || 0) + prod;
        });
      });
      // Shift lead — pallets completed
      const lead = shift.shift_lead;
      if (lead) {
        const pallets = Math.floor(getTotalCases(shift) / PALLET_CASES);
        if (pallets > 0) {
          if (!totals.shift_lead) totals.shift_lead = {};
          totals.shift_lead[lead] = (totals.shift_lead[lead] || 0) + pallets;
        }
      }
    });

    const result = {};
    MVP_AWARDS.forEach((p) => {
      const posTotals = totals[p.key] || {};
      let topId = null;
      let topVal = 0;
      Object.entries(posTotals).forEach(([id, val]) => {
        if (val > topVal) { topVal = val; topId = id; }
      });
      result[p.key] = { empId: topId, total: topVal };
    });
    return result;
  }, [shifts, employees, packConstants]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Crown className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-semibold text-lg">Position MVPs</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">All time · highest lifetime production per job</p>
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MVP_AWARDS.map((p) => {
            const mvp = mvps[p.key];
            const emp = mvp?.empId ? empMap[mvp.empId] : null;
            const unit = p.kind === "leader" ? p.unit : POSITION_PRODUCTION[p.key].unit;
            const label = p.kind === "leader" ? p.label : positionLabel(p.key);
            const color = p.kind === "leader" ? p.color : positionColor(p.key);
            return (
              <div key={p.key} className="bg-muted/40 rounded-xl p-4 text-center">
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>
                  {p.abbr}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
                <p className="font-heading font-bold text-sm mt-2 truncate" title={p.title}>
                  {emp?.name || "—"}
                </p>
                <p className="text-xs text-primary font-medium mt-0.5">
                  {mvp && mvp.total > 0 ? `${Math.round(mvp.total).toLocaleString()} ${unit}` : "No data"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}