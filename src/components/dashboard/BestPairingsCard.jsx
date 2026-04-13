import { Users } from "lucide-react";
import { findBestPairings } from "../../lib/analyticsHelpers";

export default function BestPairingsCard({ shifts, employees }) {
  const pairings = findBestPairings(shifts, employees);
  const maxCph = pairings.length > 0 ? Math.max(...pairings.map((p) => p.avgCph)) : 1;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Best Pairings</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Employee combos that maximize production</p>
      {pairings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Need more shift data (at least 2 shared shifts per pair)</p>
      ) : (
        <div className="space-y-4">
          {pairings.map((pair, i) => {
            const pct = maxCph > 0 ? (pair.avgCph / maxCph) * 100 : 0;
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {pair.employees.map((emp) => (
                        <div key={emp.id} className="w-6 h-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary">
                          {emp.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm font-medium">{pair.employees.map((e) => e.name).join(" & ")}</p>
                  </div>
                  <span className="text-sm font-heading font-bold text-primary">
                    {pair.avgCph.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">c/hr</span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{pair.count} shifts together</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}