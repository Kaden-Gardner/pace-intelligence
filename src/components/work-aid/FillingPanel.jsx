import { Button } from "@/components/ui/button";
import { Plus, Minus, RotateCcw } from "lucide-react";

const FLAVORS = [
  { key: "filling_flavor_1", label: "Flavor 1" },
  { key: "filling_flavor_2", label: "Flavor 2" },
  { key: "filling_flavor_3", label: "Flavor 3" },
  { key: "filling_flavor_4", label: "Flavor 4" },
];

export default function FillingPanel({ counters, onIncrement, onDecrement, onResetAll, busyKeys }) {
  const allZero = FLAVORS.every((f) => (counters[f.key]?.cases || 0) === 0);
  const anyBusy = FLAVORS.some((f) => busyKeys.has(f.key));

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <h3 className="font-heading font-semibold text-lg mb-8">Molds Filled</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10 w-full max-w-2xl">
        {FLAVORS.map((f) => {
          const count = counters[f.key]?.cases || 0;
          const isBusy = busyKeys.has(f.key);
          return (
            <div key={f.key} className="flex flex-col items-center text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">{f.label}</p>
              <p className="text-4xl font-heading font-bold tabular-nums mb-3">{count}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="w-10 h-10 rounded-full" onClick={() => onDecrement(f.key)} disabled={count <= 0 || isBusy}>
                  <Minus className="w-5 h-5" />
                </Button>
                <Button size="icon" className="w-10 h-10 rounded-full" onClick={() => onIncrement(f.key)} disabled={isBusy}>
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="outline" className="gap-2" onClick={onResetAll} disabled={allZero || anyBusy}>
        <RotateCcw className="w-4 h-4" /> Reset All
      </Button>
    </div>
  );
}