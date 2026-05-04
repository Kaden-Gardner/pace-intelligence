import { getBestPosition } from "@/lib/analyticsHelpers";
import { CalendarClock, Sparkles, FlaskConical, Users } from "lucide-react";

const POSITIONS = ["Filling", "Pulling", "Sorting", "Bagging", "Boxing", "Shift Lead", "Training"];

const POSITION_COLORS = {
  Filling:    "bg-blue-100 text-blue-800",
  Pulling:    "bg-orange-100 text-orange-800",
  Sorting:    "bg-purple-100 text-purple-800",
  Bagging:    "bg-pink-100 text-pink-800",
  Boxing:     "bg-yellow-100 text-yellow-800",
  "Shift Lead": "bg-red-100 text-red-800",
  Training:   "bg-gray-100 text-gray-700",
};

export default function UpcomingShiftTab({ scheduledShifts, employees, flavorSets, shifts }) {
  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });

  const todayStr = new Date().toISOString().split("T")[0];

  // Find the closest upcoming production shift
  const upcoming = [...scheduledShifts]
    .filter((s) => s.shift_date >= todayStr)
    .sort((a, b) => {
      if (a.shift_date !== b.shift_date) return a.shift_date.localeCompare(b.shift_date);
      return (a.shift_time || "").localeCompare(b.shift_time || "");
    });

  const nextShift = upcoming[0] || null;

  if (!nextShift) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <CalendarClock className="w-10 h-10 opacity-30" />
        <p>No upcoming production shifts scheduled.</p>
      </div>
    );
  }

  const fs = fsMap[nextShift.flavorset_id];
  const assignedEmps = (nextShift.assigned_employees || []).map((id) => empMap[id]).filter(Boolean);
  const onCallEmps = (nextShift.on_call_employees || []).map((id) => empMap[id]).filter(Boolean);
  const mixerEmp = nextShift.mixer_employee ? empMap[nextShift.mixer_employee] : null;

  // For each assigned employee, compute best position from historical data
  const empSuggestions = assignedEmps.map((emp) => {
    const best = getBestPosition(shifts, emp.id);
    return { emp, best };
  });

  // Group by suggested position to show coverage at a glance
  const positionCoverage = {};
  POSITIONS.forEach((p) => { positionCoverage[p] = []; });
  empSuggestions.forEach(({ emp, best }) => {
    if (best && positionCoverage[best] !== undefined) {
      positionCoverage[best].push(emp);
    }
  });

  const dateLabel = new Date(nextShift.shift_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  function getMixerTime(shiftTime) {
    if (!shiftTime) return "";
    const [h, m] = shiftTime.split(":").map(Number);
    const total = h * 60 + m - 90;
    const hh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const mm = ((total % 60) + 60) % 60;
    const period = hh >= 12 ? "PM" : "AM";
    const display = hh % 12 === 0 ? 12 : hh % 12;
    return `${display}:${String(mm).padStart(2, "0")} ${period}`;
  }

  function fmt12(time) {
    if (!time) return "";
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:${String(m).padStart(2, "0")} ${period}`;
  }

  return (
    <div className="mt-6 space-y-5">
      {/* Shift header */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-xl">{dateLabel}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground font-medium">{fmt12(nextShift.shift_time)}</span>
              {fs && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {fs.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                  {fs.name}
                </span>
              )}
              {nextShift.special_order && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                  Special: {nextShift.special_order_name || "Order"}
                </span>
              )}
            </div>
            {nextShift.notes && <p className="text-sm text-muted-foreground mt-1">{nextShift.notes}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-heading font-bold text-primary">{assignedEmps.length}</p>
            <p className="text-xs text-muted-foreground">workers</p>
          </div>
        </div>

        {mixerEmp && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <span className="font-semibold">{mixerEmp.name}</span> mixing — arrives at <span className="font-semibold">{getMixerTime(nextShift.shift_time)}</span>
            </p>
          </div>
        )}
      </div>

      {/* AI Position Suggestions */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold">Suggested Positions</h3>
          <span className="text-xs text-muted-foreground ml-1">based on each employee's best historical performance</span>
        </div>

        {assignedEmps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees assigned to this shift yet.</p>
        ) : (
          <div className="space-y-3">
            {empSuggestions.map(({ emp, best }) => (
              <div key={emp.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <span className="font-medium text-sm">{emp.name}</span>
                {best ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${POSITION_COLORS[best] || "bg-muted text-muted-foreground"}`}>
                    {best}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">No data</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Position Coverage Summary */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-heading font-semibold">Position Coverage</h3>
          <span className="text-xs text-muted-foreground ml-1">who excels where</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POSITIONS.filter((p) => p !== "Training").map((pos) => {
            const empsForPos = positionCoverage[pos] || [];
            return (
              <div key={pos} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${POSITION_COLORS[pos] || "bg-muted text-muted-foreground"}`}>
                  {pos}
                </span>
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {empsForPos.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No best-fit match</span>
                  ) : (
                    empsForPos.map((emp) => (
                      <span key={emp.id} className="text-xs font-medium">{emp.name}</span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* On Call */}
      {onCallEmps.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">On Call</p>
          <div className="flex flex-wrap gap-2">
            {onCallEmps.map((emp) => (
              <span key={emp.id} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg">{emp.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}