import { Trophy } from "lucide-react";
import { getTotalCases } from "@/lib/analyticsHelpers";

function computeShiftLeadStats(shifts, employees) {
  const stats = {};

  shifts.forEach((shift) => {
    if (!shift.shift_lead) return;
    const empId = shift.shift_lead;
    if (!stats[empId]) {
      stats[empId] = { totalCases: 0, totalWaste: 0, totalHours: 0, shiftCount: 0 };
    }
    stats[empId].totalCases += getTotalCases(shift);
    stats[empId].totalWaste += shift.waste || 0;
    stats[empId].totalHours += shift.shift_duration || 0;
    stats[empId].shiftCount += 1;
  });

  return Object.entries(stats)
    .map(([empId, s]) => {
      const emp = employees.find((e) => e.id === empId);
      if (!emp || emp.terminated || emp.active === false) return null;
      return {
        name: emp.name,
        employee_number: emp.employee_number || "",
        totalCases: s.totalCases,
        totalWaste: s.totalWaste,
        avgCph: s.totalHours > 0 ? s.totalCases / s.totalHours : 0,
        shiftCount: s.shiftCount,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.avgCph - a.avgCph);
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ShiftLeadCompetitionCard({ shifts, employees }) {
  const leaders = computeShiftLeadStats(shifts, employees);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Supervisor Friendly Competition</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Stats as Shift Lead · all time</p>

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}