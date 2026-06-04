import { useState, useRef } from "react";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TOTAL_MINS = 24 * 60;
const MAX_MARKERS = 5;

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

function markerCrossesAvail(markerMins, fromMins, untilMins, isAvailable, hasRange) {
  if (!isAvailable) return false;
  if (!hasRange) return true; // all day
  if (fromMins !== null && untilMins !== null) return markerMins >= fromMins && markerMins <= untilMins;
  if (fromMins !== null) return markerMins >= fromMins;
  return false;
}

export default function AvailabilityPlannerTab({ employees, availabilities }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [markers, setMarkers] = useState([]); // array of "HH:MM" strings
  const [newMarker, setNewMarker] = useState("08:00");
  const scrollRef = useRef(null);

  const ds = format(currentDate, "yyyy-MM-dd");
  const dayLabel = format(currentDate, "EEEE, MMMM d, yyyy");

  const activeEmployees = employees.filter((e) => e.active !== false && !e.terminated);

  function getAvail(emp) {
    return availabilities.find(
      (a) =>
        a.date === ds &&
        ((a.employee_id && a.employee_id === emp.id) ||
          (a.employee_number && a.employee_number === emp.employee_number))
    );
  }

  function addMarker() {
    if (!newMarker || markers.includes(newMarker) || markers.length >= MAX_MARKERS) return;
    setMarkers((prev) => [...prev, newMarker].sort());
  }

  function removeMarker(t) {
    setMarkers((prev) => prev.filter((m) => m !== t));
  }

  const markerMinsArr = markers.map((m) => timeStrToMins(m));

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

      {/* Marker controls */}
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Time Markers ({markers.length}/{MAX_MARKERS}):</span>
        {markers.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full font-medium">
            {m}
            <button onClick={() => removeMarker(m)} className="hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {markers.length < MAX_MARKERS && (
          <div className="flex items-center gap-1.5">
            <input
              type="time"
              value={newMarker}
              onChange={(e) => setNewMarker(e.target.value)}
              className="text-xs h-7 px-2 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={addMarker}>
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto" ref={scrollRef}>
        <div className="min-w-[640px]">
          {/* Time header row */}
          <div className="flex border-b border-border">
            <div className="w-32 flex-shrink-0 border-r border-border" />
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
              {/* Marker lines in header */}
              {markerMinsArr.map((mm, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full w-px border-l-2 border-dashed border-purple-500 z-10"
                  style={{ left: `${pct(mm)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Employee rows */}
          {activeEmployees.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No active employees found.</div>
          ) : (
            [...activeEmployees].sort((a, b) => {
              const aAvail = availabilities.find(
                (av) => av.date === ds && ((av.employee_id && av.employee_id === a.id) || (av.employee_number && av.employee_number === a.employee_number))
              );
              const bAvail = availabilities.find(
                (av) => av.date === ds && ((av.employee_id && av.employee_id === b.id) || (av.employee_number && av.employee_number === b.employee_number))
              );
              const aUp = aAvail?.is_available === true ? 0 : 1;
              const bUp = bAvail?.is_available === true ? 0 : 1;
              return aUp - bUp;
            }).map((emp) => {
              const avail = getAvail(emp);
              const isAvailable = avail?.is_available === true;
              const fromMins = timeStrToMins(avail?.available_from);
              const untilMins = timeStrToMins(avail?.available_until);

              let barLeft = 0;
              let barWidth = 100;
              let hasRange = false;

              if (isAvailable && fromMins !== null && untilMins !== null && untilMins > fromMins) {
                barLeft = pct(fromMins);
                barWidth = pct(untilMins - fromMins);
                hasRange = true;
              } else if (isAvailable && fromMins !== null && untilMins === null) {
                barLeft = pct(fromMins);
                barWidth = pct(TOTAL_MINS - fromMins);
                hasRange = true;
              }

              const isHighlighted = markerMinsArr.length > 0 && markerMinsArr.some((mm) =>
                markerCrossesAvail(mm, fromMins, untilMins, isAvailable, hasRange)
              );

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

                    {/* Marker dotted lines */}
                    {markerMinsArr.map((mm, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full w-px border-l-2 border-dashed border-purple-500 z-10"
                        style={{ left: `${pct(mm)}%` }}
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
                      <div className={`absolute inset-y-1 left-0 right-0 bg-green-100 dark:bg-green-900/30 rounded flex items-center px-2 ${isHighlighted ? "ring-2 ring-purple-500" : ""}`}>
                        <span className="text-[10px] text-green-700 dark:text-green-400 font-medium">All day</span>
                      </div>
                    )}
                    {isAvailable && hasRange && (
                      <>
                        {barLeft > 0 && (
                          <div
                            className="absolute inset-y-1 bg-muted/50 rounded-l"
                            style={{ left: 0, width: `${barLeft}%` }}
                          />
                        )}
                        <div
                          className={`absolute inset-y-1 bg-green-400 dark:bg-green-500 rounded flex items-center px-2 overflow-hidden ${isHighlighted ? "ring-2 ring-purple-500" : ""}`}
                          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                        >
                          <span className="text-[10px] text-white font-medium whitespace-nowrap">
                            {avail.available_from}
                            {avail.available_until ? ` – ${avail.available_until}` : "+"}
                          </span>
                        </div>
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