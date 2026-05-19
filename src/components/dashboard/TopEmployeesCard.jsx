import { useState } from "react";
import { TrendingUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRateUnit, formatRate } from "@/hooks/useRateUnit";

export default function TopEmployeesCard({ empStats }) {
  const [selectedId, setSelectedId] = useState(null);
  const [isPpm, setIsPpm] = useRateUnit();
  const top5 = empStats.slice(0, 5);

  const selectedStat = selectedId ? empStats.find((s) => s.employee.id === selectedId) : null;
  const selectedCph = selectedStat && selectedStat.totalHours > 0 ? selectedStat.totalCases / selectedStat.totalHours : 0;
  const selectedPositions = selectedStat
    ? Object.entries(selectedStat.positionStats)
        .map(([pos, data]) => ({ pos, cph: data.totalHours > 0 ? data.totalCases / data.totalHours : 0, shifts: data.totalShifts || 0 }))
        .sort((a, b) => b.cph - a.cph)
    : [];

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Top Employees</h3>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">By average {isPpm ? "pops/min" : "cases/hr"}</p>
        <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
          <span>Cases/hr</span>
          <Switch checked={isPpm} onCheckedChange={setIsPpm} className="scale-75" />
          <span>Pops/min</span>
        </div>
      </div>

      {top5.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-3">
          {top5.map((stat, i) => {
            const cph = stat.totalHours > 0 ? (stat.totalCases / stat.totalHours) : 0;
            const bestPos = Object.entries(stat.positionStats)
              .map(([pos, data]) => ({ pos, cph: data.totalHours > 0 ? data.totalCases / data.totalHours : 0 }))
              .sort((a, b) => b.cph - a.cph)[0];

            return (
              <div key={stat.employee.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{stat.employee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Best: {bestPos?.pos || "N/A"} · {stat.totalShifts} shifts
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-sm font-heading font-bold">{formatRate(cph, isPpm).value}</p>
                   <p className="text-xs text-muted-foreground">{formatRate(cph, isPpm).label}</p>
                 </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All-employee lookup dropdown */}
      {empStats.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Look up any employee</p>
          <Select value={selectedId || ""} onValueChange={(v) => setSelectedId(v || null)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an employee..." />
            </SelectTrigger>
            <SelectContent>
              {empStats.map((s) => {
                const cph = s.totalHours > 0 ? s.totalCases / s.totalHours : 0;
                return (
                  <SelectItem key={s.employee.id} value={s.employee.id}>
                    {s.employee.name} — {formatRate(cph, isPpm).value} {formatRate(cph, isPpm).label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {selectedStat && (
            <div className="mt-3 bg-muted rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-sm">{selectedStat.employee.name}</p>
                <div className="text-right">
                  <p className="font-heading font-bold text-lg text-primary">{formatRate(selectedCph, isPpm).value}</p>
                  <p className="text-xs text-muted-foreground">{formatRate(selectedCph, isPpm).label} overall</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-card rounded-lg p-2 text-center">
                  <p className="font-heading font-bold text-base">{selectedStat.totalShifts}</p>
                  <p className="text-xs text-muted-foreground">shifts</p>
                </div>
                <div className="bg-card rounded-lg p-2 text-center">
                  <p className="font-heading font-bold text-base">{selectedStat.totalCases}</p>
                  <p className="text-xs text-muted-foreground">total cases</p>
                </div>
              </div>
              {selectedPositions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">By position</p>
                  <div className="space-y-1">
                    {selectedPositions.map(({ pos, cph, shifts }) => (
                      <div key={pos} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{pos}</span>
                        <span className="font-medium">{formatRate(cph, isPpm).value} {formatRate(cph, isPpm).label} · {shifts} shift{shifts !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}