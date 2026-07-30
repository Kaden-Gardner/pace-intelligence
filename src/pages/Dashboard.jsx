import { useState, useEffect, useMemo } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { base44 } from "@/api/base44Client";
import { BarChart3, Users, Package, TrendingUp, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useRateUnit, formatRate } from "@/hooks/useRateUnit";
import StatCard from "../components/StatCard";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import DreamTeamCard from "../components/dashboard/DreamTeamCard";
import TopEmployeesCard from "../components/dashboard/TopEmployeesCard";
import BestPairingsCard from "../components/dashboard/BestPairingsCard";
import ShiftLeadCompetitionCard from "../components/dashboard/ShiftLeadCompetitionCard";
import FlavorBreakdownCard from "../components/dashboard/FlavorBreakdownCard";
import EmptyState from "../components/EmptyState";
import {
  getTotalCases,
  computeEmployeeStats,
  findDreamTeam,
  getWeeklyProductionData,
} from "../lib/analyticsHelpers";

const PERIODS = [
  { label: "All Time", key: "all" },
  { label: "Past Year", key: "year" },
  { label: "Past Month", key: "month" },
  { label: "Past Week", key: "week" },
  { label: "Last Shift", key: "shift" },
];

function filterShiftsByPeriod(shifts, period) {
  if (period === "all") return shifts;
  if (period === "shift") {
    if (shifts.length === 0) return [];
    const latest = shifts[0].shift_date;
    return shifts.filter((s) => s.shift_date === latest);
  }
  const now = new Date();
  const cutoff = new Date();
  if (period === "year") cutoff.setFullYear(now.getFullYear() - 1);
  else if (period === "month") cutoff.setMonth(now.getMonth() - 1);
  else if (period === "week") cutoff.setDate(now.getDate() - 7);
  return shifts.filter((s) => new Date(s.shift_date) >= cutoff);
}

export default function Dashboard() {
  const [period, setPeriod] = useState("year");
  const [isPpm, setIsPpm] = useRateUnit();
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [rates, setRates] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [s, e, f, fs, inv, te, rt, ord] = await Promise.all([
      base44.entities.Shift.list("-shift_date", 500),
      base44.entities.Employee.list(),
      base44.entities.Flavor.list(),
      base44.entities.FlavorSet.list("name"),
      base44.entities.Inventory.list(),
      base44.entities.TimeEntry.list("-clock_in", 2000),
      base44.entities.EmployeeRate.list(),
      base44.entities.OrderPickup.list("-pickup_date", 500),
    ]);
    setShifts(s);
    setEmployees(e);
    setFlavors(f);
    setFlavorSets(fs);
    setInventory(inv);
    setTimeEntries(te);
    setRates(rt);
    setOrders(ord);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  // Team performance always uses all shifts — only active, non-terminated employees (not affected by period)
  const activeEmployees = useMemo(() => employees.filter((e) => e.active !== false && !e.terminated), [employees]);
  const empStats = useMemo(() => computeEmployeeStats(shifts, activeEmployees), [shifts, activeEmployees]);
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);
  const rateMap = useMemo(() => Object.fromEntries(rates.map((r) => [r.employee_id, r])), [rates]);
  const avgCasePrice = useMemo(() => {
    const priced = orders.filter((o) => o.is_priced && o.case_sell_price > 0);
    return priced.length > 0 ? priced.reduce((sum, o) => sum + o.case_sell_price, 0) / priced.length : null;
  }, [orders]);
  const dreamTeam = useMemo(
    () => findDreamTeam(shifts, activeEmployees, { empMap, rateMap, timeEntries, avgCasePrice }),
    [shifts, activeEmployees, empMap, rateMap, timeEntries, avgCasePrice]
  );
  const empEntries = useMemo(() => {
    const entries = Object.values(empStats).filter((s) => s.totalHours > 0);
    entries.sort((a, b) => (b.totalCases / b.totalHours) - (a.totalCases / a.totalHours));
    return entries;
  }, [empStats]);

  // Period-filtered data (recomputes only when period or shifts change)
  const periodShifts = useMemo(() => filterShiftsByPeriod(shifts, period), [shifts, period]);
  const { totalCases, totalHours, avgCph, totalWaste, totalPopsicles } = useMemo(() => {
    const totalCases = periodShifts.reduce((sum, s) => sum + getTotalCases(s), 0);
    const totalHours = periodShifts.reduce((sum, s) => sum + (s.shift_duration || 0), 0);
    const totalWaste = periodShifts.reduce((sum, s) => sum + (s.waste || 0), 0);
    const totalPopsicles = periodShifts.reduce((sum, s) => {
      const ppc = s.popsicles_per_case || 144;
      return sum + getTotalCases(s) * ppc;
    }, 0);
    return { totalCases, totalHours, avgCph: totalHours > 0 ? totalCases / totalHours : 0, totalWaste, totalPopsicles };
  }, [periodShifts]);

  const weeklyData = useMemo(() => getWeeklyProductionData(periodShifts), [periodShifts]);
  const individualColor = useMemo(() => localStorage.getItem("individualCasesColor") || "#7c3aed", []);

  const { flavorMap, flavorColorMap } = useMemo(() => {
    const fm = {};
    const fcm = {};
    flavors.forEach(f => { fm[f.id] = f.name; if (f.color) fcm[f.name] = f.color; });
    return { flavorMap: fm, flavorColorMap: fcm };
  }, [flavors]);

  const flavorCases = useMemo(() => {
    const fc = {};
    periodShifts.forEach((s) => {
      [
        [s.individual_flavor_1, s.individual_flavor_1_cases],
        [s.individual_flavor_2, s.individual_flavor_2_cases],
        [s.individual_flavor_3, s.individual_flavor_3_cases],
        [s.individual_flavor_4, s.individual_flavor_4_cases],
      ].forEach(([flavorId, cases]) => {
        if (flavorId && cases) {
          const name = flavorMap[flavorId] || flavorId;
          fc[name] = (fc[name] || 0) + cases;
        }
      });
    });
    return fc;
  }, [periodShifts, flavorMap]);

  const palletInventory = useMemo(
    () => inventory.filter((inv) => inv.flavorset_id && flavorSets.some((fs) => fs.id === inv.flavorset_id)),
    [inventory, flavorSets]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div>
        <h1 className="font-heading text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground mb-8">Production analytics at a glance</p>
        <EmptyState
          icon={BarChart3}
          title="No shift data yet"
          description="Start by adding your first shift to see production analytics and insights."
          actionLabel="Add First Shift"
          actionTo="/shifts/new"
        />
      </div>
    );
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || "";

  return (
    <div className="space-y-8">
      {/* Header + Global Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Production analytics at a glance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Total Production */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Production</p>
        <p className="text-5xl font-heading font-bold">{totalPopsicles.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground mt-1">Popsicles produced · {periodLabel}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Cases" value={totalCases.toLocaleString()} subtitle={periodLabel} icon={Package} />
        <StatCard
          title={isPpm ? "Avg Pops / Min" : "Avg Cases / Hour"}
          value={formatRate(avgCph, isPpm).value}
          subtitle={
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cases/hr</span>
              <Switch checked={isPpm} onCheckedChange={setIsPpm} className="scale-75" />
              <span className="text-xs text-muted-foreground">Pops/min</span>
            </span>
          }
          icon={TrendingUp}
        />
        <StatCard title="Total Shifts" value={periodShifts.length} subtitle={`${employees.length} employees`} icon={BarChart3} />
        <StatCard title="Total Waste" value={`${totalWaste.toLocaleString()} gal`} subtitle="Gallons wasted" icon={Trash2} />
      </div>

      {/* Weekly Production Column Chart */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Weekly Production</p>
        <WeeklyChart data={weeklyData} shifts={periodShifts} flavorSets={flavorSets} individualColor={individualColor} />
      </div>

      {/* Flavor Breakdown Pie Chart */}
      <div>
        <h2 className="font-heading font-semibold text-lg mb-4">Individual Flavors</h2>
        <FlavorBreakdownCard flavorCases={flavorCases} flavorColorMap={flavorColorMap} />
      </div>

      {/* Inventory Summary */}
      {palletInventory.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg mb-4">Inventory — Pallets on Hand</h2>
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {palletInventory.map((inv) => {
                const fs = flavorSets.find((f) => f.id === inv.flavorset_id);
                const pallets = Math.floor((inv.cases || 0) / 66);
                const remainder = (inv.cases || 0) % 66;
                return (
                  <div key={inv.id} className="bg-muted rounded-xl p-4 text-center">
                    <p className="text-3xl font-heading font-bold">{pallets}</p>
                    <p className="text-xs font-medium mt-1 flex items-center justify-center gap-1">
                      {fs?.color && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                      {fs?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">{inv.cases} cases</p>
                    {remainder > 0 && <p className="text-xs text-muted-foreground">+{remainder} partial</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Team Performance — always all-time */}
      <div>
        <h2 className="font-heading font-semibold text-lg mb-1">Team Performance</h2>
        <p className="text-xs text-muted-foreground mb-4">All time · not affected by period filter</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DreamTeamCard dreamTeam={dreamTeam} />
          <TopEmployeesCard empStats={empEntries} />
          <BestPairingsCard shifts={shifts} employees={employees} />
        </div>
      </div>

      {/* Supervisor Friendly Competition */}
      <ShiftLeadCompetitionCard shifts={periodShifts} employees={activeEmployees} periodLabel={periodLabel} />
    </div>
  );
}