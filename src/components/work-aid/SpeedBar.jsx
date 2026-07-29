import { GALLONS_PER_CASE } from "@/lib/productionConstants";

function Metric({ value, label, destructive }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 text-center">
      <p className={`text-xl font-heading font-bold tabular-nums ${destructive ? "text-destructive" : ""}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function SpeedBar({ shiftElapsedMs, cases, downtimeMs, showLostProduct, packConstants }) {
  const bagsPerCase = packConstants?.bagsPerCase ?? 12;
  const popsPerCase = packConstants?.popsPerCase ?? 144;
  const popsPerMold = packConstants?.popsPerMold ?? 24;

  const shiftHours = shiftElapsedMs / 3600000;
  const casesPerHour = shiftHours > 0 ? cases / shiftHours : 0;
  const bagsPerHour = casesPerHour * bagsPerCase;
  const popsiclesPerMin = (casesPerHour * popsPerCase) / 60;
  const gallonsPerHour = casesPerHour * GALLONS_PER_CASE;
  const moldsPerMin = popsPerMold > 0 ? popsiclesPerMin / popsPerMold : 0;
  const lostProduct = casesPerHour * (downtimeMs / 3600000);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      <Metric value={casesPerHour.toFixed(0)} label="Cases/hr" />
      {showLostProduct ? (
        <Metric value={lostProduct.toFixed(0)} label="Lost Product" destructive />
      ) : (
        <Metric value={bagsPerHour.toFixed(0)} label="Bags/hr" />
      )}
      <Metric value={popsiclesPerMin.toFixed(0)} label="Pops/min" />
      <Metric value={gallonsPerHour.toFixed(0)} label="Gallons/hr" />
      <Metric value={moldsPerMin.toFixed(0)} label="Molds/min" />
    </div>
  );
}