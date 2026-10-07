import { useState } from "react";
import { TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRateUnit, formatRate } from "@/hooks/useRateUnit";
import InfoButton from "@/components/bigboy/InfoButton";
import { empFirstName } from "@/lib/employeeName";

function ScoreDelta({ current, previous }) {
  if (previous == null || typeof current !== "number") return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.05) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const up = diff > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(diff).toFixed(1)}
    </span>
  );
}

export default function TopEmployeesCard({ empStats, info }) {
  const [selectedId, setSelectedId] = useState(null);
  const [isPpm, setIsPpm] = useRateUnit();
  const top5 = empStats.slice(0, 5);

  const selectedStat = selectedId ? empStats.find((s) => s.employee.id === selectedId) : null;
  const selectedScore = selectedStat?.employee?.current_score;
  const selectedPrev = selectedStat?.employee?.previous_score;
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
        {info && <InfoButton {...info} />}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">By performance score</p>
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
            const sc = stat.employee?.current_score;
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
                    <p className="text-sm font-medium">{empFirstName(stat.employee)}</p>
                    <p className="text-xs text-muted-foreground">
                      Best: {bestPos?.pos || "N/A"} · {stat.totalShifts} shifts
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <ScoreDelta current={sc} previous={stat.employee?.previous_score} />
                  <div>
                    <p className="text-sm font-heading font-bold text-primary">{typeof sc === "number" ? sc.toFixed(1) : "—"}</p>
                    <p className="text-xs text-muted-foreground">score</p>
                  </div>
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
                const sc = s.employee?.current_score;
                return (
                  <SelectItem key={s.employee.id} value={s.employee.id}>
                    {empFirstName(s.employee)}{typeof sc === "number" ? ` — ${sc.toFixed(1)} score` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {selectedStat && (
            <div className="mt-3 bg-muted rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-sm">{empFirstName(selectedStat.employee)}</p>
                <div className="flex items-center gap-2 text-right">
                  <ScoreDelta current={selectedScore} previous={selectedPrev} />
                  <div>
                    <p className="font-heading font-bold text-lg text-primary">{typeof selectedScore === "number" ? selectedScore.toFixed(1) : "—"}</p>
                    <p className="text-xs text-muted-foreground">score overall</p>
                  </div>
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