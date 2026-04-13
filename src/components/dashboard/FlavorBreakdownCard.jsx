import { IceCreamCone } from "lucide-react";

const COLORS = [
  "hsl(192 75% 42%)",
  "hsl(340 65% 55%)",
  "hsl(160 50% 45%)",
  "hsl(40 85% 55%)",
  "hsl(270 55% 55%)",
  "hsl(20 80% 55%)",
  "hsl(210 60% 50%)",
  "hsl(300 50% 50%)",
];

export default function FlavorBreakdownCard({ flavorCases }) {
  const data = Object.entries(flavorCases).map(([name, cases]) => ({ name, cases }));
  data.sort((a, b) => b.cases - a.cases);
  const total = data.reduce((sum, d) => sum + d.cases, 0);
  const max = data[0]?.cases || 1;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <IceCreamCone className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Flavor Breakdown</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Total individual cases by flavor</p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No individual flavor data recorded yet</p>
      ) : (
        <div className="space-y-4">
          {data.map((item, i) => {
            const pct = (item.cases / max) * 100;
            const share = total > 0 ? ((item.cases / total) * 100).toFixed(1) : 0;
            return (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <p className="text-sm font-medium">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-heading font-bold">{item.cases.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground ml-1">cases ({share}%)</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}