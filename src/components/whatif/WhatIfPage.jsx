import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Sparkles, Gauge, DollarSign, Users, Flame, Timer, Package } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { fmt$, fmtInt, fmtNum } from "@/components/bigboy/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ChartTooltip({ active, payload, label, currency = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 text-xs shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-medium">
          {p.name}: {currency ? fmt$(p.value) : fmtInt(p.value)}
        </p>
      ))}
    </div>
  );
}

function Tile({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`font-heading font-bold text-lg ${accent || ""}`}>{value}</p>
    </div>
  );
}

export default function WhatIfPage({ timeframe, weekdays, hoursPerDay, averages, onBack, onRestart }) {
  const { weeks, isOneWeek } = timeframe;
  const a = averages;

  // Per-weekday predictions. Crew size is a whole number, pulled from the
  // historical average crew on that weekday (falling back to the overall avg).
  const perDay = useMemo(() => {
    return weekdays.map((wd) => {
      const crew = a.crewByDay[wd] || Math.round(a.avgCrewSize);
      const shifts = isOneWeek ? 1 : Math.round(weeks);
      const cases = shifts * hoursPerDay * a.avgCasesPerHour;
      const labor = shifts * (crew * a.avgWage * hoursPerDay + a.overheadPerShift);
      const supply = cases * a.avgSupplyPerCase;
      const revenue = a.avgCasePrice != null ? cases * a.avgCasePrice : null;
      const profit = revenue != null ? revenue - labor - supply : null;
      const waste = shifts * a.avgWastePerShift;
      const downtime = shifts * a.avgDowntimePerShift;
      return { wd, label: WEEKDAYS[wd], crew, shifts, cases, labor, supply, revenue, profit, waste, downtime };
    }).sort((x, y) => x.wd - y.wd);
  }, [weekdays, hoursPerDay, a, weeks, isOneWeek]);

  const totals = useMemo(() => {
    const t = perDay.reduce((acc, d) => {
      acc.shifts += d.shifts;
      acc.cases += d.cases;
      acc.labor += d.labor;
      acc.supply += d.supply;
      acc.revenue += d.revenue || 0;
      acc.profit += d.profit || 0;
      acc.waste += d.waste;
      acc.downtime += d.downtime;
      acc.crewWeighted += d.crew * d.shifts;
      return acc;
    }, { shifts: 0, cases: 0, labor: 0, supply: 0, revenue: 0, profit: 0, waste: 0, downtime: 0, crewWeighted: 0 });
    return { ...t, avgCrew: t.shifts > 0 ? t.crewWeighted / t.shifts : 0 };
  }, [perDay]);

  const hasRevenue = a.avgCasePrice != null;

  // Cumulative time series across the timeframe.
  const series = useMemo(() => {
    let chunks;
    if (isOneWeek) chunks = totals.shifts; // per working shift/day
    else if (weeks <= 52) chunks = Math.max(1, Math.round(weeks)); // per week
    else chunks = Math.max(1, Math.round(weeks / (52 / 12))); // per month
    const perChunkProfit = totals.profit / chunks;
    const perChunkCases = totals.cases / chunks;
    const perChunkRevenue = totals.revenue / chunks;
    const rows = [];
    let cumP = 0, cumC = 0, cumR = 0;
    for (let i = 1; i <= chunks; i++) {
      cumP += perChunkProfit;
      cumC += perChunkCases;
      cumR += perChunkRevenue;
      const label = isOneWeek ? `Shift ${i}` : weeks <= 52 ? `Wk ${i}` : `Mo ${i}`;
      rows.push({ label, cumProfit: Math.round(cumP), cumCases: Math.round(cumC), cumRevenue: Math.round(cumR) });
    }
    return rows;
  }, [totals, weeks, isOneWeek]);

  const casesByDay = perDay.map((d) => ({ label: d.label, cases: Math.round(d.cases) }));
  const crewByDay = perDay.map((d) => ({ label: d.label, crew: d.crew }));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back to Analytics
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold">What If — {timeframe.label}</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={onRestart}>
          <RotateCcw className="w-4 h-4" /> New Scenario
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-6">
        Projecting {totals.shifts} shifts over {timeframe.label.toLowerCase()} · {weekdays.length} day(s)/week × {fmtNum(hoursPerDay, 1)}h · {fmtNum(a.avgCasesPerHour, 1)} cases/hr avg speed · {fmt$(a.avgWage)}/hr avg wage.
      </p>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <Tile icon={Package} label="Predicted Cases" value={fmtInt(totals.cases)} accent="text-primary" />
        <Tile icon={DollarSign} label="Predicted Revenue" value={hasRevenue ? fmt$(totals.revenue) : "—"} />
        <Tile icon={DollarSign} label="Predicted Labor" value={fmt$(totals.labor)} />
        <Tile icon={DollarSign} label="Predicted Profit" value={hasRevenue ? fmt$(totals.profit) : "—"} accent={totals.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} />
        <Tile icon={Flame} label="Predicted Waste" value={`${fmtNum(totals.waste, 1)} gal`} accent="text-orange-600 dark:text-orange-400" />
        <Tile icon={Timer} label="Predicted Downtime" value={`${fmtNum(totals.downtime, 1)} hrs`} accent="text-amber-600 dark:text-amber-400" />
        <Tile icon={Users} label="Avg Crew Size" value={`${Math.round(totals.avgCrew)} ppl`} />
        <Tile icon={Gauge} label="Avg Speed" value={`${fmtNum(a.avgCasesPerHour, 1)} cph`} />
      </div>

      {/* Per-weekday predictions table */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6 overflow-x-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Day-by-Day Predictions</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left border-b border-border">
              <th className="py-2 pr-4 font-medium">Weekday</th>
              <th className="py-2 pr-4 font-medium">Crew</th>
              <th className="py-2 pr-4 font-medium">Shifts</th>
              <th className="py-2 pr-4 font-medium">Cases</th>
              <th className="py-2 pr-4 font-medium">Labor</th>
              {hasRevenue && <th className="py-2 pr-4 font-medium">Revenue</th>}
              {hasRevenue && <th className="py-2 pr-4 font-medium">Profit</th>}
              <th className="py-2 pr-4 font-medium">Waste (gal)</th>
              <th className="py-2 pr-4 font-medium">Downtime (h)</th>
            </tr>
          </thead>
          <tbody>
            {perDay.map((d) => (
              <tr key={d.wd} className="border-b border-border/50">
                <td className="py-2 pr-4 font-medium">{d.label}</td>
                <td className="py-2 pr-4">{d.crew}</td>
                <td className="py-2 pr-4">{d.shifts}</td>
                <td className="py-2 pr-4">{fmtInt(d.cases)}</td>
                <td className="py-2 pr-4">{fmt$(d.labor)}</td>
                {hasRevenue && <td className="py-2 pr-4">{fmt$(d.revenue)}</td>}
                {hasRevenue && (
                  <td className={`py-2 pr-4 font-semibold ${d.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {fmt$(d.profit)}
                  </td>
                )}
                <td className="py-2 pr-4">{fmtNum(d.waste, 1)}</td>
                <td className="py-2 pr-4">{fmtNum(d.downtime, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Cumulative {hasRevenue ? "Profit" : "Cases"} Over Time
          </p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="whatifGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} className="text-muted-foreground" />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey={hasRevenue ? "cumProfit" : "cumCases"} name={hasRevenue ? "Cumulative Profit" : "Cumulative Cases"} stroke="#10b981" strokeWidth={2} fill="url(#whatifGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Predicted Cases per Weekday</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={casesByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip content={<ChartTooltip currency={false} />} />
                <Bar dataKey="cases" name="Cases" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Predicted Crew Size per Weekday</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crewByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} className="text-muted-foreground" />
                <Tooltip content={<ChartTooltip currency={false} />} />
                <Bar dataKey="crew" name="Crew Size" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Projection assumes flat historical averages — no seasonality, growth, price, or cost changes. Crew sizes per weekday come from your historical average crew on that day of week (rounded to whole people).
      </p>
    </div>
  );
}