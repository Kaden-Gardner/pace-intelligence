import { useState } from "react";
import { GALLONS_PER_CASE } from "@/lib/productionConstants";

function Metric({ value, label, prefix, destructive }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 text-center">
      <p className={`text-xl font-heading font-bold tabular-nums ${destructive ? "text-destructive" : ""}`}>
        {prefix}{value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function fmt(n) {
  if (!isFinite(n) || n === 0) return "0";
  if (Math.abs(n) < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString();
}

export default function SpeedBar({ shiftElapsedMs, cases, downtimeMs, showLostProduct, packConstants, avgCasePrice }) {
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

  // Lost Product is a case count, not a rate — stays in cases regardless of toggle.
  const lostProduct = casesPerHour * (downtimeMs / 3600000);

  return (
    <div className="mb-6">
      <div className="flex justify-end mb-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setPerMinute(false)}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${!perMinute ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Per Hour</button>
          <button
            type="button"
            onClick={() => setPerMinute(true)}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${perMinute ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >Per Minute</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Metric value={fmt(perHour.cases / div)} label={`Cases/${u}`} />
        {showLostProduct ? (
          <Metric value={fmt(lostProduct)} label="Lost Product" destructive />
        ) : (
          <Metric value={fmt(perHour.bags / div)} label={`Bags/${u}`} />
        )}
        <Metric value={fmt(perHour.pops / div)} label={`Pops/${u}`} />
        <Metric value={fmt(perHour.gallons / div)} label={`Gallons/${u}`} />
        <Metric value={fmt(perHour.molds / div)} label={`Molds/${u}`} />
        <Metric value={fmt(perHour.dollars / div)} label={`$/${u}`} prefix="$" />
      </div>
    </div>
  );
}