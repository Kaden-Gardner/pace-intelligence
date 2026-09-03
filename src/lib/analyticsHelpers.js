import { GALLONS_PER_CASE, DEFAULT_POPS_PER_CASE, DEFAULT_POPS_PER_MOLD, DEFAULT_BAGS_PER_CASE } from "./productionConstants";

// Trainee entries are stored as "empId|position" strings (see ShiftPositionsSection);
// this extracts the plain employee ID for matching.
export function getTraineeId(entry) {
  if (!entry) return entry;
  const idx = entry.indexOf("|");
  return idx === -1 ? entry : entry.substring(0, idx);
}

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
    shift.training_employees.forEach((e) => employees.add(getTraineeId(e)));
  }
  return [...employees].filter(Boolean);
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
  if (shift.training_employees?.some((e) => getTraineeId(e) === employeeId)) positions.push("Training");
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

// ── Labor-only ROI helpers (mirror the Financials shift labor calc) ──
function entryOverlapsShift(shiftDate, shiftTime, shiftDuration, clockIn, clockOut) {
  if (!clockIn) return false;
  const shiftStart = new Date(`${shiftDate}T${shiftTime || "00:00"}:00`);
  const shiftEnd = new Date(shiftStart.getTime() + (shiftDuration || 8) * 3600000);
  const entryStart = new Date(clockIn);
  const entryEnd = clockOut ? new Date(clockOut) : new Date();
  return entryStart < shiftEnd && entryEnd > shiftStart;
}

function entryTotalHours(clockIn, clockOut) {
  if (!clockIn) return 0;
  const entryStart = new Date(clockIn);
  const entryEnd = clockOut ? new Date(clockOut) : new Date();
  return Math.max(0, (entryEnd - entryStart) / 3600000);
}

function getEmpAge(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const b = new Date(birthday);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

// Labor cost for a production shift: uses full clocked-in time (not divided across
// overlapping shifts), falling back to shift duration when no clock-in exists.
// Minors under 15 are capped at 3 hours — same rules as the Financials page.
export function calcShiftLaborCost(shift, { empMap, rateMap, timeEntries }) {
  const shiftDate = shift.shift_date;
  const shiftTime = shift.shift_time || "06:00";
  const shiftDuration = shift.shift_duration || 8;

  let empIds = [];
  [shift.filling_employee, shift.pulling_employee_1, shift.pulling_employee_2, shift.pulling_employee_3,
   shift.sorting_employee, shift.bagging_employee, shift.boxing_employee, shift.shift_lead].forEach((id) => { if (id) empIds.push(id); });
  if (shift.training_employees) empIds.push(...shift.training_employees.map(getTraineeId));
  empIds = [...new Set(empIds)].filter(Boolean);

  let totalCost = 0;
  empIds.forEach((empId) => {
    const rate = rateMap[empId]?.hourly_rate || 0;
    if (!rate) return;
    const emp = empMap[empId];
    const age = getEmpAge(emp?.birthday);
    const isMinor = age !== null && age < 15;
    const empEntries = timeEntries.filter((te) => te.employee_id === empId || (emp && te.employee_number === emp.employee_number));
    const overlapping = empEntries.filter((te) => entryOverlapsShift(shiftDate, shiftTime, shiftDuration, te.clock_in, te.clock_out));
    let hours;
    if (overlapping.length > 0) {
      hours = overlapping.reduce((sum, te) => sum + entryTotalHours(te.clock_in, te.clock_out), 0);
    } else {
      hours = shiftDuration;
    }
    if (isMinor) hours = Math.min(hours, 3);
    totalCost += hours * rate;
  });
  return totalCost;
}

// Dream team = crew of the single shift with the greatest labor-only ROI
// (predicted revenue ÷ labor cost). Returns [] when revenue or labor data is missing.
export function findDreamTeam(shifts, employees, laborData) {
  if (shifts.length === 0 || !laborData) return [];

  const { empMap, rateMap, timeEntries, avgCasePrice } = laborData;
  if (avgCasePrice == null) return []; // need priced orders to estimate revenue

  const scored = shifts
    .map((s) => {
      const laborCost = calcShiftLaborCost(s, { empMap, rateMap, timeEntries });
      const cases = getTotalCases(s);
      const predictedRevenue = cases > 0 ? avgCasePrice * cases : 0;
      const roi = laborCost > 0 ? predictedRevenue / laborCost : null;
      const crew = getShiftEmployees(s);
      return { roi, cases, speed: getCasesPerHour(s), crewSize: crew.length, crew };
    })
    .filter((x) => x.roi !== null);

  // Rank by: highest ROI → most cases → fastest speed (CPH) → fewest employees
  scored.sort((a, b) => {
    if (b.roi !== a.roi) return b.roi - a.roi;
    if (b.cases !== a.cases) return b.cases - a.cases;
    if (b.speed !== a.speed) return b.speed - a.speed;
    return a.crewSize - b.crewSize;
  });
  if (scored.length === 0) return [];

  // Never show terminated employees — the dream team must be a crew you could actually field.
  const activeCrew = scored[0].crew
    .map((id) => employees.find((e) => e.id === id))
    .filter((e) => e && !e.terminated);
  return activeCrew;
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

export function getBestPosition(shifts, employeeId) {
  const positionCph = {};
  shifts.forEach((shift) => {
    const positions = getEmployeePosition(shift, employeeId);
    const cph = getCasesPerHour(shift);
    positions.forEach((pos) => {
      if (!positionCph[pos]) positionCph[pos] = { total: 0, count: 0 };
      positionCph[pos].total += cph;
      positionCph[pos].count += 1;
    });
  });
  let best = null;
  let bestAvg = 0;
  Object.entries(positionCph).forEach(([pos, data]) => {
    const avg = data.total / data.count;
    if (avg > bestAvg) { bestAvg = avg; best = pos; }
  });
  return best;
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

// ── Per-position production metrics (lifetime totals) ──
// Maps each production position to the unit it produces per shift.
export const POSITION_PRODUCTION = {
  pulling: { label: "Molds Touched", unit: "molds" },
  filling: { label: "Gallons Poured", unit: "gal" },
  sorting: { label: "Pops Touched", unit: "pops" },
  bagging: { label: "Bags Filled", unit: "bags" },
  boxing: { label: "Cases Made", unit: "cases" },
};

// Resolve pack constants from a MaterialDefaults map (keyed by material_key).
export function resolvePackConstants(matDefaultsMap = {}) {
  return {
    bagsPerCase: matDefaultsMap["bags_per_case"]?.qty_per_shift || DEFAULT_BAGS_PER_CASE,
    popsPerCase: matDefaultsMap["popsicles_per_case"]?.qty_per_shift || DEFAULT_POPS_PER_CASE,
    popsPerMold: matDefaultsMap["popsicles_per_mold"]?.qty_per_shift || DEFAULT_POPS_PER_MOLD,
  };
}

// Per-position production metric for a single shift.
// `position` accepts the capitalized label (from getEmployeePosition) or the lowercase key.
// Returns null for positions without a production metric (Shift Lead, Training).
export function getPositionProduction(shift, position, packConstants = {}) {
  const pos = String(position || "").toLowerCase();
  if (!POSITION_PRODUCTION[pos]) return null;
  const totalCases = getTotalCases(shift);
  if (totalCases <= 0) return 0;
  const popsPerCase = packConstants.popsPerCase || DEFAULT_POPS_PER_CASE;
  const popsPerMold = packConstants.popsPerMold || DEFAULT_POPS_PER_MOLD;
  const bagsPerCase = packConstants.bagsPerCase || DEFAULT_BAGS_PER_CASE;
  const totalPops = totalCases * popsPerCase;
  switch (pos) {
    case "pulling": return popsPerMold > 0 ? totalPops / popsPerMold : 0;
    case "filling": return totalCases * GALLONS_PER_CASE;
    case "sorting": return totalPops;
    case "bagging": return totalCases * bagsPerCase;
    case "boxing": return totalCases;
    default: return null;
  }
}