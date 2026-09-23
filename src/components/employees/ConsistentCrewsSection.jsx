import { useMemo } from "react";
import { Users, Repeat2 } from "lucide-react";
import { excludeShiftsWithTerminated, getTotalCases, getTraineeId } from "@/lib/analyticsHelpers";
import { empFirstName } from "@/lib/employeeName";

const POSITION_FIELDS = [
  "filling_employee",
  "pulling_employee_1",
  "pulling_employee_2",
  "pulling_employee_3",
  "sorting_employee",
  "bagging_employee",
  "boxing_employee",
  "shift_lead",
];

// Everyone who worked a shift together (all positions + training), sorted for a stable signature.
function getShiftCrew(shift) {
  const ids = new Set();
  POSITION_FIELDS.forEach((f) => { if (shift[f]) ids.add(shift[f]); });
  (shift.training_employees || []).forEach((t) => ids.add(getTraineeId(t)));
  return Array.from(ids).filter(Boolean).sort();
}

export default function ConsistentCrewsSection({ shifts, employees }) {
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);

  // Recurring crews: same exact crew worked 2+ shifts together (terminated-employee shifts excluded).
  const crews = useMemo(() => {
    const eligible = excludeShiftsWithTerminated(shifts, employees);
    const groups = {};
    eligible.forEach((shift) => {
      const ids = getShiftCrew(shift);
      if (ids.length < 2) return; // a crew needs at least 2 members
      const sig = ids.join(",");
      if (!groups[sig]) groups[sig] = { ids, shifts: [] };
      groups[sig].shifts.push(shift);
    });

    return Object.values(groups)
      .filter((g) => g.shifts.length >= 2)
      .map((g) => {
        const totalCases = g.shifts.reduce((sum, s) => sum + getTotalCases(s), 0);
        const dates = g.shifts.map((s) => s.shift_date).filter(Boolean).sort();
        return {
          sig: g.ids.join(","),
          ids: g.ids,
          shiftCount: g.shifts.length,
          totalCases,
          firstDate: dates[0],
          lastDate: dates[dates.length - 1],
        };
      })
      .sort((a, b) => b.shiftCount - a.shiftCount || b.totalCases - a.totalCases);
  }, [shifts, employees]);

  const crewNames = (c) =>
    c.ids
      .map((id) => empFirstName(empMap[id]))
      .filter((n) => n && n !== "?")
      .sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Repeat2 className="w-5 h-5 text-primary" />
        <div>
          <h2 className="font-heading font-semibold text-lg">Consistent Crews</h2>
          <p className="text-xs text-muted-foreground">Teams that have worked the same shift together 2+ times</p>
        </div>
      </div>
      {crews.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((c) => (
            <div key={c.sig} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{c.shiftCount} shifts together</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                  {c.ids.length} members
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {crewNames(c).map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 bg-muted text-foreground rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    <Users className="w-2.5 h-2.5" />
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                <span>{c.totalCases.toLocaleString()} cases</span>
                {c.firstDate && c.lastDate && (
                  <span>{c.firstDate === c.lastDate ? c.firstDate : `${c.firstDate} – ${c.lastDate}`}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No recurring crews yet — the same crew needs to work 2+ shifts together.
          </p>
        </div>
      )}
    </div>
  );
}