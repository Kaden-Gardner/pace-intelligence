import { useState } from "react";
import { ChevronDown, ChevronRight, FlaskConical } from "lucide-react";
import { formatShortDate, ingredientLabel, materialLabel } from "@/lib/lots";

export default function BaseBatchesPanel({ batches }) {
  const [open, setOpen] = useState(false);

  const sorted = [...(batches || [])].sort((a, b) => String(b.shift_date).localeCompare(String(a.shift_date)));

  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground mt-3">No batches recorded for this flavorset yet.</p>;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <FlaskConical className="w-3.5 h-3.5" />
        {sorted.length} batch{sorted.length === 1 ? "" : "es"} made
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sorted.map((batch) => {
            const count = Number(batch.batch_size) || 0;
            const ingredients = batch.ingredient_lots || [];
            const materials = batch.material_lots || [];
            return (
              <div key={batch.id} className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs font-semibold mb-2">
                  {formatShortDate(batch.shift_date)}
                  <span className="font-normal text-muted-foreground">
                    {" · "}{count} batch{count === 1 ? "" : "es"} · {Math.round(count * 240)} gal
                  </span>
                </p>
                {ingredients.length === 0 && materials.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No lot numbers recorded.</p>
                ) : (
                  <div className="space-y-1">
                    {ingredients.map((row) => (
                      <p key={`i-${row.ingredient}`} className="text-xs flex justify-between gap-3">
                        <span className="text-muted-foreground">{ingredientLabel(row.ingredient)}</span>
                        <span className="font-medium">{row.lot_number || "—"}</span>
                      </p>
                    ))}
                    {materials.map((row, i) => (
                      <p key={`m-${row.material_key}-${i}`} className="text-xs flex justify-between gap-3">
                        <span className="text-muted-foreground">{materialLabel(row.material_key)}</span>
                        <span className="font-medium">{row.lot_number || "—"}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}