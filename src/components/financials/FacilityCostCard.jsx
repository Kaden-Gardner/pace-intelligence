import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Check } from "lucide-react";

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }

export default function FacilityCostCard({ facilityCost, monthlyFacilityCost, onSave, unlocked }) {
  const [val, setVal] = useState(facilityCost ? String(facilityCost.monthly_cost) : "");
  const [editing, setEditing] = useState(false);

  const current = facilityCost?.monthly_cost || 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-heading font-semibold">Facility Cost</p>
          <p className="text-xs text-muted-foreground">Monthly facility cost, divided evenly across all shifts in each month.</p>
        </div>
      </div>

      {!unlocked || !editing ? (
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="font-heading font-bold text-3xl text-primary">{current > 0 ? fmt$(current) : "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">per month</p>
          </div>
          {unlocked && current === 0 && (
            <Button size="sm" variant="outline" onClick={() => { setVal(""); setEditing(true); }}>Set monthly cost</Button>
          )}
          {unlocked && current > 0 && (
            <Button size="sm" variant="outline" onClick={() => { setVal(String(current)); setEditing(true); }}>Edit</Button>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly facility cost ($)</label>
            <Input type="number" min="0" step="0.01" value={val} onChange={(e) => setVal(e.target.value)} placeholder="0.00" />
          </div>
          <Button size="sm" className="gap-1" onClick={() => { onSave(val); setEditing(false); }} disabled={val === "" || isNaN(parseFloat(val)) || parseFloat(val) < 0}>
            <Check className="w-3 h-3" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}

      {current > 0 && monthlyFacilityCost > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Allocated to each shift this month: <span className="font-semibold text-foreground">{fmt$(monthlyFacilityCost)}/shift</span>
          </p>
        </div>
      )}
    </div>
  );
}