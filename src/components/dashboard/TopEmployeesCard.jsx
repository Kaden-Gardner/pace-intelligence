import { TrendingUp } from "lucide-react";

export default function TopEmployeesCard({ empStats }) {
  const top5 = empStats.slice(0, 5);

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
        <div className="space-y-3">
          {top5.map((stat, i) => {
            const cph = stat.totalHours > 0 ? (stat.totalCases / stat.totalHours) : 0;
            const bestPos = Object.entries(stat.positionStats)
              .map(([pos, data]) => ({
                pos,
                cph: data.totalHours > 0 ? data.totalCases / data.totalHours : 0,
              }))
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
                  <p className="text-sm font-heading font-bold">{cph.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">cases/hr</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}