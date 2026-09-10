import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { format, addMonths } from "date-fns";
import { fmtInt, fmt$, fmtNum } from "@/components/bigboy/format";

const WEEKS_PER_MONTH = 52 / 12; // ≈ 4.333
const MONTHS = 24;

function ChartTooltip({ active, payload, label, isCurrency = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 text-xs shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-medium">
          {p.name}: {isCurrency ? fmt$(p.value) : fmtInt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function TwoYearProjectionDialog({ averages }) {
  const [open, setOpen] = useState(false);
  const { avgCasesPerHour, avgSalePrice, costPerCase, avgShiftHours, shiftsPerWeek } = averages;

  const defaultHours = (shiftsPerWeek && avgShiftHours) ? shiftsPerWeek * avgShiftHours : 40;
  const [hoursPerWeek, setHoursPerWeek] = useState(Math.round(defaultHours * 10) / 10);

  const ready = avgCasesPerHour > 0 && avgSalePrice != null && costPerCase != null;

  const projection = useMemo(() => {
    if (!ready) return [];
    const casesPerWeek = hoursPerWeek * avgCasesPerHour;
    const casesPerMonth = casesPerWeek * WEEKS_PER_MONTH;
    const revenuePerMonth = casesPerMonth * avgSalePrice;
    const costPerMonth = casesPerMonth * costPerCase;
    const profitPerMonth = revenuePerMonth - costPerMonth;

    const start = new Date();
    let cumProfit = 0, cumRevenue = 0, cumCases = 0;
    const rows = [];
    for (let i = 0; i < MONTHS; i++) {
      const m = addMonths(start, i);
      cumProfit += profitPerMonth;
      cumRevenue += revenuePerMonth;
      cumCases += casesPerMonth;
      rows.push({
        label: format(m, "MMM yy"),
        month: format(m, "MMM"),
        year: format(m, "yy"),
        revenue: Math.round(revenuePerMonth),
        cost: Math.round(costPerMonth),
        profit: Math.round(profitPerMonth),
        cumProfit: Math.round(cumProfit),
        cumRevenue: Math.round(cumRevenue),
        cases: Math.round(casesPerMonth),
        cumCases: Math.round(cumCases),
      });
    }
    return rows;
  }, [ready, hoursPerWeek, avgCasesPerHour, avgSalePrice, costPerCase]);

  const summary = useMemo(() => {
    if (!projection.length) return null;
    const last = projection[projection.length - 1];
    const monthlyProfit = projection[0].profit;
    const margin = last.cumRevenue > 0 ? (last.cumProfit / last.cumRevenue) * 100 : 0;
    return {
      totalProfit: last.cumProfit,
      totalRevenue: last.cumRevenue,
      totalCases: last.cumCases,
      totalHours: hoursPerWeek * 52 * 2,
      monthlyProfit,
      margin,
      casesPerWeek: hoursPerWeek * avgCasesPerHour,
    };
  }, [projection, hoursPerWeek, avgCasesPerHour]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <TrendingUp className="w-4 h-4" /> 2-Year Projection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Two-Year Financial Projection
          </DialogTitle>
          <DialogDescription>
            Predicts the next 24 months from your historical averages. Adjust the weekly hours — everything else is calculated from your real averages.
          </DialogDescription>
        </DialogHeader>

        {!ready ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Not enough data yet. You need priced orders (avg sale price) and recorded shift costs to generate a projection.
          </div>
        ) : (
          <>
            {/* Controls + averages used */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/40 rounded-xl border border-border p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hours per Week (adjustable)</label>
                <div className="flex items-center gap-3 mt-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-28 font-heading font-bold text-lg"
                  />
                  <input
                    type="range"
                    min={0}
                    max={Math.max(120, Math.ceil(hoursPerWeek / 10) * 10 + 20)}
                    step={1}
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Currently averaging {fmtNum(shiftsPerWeek, 1)} shifts/wk × {fmtNum(avgShiftHours, 1)}h = {fmtNum(defaultHours, 1)}h.</p>
              </div>

              <div className="bg-muted/40 rounded-xl border border-border p-4 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Averages Used (from history)</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Cases / hour</span><span className="font-medium text-right">{fmtNum(avgCasesPerHour, 1)}</span>
                  <span className="text-muted-foreground">Avg sale price / case</span><span className="font-medium text-right">{fmt$(avgSalePrice)}</span>
                  <span className="text-muted-foreground">Total cost / case</span><span className="font-medium text-right">{fmt$(costPerCase)}</span>
                  <span className="text-muted-foreground">Profit / case</span><span className="font-medium text-right text-emerald-600 dark:text-emerald-400">{fmt$(avgSalePrice - costPerCase)}</span>
                </div>
              </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">2-Yr Profit</p>
                <p className="font-heading font-bold text-lg text-emerald-700 dark:text-emerald-400">{fmt$(summary.totalProfit)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2-Yr Revenue</p>
                <p className="font-heading font-bold text-lg">{fmt$(summary.totalRevenue)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2-Yr Cases</p>
                <p className="font-heading font-bold text-lg">{fmtInt(summary.totalCases)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Monthly Profit</p>
                <p className="font-heading font-bold text-lg text-emerald-600 dark:text-emerald-400">{fmt$(summary.monthlyProfit)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Margin</p>
                <p className="font-heading font-bold text-lg">{fmtNum(summary.margin, 1)}%</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cases / Wk</p>
                <p className="font-heading font-bold text-lg">{fmtInt(summary.casesPerWeek)}</p>
              </div>
            </div>

            {/* Cumulative profit over time */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cumulative Profit Over Time (24 months)</p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projection} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumProfitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} className="text-muted-foreground" />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="cumProfit" name="Cumulative Profit" stroke="#10b981" strokeWidth={2} fill="url(#cumProfitGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly revenue / cost / profit */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Monthly Revenue, Cost &amp; Profit</p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projection} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} className="text-muted-foreground" />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly cases bar */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cases Produced per Month</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projection} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                    <Tooltip content={<ChartTooltip isCurrency={false} />} />
                    <Bar dataKey="cases" name="Cases" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Projection assumes flat historical averages — no seasonality, growth, price, or cost changes. Adjust weekly hours to model different capacity.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}