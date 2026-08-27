import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const POPSICLES_PER_CASE = 144;
const POPSICLES_PER_MOLD_DEFAULT = 24;
const BAGS_PER_CASE_DEFAULT = 12;
const GALLONS_PER_CASE = 3;

const POSITION_FIELDS = [
  "filling_employee",
  "pulling_employee_1",
  "pulling_employee_2",
  "pulling_employee_3",
  "sorting_employee",
  "bagging_employee",
  "boxing_employee",
  "shift_lead",
];

const POSITION_METRICS = {
  pulling: "molds",
  filling: "gal",
  sorting: "pops",
  bagging: "bags",
  boxing: "cases",
};

function getTotalCases(s) {
  const flavorsetCases = s.flavorset_cases || 0;
  const indCases =
    (s.individual_flavor_1_cases || 0) +
    (s.individual_flavor_2_cases || 0) +
    (s.individual_flavor_3_cases || 0) +
    (s.individual_flavor_4_cases || 0);
  return flavorsetCases + indCases;
}

// The five production positions (excludes Shift Lead / Training, which have no
// per-position production metric).
function getProductionPositions(s, empId) {
  const positions = [];
  if (s.filling_employee === empId) positions.push("filling");
  if (s.pulling_employee_1 === empId || s.pulling_employee_2 === empId || s.pulling_employee_3 === empId) positions.push("pulling");
  if (s.sorting_employee === empId) positions.push("sorting");
  if (s.bagging_employee === empId) positions.push("bagging");
  if (s.boxing_employee === empId) positions.push("boxing");
  return positions;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Find the employee record for this user
  const emps = await base44.entities.Employee.filter({ employee_number: user.employee_number });
  if (emps.length === 0) return Response.json({ error: "No employee record found" }, { status: 404 });
  const empId = emps[0].id;

  // Fetch shifts + pack-conversion defaults (service role bypasses admin-only RLS)
  const [shifts, matDef] = await Promise.all([
    base44.asServiceRole.entities.Shift.list("-shift_date", 1000),
    base44.asServiceRole.entities.MaterialDefaults.list(),
  ]);

  const matMap = {};
  matDef.forEach((d) => { matMap[d.material_key] = d; });
  const popsPerCase = matMap["popsicles_per_case"]?.qty_per_shift || POPSICLES_PER_CASE;
  const popsPerMold = matMap["popsicles_per_mold"]?.qty_per_shift || POPSICLES_PER_MOLD_DEFAULT;
  const bagsPerCase = matMap["bags_per_case"]?.qty_per_shift || BAGS_PER_CASE_DEFAULT;

  // Find shifts where this employee was assigned to any position
  const myShifts = shifts.filter((s) => {
    const inMainPositions = POSITION_FIELDS.some((f) => s[f] === empId);
    const inTraining = (s.training_employees || []).includes(empId);
    return inMainPositions || inTraining;
  });

  let totalCasesHourNumerator = 0;
  let totalCasesHourCount = 0;
  const positionTotals = {};

  for (const s of myShifts) {
    const duration = s.shift_duration;
    const totalCases = getTotalCases(s);
    if (duration && duration > 0 && totalCases > 0) {
      totalCasesHourNumerator += totalCases / duration;
      totalCasesHourCount++;
    }

    const positions = getProductionPositions(s, empId);
    if (positions.length === 0 || totalCases <= 0) continue;
    const totalPops = totalCases * popsPerCase;
    positions.forEach((pos) => {
      if (!positionTotals[pos]) positionTotals[pos] = { total: 0, shifts: 0 };
      let metric = 0;
      switch (pos) {
        case "pulling": metric = popsPerMold > 0 ? totalPops / popsPerMold : 0; break;
        case "filling": metric = totalCases * GALLONS_PER_CASE; break;
        case "sorting": metric = totalPops; break;
        case "bagging": metric = totalCases * bagsPerCase; break;
        case "boxing": metric = totalCases; break;
      }
      positionTotals[pos].total += metric;
      positionTotals[pos].shifts += 1;
    });
  }

  const positionTotalsOut = {};
  Object.keys(positionTotals).forEach((pos) => {
    positionTotalsOut[pos] = {
      total: Math.round(positionTotals[pos].total),
      shifts: positionTotals[pos].shifts,
      unit: POSITION_METRICS[pos],
    };
  });

  if (myShifts.length === 0) {
    return Response.json({
      totalShifts: 0,
      shiftsWithData: 0,
      avgCasesPerHour: null,
      avgPopsPerMinute: null,
      positionTotals: {},
    });
  }

  const avgCasesPerHour = totalCasesHourCount > 0 ? totalCasesHourNumerator / totalCasesHourCount : null;
  const avgPopsPerMinute = avgCasesPerHour != null ? (avgCasesPerHour * POPSICLES_PER_CASE) / 60 : null;

  return Response.json({
    totalShifts: myShifts.length,
    shiftsWithData: totalCasesHourCount,
    avgCasesPerHour: avgCasesPerHour != null ? Math.round(avgCasesPerHour * 10) / 10 : null,
    avgPopsPerMinute: avgPopsPerMinute != null ? Math.round(avgPopsPerMinute * 100) / 100 : null,
    positionTotals: positionTotalsOut,
  });
});