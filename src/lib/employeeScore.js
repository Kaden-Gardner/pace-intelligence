import { getTotalCases, getTraineeId } from "./analyticsHelpers";
import { differenceInMinutes, parseISO } from "date-fns";

// Computes the composite performance score for every employee.
//
// Components (per employee):
//   S = 100 * ((avg speed - minSpeedRequired) / 10)        — speed vs. requirement
//   E = 10 * avg employee score (from shift.employee_scores, 0–10 scale)
//   T = 100 * minShiftsPerWeek * (shifts worked in past 30 days / 20)
//   P = 100 * ((PVR - 1) / 99)                              — production value ratio
//   score = 0.30*S + 0.25*E + 0.10*T + 0.35*P
//
// Returns a map: empId -> { speed, avgScore, shifts30d, totalShifts, totalCases,
//                           totalHours, pvr, pay, prodValue, S, E, T, P, score }
export function computeEmployeeScores({
  shifts,
  employees,
  settings,
  rateMap = {},
  timeEntries = [],
  avgCasePrice = null,
  taxRate = 0,
}) {
  const minShiftsPerWeek = settings?.min_shifts_per_week || 0;
  const minSpeedRequired = settings?.min_speed_required || 0;
  const tRate = taxRate || 0;

  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86400000);

  // Single-pass per-employee aggregates
  const agg = {};
  employees.forEach((emp) => {
    agg[emp.id] = { totalCases: 0, totalHours: 0, totalShifts: 0, shifts30d: 0, scoreSum: 0, scoreCount: 0 };
  });

  shifts.forEach((s) => {
    const cases = getTotalCases(s);
    const hours = s.shift_duration || 0;
    const in30 = s.shift_date ? new Date(s.shift_date + "T12:00:00") >= cutoff30 : false;

    // Who worked this production shift
    const worked = new Set();
    [
      s.filling_employee, s.pulling_employee_1, s.pulling_employee_2, s.pulling_employee_3,
      s.sorting_employee, s.bagging_employee, s.boxing_employee, s.shift_lead,
    ].forEach((id) => { if (id) worked.add(id); });
    (s.training_employees || []).forEach((t) => {
      const tid = getTraineeId(t);
      if (tid) worked.add(tid);
    });

    worked.forEach((id) => {
      const a = agg[id];
      if (!a) return;
      a.totalCases += cases;
      a.totalHours += hours;
      a.totalShifts += 1;
      if (in30) a.shifts30d += 1;
    });

    (s.employee_scores || []).forEach((es) => {
      if (es.employee_id && typeof es.score === "number" && !isNaN(es.score)) {
        const a = agg[es.employee_id];
        if (a) { a.scoreSum += es.score; a.scoreCount += 1; }
      }
    });
  });

  // Clocked hours per employee (for PVR / pay)
  const numToId = {};
  employees.forEach((e) => { if (e.employee_number) numToId[e.employee_number] = e.id; });
  const clockedMap = {};
  timeEntries.forEach((te) => {
    if (!te.clock_in || !te.clock_out) return;
    const id = te.employee_id || numToId[te.employee_number];
    if (!id) return;
    const h = te.total_hours != null
      ? te.total_hours
      : Math.max(0, differenceInMinutes(parseISO(te.clock_out), parseISO(te.clock_in)) / 60);
    clockedMap[id] = (clockedMap[id] || 0) + h;
  });

  const result = {};
  employees.forEach((emp) => {
    const a = agg[emp.id] || { totalCases: 0, totalHours: 0, totalShifts: 0, shifts30d: 0, scoreSum: 0, scoreCount: 0 };
    const speed = a.totalHours > 0 ? a.totalCases / a.totalHours : 0;
    const avgScore = a.scoreCount > 0 ? a.scoreSum / a.scoreCount : 0;

    const clockedH = clockedMap[emp.id] || 0;
    const rate = rateMap[emp.id]?.hourly_rate || 0;
    const effRate = rate * (1 + tRate / 100);
    const pay = clockedH * effRate;
    const prodValue = avgCasePrice != null && a.totalCases > 0 ? a.totalCases * avgCasePrice : 0;
    const pvr = pay > 0 && prodValue > 0 ? prodValue / pay : null;

    const S = 100 * ((speed - minSpeedRequired) / 10);
    const E = 10 * avgScore;
    const T = 100 * minShiftsPerWeek * (a.shifts30d / 20);
    const P = pvr != null ? 100 * ((pvr - 1) / 99) : 0;
    const score = 0.3 * S + 0.25 * E + 0.1 * T + 0.35 * P;

    result[emp.id] = {
      speed,
      avgScore,
      shifts30d: a.shifts30d,
      totalShifts: a.totalShifts,
      totalCases: a.totalCases,
      totalHours: a.totalHours,
      pvr,
      pay,
      prodValue,
      S,
      E,
      T,
      P,
      score,
    };
  });

  return result;
}