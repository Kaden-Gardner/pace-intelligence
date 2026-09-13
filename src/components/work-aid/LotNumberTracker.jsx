import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackagePlus, Settings2 } from "lucide-react";

function formatLot(n) {
  return `P${String(Number(n) || 0).padStart(6, "0")}`;
}

export default function LotNumberTracker({ lotNumber, isAdmin, onIncrement, onSet, busy }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  function openEdit() {
    setVal(String(lotNumber || 0));
    setEditing(true);
  }
  function save() {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    onSet(n);
    setEditing(false);
  }

  return (
    <div className="flex justify-end mb-4">
      <div className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3 flex-wrap">
        <div className="pr-2">
          <p className="text-xs text-muted-foreground">Current Lot</p>
          <p className="font-heading font-bold text-2xl tracking-wider">{formatLot(lotNumber)}</p>
        </div>
        <Button className="gap-1.5" onClick={onIncrement} disabled={busy}>
          <PackagePlus className="w-4 h-4" /> Finished Pallet
        </Button>
        {isAdmin && !editing && (
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Settings2 className="w-4 h-4" /> Manual Override
          </Button>
        )}
        {isAdmin && editing && (
          <div className="flex items-center gap-2">
            <Input value={val} onChange={(e) => setVal(e.target.value)} className="w-24" autoFocus onKeyDown={(e) => e.key === "Enter" && save()} />
            <Button size="sm" onClick={save}>Set</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}