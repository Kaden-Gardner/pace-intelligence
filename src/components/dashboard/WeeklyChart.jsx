import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getTotalCases } from "../../lib/analyticsHelpers";

// Brand-themed fallback palette (used when flavorset has no color set)
const FLAVORSET_COLORS = [
  "#f59e0b",  // amber (original)
  "#dc2626",  // red (juice)
  "#7c3aed",  // purple (individual)
  "#0d9488",  // teal
  "#16a34a",  // green
  "#2563eb",  // blue
  "#ea580c",  // orange
  "#db2777",  // pink
];

export default function WeeklyChart({ data, shifts = [], flavorSets = [] }) {
  // Build stacked data: per day, cases broken down by flavorset
  const stackedData = data.map((day) => {
    const dayShifts = shifts.filter((s) => s.shift_date === day.date);
    const entry = { day: day.day };
    flavorSets.forEach((fs) => {
      const fsShifts = dayShifts.filter((s) => s.flavorset_id === fs.id);
      entry[fs.name] = fsShifts.reduce((sum, s) => sum + (s.flavorset_cases || 0), 0);
    });
    // Individual (no flavorset) cases
    const indivCases = dayShifts.reduce((sum, s) => {
      return sum + (s.individual_flavor_1_cases || 0) + (s.individual_flavor_2_cases || 0)
        + (s.individual_flavor_3_cases || 0) + (s.individual_flavor_4_cases || 0);
    }, 0);
    if (indivCases > 0) entry["Individual"] = indivCases;
    return entry;
  });

  const keys = flavorSets.map((fs) => fs.name);
  if (shifts.some((s) => (s.individual_flavor_1_cases || 0) + (s.individual_flavor_2_cases || 0) + (s.individual_flavor_3_cases || 0) + (s.individual_flavor_4_cases || 0) > 0)) {
    keys.push("Individual");
  }

  function getFlavorsetColor(name, i) {
    const fs = flavorSets.find((f) => f.name === name);
    return fs?.color || FLAVORSET_COLORS[i % FLAVORSET_COLORS.length];
  }

  // Fallback: if no flavorsets, show plain bar
  const hasFlavorsets = flavorSets.length > 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="font-heading font-semibold text-lg mb-1">Weekly Production</h3>
      <p className="text-sm text-muted-foreground mb-6">Cases produced in the past 7 days</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hasFlavorsets ? stackedData : data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(210 15% 90%)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis tickLine={false} axisLine={false} className="text-xs" />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid hsl(210 15% 90%)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            />
            {hasFlavorsets ? (
              <>
                {keys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={getFlavorsetColor(key, i)}
                    radius={i === keys.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </>
            ) : (
              <Bar dataKey="cases" fill="hsl(3 79% 51%)" radius={[8, 8, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}