import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import {
  ArrowLeft, BarChart3, Clock, Gauge, Users, FlaskConical, Package, Flame, Timer, Repeat2,
} from "lucide-react";
import { getTotalCases, getShiftEmployees, excludeShiftsWithTerminated } from "@/lib/analyticsHelpers";
import { fmtNum, fmtInt } from "@/components/bigboy/format";

const METRICS = [
  { key: "shift_duration", label: "Shift Duration", unit: "hrs", icon: Clock, fmt: (v) => fmtNum(v, 1) },
  { key: "speed", label: "Speed", unit: "cases/hr", icon: Gauge, fmt: (v) => fmtNum(v, 1) },
  { key: "crew", label: "Crew Size", unit: "ppl", icon: Users, fmt: (v) => fmtInt(Math.round(v)) },
  { key: "batch_size", label: "Batch Size", unit: "gal", icon: FlaskConical, fmt: (v) => fmtNum(v, 1) },
  { key: "cases_output", label: "Cases Output", unit: "cases", icon: Package, fmt: (v) => fmtInt(Math.round(v)) },
  { key: "waste", label: "Waste", unit: "gal", icon: Flame, fmt: (v) => fmtNum(v, 1) },
  { key: "downtime", label: "Downtime", unit: "hrs", icon: Timer, fmt: (v) => fmtNum(v, 2) },
];

function parseDowntimeHours(text) {
  if (!text) return 0;
  const s = String(text).toLowerCase().trim();
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (h) return parseFloat(h[1]);
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (m) return parseFloat(m[1]) / 60;
  const p = s.match(/(\d+(?:\.\d+)?)/);
  if (p) return parseFloat(p[1]) / 60;
  return 0;
}

function computeShiftMetrics(s) {
  const totalCases = getTotalCases(s);
  const duration = s.shift_duration || 0;
  return {
    shift_duration: duration,
    speed: duration > 0 ? totalCases / duration : 0,
    crew: getShiftEmployees(s).length,
    batch_size:
      (s.starting_gallons_flavor_1 || 0) +
      (s.starting_gallons_flavor_2 || 0) +
      (s.starting_gallons_flavor_3 || 0) +
      (s.starting_gallons_flavor_4 || 0),
    cases_output: totalCases,
    waste: s.waste || 0,
    downtime: parseDowntimeHours(s.downtime),
  };
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Linear regression of Y on X. Returns slope, intercept, correlation r, and meanY.
function regress(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: mean(ys), r: 0, meanY: mean(ys) };
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  return { slope, intercept, r, meanY: my };
}

function corrLabel(r) {
  const a = Math.abs(r);
  if (a >= 0.7) return { txt: "Strong", cls: "text-emerald-600 dark:text-emerald-400" };
  if (a >= 0.4) return { txt: "Moderate", cls: "text-amber-600 dark:text-amber-400" };
  if (a >= 0.2) return { txt: "Weak", cls: "text-orange-600 dark:text-orange-400" };
  return { txt: "None", cls: "text-muted-foreground" };
}

export default function ComparisonsPredictions({ shifts, employees, onBack }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [driverValue, setDriverValue] = useState(0);

  // Per-shift metric rows (terminated-employee shifts excluded, like Big Boy).
  const rows = useMemo(() => {
    const clean = excludeShiftsWithTerminated(shifts || [], employees || []);
    return clean
      .map(computeShiftMetrics)
      .filter((r) => r.shift_duration > 0 && r.crew > 0);
  }, [shifts, employees]);

  const averages = useMemo(() => {
    const out = {};
    METRICS.forEach((m) => {
      out[m.key] = mean(rows.map((r) => r[m.key]));
    });
    return out;
  }, [rows]);

  const selected = METRICS.find((m) => m.key === selectedKey) || null;

  // Range for the driver slider.
  const driverRange = useMemo(() => {
    if (!selected) return { min: 0, max: 0, step: 1 };
    const vals = rows.map((r) => r[selected.key]);
    if (!vals.length) return { min: 0, max: 0, step: 1 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const step = selected.key === "crew" ? 1 : Math.max(0.1, +(span / 50).toFixed(2));
    return { min, max, step };
  }, [rows, selected]);

  // When a metric is selected, default the driver value to its average.
  function pickMetric(key) {
    setSelectedKey(key);
    setDriverValue(averages[key] || 0);
  }

  // For each other metric: regression vs the driver, predicted value, % change.
  const predictions = useMemo(() => {
    if (!selected) return [];
    const xs = rows.map((r) => r[selected.key]);
    return METRICS.filter((m) => m.key !== selected.key).map((m) => {
      const ys = rows.map((r) => r[m.key]);
      const reg = regress(xs, ys);
      const predicted = reg.intercept + reg.slope * driverValue;
      const avg = reg.meanY;
      const pct = avg !== 0 ? ((predicted - avg) / Math.abs(avg)) * 100 : 0;
      const c = corrLabel(reg.r);
      return { metric: m, predicted, avg, pct, r: reg.r, corr: c, slope: reg.slope };
    });
  }, [rows, selected, driverValue]);

  const chartData = predictions.map((p) => ({ label: p.metric.label, pct: Math.round(p.pct) }));

  // ── Metric picker ──
  if (!selected) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="sm" className="gap-1" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back to Analytics
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold">Comparisons & Predictions</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Pick a metric to use as the driver. You'll see how every other metric shifts as that driver increases or decreases — based on your historical shift data ({rows.length} shifts).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => pickMetric(m.key)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">Avg: {m.fmt(averages[m.key] || 0)} {m.unit}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const Icon = selected.icon;
  const driverPct = averages[selected.key] !== 0
    ? ((driverValue - averages[selected.key]) / Math.abs(averages[selected.key])) * 100
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" /> Back to Analytics
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold">Comparisons & Predictions</h1>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelectedKey(null)}>
          <Repeat2 className="w-4 h-4" /> Change Metric
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-6">
        Drag the {selected.label.toLowerCase()} slider to see how every other metric is shaped by it — based on {rows.length} historical shifts.
      </p>

      {/* Driver control */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Driver Metric</p>
            <p className="font-heading font-bold text-lg">{selected.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <input
            type="range"
            min={driverRange.min}
            max={driverRange.max}
            step={driverRange.step}
            value={driverValue}
            onChange={(e) => setDriverValue(parseFloat(e.target.value))}
            className="flex-1 accent-primary"
          />
          <Input
            type="number"
            min={driverRange.min}
            max={driverRange.max}
            step={driverRange.step}
            value={Math.round(driverValue * 100) / 100}
            onChange={(e) => setDriverValue(Math.max(driverRange.min, Math.min(driverRange.max, parseFloat(e.target.value) || 0)))}
            className="w-24 font-heading font-bold text-base"
          />
          <span className="text-xs text-muted-foreground">{selected.unit}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span className="text-muted-foreground">Average: <span className="font-medium text-foreground">{selected.fmt(averages[selected.key])} {selected.unit}</span></span>
          <span className="text-muted-foreground">Min: <span className="font-medium text-foreground">{selected.fmt(driverRange.min)} {selected.unit}</span></span>
          <span className="text-muted-foreground">Max: <span className="font-medium text-foreground">{selected.fmt(driverRange.max)} {selected.unit}</span></span>
          <span className={`font-semibold ${driverPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {driverPct >= 0 ? "+" : ""}{fmtNum(driverPct, 1)}% vs avg
          </span>
        </div>
      </div>

      {/* Predictions table */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6 overflow-x-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">How Other Metrics Respond</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left border-b border-border">
              <th className="py-2 pr-4 font-medium">Metric</th>
              <th className="py-2 pr-4 font-medium">Average</th>
              <th className="py-2 pr-4 font-medium">Predicted</th>
              <th className="py-2 pr-4 font-medium">% Change</th>
              <th className="py-2 pr-4 font-medium">Correlation</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((p) => {
              const MIcon = p.metric.icon;
              return (
                <tr key={p.metric.key} className="border-b border-border/50">
                  <td className="py-2 pr-4">
                    <span className="flex items-center gap-1.5 font-medium">
                      <MIcon className="w-3.5 h-3.5 text-muted-foreground" /> {p.metric.label}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{p.metric.fmt(p.avg)} {p.metric.unit}</td>
                  <td className="py-2 pr-4 font-semibold">{p.metric.fmt(p.predicted)} {p.metric.unit}</td>
                  <td className={`py-2 pr-4 font-semibold ${p.pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {p.pct >= 0 ? "+" : ""}{fmtNum(p.pct, 1)}%
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`font-medium ${p.corr.cls}`}>{p.corr.txt}</span>
                    <span className="text-muted-foreground"> (r={fmtNum(p.r, 2)})</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* % change bar chart */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Percent Change from Average</p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} className="text-muted-foreground" />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={80} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }}
                formatter={(v) => [`${v}%`, "% Change"]}
              />
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.pct >= 0 ? "#10b981" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Predictions use linear regression on your historical shift data. Correlation strength shows how reliably the driver explains each metric (|r| ≥ 0.7 strong, ≥ 0.4 moderate, ≥ 0.2 weak).
      </p>
    </div>
  );
}