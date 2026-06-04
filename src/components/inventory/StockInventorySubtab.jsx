import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StockInventorySubtab({ items, stockInventory, setStockInventory }) {
  const [editingId, setEditingId] = useState(null); // item_id being edited
  const [editQty, setEditQty] = useState(0);
  const [saving, setSaving] = useState(false);

  function getRecord(itemId) {
    return stockInventory.find((s) => s.item_id === itemId);
  }

  function qtyLabel(item) {
    if (item.item_type === "material") {
      if (item.material_form === "roll") return item.roll_unit || "units";
      return "containers";
    }
    return item.unit_of_measure || "units";
  }

  async function startEdit(item) {
    const record = getRecord(item.id);
    setEditQty(record?.quantity ?? 0);
    setEditingId(item.id);
  }

  async function saveEdit(item) {
    setSaving(true);
    const record = getRecord(item.id);
    if (record) {
      await base44.entities.StockInventory.update(record.id, { quantity: editQty });
      setStockInventory((prev) => prev.map((s) => s.id === record.id ? { ...s, quantity: editQty } : s));
    } else {
      const created = await base44.entities.StockInventory.create({ item_id: item.id, quantity: editQty });
      setStockInventory((prev) => [...prev, created]);
    }
    setEditingId(null);
    setSaving(false);
  }

  function typeColor(item) {
    if (item.item_type === "ingredient") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (item.item_type === "finished_product") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  }

  function typeLabel(item) {
    if (item.item_type === "ingredient") return "Ingredient";
    if (item.item_type === "finished_product") return "Finished Product";
    return "Material";
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No items yet. Go to the "Items" tab to add items to your inventory system.
      </p>
    );
  }

  // Group by type
  const groups = [
    { key: "ingredient", label: "Ingredients" },
    { key: "finished_product", label: "Finished Products" },
    { key: "material", label: "Materials" },
  ];

  return (
    <div className="space-y-8">
      {groups.map(({ key, label }) => {
        const groupItems = items.filter((i) => i.item_type === key);
        if (groupItems.length === 0) return null;
        return (
          <div key={key}>
            <h3 className="font-heading font-semibold mb-3">{label}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupItems.map((item) => {
                const record = getRecord(item.id);
                const qty = record?.quantity ?? 0;
                const isEditing = editingId === item.id;
                const unit = qtyLabel(item);

                return (
                  <div key={item.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeColor(item)}`}>{typeLabel(item)}</span>
                      </div>
                      {!isEditing && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground block">Quantity ({unit})</label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={editQty}
                          onChange={(e) => setEditQty(parseFloat(e.target.value) || 0)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1" onClick={() => saveEdit(item)} disabled={saving}>
                            <Check className="w-3 h-3" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted rounded-xl px-4 py-3 text-center">
                        <p className="text-2xl font-heading font-bold">{qty % 1 === 0 ? qty : qty.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{unit} on hand</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}