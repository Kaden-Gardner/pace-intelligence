import { useMemo } from "react";
import {
  getEmployeePosition,
  getPositionProduction,
  POSITION_PRODUCTION,
} from "@/lib/analyticsHelpers";
import { positionColor, positionLabel } from "@/lib/positions";
import { Crown } from "lucide-react";

// Each production position's "Most Valuable" award — lifetime production total.
const MVP_AWARDS = [
  { key: "pulling", abbr: "MVP", title: "Most Valuable Puller" },
  { key: "boxing", abbr: "MVC", title: "Most Valuable Boxer" },
  { key: "filling", abbr: "MVF", title: "Most Valuable Filler" },
  { key: "sorting", abbr: "MVS", title: "Most Valuable Sorter" },
  { key: "bagging", abbr: "MVB", title: "Most Valuable Bagger" },
];

export default function PositionMVPsCard({ shifts, employees, packConstants }) {
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);

  const mvps = useMemo(() => {
    const totals = {}; // posKey -> { empId -> total }
    shifts.forEach((shift) => {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {MVP_AWARDS.map((p) => {
            const mvp = mvps[p.key];
            const emp = mvp?.empId ? empMap[mvp.empId] : null;
            const meta = POSITION_PRODUCTION[p.key];
            return (
              <div key={p.key} className="bg-muted/40 rounded-xl p-4 text-center">
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${positionColor(p.key)}`}>
                  {p.abbr}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{positionLabel(p.key)}</p>
                <p className="font-heading font-bold text-sm mt-2 truncate" title={p.title}>
                  {emp?.name || "—"}
                </p>
                <p className="text-xs text-primary font-medium mt-0.5">
                  {mvp && mvp.total > 0 ? `${Math.round(mvp.total).toLocaleString()} ${meta.unit}` : "No data"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}