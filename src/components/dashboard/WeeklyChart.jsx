import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { getTotalCases } from "../../lib/analyticsHelpers";

// Brand-themed palette matching Pace Bars logo/design system
const FLAVORSET_COLORS = [
  "hsl(3 79% 51%)",    // primary red
  "hsl(285 63% 49%)",  // accent purple
  "hsl(192 75% 42%)",  // teal
  "hsl(40 85% 55%)",   // amber
  "hsl(160 50% 45%)",  // green
  "hsl(210 70% 55%)",  // blue
  "hsl(20 80% 55%)",   // orange
  "hsl(300 50% 50%)",  // magenta
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
                    fill={FLAVORSET_COLORS[i % FLAVORSET_COLORS.length]}
                    radius={i === keys.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
                <Legend />
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