import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Wraps a displayed number; clicking it opens a small popup showing the exact
// math (source numbers + formula) used to derive it. Used across the Shift
// Diagnostic dialog so every figure is auditable.
export default function MathValue({ value, steps = [], formula, result }) {
  if (!steps || steps.length === 0) return <span>{value}</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="underline decoration-dotted underline-offset-2 hover:text-primary transition-colors"
        >
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 text-xs space-y-1">
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {steps.map((s, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">{s.label}</span>
              <span className="font-medium tabular-nums whitespace-nowrap">{s.value}</span>
            </div>
          ))}
        </div>
        {formula && (
          <p className="pt-1.5 mt-1.5 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
            {formula}
          </p>
        )}
        <div className="flex justify-between pt-1.5 border-t border-border font-semibold">
          <span>=</span>
          <span className="tabular-nums">{result ?? value}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}