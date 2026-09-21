import { Users } from "lucide-react";
import { findBestPairings } from "../../lib/analyticsHelpers";
import { Switch } from "@/components/ui/switch";
import { useRateUnit, formatRate } from "@/hooks/useRateUnit";
import InfoButton from "@/components/bigboy/InfoButton";
import { empFirstName } from "@/lib/employeeName";

export default function BestPairingsCard({ shifts, employees, info }) {
  const [isPpm, setIsPpm] = useRateUnit();
  const pairings = findBestPairings(shifts, employees);

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Best Pairings</h3>
        {info && <InfoButton {...info} />}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">Employee combos that maximize production</p>
        <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
          <span>Cases/hr</span>
          <Switch checked={isPpm} onCheckedChange={setIsPpm} className="scale-75" />
          <span>Pops/min</span>
        </div>
      </div>
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
                      {empFirstName(emp).charAt(0)}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {pair.employees.map((e) => empFirstName(e)).join(" & ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{pair.count} shifts together</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-heading font-bold">{formatRate(pair.avgCph, isPpm).value}</p>
                <p className="text-xs text-muted-foreground">avg {formatRate(pair.avgCph, isPpm).label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}