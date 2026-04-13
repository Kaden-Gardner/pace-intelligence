import { IceCreamCone } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const FALLBACK_COLORS = [
  "hsl(192 75% 42%)",
  "hsl(340 65% 55%)",
  "hsl(160 50% 45%)",
  "hsl(40 85% 55%)",
  "hsl(270 55% 55%)",
  "hsl(20 80% 55%)",
  "hsl(210 60% 50%)",
  "hsl(300 50% 50%)",
];

export default function FlavorBreakdownCard({ flavorCases, flavorColorMap = {} }) {
  const data = Object.entries(flavorCases).map(([name, cases]) => ({ name, cases }));
  data.sort((a, b) => b.cases - a.cases);

  function getColor(name, i) {
    return flavorColorMap[name] || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
  }

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
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="cases" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {data.map((item, i) => (
                    <Cell key={i} fill={getColor(item.name, i)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(item.name, i) }} />
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.cases.toLocaleString()} cases</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}