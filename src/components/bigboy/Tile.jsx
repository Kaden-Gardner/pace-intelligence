export default function Tile({ label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-primary/10 border border-primary/30" : "bg-muted/40"}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`font-heading font-bold text-lg ${highlight ? "text-primary" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}