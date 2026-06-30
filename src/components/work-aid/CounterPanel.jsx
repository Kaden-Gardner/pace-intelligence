import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw } from "lucide-react";

export default function CounterPanel({ label, counter, onIncrement, onDecrement, onReset }) {
  const cases = counter?.cases || 0;
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <h3 className="font-heading font-semibold text-lg mb-8">{label} Cases</h3>
      <div className="flex items-center gap-6 sm:gap-10 mb-12">
        <Button variant="outline" size="icon" className="w-16 h-16 rounded-full" onClick={onDecrement} disabled={cases <= 0}>
          <Minus className="w-8 h-8" />
        </Button>
        <div className="text-center min-w-[120px]">
          <p className="text-6xl font-heading font-bold tabular-nums">{cases}</p>
          <p className="text-sm text-muted-foreground mt-1">cases</p>
        </div>
        <Button size="icon" className="w-16 h-16 rounded-full" onClick={onIncrement}>
          <Plus className="w-8 h-8" />
        </Button>
      </div>
      <Button variant="outline" className="gap-2" onClick={onReset}>
        <RotateCcw className="w-4 h-4" /> Reset
      </Button>
    </div>
  );
}