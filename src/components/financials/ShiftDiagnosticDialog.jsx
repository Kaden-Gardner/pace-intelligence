import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { getTotalCases } from "@/lib/analyticsHelpers";
import { Stethoscope, Activity, DollarSign, Package, TrendingUp, AlertTriangle, Clock, Gauge, Calendar, Users } from "lucide-react";

function fmt$(n) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtHours(h) {
  if (!h) return "0h";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}
function fmtDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

function StatTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="font-heading font-bold text-xl" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, height = 200 }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <p className="text-sm font-medium mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = { borderRadius: "0.75rem", fontSize: 12 };

export default function ShiftDiagnosticDialog({
  productionShifts = [],
  baseMixShifts = [],
  calcShiftCost,
  calcBaseMixSupplyCost,
  calcProductionSupplyCost,
  calcWasteInfo,
  orders = [],
  triggerLabel = "Diagnostic",
}) {
  const [open, setOpen] = useState(false);

  // Month selection: store as { year, month } (month is 0-indexed)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });

  // Build a list of the last 24 months (most recent first)
  const monthOptions = useMemo(() => {
    const opts = [];
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({ year: d.getFullYear(), month: d.getMonth(), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const financialMode = !!calcShiftCost;

  const summaries = useMemo(() => {
    const inRange = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr + "T12:00:00");
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
    };

    const all = [
      ...productionShifts.map((s) => ({ ...s, _type: "production" })),
      ...baseMixShifts.map((s) => ({ ...s, _type: "basemix" })),
    ].filter((s) => inRange(s.shift_date));

    const pricedOrders = orders.filter((o) => o.is_priced && o.case_sell_price > 0);
    const avgCasePrice = pricedOrders.length > 0
      ? pricedOrders.reduce((sum, o) => sum + o.case_sell_price, 0) / pricedOrders.length
      : null;

    return all
      .map((s) => {
        const isBaseMix = s._type === "basemix";
        const laborCost = financialMode ? calcShiftCost(s, isBaseMix) : 0;
        const supplyCost = financialMode
          ? (isBaseMix ? calcBaseMixSupplyCost(s) : calcProductionSupplyCost(s))
          : 0;
        const totalCost = financialMode ? laborCost + supplyCost : null;
        const cases = isBaseMix ? null : getTotalCases(s);
        const shiftHours = s.shift_duration || 8;
        const casesPerHour = !isBaseMix && cases != null && shiftHours > 0 ? cases / shiftHours : null;
        const predictedRevenue = (financialMode && !isBaseMix && cases > 0 && avgCasePrice) ? avgCasePrice * cases : null;
        const profitRatio = predictedRevenue && totalCost > 0 ? predictedRevenue / totalCost : null;
        const waste = financialMode && !isBaseMix && calcWasteInfo ? calcWasteInfo(s) : null;
        const downtimeHours = isBaseMix ? 0 : parseDowntimeHours(s.downtime);
        const wasteGallons = isBaseMix ? 0 : (s.waste || 0);

        let empIds = [];
        if (isBaseMix) {
          [s.mixer_1, s.mixer_2, s.mixer_3, s.shift_lead].forEach((id) => { if (id) empIds.push(id); });
        } else {
          [s.filling_employee, s.pulling_employee_1, s.pulling_employee_2, s.pulling_employee_3,
           s.sorting_employee, s.bagging_employee, s.boxing_employee, s.shift_lead].forEach((id) => { if (id) empIds.push(id); });
          if (s.training_employees) empIds.push(...s.training_employees);
        }
        empIds = [...new Set(empIds)].filter(Boolean);

        return {
          s,
          isBaseMix,
          laborCost,
          supplyCost,
          totalCost,
          cases,
          casesPerHour,
          predictedRevenue,
          profitRatio,
          waste,
          wasteCost: waste?.totalWasteCost || 0,
          downtimeHours,
          wasteGallons,
          empCount: empIds.length,
          date: s.shift_date,
          label: fmtDate(s.shift_date) + (isBaseMix ? " BM" : ""),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedMonth, productionShifts, baseMixShifts, financialMode, calcShiftCost, calcBaseMixSupplyCost, calcProductionSupplyCost, calcWasteInfo, orders]);

  const totals = useMemo(() => {
    const totalLabor = summaries.reduce((a, b) => a + b.laborCost, 0);
    const totalSupply = summaries.reduce((a, b) => a + b.supplyCost, 0);
    const totalCombined = totalLabor + totalSupply;
    const totalCases = summaries.reduce((a, b) => a + (b.cases || 0), 0);
    const totalPredictedRev = summaries.reduce((a, b) => a + (b.predictedRevenue || 0), 0);
    const totalWasteCost = summaries.reduce((a, b) => a + b.wasteCost, 0);
    const totalDowntime = summaries.reduce((a, b) => a + b.downtimeHours, 0);
    const totalWasteGallons = summaries.reduce((a, b) => a + b.wasteGallons, 0);
    const prodShifts = summaries.filter((s) => !s.isBaseMix);
    const totalProdHours = prodShifts.reduce((a, b) => a + (b.s.shift_duration || 0), 0);
    const avgCasesPerHour = totalProdHours > 0 ? totalCases / totalProdHours : 0;
    const avgCostPerCase = totalCases > 0 ? totalCombined / totalCases : null;
    const ratioShifts = summaries.filter((s) => s.profitRatio != null);
    const avgProfitRatio = ratioShifts.length > 0 ? ratioShifts.reduce((a, b) => a + b.profitRatio, 0) / ratioShifts.length : null;
    const profitableShifts = ratioShifts.filter((s) => s.profitRatio >= 1).length;
    const avgShiftCost = summaries.length > 0 ? totalCombined / summaries.length : 0;
    const avgEmpCount = prodShifts.length > 0 ? prodShifts.reduce((a, b) => a + b.empCount, 0) / prodShifts.length : 0;
    return {
      totalLabor, totalSupply, totalCombined, totalCases, totalPredictedRev,
      totalWasteCost, totalDowntime, totalWasteGallons, avgCasesPerHour, avgCostPerCase,
      avgProfitRatio, profitableShifts, ratioShiftCount: ratioShifts.length,
      avgShiftCost, prodShiftCount: prodShifts.length,
      baseMixCount: summaries.length - prodShifts.length, avgEmpCount,
    };
  }, [summaries]);

  const costData = summaries.map((x) => ({ label: x.label, Labor: parseFloat(x.laborCost.toFixed(2)), Supplies: parseFloat(x.supplyCost.toFixed(2)) }));
  const casesData = summaries.filter((x) => !x.isBaseMix).map((x) => ({ label: x.label, Cases: x.cases || 0 }));
  const ratioData = summaries.filter((x) => x.profitRatio != null).map((x) => ({ label: x.label, Ratio: parseFloat(x.profitRatio.toFixed(2)) }));
  const speedData = summaries.filter((x) => x.casesPerHour != null).map((x) => ({ label: x.label, Speed: parseFloat(x.casesPerHour.toFixed(1)) }));
  const wasteCostData = summaries.filter((x) => !x.isBaseMix && x.wasteCost > 0).map((x) => ({ label: x.label, Waste: parseFloat(x.wasteCost.toFixed(2)) }));
  const wasteGalData = summaries.filter((x) => !x.isBaseMix && x.wasteGallons > 0).map((x) => ({ label: x.label, Gallons: x.wasteGallons }));
  const downtimeData = summaries.filter((x) => !x.isBaseMix && x.downtimeHours > 0).map((x) => ({ label: x.label, Downtime: parseFloat(x.downtimeHours.toFixed(2)) }));
  const empData = summaries.filter((x) => !x.isBaseMix).map((x) => ({ label: x.label, Crew: x.empCount }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
          <Stethoscope className="w-4 h-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" /> Shift Diagnostic
          </DialogTitle>
        </DialogHeader>

        {/* Month selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={`${selectedMonth.year}-${selectedMonth.month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                setSelectedMonth({ year: y, month: m });
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {monthOptions.map((opt) => (
                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {monthOptions.slice(0, 6).map((opt) => (
              <button
                key={`${opt.year}-${opt.month}`}
                onClick={() => setSelectedMonth({ year: opt.year, month: opt.month })}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selectedMonth.year === opt.year && selectedMonth.month === opt.month ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {MONTH_NAMES[opt.month].slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground ml-auto">
            {summaries.length} shifts · {totals.prodShiftCount} production · {totals.baseMixCount} base mix
          </p>
        </div>

        {!financialMode && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
            <span>ℹ️</span>
            <p>Production-only diagnostic — cost & revenue charts appear when launched from the Financials page.</p>
          </div>
        )}

        {summaries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No shifts in {MONTH_NAMES[selectedMonth.month]} {selectedMonth.year}.</p>
          </div>
        ) : (
          <>
            {/* Summary stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {financialMode && (
                <>
                  <StatTile icon={DollarSign} label="Total Labor Cost" value={fmt$(totals.totalLabor)} sub={`${summaries.length} shifts`} />
                  <StatTile icon={Package} label="Total Supply Cost" value={fmt$(totals.totalSupply)} sub="materials + ingredients" />
                  <StatTile icon={DollarSign} label="Total Combined Cost" value={fmt$(totals.totalCombined)} sub="labor + supplies" />
                  <StatTile icon={DollarSign} label="Avg Cost Per Shift" value={fmt$(totals.avgShiftCost)} sub={`avg of ${summaries.length}`} />
                  <StatTile icon={DollarSign} label="Avg Cost Per Case" value={totals.avgCostPerCase != null ? fmt$(totals.avgCostPerCase) : "—"} sub="combined ÷ cases" />
                  <StatTile icon={TrendingUp} label="Predicted Revenue" value={fmt$(totals.totalPredictedRev)} sub="avg price × cases" />
                  <StatTile icon={Gauge} label="Avg Profit Ratio" value={totals.avgProfitRatio != null ? `${totals.avgProfitRatio.toFixed(2)}×` : "—"} sub={`${totals.profitableShifts}/${totals.ratioShiftCount} profitable`} color={totals.avgProfitRatio != null && totals.avgProfitRatio >= 1 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"} />
                  <StatTile icon={AlertTriangle} label="Total Waste Cost" value={fmt$(totals.totalWasteCost)} sub="materials + downtime" color="hsl(var(--destructive))" />
                </>
              )}
              <StatTile icon={Package} label="Total Cases Produced" value={totals.totalCases.toLocaleString()} sub="production shifts" />
              <StatTile icon={Activity} label="Avg Cases / Hour" value={totals.avgCasesPerHour > 0 ? totals.avgCasesPerHour.toFixed(1) : "—"} sub="production speed" />
              <StatTile icon={AlertTriangle} label="Waste (Gallons)" value={totals.totalWasteGallons.toFixed(1)} sub="popsicle punch" color="hsl(var(--destructive))" />
              <StatTile icon={Clock} label="Total Downtime" value={fmtHours(totals.totalDowntime)} sub="across all shifts" />
              <StatTile icon={Users} label="Avg Crew Size" value={totals.avgEmpCount > 0 ? totals.avgEmpCount.toFixed(1) : "—"} sub="per production shift" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {financialMode && (
                <ChartCard title="Shift Cost Over Time">
                  <BarChart data={costData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} width={55} />
                    <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Labor" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Supplies" stackId="a" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartCard>
              )}

              <ChartCard title="Cases Produced Over Time">
                {casesData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No production shifts in range.</p>
                ) : (
                  <BarChart data={casesData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={45} />
                    <Tooltip formatter={(v) => [`${v} cases`, "Cases"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="Cases" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ChartCard>

              {financialMode && (
                <ChartCard title="Profit Ratio Over Time">
                  {ratioData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No profit data available.</p>
                  ) : (
                    <LineChart data={ratioData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} />
                      <Tooltip formatter={(v) => `${v.toFixed(2)}×`} contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="Ratio" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  )}
                </ChartCard>
              )}

              <ChartCard title="Production Speed (cases/hr)">
                {speedData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No production data.</p>
                ) : (
                  <LineChart data={speedData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} />
                    <Tooltip formatter={(v) => `${v.toFixed(1)} cases/hr`} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="Speed" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                )}
              </ChartCard>

              {financialMode ? (
                <ChartCard title="Waste Cost Over Time">
                  {wasteCostData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No waste recorded in range.</p>
                  ) : (
                    <BarChart data={wasteCostData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} width={55} />
                      <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={tooltipStyle} />
                      <Bar dataKey="Waste" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ChartCard>
              ) : (
                <ChartCard title="Waste Gallons Over Time">
                  {wasteGalData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No waste recorded in range.</p>
                  ) : (
                    <BarChart data={wasteGalData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} />
                      <Tooltip formatter={(v) => [`${v} gal`, "Waste"]} contentStyle={tooltipStyle} />
                      <Bar dataKey="Gallons" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ChartCard>
              )}

              <ChartCard title="Downtime Hours Over Time">
                {downtimeData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No downtime recorded in range.</p>
                ) : (
                  <BarChart data={downtimeData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} />
                    <Tooltip formatter={(v) => [`${v} hrs`, "Downtime"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="Downtime" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ChartCard>

              <ChartCard title="Crew Size Over Time">
                {empData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No production data.</p>
                ) : (
                  <BarChart data={empData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={40} allowDecimals={false} />
                    <Tooltip formatter={(v) => [`${v} people`, "Crew"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="Crew" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ChartCard>
            </div>

            {/* Per-shift table */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <p className="text-sm font-medium mb-3">Per-Shift Breakdown</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                      {financialMode && <th className="py-2 pr-3 font-medium text-right">Labor</th>}
                      {financialMode && <th className="py-2 pr-3 font-medium text-right">Supplies</th>}
                      {financialMode && <th className="py-2 pr-3 font-medium text-right">Total</th>}
                      <th className="py-2 pr-3 font-medium text-right">Cases</th>
                      <th className="py-2 pr-3 font-medium text-right">Cases/hr</th>
                      {financialMode && <th className="py-2 pr-3 font-medium text-right">Pred. Rev</th>}
                      {financialMode && <th className="py-2 pr-3 font-medium text-right">Ratio</th>}
                      <th className="py-2 pr-3 font-medium text-right">Waste gal</th>
                      <th className="py-2 pr-3 font-medium text-right">Down</th>
                      <th className="py-2 pr-3 font-medium text-right">Crew</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...summaries].reverse().map((x, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-3">{x.label}</td>
                        <td className="py-2 pr-3">{x.isBaseMix ? "Base Mix" : "Production"}</td>
                        {financialMode && <td className="py-2 pr-3 text-right">{fmt$(x.laborCost)}</td>}
                        {financialMode && <td className="py-2 pr-3 text-right">{fmt$(x.supplyCost)}</td>}
                        {financialMode && <td className="py-2 pr-3 text-right font-medium">{fmt$(x.totalCost)}</td>}
                        <td className="py-2 pr-3 text-right">{x.cases != null ? x.cases : "—"}</td>
                        <td className="py-2 pr-3 text-right">{x.casesPerHour != null ? x.casesPerHour.toFixed(1) : "—"}</td>
                        {financialMode && <td className="py-2 pr-3 text-right">{x.predictedRevenue != null ? fmt$(x.predictedRevenue) : "—"}</td>}
                        <td className="py-2 pr-3 text-right" style={x.profitRatio != null && x.profitRatio >= 1 ? { color: "hsl(var(--chart-3))" } : { color: "hsl(var(--destructive))" }}>
                          {x.profitRatio != null ? `${x.profitRatio.toFixed(2)}×` : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">{x.wasteGallons > 0 ? x.wasteGallons : "—"}</td>
                        <td className="py-2 pr-3 text-right">{x.downtimeHours > 0 ? fmtHours(x.downtimeHours) : "—"}</td>
                        <td className="py-2 pr-3 text-right">{x.empCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}