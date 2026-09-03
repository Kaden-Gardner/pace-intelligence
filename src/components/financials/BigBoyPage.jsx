import { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crown } from "lucide-react";
import { differenceInMinutes, parseISO } from "date-fns";
import {
  getTotalCases,
  computeEmployeeStats,
  findDreamTeam,
  getWeeklyProductionData,
  resolvePackConstants,
  getPositionProduction,
  getEmployeePosition,
} from "@/lib/analyticsHelpers";
import OverviewSection from "@/components/bigboy/OverviewSection";
import EmployeeSection from "@/components/bigboy/EmployeeSection";
import FinancialSection from "@/components/bigboy/FinancialSection";
import SalesSection from "@/components/bigboy/SalesSection";
import FlavorSection from "@/components/bigboy/FlavorSection";
import ComparisonsSection from "@/components/bigboy/ComparisonsSection";
import InventoryValueCard from "@/components/financials/InventoryValueCard";
import PayPeriodsCard from "@/components/financials/PayPeriodsCard";
import DreamTeamCard from "@/components/dashboard/DreamTeamCard";
import TopEmployeesCard from "@/components/dashboard/TopEmployeesCard";
import BestPairingsCard from "@/components/dashboard/BestPairingsCard";
import PositionMVPsCard from "@/components/dashboard/PositionMVPsCard";
import MostValuableTeamCard from "@/components/dashboard/MostValuableTeamCard";
import ShiftLeadCompetitionCard from "@/components/dashboard/ShiftLeadCompetitionCard";
import { INFO } from "@/components/bigboy/explanations";

const GALLONS_PER_CASE = 3;
const CASES_PER_PALLET = 66;

function parseDowntimeHours(text) {
  if (!text) return 0;
  const s = String(text).toLowerCase().trim();
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) return parseFloat(hourMatch[1]);
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) return parseFloat(minMatch[1]) / 60;
  const plainMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (plainMatch) return parseFloat(plainMatch[1]) / 60;
  return 0;
}

export default function BigBoyPage({
  shifts, baseMixShifts, employees, rates, timeEntries, orders, orderItems,
  flavorSets, matDefaults, taxRate,
  calcShiftCost, calcProductionSupplyCost, orderRevenue, onBack,
}) {
  const [flavors, setFlavors] = useState([]);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    base44.entities.Flavor.list().then(setFlavors).catch(() => setFlavors([]));
    base44.entities.Inventory.list().then(setInventory).catch(() => setInventory([]));
  }, []);

  // Keep latest calc fns (they close over Financials data) without breaking memo deps
  const fnRef = useRef({});
  fnRef.current = { calcShiftCost, calcProductionSupplyCost, orderRevenue };

  const pack = useMemo(() => {
    const map = {};
    (matDefaults || []).forEach((d) => { map[d.material_key] = d; });
    return resolvePackConstants(map);
  }, [matDefaults]);

  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);
  const rateMap = useMemo(() => Object.fromEntries(rates.map((r) => [r.employee_id, r])), [rates]);
  const activeEmployees = useMemo(() => employees.filter((e) => e.active !== false && !e.terminated), [employees]);

  const avgCasePrice = useMemo(() => {
    const priced = (orderItems || []).filter((i) => i.case_sell_price > 0);
    return priced.length > 0 ? priced.reduce((s, i) => s + i.case_sell_price, 0) / priced.length : null;
  }, [orderItems]);

  // ── All-time production totals ──
  const totals = useMemo(() => {
    let cases = 0, pops = 0, waste = 0, hours = 0, downtime = 0;
    let firstDate = null, lastDate = null;
    shifts.forEach((s) => {
      const c = getTotalCases(s);
      cases += c;
      pops += c * (s.popsicles_per_case || pack.popsPerCase);
      waste += s.waste || 0;
      hours += s.shift_duration || 0;
      downtime += parseDowntimeHours(s.downtime);
      if (s.shift_date && (!firstDate || s.shift_date < firstDate)) firstDate = s.shift_date;
      if (s.shift_date && (!lastDate || s.shift_date > lastDate)) lastDate = s.shift_date;
    });
    const clockedHours = timeEntries.reduce((sum, te) => {
      if (!te.clock_in || !te.clock_out) return sum;
      const h = te.total_hours != null ? te.total_hours : Math.max(0, differenceInMinutes(parseISO(te.clock_out), parseISO(te.clock_in)) / 60);
      return sum + h;
    }, 0);
    const spanDays = firstDate && lastDate ? Math.max(1, Math.round((new Date(lastDate + "T12:00:00") - new Date(firstDate + "T12:00:00")) / 86400000) + 1) : 0;
    const totalShiftCount = shifts.length + baseMixShifts.length;
    return {
      pops, cases, pallets: Math.floor(cases / CASES_PER_PALLET),
      gallons: cases * GALLONS_PER_CASE,
      molds: pack.popsPerMold > 0 ? pops / pack.popsPerMold : 0,
      bags: cases * pack.bagsPerCase, bagsPerCase: pack.bagsPerCase,
      waste, wastePct: cases * GALLONS_PER_CASE + waste > 0 ? (waste / (cases * GALLONS_PER_CASE + waste)) * 100 : 0,
      hours, downtime, clockedHours,
      avgCph: hours > 0 ? cases / hours : 0,
      popsPerMin: hours > 0 ? pops / hours / 60 : 0,
      casesPerShift: shifts.length > 0 ? cases / shifts.length : 0,
      avgShiftHours: shifts.length > 0 ? hours / shifts.length : 0,
      shiftsCount: shifts.length, basemixCount: baseMixShifts.length,
      firstDate, lastDate, spanDays,
      shiftsPerWeek: spanDays > 0 ? totalShiftCount / (spanDays / 7) : 0,
      casesPerWeek: spanDays > 0 ? cases / (spanDays / 7) : 0,
      employeeCount: employees.length,
      activeCount: activeEmployees.length,
      terminatedCount: employees.filter((e) => e.terminated).length,
    };
  }, [shifts, baseMixShifts, pack, timeEntries, employees, activeEmployees]);

  // ── Financial totals (all time) ──
  const finances = useMemo(() => {
    const fns = fnRef.current;
    let labor = 0, supply = 0;
    shifts.forEach((s) => { labor += fns.calcShiftCost(s, false); supply += fns.calcProductionSupplyCost(s); });
    baseMixShifts.forEach((s) => { labor += fns.calcShiftCost(s, true); });
    const revenue = orders.reduce((sum, o) => sum + fns.orderRevenue(o), 0);
    const casesSold = orders.reduce((sum, o) => {
      const items = (orderItems || []).filter((i) => i.order_id === o.id);
      return sum + (items.length > 0 ? items.reduce((x, i) => x + Math.round(i.cases || 0), 0) : Math.round(o.cases || 0));
    }, 0);
    return {
      labor, supply, revenue, casesSold,
      prodValue: avgCasePrice != null ? totals.cases * avgCasePrice : null,
      profit: revenue - labor - supply,
      laborPerCase: totals.cases > 0 ? labor / totals.cases : null,
      costPerCase: totals.cases > 0 ? (labor + supply) / totals.cases : null,
      profitPerCase: casesSold > 0 ? (revenue - labor - supply) / casesSold : null,
      roi: labor > 0 ? revenue / labor : null,
      revenuePerHour: totals.hours > 0 ? revenue / totals.hours : null,
      avgSalePrice: avgCasePrice,
    };
  }, [shifts, baseMixShifts, orders, orderItems, totals.cases, totals.hours, avgCasePrice]);

  // Attach per-shift averages for the overview
  const overviewTotals = useMemo(() => ({
    ...totals,
    avgLaborPerShift: totals.shiftsCount + totals.basemixCount > 0 ? finances.labor / (totals.shiftsCount + totals.basemixCount) : null,
    avgRevenuePerShift: totals.shiftsCount > 0 ? finances.revenue / totals.shiftsCount : null,
  }), [totals, finances]);

  // ── Per-year production rows ──
  const yearRows = useMemo(() => {
    const map = {};
    shifts.forEach((s) => {
      const y = parseInt(s.shift_date?.slice(0, 4), 10);
      if (!y) return;
      if (!map[y]) map[y] = { year: y, shifts: 0, cases: 0, pops: 0, waste: 0, hours: 0 };
      const c = getTotalCases(s);
      map[y].shifts++;
      map[y].cases += c;
      map[y].pops += c * (s.popsicles_per_case || pack.popsPerCase);
      map[y].waste += s.waste || 0;
      map[y].hours += s.shift_duration || 0;
    });
    return Object.values(map)
      .map((r) => ({ ...r, gallons: r.cases * GALLONS_PER_CASE, cph: r.hours > 0 ? r.cases / r.hours : 0, value: avgCasePrice != null ? r.cases * avgCasePrice : null }))
      .sort((a, b) => b.year - a.year);
  }, [shifts, pack, avgCasePrice]);

  // ── Per-month financial comparison rows ──
  const monthlyRows = useMemo(() => {
    const fns = fnRef.current;
    const map = {};
    const get = (key) => {
      if (!map[key]) map[key] = { month: key, prodShifts: 0, basemixShifts: 0, cases: 0, hours: 0, labor: 0, supply: 0, revenue: 0, orders: 0 };
      return map[key];
    };
    shifts.forEach((s) => {
      const m = s.shift_date?.slice(0, 7);
      if (!m) return;
      const r = get(m);
      r.prodShifts++;
      r.cases += getTotalCases(s);
      r.hours += s.shift_duration || 0;
      r.labor += fns.calcShiftCost(s, false);
      r.supply += fns.calcProductionSupplyCost(s);
    });
    baseMixShifts.forEach((s) => {
      const m = s.shift_date?.slice(0, 7);
      if (!m) return;
      const r = get(m);
      r.basemixShifts++;
      r.labor += fns.calcShiftCost(s, true);
    });
    orders.forEach((o) => {
      const m = o.pickup_date?.slice(0, 7);
      if (!m) return;
      const r = get(m);
      r.orders++;
      r.revenue += fns.orderRevenue(o);
    });
    return Object.values(map)
      .map((r) => {
        const profit = r.revenue - r.labor - r.supply;
        return { ...r, profit, margin: r.revenue > 0 ? (profit / r.revenue) * 100 : null };
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [shifts, baseMixShifts, orders]);

  // ── Records ──
  const records = useMemo(() => {
    let fastest = null, biggest = null, longest = null;
    shifts.forEach((s) => {
      const c = getTotalCases(s);
      const dur = s.shift_duration || 0;
      const cph = dur > 0 ? c / dur : 0;
      if (!fastest || cph > fastest.cph) fastest = { cph, cases: c, date: s.shift_date };
      if (!biggest || c > biggest.cases) biggest = { cph, cases: c, date: s.shift_date };
      if (dur > 0 && (!longest || dur > longest.dur)) longest = { dur, date: s.shift_date };
    });
    const profitMonths = monthlyRows.filter((m) => m.revenue > 0);
    const bestMonth = [...profitMonths].sort((a, b) => b.profit - a.profit)[0] || null;
    const worstMonth = [...profitMonths].sort((a, b) => a.profit - b.profit)[0] || null;
    const topYear = [...yearRows].sort((a, b) => b.cases - a.cases)[0] || null;
    return { fastest, biggest, longest, bestMonth, worstMonth, topYear };
  }, [shifts, monthlyRows, yearRows]);

  // ── Employee stats (all time) ──
  const empStats = useMemo(() => computeEmployeeStats(shifts, activeEmployees), [shifts, activeEmployees]);
  const empEntries = useMemo(() => Object.values(empStats)
    .filter((s) => s.totalHours > 0)
    .sort((a, b) => (b.totalCases / b.totalHours) - (a.totalCases / a.totalHours)), [empStats]);
  const dreamTeam = useMemo(
    () => findDreamTeam(shifts, activeEmployees, { empMap, rateMap, timeEntries, avgCasePrice }),
    [shifts, activeEmployees, empMap, rateMap, timeEntries, avgCasePrice]
  );

  const empRows = useMemo(() => {
    const numToId = {};
    employees.forEach((e) => { if (e.employee_number) numToId[e.employee_number] = e.id; });
    const clocked = {};
    timeEntries.forEach((te) => {
      if (!te.clock_in || !te.clock_out) return;
      const id = te.employee_id || numToId[te.employee_number];
      if (!id) return;
      const h = te.total_hours != null ? te.total_hours : Math.max(0, differenceInMinutes(parseISO(te.clock_out), parseISO(te.clock_in)) / 60);
      clocked[id] = (clocked[id] || 0) + h;
    });
    return employees
      .map((emp) => {
        const st = empStats[emp.id] || { totalShifts: 0, totalCases: 0, totalHours: 0, positionStats: {} };
        const pos = { Filling: 0, Pulling: 0, Sorting: 0, Bagging: 0, Boxing: 0 };
        shifts.forEach((s) => {
          const poss = getEmployeePosition(s, emp.id);
          if (!poss.length) return;
          poss.forEach((p) => { const v = getPositionProduction(s, p, pack); if (v) pos[p] += v; });
        });
        const clockedH = clocked[emp.id] || 0;
        const rate = rateMap[emp.id]?.hourly_rate || 0;
        const effRate = rate * (1 + (taxRate || 0) / 100);
        return {
          id: emp.id, name: emp.name, number: emp.employee_number,
          active: emp.active !== false && !emp.terminated,
          shifts: st.totalShifts,
          leadShifts: st.positionStats["Shift Lead"]?.shifts || 0,
          schedHours: st.totalHours, clockedH,
          cases: st.totalCases,
          cph: st.totalHours > 0 ? st.totalCases / st.totalHours : 0,
          pos, pay: clockedH * effRate,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, empStats, shifts, pack, rateMap, timeEntries, taxRate]);

  // ── Sales stats ──
  const sales = useMemo(() => {
    const vendors = {};
    orders.forEach((o) => {
      const v = o.vendor_name || "Unknown";
      const items = (orderItems || []).filter((i) => i.order_id === o.id);
      const cs = items.length > 0 ? items.reduce((x, i) => x + Math.round(i.cases || 0), 0) : Math.round(o.cases || 0);
      const rev = fnRef.current.orderRevenue(o);
      if (!vendors[v]) vendors[v] = { name: v, orders: 0, cases: 0, revenue: 0 };
      vendors[v].orders++;
      vendors[v].cases += cs;
      vendors[v].revenue += rev;
    });
    return {
      vendorRows: Object.values(vendors).sort((a, b) => b.revenue - a.revenue),
      totalOrders: orders.length,
      pricedOrders: orders.filter((o) => o.is_priced).length,
      avgOrder: orders.length > 0 ? finances.revenue / orders.length : null,
      avgCasesOrder: orders.length > 0 ? finances.casesSold / orders.length : null,
    };
  }, [orders, orderItems, finances]);

  // ── Flavor / flavorset stats ──
  const flavorStats = useMemo(() => {
    const fsProd = {}, fsSales = {};
    shifts.forEach((s) => { if (s.flavorset_id && s.flavorset_cases) fsProd[s.flavorset_id] = (fsProd[s.flavorset_id] || 0) + s.flavorset_cases; });
    (orderItems || []).forEach((i) => { if (i.item_type === "flavorset" && i.flavorset_id) fsSales[i.flavorset_id] = (fsSales[i.flavorset_id] || 0) + Math.round(i.cases || 0); });
    const fsRows = flavorSets.map((fs) => ({ id: fs.id, name: fs.name, color: fs.color, prod: fsProd[fs.id] || 0, sales: fsSales[fs.id] || 0 }))
      .sort((a, b) => b.prod - a.prod);

    const flProd = {}, flSales = {};
    shifts.forEach((s) => {
      [1, 2, 3, 4].forEach((n) => {
        const fid = s[`individual_flavor_${n}`];
        const c = s[`individual_flavor_${n}_cases`] || 0;
        if (fid && c) flProd[fid] = (flProd[fid] || 0) + c;
      });
    });
    (orderItems || []).forEach((i) => { if (i.item_type === "individual" && i.flavor_id) flSales[i.flavor_id] = (flSales[i.flavor_id] || 0) + Math.round(i.cases || 0); });
    const flRows = flavors.map((f) => ({ id: f.id, name: f.name, color: f.color, prod: flProd[f.id] || 0, sales: flSales[f.id] || 0 }))
      .sort((a, b) => b.prod - a.prod);

    const flavorCasesMap = {}, flavorColorMap = {};
    flavors.forEach((f) => { flavorCasesMap[f.name] = flProd[f.id] || 0; if (f.color) flavorColorMap[f.name] = f.color; });
    return { fsRows, flRows, flavorCasesMap, flavorColorMap };
  }, [shifts, orderItems, flavorSets, flavors]);

  const palletsOnHand = useMemo(() => (inventory || []).filter((i) => i.flavorset_id), [inventory]);
  const singlesOnHand = useMemo(() => (inventory || []).filter((i) => i.flavor_id), [inventory]);
  const stockCases = useMemo(() => [...palletsOnHand, ...singlesOnHand].reduce((s, i) => s + (i.cases || 0), 0), [palletsOnHand, singlesOnHand]);

  const weeklyData = useMemo(() => getWeeklyProductionData(shifts), [shifts]);
  const individualColor = useMemo(() => localStorage.getItem("individualCasesColor") || "#7c3aed", []);

  const currentYear = new Date().getFullYear();
  const milestone = useMemo(() => {
    let pops = 0, revenue = 0;
    const yr = String(currentYear);
    shifts.forEach((s) => {
      if (parseInt(s.shift_date?.slice(0, 4), 10) !== currentYear) return;
      const c = getTotalCases(s);
      pops += c * (s.popsicles_per_case || pack.popsPerCase);
    });
    orders.forEach((o) => { if (o.pickup_date?.startsWith(yr)) revenue += fnRef.current.orderRevenue(o); });
    return { year: currentYear, yearPops: pops, yearDollars: revenue > 0 ? revenue : null };
  }, [shifts, pack, orders, currentYear]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back to Analytics
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold">The Big Boy Page</h1>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Every metric, number, and comparison in the app — all time.</p>
      </div>

      <OverviewSection
        t={overviewTotals}
        records={records}
        yearRows={yearRows}
        weeklyData={weeklyData}
        weeklyShifts={shifts}
        flavorSets={flavorSets}
        individualColor={individualColor}
        milestone={milestone}
      />

      <ComparisonsSection
        shifts={shifts}
        rates={rates}
        taxRate={taxRate}
        avgCasePrice={avgCasePrice}
        casesSold={finances.casesSold}
        stockCases={stockCases}
        spanDays={totals.spanDays}
      />

      <div className="mb-10">
        <h2 className="font-heading font-semibold text-lg mb-1">Team Performance</h2>
        <p className="text-xs text-muted-foreground mb-4">All time · dream team, top employees, best pairings, position MVPs, MVT, and shift lead leaderboard.</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <DreamTeamCard dreamTeam={dreamTeam} info={INFO.team.dream} />
          <TopEmployeesCard empStats={empEntries} info={INFO.team.topEmployees} />
          <BestPairingsCard shifts={shifts} employees={activeEmployees} info={INFO.team.pairings} />
        </div>
        <PositionMVPsCard shifts={shifts} employees={activeEmployees} packConstants={pack} avgCasePrice={avgCasePrice} info={INFO.team.mvps} />
        <MostValuableTeamCard shifts={shifts} employees={activeEmployees} packConstants={pack} avgCasePrice={avgCasePrice} info={INFO.team.mvt} />
        <div className="mt-6">
          <ShiftLeadCompetitionCard shifts={shifts} employees={activeEmployees} periodLabel="All Time" info={INFO.team.leads} />
        </div>
      </div>

      <EmployeeSection rows={empRows} avgCasePrice={avgCasePrice} />

      <FinancialSection finances={finances} monthlyRows={monthlyRows} taxRate={taxRate} />

      <div className="mb-10">
        <PayPeriodsCard employees={employees} rates={rates} timeEntries={timeEntries} taxRate={taxRate} info={INFO.team.payPeriods} />
      </div>

      <SalesSection sales={sales} finances={finances} totalCasesProduced={totals.cases} />

      <FlavorSection
        flavorStats={flavorStats}
        palletsOnHand={palletsOnHand}
        singlesOnHand={singlesOnHand}
        flavorSets={flavorSets}
        avgCasePrice={avgCasePrice}
      />

      <div className="mb-6">
        <InventoryValueCard info={INFO.team.inventoryValue} />
      </div>
    </div>
  );
}