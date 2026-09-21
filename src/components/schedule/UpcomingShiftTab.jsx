import { getBestPosition } from "@/lib/analyticsHelpers";
import { positionLabel, positionColor, POSITIONS } from "@/lib/positions";
import { CalendarClock, Sparkles, FlaskConical, Users, Star } from "lucide-react";
import { empFirstName } from "@/lib/employeeName";

export default function UpcomingShiftTab({ scheduledShifts, employees, flavorSets, shifts }) {
  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });

  const todayStr = new Date().toISOString().split("T")[0];

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
  const assignedEmps = (nextShift.assigned_employees || []).map((id) => empMap[id]).filter(Boolean).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const onCallEmps = (nextShift.on_call_employees || []).map((id) => empMap[id]).filter(Boolean).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const mixerEmp = nextShift.mixer_employee ? empMap[nextShift.mixer_employee] : null;

  const posMap = {};
  (nextShift.position_assignments || []).forEach((a) => { posMap[a.employee_id] = a.position; });

  const empAssignments = assignedEmps.map((emp) => ({
    emp,
    assigned: posMap[emp.id] || null,
    best: getBestPosition(shifts, emp.id),
  }));

  const positionGroups = {};
  POSITIONS.forEach((p) => { positionGroups[p.key] = []; });
  const unassigned = [];
  empAssignments.forEach(({ emp, assigned }) => {
    if (assigned && positionGroups[assigned]) {
      positionGroups[assigned].push(emp);
    } else {
      unassigned.push(emp);
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
              <span className="font-semibold">{empFirstName(mixerEmp)}</span> mixing — arrives at <span className="font-semibold">{getMixerTime(nextShift.shift_time)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Assigned Positions */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold">Assigned Positions</h3>
        </div>

        {assignedEmps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees assigned to this shift yet.</p>
        ) : (
          <div className="space-y-3">
            {empAssignments.map(({ emp, assigned, best }) => (
              <div key={emp.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{empFirstName(emp)}</span>
                  {best && best.toLowerCase() !== assigned && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Star className="w-3 h-3" />best: {best}
                    </span>
                  )}
                </div>
                {assigned ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${positionColor(assigned)}`}>
                    {positionLabel(assigned)}
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">Unassigned</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Position Coverage */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-heading font-semibold">Position Coverage</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POSITIONS.map((p) => {
            const empsForPos = positionGroups[p.key] || [];
            return (
              <div key={p.key} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${p.color}`}>
                  {p.label}
                </span>
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {empsForPos.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No one assigned</span>
                  ) : (
                    empsForPos.map((emp) => (
                      <span key={emp.id} className="text-xs font-medium">{empFirstName(emp)}</span>
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
              <span key={emp.id} className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg">{empFirstName(emp)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}