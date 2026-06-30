export default function SpeedBar({ shiftElapsedMs, cases, bags, downtimeMs, showLostProduct }) {
  const shiftHours = shiftElapsedMs / 3600000;
  const casesPerHour = shiftHours > 0 ? cases / shiftHours : 0;
  const bagsPerHour = shiftHours > 0 ? bags / shiftHours : 0;
  const popsiclesPerMin = (casesPerHour * 144) / 60;
  const lostProduct = casesPerHour * (downtimeMs / 3600000);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <p className="text-xl font-heading font-bold tabular-nums">{casesPerHour.toFixed(0)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Cases/hr</p>
      </div>
      {showLostProduct ? (
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-xl font-heading font-bold tabular-nums text-destructive">{lostProduct.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Lost Product</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-xl font-heading font-bold tabular-nums">{bagsPerHour.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Bags/hr</p>
        </div>
      )}
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <p className="text-xl font-heading font-bold tabular-nums">{popsiclesPerMin.toFixed(0)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Pops/min</p>
      </div>
    </div>
  );
}