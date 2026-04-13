import { TrendingUp } from "lucide-react";

export default function TopEmployeesCard({ empStats }) {
  const top5 = empStats.slice(0, 5);
  const maxCph = top5.length > 0
    ? Math.max(...top5.map((s) => s.totalHours > 0 ? s.totalCases / s.totalHours : 0))
    : 1;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Top Employees</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">By average cases per hour</p>
      {top5.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-4">
          {top5.map((stat, i) => {
            const cph = stat.totalHours > 0 ? stat.totalCases / stat.totalHours : 0;
            const pct = maxCph > 0 ? (cph / maxCph) * 100 : 0;
            const bestPos = Object.entries(stat.positionStats)
              .map(([pos, data]) => ({ pos, cph: data.totalHours > 0 ? data.totalCases / data.totalHours : 0 }))
              .sort((a, b) => b.cph - a.cph)[0];

            return (
              <div key={stat.employee.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">{i + 1}</span>
                    <p className="text-sm font-medium">{stat.employee.name}</p>
                  </div>
                  <span className="text-sm font-heading font-bold text-primary">
                    {cph.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">c/hr</span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{bestPos?.pos || "N/A"} · {stat.totalShifts} shifts</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}