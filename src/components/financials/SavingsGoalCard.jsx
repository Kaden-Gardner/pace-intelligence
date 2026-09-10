import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PiggyBank, Check } from "lucide-react";

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }

const PRESETS = [5, 10, 12, 24, 36];

export default function SavingsGoalCard({ goal, perShift, shiftsInWindow, unlocked, onSave }) {
  const [amount, setAmount] = useState(goal ? String(goal.target_amount) : "");
  const [months, setMonths] = useState(goal ? String(goal.timeframe_months) : "12");
  const [editing, setEditing] = useState(!goal);

  const target = goal?.target_amount || 0;
  const tf = goal?.timeframe_months || 0;

  function handleSave() {
    const a = parseFloat(amount);
    const m = parseFloat(months);
    if (isNaN(a) || a < 0 || isNaN(m) || m <= 0) return;
    onSave(a, m);
    setEditing(false);
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
          <PiggyBank className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="font-heading font-semibold">Savings Goal (Accrued)</p>
          <p className="text-xs text-muted-foreground">Set aside a target over a timeframe — divided across average shifts and added to each shift's facility cost.</p>
        </div>
      </div>

      {!unlocked || !editing ? (
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex gap-6">
            <div>
              <p className="font-heading font-bold text-3xl text-accent">{target > 0 ? fmt$(target) : "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">target</p>
            </div>
            {target > 0 && (
              <div>
                <p className="font-heading font-bold text-xl">{tf} mo</p>
                <p className="text-xs text-muted-foreground mt-0.5">timeframe</p>
              </div>
            )}
          </div>
          {unlocked && (
            <Button size="sm" variant="outline" onClick={() => { setAmount(target > 0 ? String(target) : ""); setMonths(tf > 0 ? String(tf) : "12"); setEditing(true); }}>
              {target > 0 ? "Edit" : "Set Goal"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px] max-w-xs">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Target amount ($)</label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div className="flex-1 min-w-[120px] max-w-xs">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Timeframe (months)</label>
              <Input type="number" min="1" step="1" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="12" />
            </div>
            <Button size="sm" className="gap-1 h-9" onClick={handleSave} disabled={amount === "" || isNaN(parseFloat(amount)) || parseFloat(amount) < 0 || isNaN(parseFloat(months)) || parseFloat(months) <= 0}>
              <Check className="w-3 h-3" /> Save
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setMonths(String(p))}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${months === String(p) ? "bg-accent text-accent-foreground border-accent" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"}`}>
                {p} mo
              </button>
            ))}
          </div>
        </div>
      )}

      {target > 0 && tf > 0 && perShift > 0 && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Added to each shift's facility cost: <span className="font-semibold text-foreground">{fmt$(perShift)}/shift</span>
            <span className="text-muted-foreground/70"> · ~{Math.round(shiftsInWindow)} shifts over {tf} mo</span>
          </p>
        </div>
      )}
    </div>
  );
}