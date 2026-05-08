import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { INGREDIENTS } from "@/components/inventory/IngredientsTab";

const MATERIALS = [
  { key: "roll_wrap",       label: "Roll Wrap",        unit: "roll" },
  { key: "individual_wrap", label: "Individual Wrap",  unit: "roll" },
  { key: "clear_wrap",      label: "Clear Wrap",       unit: "roll" },
  { key: "popsicle_sticks", label: "Popsicle Sticks",  unit: "box" },
  { key: "gloves_small",    label: "Gloves (S)",       unit: "box" },
  { key: "gloves_medium",   label: "Gloves (M)",       unit: "box" },
  { key: "gloves_large",    label: "Gloves (L)",       unit: "box" },
  { key: "gloves_xlarge",   label: "Gloves (XL)",      unit: "box" },
  { key: "box_stacks",      label: "Box Stacks",       unit: "stack" },
];

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }

export default function SuppliesPricingTab() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const p = await base44.entities.SupplyPrice.list();
    setPrices(p);
    setLoading(false);
  }

  function getPrice(key, type) {
    return prices.find((p) => p.item_key === key && p.item_type === type);
  }

  async function savePrice(key, type) {
    const val = parseFloat(editVal);
    if (isNaN(val) || val < 0) { setEditKey(null); return; }
    const existing = getPrice(key, type);
    if (existing) {
      await base44.entities.SupplyPrice.update(existing.id, { price_per_unit: val });
      setPrices((prev) => prev.map((p) => p.id === existing.id ? { ...p, price_per_unit: val } : p));
    } else {
      const created = await base44.entities.SupplyPrice.create({ item_key: key, item_type: type, price_per_unit: val });
      setPrices((prev) => [...prev, created]);
    }
    setEditKey(null);
    setEditVal("");
  }

  function PriceRow({ item, type }) {
    const rec = getPrice(item.key, type);
    const price = rec?.price_per_unit;
    const isEditing = editKey === `${type}:${item.key}`;
    return (
      <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm">{item.label}</p>
          <p className="text-xs text-muted-foreground">per {item.unit}</p>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number" min="0" step="0.01" autoFocus
                className="pl-7 w-28"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePrice(item.key, type)}
              />
            </div>
            <Button size="sm" className="gap-1 h-8" onClick={() => savePrice(item.key, type)}><Check className="w-3 h-3" /></Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditKey(null)}><X className="w-3 h-3" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-primary">{price != null ? fmt$(price) : "Not set"}</span>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { setEditKey(`${type}:${item.key}`); setEditVal(price != null ? price.toString() : ""); }}>
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">Set the cost price per unit for each ingredient and material. These are used to calculate supply costs per shift.</p>

      <div>
        <h3 className="font-heading font-semibold text-lg mb-3">Ingredients</h3>
        <div className="space-y-2">
          {INGREDIENTS.map((ing) => <PriceRow key={ing.key} item={ing} type="ingredient" />)}
        </div>
      </div>

      <div>
        <h3 className="font-heading font-semibold text-lg mb-3">Materials</h3>
        <div className="space-y-2">
          {MATERIALS.map((mat) => <PriceRow key={mat.key} item={mat} type="material" />)}
        </div>
      </div>
    </div>
  );
}