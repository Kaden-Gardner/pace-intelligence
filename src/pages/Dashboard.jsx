import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart3, Users, Package, TrendingUp, Award, Trash2 } from "lucide-react";
import StatCard from "../components/StatCard";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import DreamTeamCard from "../components/dashboard/DreamTeamCard";
import TopEmployeesCard from "../components/dashboard/TopEmployeesCard";
import BestPairingsCard from "../components/dashboard/BestPairingsCard";
import FlavorBreakdownCard from "../components/dashboard/FlavorBreakdownCard";
import EmptyState from "../components/EmptyState";
import {
  getTotalCases,
  getCasesPerHour,
  computeEmployeeStats,
  findDreamTeam,
  getWeeklyProductionData,
} from "../lib/analyticsHelpers";

export default function Dashboard() {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [s, e, f] = await Promise.all([
        base44.entities.Shift.list("-shift_date", 500),
        base44.entities.Employee.list(),
        base44.entities.Flavor.list(),
      ]);
      setShifts(s);
      setEmployees(e);
      setFlavors(f);
      setLoading(false);
    }
    load();
  }, []);

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

  const totalCases = shifts.reduce((sum, s) => sum + getTotalCases(s), 0);
  const totalHours = shifts.reduce((sum, s) => sum + (s.shift_duration || 0), 0);
  const avgCph = totalHours > 0 ? totalCases / totalHours : 0;
  const totalWaste = shifts.reduce((sum, s) => sum + (s.waste || 0), 0);
  const weeklyData = getWeeklyProductionData(shifts);

  // Individual flavor breakdown
  const flavorMap = {};
  flavors.forEach(f => { flavorMap[f.id] = f.name; });
  
  const flavorCases = {};
  shifts.forEach((s) => {
    [
      [s.individual_flavor_1, s.individual_flavor_1_cases],
      [s.individual_flavor_2, s.individual_flavor_2_cases],
      [s.individual_flavor_3, s.individual_flavor_3_cases],
      [s.individual_flavor_4, s.individual_flavor_4_cases],
    ].forEach(([flavorId, cases]) => {
      if (flavorId && cases) {
        const name = flavorMap[flavorId] || flavorId;
        flavorCases[name] = (flavorCases[name] || 0) + cases;
      }
    });
  });

  const empStats = computeEmployeeStats(shifts, employees);
  const dreamTeam = findDreamTeam(shifts, employees);

  // Top employee by CPH
  const empEntries = Object.values(empStats).filter((s) => s.totalHours > 0);
  empEntries.sort((a, b) => (b.totalCases / b.totalHours) - (a.totalCases / a.totalHours));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Production analytics at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Cases" value={totalCases.toLocaleString()} subtitle="Annual production" icon={Package} />
        <StatCard title="Avg Cases/Hour" value={avgCph.toFixed(1)} subtitle="Across all shifts" icon={TrendingUp} />
        <StatCard title="Total Shifts" value={shifts.length} subtitle={`${employees.length} employees`} icon={BarChart3} />
        <StatCard title="Total Waste" value={totalWaste.toLocaleString()} subtitle="Gallons wasted" icon={Trash2} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2">
          <WeeklyChart data={weeklyData} />
        </div>
        <DreamTeamCard dreamTeam={dreamTeam} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopEmployeesCard empStats={empEntries} />
        <BestPairingsCard shifts={shifts} employees={employees} />
      </div>

      <div className="mt-6">
        <FlavorBreakdownCard flavorCases={flavorCases} />
      </div>
    </div>
  );
}