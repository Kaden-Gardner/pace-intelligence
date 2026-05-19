import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const POPSICLES_PER_CASE = 144;

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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Find the employee record for this user
  const emps = await base44.entities.Employee.filter({ employee_number: user.employee_number });
  if (emps.length === 0) return Response.json({ error: "No employee record found" }, { status: 404 });
  const empId = emps[0].id;

  // Fetch all shifts (service role needed since RLS restricts to admin)
  const shifts = await base44.asServiceRole.entities.Shift.list("-shift_date", 1000);

  // Find shifts where this employee was assigned to any position
  const myShifts = shifts.filter((s) => {
    const inMainPositions = POSITION_FIELDS.some((f) => s[f] === empId);
    const inTraining = (s.training_employees || []).includes(empId);
    return inMainPositions || inTraining;
  });

  if (myShifts.length === 0) {
    return Response.json({ totalShifts: 0, avgCasesPerHour: null, avgPopsPerMinute: null });
  }

  // Calculate stats across all shifts they worked
  let totalCasesHourNumerator = 0;
  let totalCasesHourCount = 0;

  for (const s of myShifts) {
    const duration = s.shift_duration;
    if (!duration || duration <= 0) continue;

    // Total cases this shift (flavorset + individual)
    const flavorsetCases = s.flavorset_cases || 0;
    const indCases =
      (s.individual_flavor_1_cases || 0) +
      (s.individual_flavor_2_cases || 0) +
      (s.individual_flavor_3_cases || 0) +
      (s.individual_flavor_4_cases || 0);
    const totalCases = flavorsetCases + indCases;
    if (totalCases <= 0) continue;

    totalCasesHourNumerator += totalCases / duration;
    totalCasesHourCount++;
  }

  if (totalCasesHourCount === 0) {
    return Response.json({ totalShifts: myShifts.length, avgCasesPerHour: null, avgPopsPerMinute: null });
  }

  const avgCasesPerHour = totalCasesHourNumerator / totalCasesHourCount;
  const avgPopsPerMinute = (avgCasesPerHour * POPSICLES_PER_CASE) / 60;

  return Response.json({
    totalShifts: myShifts.length,
    shiftsWithData: totalCasesHourCount,
    avgCasesPerHour: Math.round(avgCasesPerHour * 10) / 10,
    avgPopsPerMinute: Math.round(avgPopsPerMinute * 100) / 100,
  });
});