import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { INGREDIENTS } from "@/components/inventory/IngredientsTab";

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(4)}`; }
function fmt$2(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }

// Pre-filled hints for each ingredient
const ING_HINTS = {
  xanthan_gum:  { unit_label: "1 lb bag",         grams_per_unit: 453.6 },
  sugar:        { unit_label: "50 lb bag",         grams_per_unit: 22680 },
  dextrose:     { unit_label: "50 lb bag",         grams_per_unit: 22680 },
  citric_acid:  { unit_label: "50 lb bag",         grams_per_unit: 22680 },  // 50 lb = 22680g
  pear_juice:   { unit_label: "5-gal bucket",      grams_per_unit: 18927 },  // 5 gal * 3785g/gal
};

export default function IngredientConversionTab() {
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { ingKey, field }
  const [editVal, setEditVal] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const recs = await base44.entities.IngredientConversion.list();
    setConversions(recs);
    setLoading(false);
  }

  function getRec(ingKey) {
    return conversions.find((c) => c.ingredient === ingKey);
  }

  async function saveField(ingKey, field, rawVal) {
    const isNumeric = field !== "unit_label";
    const val = isNumeric ? parseFloat(rawVal) : rawVal.trim();
    if (isNumeric && (isNaN(val) || val < 0)) { setEditing(null); return; }
    if (!isNumeric && !val) { setEditing(null); return; }

    const existing = getRec(ingKey);
    if (existing) {
      await base44.entities.IngredientConversion.update(existing.id, { [field]: val });
      setConversions((prev) => prev.map((c) => c.id === existing.id ? { ...c, [field]: val } : c));
    } else {
      const hint = ING_HINTS[ingKey] || {};
      const payload = { ingredient: ingKey, [field]: val };
      // Pre-fill other fields with hints if creating fresh
      if (field !== "unit_label" && !payload.unit_label) payload.unit_label = hint.unit_label || "";
      if (field !== "grams_per_unit" && !payload.grams_per_unit) payload.grams_per_unit = hint.grams_per_unit || 0;
      if (field !== "price_per_unit") payload.price_per_unit = payload.price_per_unit || 0;
      const created = await base44.entities.IngredientConversion.create(payload);
      setConversions((prev) => [...prev, created]);
    }
    setEditing(null);
    setEditVal("");
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          Define the unit size and price for each ingredient. This allows the app to calculate a precise cost-per-gram and cost-per-batch.
        </p>
        <p className="text-xs text-muted-foreground">
          Example: Citric Acid is purchased and measured in 50 lb bags. Enter "grams per bag" (≈22680g) so the app can convert correctly.
        </p>
      </div>

      <div className="space-y-3">
        {INGREDIENTS.map((ing) => {
          const rec = getRec(ing.key);
          const hint = ING_HINTS[ing.key] || {};

          const unitLabel = rec?.unit_label || hint.unit_label || null;
          const gramsPerUnit = rec?.grams_per_unit || hint.grams_per_unit || null;
          const pricePerUnit = rec?.price_per_unit || null;

          const pricePerGram = (pricePerUnit && gramsPerUnit && gramsPerUnit > 0)
            ? pricePerUnit / gramsPerUnit : null;

          const isEditingLabel = editing?.ingKey === ing.key && editing?.field === "unit_label";
          const isEditingGrams = editing?.ingKey === ing.key && editing?.field === "grams_per_unit";
          const isEditingPrice = editing?.ingKey === ing.key && editing?.field === "price_per_unit";

          function EditableField({ label, value, display, field, prefix, suffix, step = "0.01" }) {
            const isEdit = editing?.ingKey === ing.key && editing?.field === field;
            return (
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                {isEdit ? (
                  <div className="flex items-center gap-1">
                    {prefix && <span className="text-muted-foreground text-sm">{prefix}</span>}
                    <Input
                      type={field === "unit_label" ? "text" : "number"}
                      min="0" step={step} autoFocus
                      className="h-8 text-sm w-28"
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveField(ing.key, field, editVal)}
                    />
                    {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                    <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveField(ing.key, field, editVal)}><Check className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-lg">{display || (value != null ? `${prefix || ""}${value}${suffix ? ` ${suffix}` : ""}` : "—")}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => { setEditing({ ingKey: ing.key, field }); setEditVal(value != null ? value.toString() : ""); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={ing.key} className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-heading font-semibold">{ing.label}</p>
                  <p className="text-xs text-muted-foreground">Recipe unit: {ing.unit}</p>
                </div>
                {pricePerGram != null && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                    {fmt$(pricePerGram)}/g
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <EditableField
                  label="Unit Label"
                  field="unit_label"
                  value={unitLabel}
                  step="any"
                />
                <EditableField
                  label="Grams Per Unit"
                  field="grams_per_unit"
                  value={gramsPerUnit}
                  suffix="g"
                  step="1"
                />
                <EditableField
                  label="Price Per Unit"
                  field="price_per_unit"
                  value={pricePerUnit}
                  display={pricePerUnit != null ? fmt$2(pricePerUnit) : null}
                  prefix="$"
                  step="0.01"
                />
              </div>
              {pricePerGram != null && (
                <p className="text-xs text-muted-foreground mt-2">
                  Cost per recipe unit ({ing.unit}): <span className="text-foreground font-medium">{fmt$2(gramsPerUnit * pricePerGram)}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}