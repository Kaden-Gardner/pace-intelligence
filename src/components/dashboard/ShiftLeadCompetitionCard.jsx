import { Trophy, Clock, Flame } from "lucide-react";
import { getTotalCases } from "@/lib/analyticsHelpers";

// Parses a free-text downtime note into hours (mirrors Financials logic).
// Returns null for empty/missing entries (so they can be excluded), and 0
// only when the text genuinely parses to zero.
function parseDowntimeHours(text) {
  if (text == null) return null;
  const s = String(text).trim();
  if (s === "") return null;
  const hourMatch = s.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) return parseFloat(hourMatch[1]);
  const minMatch = s.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) return parseFloat(minMatch[1]) / 60;
  const plainMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (plainMatch) return parseFloat(plainMatch[1]) / 60;
  return null;
}

function minMaxNorm(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map((v) => (v - min) / (max - min));
}

function computeShiftLeadStats(shifts, employees) {
  const stats = {};

  shifts.forEach((shift) => {
    if (!shift.shift_lead) return;
    const empId = shift.shift_lead;
    if (!stats[empId]) {
      stats[empId] = { totalCases: 0, totalWaste: 0, totalHours: 0, shiftCount: 0, downtimeHours: [], wasteGallons: [], };
    }
    stats[empId].totalCases += getTotalCases(shift);
    stats[empId].totalWaste += shift.waste || 0;
    stats[empId].totalHours += shift.shift_duration || 0;
    stats[empId].shiftCount += 1;
    const dt = parseDowntimeHours(shift.downtime);
    if (dt != null && dt > 0) stats[empId].downtimeHours.push(dt);
    if (shift.waste && shift.waste > 0) stats[empId].wasteGallons.push(shift.waste);
  });

  const allLeaders = Object.entries(stats)
    .map(([empId, s]) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp || emp.terminated || emp.active === false) return null;
      const totalDowntime = s.downtimeHours.reduce((a, b) => a + b, 0);
      const lowestDowntime = s.downtimeHours.length > 0 ? Math.min(...s.downtimeHours) : null;
      const totalWasteQualifying = s.wasteGallons.reduce((a, b) => a + b, 0);
      const lowestWaste = s.wasteGallons.length > 0 ? Math.min(...s.wasteGallons) : null;
      return {
        name: emp.name,
        employee_number: emp.employee_number || "",
        totalCases: s.totalCases,
        totalWaste: s.totalWaste,
        avgCph: s.totalHours > 0 ? s.totalCases / s.totalHours : 0,
        shiftCount: s.shiftCount,
        totalDowntime,
        downtimeShiftCount: s.downtimeHours.length,
        lowestDowntime,
        totalWasteQualifying,
        wasteShiftCount: s.wasteGallons.length,
        lowestWaste,
        avgCasesPerShift: s.shiftCount > 0 ? s.totalCases / s.shiftCount : 0,
        avgWastePerShift: s.shiftCount > 0 ? s.totalWaste / s.shiftCount : 0,
        avgDowntimePerShift: s.shiftCount > 0 ? totalDowntime / s.shiftCount : 0,
      };
    })
    .filter(Boolean);

  // Composite ranking: most cases, least waste, least downtime, highest speed —
  // each normalized to 0-1 across all leaders and averaged (per-shift averages).
  const leaders = allLeaders;
  const normCases = minMaxNorm(leaders.map((l) => l.avgCasesPerShift));
  const normSpeed = minMaxNorm(leaders.map((l) => l.avgCph));
  const normWaste = minMaxNorm(leaders.map((l) => l.avgWastePerShift));
  const normDowntime = minMaxNorm(leaders.map((l) => l.avgDowntimePerShift));

  leaders.forEach((l, i) => {
    const wasteScore = 1 - normWaste[i];      // less waste is better
    const downtimeScore = 1 - normDowntime[i]; // less downtime is better
    l.compositeScore = (normCases[i] + normSpeed[i] + wasteScore + downtimeScore) / 4;
  });

  return leaders.sort((a, b) => b.compositeScore - a.compositeScore);
}

function fmtHours(h) {
  if (h == null) return "—";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ShiftLeadCompetitionCard({ shifts, employees, periodLabel }) {
  const leaders = computeShiftLeadStats(shifts, employees);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Supervisor Friendly Competition</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Stats as Shift Lead · {periodLabel || "all time"}</p>

      {leaders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shift lead data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-2 font-medium">Supervisor</th>
                <th className="text-right pb-2 font-medium">Shifts</th>
                <th className="text-right pb-2 font-medium">Total Cases</th>
                <th className="text-right pb-2 font-medium">Total Waste (gal)</th>
                <th className="text-right pb-2 font-medium">Avg Cases/hr</th>
                <th className="text-right pb-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader, i) => (
                <tr key={leader.name} className="border-b border-border/50 last:border-0">
                  <td className="py-3 flex items-center gap-2">
                    <span className="text-base">{MEDALS[i] || ""}</span>
                    <div>
                      <p className="font-medium">{leader.name}</p>
                      {leader.employee_number && (
                        <p className="text-xs text-muted-foreground">#{leader.employee_number}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-right text-muted-foreground">{leader.shiftCount}</td>
                  <td className="py-3 text-right font-medium">{leader.totalCases.toLocaleString()}</td>
                  <td className="py-3 text-right text-muted-foreground">{leader.totalWaste.toLocaleString()}</td>
                  <td className="py-3 text-right font-heading font-bold text-primary">
                    {leader.avgCph.toFixed(1)}
                  </td>
                  <td className="py-3 text-right font-heading font-bold text-primary">
                    {(leader.compositeScore * 100).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(() => {
        const eligible = leaders.filter((l) => l.downtimeShiftCount > 0);
        if (eligible.length === 0) return null;
        const leastTotal = [...eligible].sort((a, b) => a.totalDowntime - b.totalDowntime)[0];
        const lowestSingle = [...eligible].sort((a, b) => a.lowestDowntime - b.lowestDowntime)[0];
        return (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <h4 className="font-heading font-semibold text-sm">Downtime Leaders</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Excludes shifts with no downtime entry or exactly 0.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Least Total Downtime</p>
                <p className="font-heading font-bold text-primary text-lg">{leastTotal.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtHours(leastTotal.totalDowntime)} across {leastTotal.downtimeShiftCount} shift{leastTotal.downtimeShiftCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Lowest Single-Shift Downtime</p>
                <p className="font-heading font-bold text-primary text-lg">{lowestSingle.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtHours(lowestSingle.lowestDowntime)} in one shift
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {(() => {
        const eligible = leaders.filter((l) => l.wasteShiftCount > 0);
        if (eligible.length === 0) return null;
        const leastTotal = [...eligible].sort((a, b) => a.totalWasteQualifying - b.totalWasteQualifying)[0];
        const lowestSingle = [...eligible].sort((a, b) => a.lowestWaste - b.lowestWaste)[0];
        return (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-primary" />
              <h4 className="font-heading font-semibold text-sm">Waste Leaders</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Excludes shifts with no waste entry or exactly 0.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Least Total Waste</p>
                <p className="font-heading font-bold text-primary text-lg">{leastTotal.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {leastTotal.totalWasteQualifying.toFixed(1)} gal across {leastTotal.wasteShiftCount} shift{leastTotal.wasteShiftCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Lowest Single-Shift Waste</p>
                <p className="font-heading font-bold text-primary text-lg">{lowestSingle.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lowestSingle.lowestWaste.toFixed(1)} gal in one shift
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}