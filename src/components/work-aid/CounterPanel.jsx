import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw } from "lucide-react";

export default function CounterPanel({ label, counter, unit = "cases", onIncrement, onDecrement, onReset, disabled, secondaryLabel, conversionDivisor }) {
  const count = counter?.cases || 0;
  const secondaryValue = conversionDivisor ? count / conversionDivisor : null;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <h3 className="font-heading font-semibold text-lg mb-4">{label}</h3>
      {secondaryValue !== null && (
        <div className="mb-4 text-center">
          <p className="text-3xl font-heading font-bold text-primary tabular-nums">{secondaryValue.toFixed(1)}</p>
          <p className="text-xs text-muted-foreground">{secondaryLabel}</p>
        </div>
      )}
      <div className="flex items-center gap-6 sm:gap-10 mb-12">
        <Button variant="outline" size="icon" className="w-16 h-16 rounded-full" onClick={onDecrement} disabled={count <= 0 || disabled}>
          <Minus className="w-8 h-8" />
        </Button>
        <div className="text-center min-w-[120px]">
          <p className="text-6xl font-heading font-bold tabular-nums">{count}</p>
          <p className="text-sm text-muted-foreground mt-1">{unit}</p>
        </div>
        <Button size="icon" className="w-16 h-16 rounded-full" onClick={onIncrement} disabled={disabled}>
          <Plus className="w-8 h-8" />
        </Button>
      </div>
      <Button variant="outline" className="gap-2" onClick={onReset} disabled={disabled || count <= 0}>
        <RotateCcw className="w-4 h-4" /> Reset
      </Button>
    </div>
  );
}