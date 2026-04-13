import { Users } from "lucide-react";
import { findBestPairings } from "../../lib/analyticsHelpers";

export default function BestPairingsCard({ shifts, employees }) {
  const pairings = findBestPairings(shifts, employees);

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
        <div className="space-y-3">
          {pairings.map((pair, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {pair.employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="w-7 h-7 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary"
                    >
                      {emp.name.charAt(0)}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {pair.employees.map((e) => e.name).join(" & ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{pair.count} shifts together</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-heading font-bold">{pair.avgCph.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">avg cases/hr</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}