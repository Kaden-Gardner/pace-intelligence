export function getTotalCases(shift) {
  const flavorsetCases = shift.flavorset_cases || 0;
  const indiv1 = shift.individual_flavor_1_cases || 0;
  const indiv2 = shift.individual_flavor_2_cases || 0;
  const indiv3 = shift.individual_flavor_3_cases || 0;
  const indiv4 = shift.individual_flavor_4_cases || 0;
  return flavorsetCases + indiv1 + indiv2 + indiv3 + indiv4;
}

export function getCasesPerHour(shift) {
  const total = getTotalCases(shift);
  const duration = shift.shift_duration || 1;
  return total / duration;
}

export function getShiftEmployees(shift) {
  const employees = new Set();
  if (shift.filling_employee) employees.add(shift.filling_employee);
  if (shift.pulling_employee_1) employees.add(shift.pulling_employee_1);
  if (shift.pulling_employee_2) employees.add(shift.pulling_employee_2);
  if (shift.pulling_employee_3) employees.add(shift.pulling_employee_3);
  if (shift.sorting_employee) employees.add(shift.sorting_employee);
  if (shift.bagging_employee) employees.add(shift.bagging_employee);
  if (shift.boxing_employee) employees.add(shift.boxing_employee);
  if (shift.shift_lead) employees.add(shift.shift_lead);
  if (shift.training_employees) {
    shift.training_employees.forEach((e) => employees.add(e));
  }
  return [...employees];
}

export function getEmployeePosition(shift, employeeId) {
  const positions = [];
  if (shift.filling_employee === employeeId) positions.push("Filling");
  if (shift.pulling_employee_1 === employeeId) positions.push("Pulling");
  if (shift.pulling_employee_2 === employeeId) positions.push("Pulling");
  if (shift.pulling_employee_3 === employeeId) positions.push("Pulling");
  if (shift.sorting_employee === employeeId) positions.push("Sorting");
  if (shift.bagging_employee === employeeId) positions.push("Bagging");
  if (shift.boxing_employee === employeeId) positions.push("Boxing");
  if (shift.shift_lead === employeeId) positions.push("Shift Lead");
  if (shift.training_employees?.includes(employeeId)) positions.push("Training");
  return positions;
}

export function computeEmployeeStats(shifts, employees) {
  const stats = {};

  employees.forEach((emp) => {
    stats[emp.id] = {
      employee: emp,
      totalShifts: 0,
      totalCases: 0,
      totalHours: 0,
      positionStats: {},
    };
  });

  shifts.forEach((shift) => {
    const cph = getCasesPerHour(shift);
    const totalCases = getTotalCases(shift);

    employees.forEach((emp) => {
      const positions = getEmployeePosition(shift, emp.id);
      if (positions.length === 0) return;

      const s = stats[emp.id];
      if (!s) return;
      s.totalShifts += 1;
      s.totalCases += totalCases;
      s.totalHours += shift.shift_duration || 0;

      positions.forEach((pos) => {
        if (!s.positionStats[pos]) {
          s.positionStats[pos] = { shifts: 0, totalCases: 0, totalHours: 0 };
        }
        s.positionStats[pos].shifts += 1;
        s.positionStats[pos].totalCases += totalCases;
        s.positionStats[pos].totalHours += shift.shift_duration || 0;
      });
    });
  });

  return stats;
}

export function findDreamTeam(shifts, employees) {
  if (shifts.length === 0) return [];

  // Score each shift by cases per hour, find top performing crew combos
  const shiftScores = shifts.map((s) => ({
    shift: s,
    cph: getCasesPerHour(s),
    crew: getShiftEmployees(s),
  }));

  shiftScores.sort((a, b) => b.cph - a.cph);

  // Find top shift
  if (shiftScores.length === 0) return [];

  const topShift = shiftScores[0];
  return topShift.crew
    .map((id) => employees.find((e) => e.id === id))
    .filter(Boolean);
}

export function findBestPairings(shifts, employees) {
  const pairScores = {};

  shifts.forEach((shift) => {
    const crew = getShiftEmployees(shift);
    const cph = getCasesPerHour(shift);

    for (let i = 0; i < crew.length; i++) {
      for (let j = i + 1; j < crew.length; j++) {
        const key = [crew[i], crew[j]].sort().join(":");
        if (!pairScores[key]) {
          pairScores[key] = { ids: [crew[i], crew[j]], totalCph: 0, count: 0 };
        }
        pairScores[key].totalCph += cph;
        pairScores[key].count += 1;
      }
    }
  });

  return Object.values(pairScores)
    .filter((p) => p.count >= 2)
    .map((p) => ({
      ...p,
      avgCph: p.totalCph / p.count,
      employees: p.ids.map((id) => employees.find((e) => e.id === id)).filter(Boolean),
    }))
    .sort((a, b) => b.avgCph - a.avgCph)
    .slice(0, 5);
}

export function getWeeklyProductionData(shifts) {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  return days.map((date) => {
    const dayShifts = shifts.filter((s) => s.shift_date === date);
    const totalCases = dayShifts.reduce((sum, s) => sum + getTotalCases(s), 0);
    const totalHours = dayShifts.reduce((sum, s) => sum + (s.shift_duration || 0), 0);
    const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
    return {
      date,
      day: dayName,
      cases: totalCases,
      cph: totalHours > 0 ? (totalCases / totalHours) : 0,
    };
  });
}