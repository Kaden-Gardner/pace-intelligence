import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, X, FlaskConical } from "lucide-react";
import { CONSUMABLE_MATERIALS } from "@/components/inventory/consumableMaterials";
import { ingredientsUsedInFlavorset } from "@/lib/lots";

export default function BaseLotSection({ flavorsetId, flavorsetName, baseMixDefaults, ingredientLots, setIngredientLots, materialLots, setMaterialLots }) {
  const used = flavorsetId ? ingredientsUsedInFlavorset(flavorsetId, baseMixDefaults) : [];

  function setLot(key, value) {
    setIngredientLots((prev) => ({ ...prev, [key]: value }));
  }

  function setRow(index, field, value) {
    setMaterialLots((prev) => (prev || []).map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setMaterialLots((prev) => [...(prev || []), { material_key: "", lot_number: "" }]);
  }

  function removeRow(index) {
    setMaterialLots((prev) => (prev || []).filter((_, i) => i !== index));
  }

  const rows = materialLots || [];
  const availableMaterials = CONSUMABLE_MATERIALS.filter(
    (m) => !rows.some((row) => row.material_key === m.key)
  );

  return (
    <section className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-lg">Lot Numbers</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Record the lots used in this base batch so every finished pallet can be traced back to them.
      </p>

      {!flavorsetId ? (
        <p className="text-sm text-muted-foreground">Select a flavorset above to see which ingredients need a lot number.</p>
      ) : (
        <>
          <p className="text-xs font-medium text-muted-foreground mb-2">Ingredients used in {flavorsetName}</p>
          <div className="space-y-2">
            {used.map((ing) => (
              <div key={ing.key} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <label className="text-sm">{ing.label}</label>
                <Input
                  placeholder="Lot #"
                  value={ingredientLots[ing.key] || ""}
                  onChange={(e) => setLot(ing.key, e.target.value)}
                />
              </div>
            ))}
            {used.length === 0 && (
              <p className="text-sm text-muted-foreground">No ingredients are configured for this flavorset.</p>
            )}
          </div>
        </>
      )}

      <div className="mt-6">
        <p className="text-xs font-medium text-muted-foreground mb-2">Materials used</p>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select value={row.material_key || undefined} onValueChange={(v) => setRow(index, "material_key", v)}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  {[...availableMaterials, ...CONSUMABLE_MATERIALS.filter((m) => m.key === row.material_key)].map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Lot #"
                value={row.lot_number || ""}
                onChange={(e) => setRow(index, "lot_number", e.target.value)}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        {availableMaterials.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5 mt-3" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" /> Add material
          </Button>
        )}
      </div>
    </section>
  );
}