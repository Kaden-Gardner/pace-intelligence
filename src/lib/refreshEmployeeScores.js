import { base44 } from "@/api/base44Client";
import { computeEmployeeScores } from "./employeeScore";

// Snapshots every employee's current_score into previous_score, then recomputes
// the composite score (now including the just-posted shift) and stores it as
// the new current_score. Called after a shift report is saved.
//
// On the very first run (current_score never set), previous_score stays null so
// no change arrow is shown until there is a real prior value to compare.
export async function refreshEmployeeScores() {
  const [shifts, employees, timeEntries, rates, perfSettings, taxSettings, orders] = await Promise.all([
    base44.entities.Shift.list("-shift_date", 1000),
    base44.entities.Employee.list(),
    base44.entities.TimeEntry.list("-clock_in", 3000),
    base44.entities.EmployeeRate.list(),
    base44.entities.PerformanceSettings.list().catch(() => []),
    base44.entities.TaxSettings.list().catch(() => []),
    base44.entities.OrderPickup.list("-pickup_date", 1000),
  ]);

  const rateMap = Object.fromEntries(rates.map((r) => [r.employee_id, r]));
  const taxRate = taxSettings.length > 0 ? taxSettings[0].tax_rate || 0 : 0;
  const settings = perfSettings.length > 0 ? perfSettings[0] : null;
  const priced = orders.filter((o) => o.is_priced && o.case_sell_price > 0);
  const avgCasePrice = priced.length > 0
    ? priced.reduce((s, o) => s + o.case_sell_price, 0) / priced.length
    : null;

  const scores = computeEmployeeScores({
    shifts, employees, settings, rateMap, timeEntries, avgCasePrice, taxRate,
  });

  // Snapshot current → previous (only when a current value already exists),
  // then set current to the freshly computed score.
  const updates = employees.map((emp) => {
    const newScore = scores[emp.id]?.score ?? 0;
    const hasCurrent = typeof emp.current_score === "number";
    return {
      id: emp.id,
      previous_score: hasCurrent ? emp.current_score : null,
      current_score: newScore,
    };
  });

  await base44.entities.Employee.bulkUpdate(updates);
  return { updated: updates.length };
}