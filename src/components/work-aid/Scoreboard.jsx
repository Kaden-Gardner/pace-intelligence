import { useState } from "react";
import { GALLONS_PER_CASE } from "@/lib/productionConstants";

function fmtDur(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmt(n) {
  if (!isFinite(n) || n === 0) return "0";
  if (Math.abs(n) < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

export default function Scoreboard({ shiftElapsedMs, cases, downtimeMs, packConstants, avgCasePrice }) {
  const [perMinute, setPerMinute] = useState(false);
  const bagsPerCase = packConstants?.bagsPerCase ?? 12;
  const popsPerCase = packConstants?.popsPerCase ?? 144;
  const popsPerMold = packConstants?.popsPerMold ?? 24;

  const shiftHours = shiftElapsedMs / 3600000;
  const casesPerHour = shiftHours > 0 ? cases / shiftHours : 0;

  const perHour = {
    cases: casesPerHour,
    bags: casesPerHour * bagsPerCase,
    pops: casesPerHour * popsPerCase,
    gallons: casesPerHour * GALLONS_PER_CASE,
    molds: popsPerMold > 0 ? (casesPerHour * popsPerCase) / popsPerMold : 0,
    dollars: casesPerHour * (avgCasePrice || 0),
  };
  const div = perMinute ? 60 : 1;
  const u = perMinute ? "min" : "hr";

  const lostProduct = casesPerHour * (downtimeMs / 3600000);

  const metrics = [
    { label: `Cases/${u}`, value: fmt(perHour.cases / div) },
    { label: `Bags/${u}`, value: fmt(perHour.bags / div) },
    { label: `Pops/${u}`, value: fmt(perHour.pops / div) },
    { label: `Gallons/${u}`, value: fmt(perHour.gallons / div) },
    { label: `Molds/${u}`, value: fmt(perHour.molds / div) },
    { label: `$/${u}`, value: fmt(perHour.dollars / div), prefix: "$" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setPerMinute(false)}
            className={`px-6 py-2 rounded-lg text-base font-semibold transition-colors ${!perMinute ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Per Hour</button>
          <button
            type="button"
            onClick={() => setPerMinute(true)}
            className={`px-6 py-2 rounded-lg text-base font-semibold transition-colors ${perMinute ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Per Minute</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">Total Downtime</p>
          <p className="text-5xl font-heading font-bold tabular-nums">{fmtDur(downtimeMs)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-destructive/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">Lost Product</p>
          <p className="text-5xl font-heading font-bold tabular-nums text-destructive">{fmt(lostProduct)}</p>
          <p className="text-xs text-muted-foreground mt-1">cases</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card rounded-2xl border border-border p-6 text-center">
            <p className="text-5xl font-heading font-bold tabular-nums text-primary">{m.prefix}{m.value}</p>
            <p className="text-sm text-muted-foreground mt-2">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}