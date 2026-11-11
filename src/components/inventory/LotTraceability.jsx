import { formatShortDate, ingredientLabel, materialLabel } from "@/lib/lots";

export default function LotTraceability({ shiftIds, shifts, batches }) {
  const shiftById = {};
  (shifts || []).forEach((s) => { shiftById[s.id] = s; });
  const batchById = {};
  (batches || []).forEach((b) => { batchById[b.id] = b; });

  const usedBatchIds = [
    ...new Set((shiftIds || []).flatMap((id) => shiftById[id]?.base_batch_ids || [])),
  ];
  const usedBatches = usedBatchIds.map((id) => batchById[id]).filter(Boolean);

  if (usedBatches.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No base batch was linked to this shift, so there are no lots to trace.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {usedBatches.map((batch) => {
        const ingredients = batch.ingredient_lots || [];
        const materials = batch.material_lots || [];
        return (
          <div key={batch.id} className="bg-muted/50 rounded-xl p-3">
            <p className="text-xs font-semibold mb-2">
              Base made {formatShortDate(batch.shift_date)}
              <span className="font-normal text-muted-foreground">
                {" · "}{Number(batch.batch_size) || 0} batch{(Number(batch.batch_size) || 0) === 1 ? "" : "es"} · {Math.round((Number(batch.batch_size) || 0) * 240)} gal
              </span>
            </p>
            {ingredients.length === 0 && materials.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No lot numbers recorded for this batch.</p>
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
  );
}