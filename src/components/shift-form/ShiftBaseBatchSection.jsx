import { Checkbox } from "@/components/ui/checkbox";
import { formatShortDate } from "@/lib/lots";
import { Layers } from "lucide-react";

export default function ShiftBaseBatchSection({ form, updateForm, batches, flavorSets }) {
  const flavorsetId = form.flavorset_id;
  const selected = form.base_batch_ids || [];

  const options = [...(batches || [])]
    .filter((b) => !flavorsetId || b.flavorset_id === flavorsetId)
    .sort((a, b) => String(b.shift_date).localeCompare(String(a.shift_date)));

  const fsMap = {};
  (flavorSets || []).forEach((fs) => { fsMap[fs.id] = fs; });

  function toggle(id) {
    updateForm(
      "base_batch_ids",
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  }

  return (
    <section className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-lg">Base Batches Used</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Select which batch of base this shift ran. This links the finished pallets back to their ingredient and material lots.
      </p>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No base mixing batches recorded{flavorsetId ? " for this flavorset" : ""} yet.
        </p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
          {options.map((b) => {
            const batches = Number(b.batch_size) || 0;
            return (
              <label
                key={b.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox checked={selected.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
                <span className="flex-1 min-w-0 text-sm">
                  <span className="font-medium">{formatShortDate(b.shift_date)}</span>
                  <span className="text-muted-foreground">
                    {" · "}{batches} batch{batches === 1 ? "" : "es"} · {Math.round(batches * 240)} gal
                    {!flavorsetId && b.flavorset_id ? ` · ${fsMap[b.flavorset_id]?.name || "Unknown"}` : ""}
                  </span>
                </span>
                {(b.ingredient_lots || []).length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                    lots logged
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}