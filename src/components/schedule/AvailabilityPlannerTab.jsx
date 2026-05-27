import { useState, useRef } from "react";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 = 12 AM, 23 = 11 PM
const TOTAL_MINS = 24 * 60;

function timeStrToMins(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

function pct(mins) {
  return (mins / TOTAL_MINS) * 100;
}

function hourLabel(h) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export default function AvailabilityPlannerTab({ employees, availabilities }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollRef = useRef(null);

  const ds = format(currentDate, "yyyy-MM-dd");
  const dayLabel = format(currentDate, "EEEE, MMMM d, yyyy");

  // Only active, non-terminated employees
  const activeEmployees = employees.filter((e) => e.active !== false && !e.terminated);

  // Get availability record for this employee on this date
  function getAvail(emp) {
    return availabilities.find(
      (a) =>
        a.date === ds &&
        ((a.employee_id && a.employee_id === emp.id) ||
          (a.employee_number && a.employee_number === emp.employee_number))
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Day navigation bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => subDays(d, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-heading font-semibold text-sm">{dayLabel}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentDate((d) => addDays(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto" ref={scrollRef}>
        <div className="min-w-[640px]">
          {/* Time header row */}
          <div className="flex border-b border-border">
            {/* Name column spacer */}
            <div className="w-32 flex-shrink-0 border-r border-border" />
            {/* Hour ticks */}
            <div className="flex-1 relative h-8">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 h-full flex items-center"
                  style={{ left: `${pct(h * 60)}%` }}
                >
                  <span className="text-[10px] text-muted-foreground pl-1 leading-none whitespace-nowrap select-none">
                    {hourLabel(h)}
                  </span>
                  <div className="absolute left-0 top-0 h-full w-px bg-border" />
                </div>
              ))}
            </div>
          </div>

          {/* Employee rows */}
          {activeEmployees.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No active employees found.</div>
          ) : (
            activeEmployees.map((emp) => {
              const avail = getAvail(emp);
              const isAvailable = avail?.is_available === true;
              const fromMins = timeStrToMins(avail?.available_from);
              const untilMins = timeStrToMins(avail?.available_until);

              // Determine bar rendering
              let barLeft = 0;
              let barWidth = 100;
              let hasRange = false;

              if (isAvailable && fromMins !== null && untilMins !== null && untilMins > fromMins) {
                barLeft = pct(fromMins);
                barWidth = pct(untilMins - fromMins);
                hasRange = true;
              } else if (isAvailable && fromMins !== null && untilMins === null) {
                // Available from X onward
                barLeft = pct(fromMins);
                barWidth = pct(TOTAL_MINS - fromMins);
                hasRange = true;
              }

              return (
                <div key={emp.id} className="flex border-b border-border last:border-b-0 group hover:bg-muted/20 transition-colors">
                  {/* Name */}
                  <div className="w-32 flex-shrink-0 border-r border-border flex items-center px-3 py-2">
                    <span className="text-xs font-medium truncate">{emp.name}</span>
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative h-10 my-1">
                    {/* Hour grid lines */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute top-0 h-full w-px bg-border/40"
                        style={{ left: `${pct(h * 60)}%` }}
                      />
                    ))}

                    {/* Availability bar */}
                    {!avail && (
                      <div className="absolute inset-y-1 left-0 right-0 flex items-center px-2">
                        <span className="text-[10px] text-muted-foreground/50 italic">No availability set</span>
                      </div>
                    )}
                    {avail && !isAvailable && (
                      <div className="absolute inset-y-1 left-0 right-0 bg-red-100 dark:bg-red-900/20 rounded flex items-center px-2">
                        <span className="text-[10px] text-red-500 font-medium">Unavailable</span>
                      </div>
                    )}
                    {isAvailable && !hasRange && (
                      <div className="absolute inset-y-1 left-0 right-0 bg-green-100 dark:bg-green-900/30 rounded flex items-center px-2">
                        <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">All day</span>
                      </div>
                    )}
                    {isAvailable && hasRange && (
                      <>
                        {/* Unavailable zones (dimmed) */}
                        <div
                          className="absolute inset-y-1 bg-muted/50 rounded-l"
                          style={{ left: 0, width: `${barLeft}%` }}
                        />
                        {/* Available bar */}
                        <div
                          className="absolute inset-y-1 bg-green-400 dark:bg-green-500 rounded flex items-center px-2 overflow-hidden"
                          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        >
                          <span className="text-[10px] text-white font-medium whitespace-nowrap">
                            {avail.available_from}
                            {avail.available_until ? ` – ${avail.available_until}` : "+"}
                          </span>
                        </div>
                        {/* Trailing unavailable */}
                        {untilMins !== null && (
                          <div
                            className="absolute inset-y-1 bg-muted/50 rounded-r"
                            style={{ left: `${barLeft + barWidth}%`, right: 0 }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}