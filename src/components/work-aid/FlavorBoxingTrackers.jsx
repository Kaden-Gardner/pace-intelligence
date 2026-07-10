import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Minus } from "lucide-react";

export default function FlavorBoxingTrackers({ flavors, counters, onIncrement, onDecrement, busyKeys, enabledStates, onToggle }) {
  if (!flavors || flavors.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-6">
      <h3 className="font-heading font-semibold text-sm mb-4 text-center">Per-Flavor Case Tracking</h3>
      <p className="text-xs text-muted-foreground text-center mb-4">Toggle on a flavor to count its cases — enabled counts add to the total above.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {flavors.map((f) => {
          const count = counters[f.key]?.cases || 0;
          const isEnabled = enabledStates[f.key] || false;
          const isBusy = busyKeys.has(f.key);
          return (
            <div key={f.key} className={`rounded-xl border p-4 transition-opacity ${isEnabled ? "border-primary/30 bg-primary/5" : "border-border opacity-50"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {f.color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />}
                  <span className="text-sm font-medium truncate">{f.name}</span>
                </div>
                <Switch checked={isEnabled} onCheckedChange={() => onToggle(f.key)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="icon" className="w-10 h-10 rounded-full" onClick={() => onDecrement(f.key)} disabled={!isEnabled || count <= 0 || isBusy}>
                  <Minus className="w-5 h-5" />
                </Button>
                <p className="text-3xl font-heading font-bold tabular-nums">{count}</p>
                <Button size="icon" className="w-10 h-10 rounded-full" onClick={() => onIncrement(f.key)} disabled={!isEnabled || isBusy}>
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}