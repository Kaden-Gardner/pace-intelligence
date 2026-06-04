import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BLANK = {
  name: "",
  item_type: "ingredient",
  source: "purchased",
  state: "liquid",
  unit_of_measure: "",
  units_per_container: 1,
  unit_of_usage: "",
  material_form: "container",
  items_per_container: 1,
  roll_unit: "",
  roll_size: 0,
  recipe: [],
};

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${value === o.value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function StockItemsSubtab({ items, setItems }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  // For recipe ingredient picker
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");

  function openNew() {
    setForm(BLANK);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(item) {
    setForm({ ...BLANK, ...item });
    setEditingId(item.id);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
  }

  function set(field, val) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  function addRecipeItem(item) {
    if (form.recipe.some((r) => r.item_id === item.id)) return;
    set("recipe", [...form.recipe, { item_id: item.id, amount: 1 }]);
    setRecipePickerOpen(false);
    setRecipeSearch("");
  }

  function removeRecipeItem(itemId) {
    set("recipe", form.recipe.filter((r) => r.item_id !== itemId));
  }

  function updateRecipeAmount(itemId, amount) {
    set("recipe", form.recipe.map((r) => r.item_id === itemId ? { ...r, amount } : r));
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form };
    // Clean up irrelevant fields
    if (payload.item_type !== "ingredient") { delete payload.state; }
    if (!["ingredient", "finished_product"].includes(payload.item_type)) { delete payload.source; delete payload.unit_of_measure; delete payload.units_per_container; delete payload.unit_of_usage; delete payload.recipe; }
    if (payload.source !== "produced") { payload.recipe = []; }
    if (payload.item_type !== "material") { delete payload.material_form; delete payload.items_per_container; delete payload.roll_unit; delete payload.roll_size; }
    if (payload.item_type === "material" && payload.material_form !== "container") { delete payload.items_per_container; }
    if (payload.item_type === "material" && payload.material_form !== "roll") { delete payload.roll_unit; delete payload.roll_size; }

    if (editingId) {
      const updated = await base44.entities.StockItem.update(editingId, payload);
      setItems((prev) => prev.map((i) => i.id === editingId ? { ...i, ...payload } : i));
    } else {
      const created = await base44.entities.StockItem.create(payload);
      setItems((prev) => [...prev, created]);
    }
    setSaving(false);
    cancel();
  }

  async function deleteItem(id) {
    await base44.entities.StockItem.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const isProduced = form.source === "produced";
  const isIngredient = form.item_type === "ingredient";
  const isFinished = form.item_type === "finished_product";
  const isMaterial = form.item_type === "material";
  const hasRecipe = (isIngredient || isFinished) && isProduced;

  // Items available for recipes (not the item itself)
  const recipeableItems = items.filter((i) => i.id !== editingId);
  const filteredRecipeItems = recipeableItems.filter((i) =>
    !recipeSearch || i.name.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  function getItemName(id) {
    return items.find((i) => i.id === id)?.name || "Unknown";
  }

  function getUsageUnit(id) {
    const it = items.find((i) => i.id === id);
    if (!it) return "";
    if (it.item_type === "material") return it.material_form === "roll" ? (it.roll_unit || "") : "ea";
    return it.unit_of_usage || it.unit_of_measure || "";
  }

  function typeLabel(item) {
    if (item.item_type === "ingredient") return "Ingredient";
    if (item.item_type === "finished_product") return "Finished Product";
    if (item.item_type === "material") return "Material";
    return item.item_type;
  }

  function typeColor(item) {
    if (item.item_type === "ingredient") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (item.item_type === "finished_product") return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <h3 className="font-heading font-semibold text-lg">{editingId ? "Edit Item" : "New Item"}</h3>

          {/* Name */}
          <Field label="Item Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Xanthan Gum" />
          </Field>

          {/* Item Type */}
          <Field label="Item Type">
            <SegmentedControl
              value={form.item_type}
              onChange={(v) => set("item_type", v)}
              options={[
                { value: "ingredient", label: "Ingredient" },
                { value: "finished_product", label: "Finished Product" },
                { value: "material", label: "Material" },
              ]}
            />
          </Field>

          {/* Ingredient / Finished Product specific */}
          {(isIngredient || isFinished) && (
            <>
              <Field label="Source">
                <SegmentedControl
                  value={form.source}
                  onChange={(v) => set("source", v)}
                  options={[
                    { value: "purchased", label: "Purchased" },
                    { value: "produced", label: "Produced In-House" },
                  ]}
                />
              </Field>

              {isIngredient && (
                <Field label="State">
                  <SegmentedControl
                    value={form.state}
                    onChange={(v) => set("state", v)}
                    options={[
                      { value: "solid", label: "Solid" },
                      { value: "liquid", label: "Liquid" },
                    ]}
                  />
                </Field>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Unit of Measure (storage, e.g. gal, lb)">
                  <Input value={form.unit_of_measure} onChange={(e) => set("unit_of_measure", e.target.value)} placeholder="gal" />
                </Field>
                <Field label="Units per Container">
                  <Input type="number" min="0" step="any" value={form.units_per_container} onChange={(e) => set("units_per_container", parseFloat(e.target.value) || 0)} />
                </Field>
                <Field label="Unit of Usage (calculation, e.g. cups, oz)">
                  <Input value={form.unit_of_usage} onChange={(e) => set("unit_of_usage", e.target.value)} placeholder="cups" />
                </Field>
              </div>

              {/* Recipe section */}
              {hasRecipe && (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Recipe / Required Items</p>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setRecipePickerOpen((v) => !v)}>
                      <Plus className="w-3 h-3" /> Add Ingredient
                    </Button>
                  </div>

                  {/* Picker dropdown */}
                  {recipePickerOpen && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <Input
                          placeholder="Search items..."
                          value={recipeSearch}
                          onChange={(e) => setRecipeSearch(e.target.value)}
                          className="h-7 text-xs"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredRecipeItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3">No items found. Add items first.</p>
                        ) : (
                          filteredRecipeItems.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => addRecipeItem(it)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                            >
                              <span>{it.name}</span>
                              <span className="text-xs text-muted-foreground">{typeLabel(it)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recipe rows */}
                  {form.recipe.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No items added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {form.recipe.map((r) => (
                        <div key={r.item_id} className="flex items-center gap-2">
                          <span className="text-sm flex-1">{getItemName(r.item_id)}</span>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={r.amount}
                            onChange={(e) => updateRecipeAmount(r.item_id, parseFloat(e.target.value) || 0)}
                            className="w-20 h-7 text-xs"
                          />
                          <span className="text-xs text-muted-foreground w-10">{getUsageUnit(r.item_id)}</span>
                          <button type="button" onClick={() => removeRecipeItem(r.item_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Material specific */}
          {isMaterial && (
            <>
              <Field label="Material Form">
                <SegmentedControl
                  value={form.material_form}
                  onChange={(v) => set("material_form", v)}
                  options={[
                    { value: "container", label: "Container" },
                    { value: "roll", label: "Roll" },
                  ]}
                />
              </Field>

              {form.material_form === "container" && (
                <Field label="Items per Container (usage = 1 item)">
                  <Input type="number" min="1" step="1" value={form.items_per_container} onChange={(e) => set("items_per_container", parseFloat(e.target.value) || 1)} className="max-w-xs" />
                </Field>
              )}

              {form.material_form === "roll" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Unit of Usage (e.g. feet, inches)">
                    <Input value={form.roll_unit} onChange={(e) => set("roll_unit", e.target.value)} placeholder="feet" />
                  </Field>
                  <Field label="Roll Size (in that unit)">
                    <Input type="number" min="0" step="any" value={form.roll_size} onChange={(e) => set("roll_size", parseFloat(e.target.value) || 0)} />
                  </Field>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving} className="gap-2"><Check className="w-4 h-4" /> {editingId ? "Update" : "Create"}</Button>
            <Button variant="ghost" onClick={cancel}><X className="w-4 h-4" /> Cancel</Button>
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No items yet. Click "Add Item" to get started.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <div key={item.id} className="bg-card rounded-xl border border-border">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor(item)}`}>{typeLabel(item)}</span>
                  <p className="font-medium flex-1">{item.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.item_type !== "material" && item.unit_of_measure && <span>{item.unit_of_measure}</span>}
                    {item.source && <span className="capitalize">{item.source}</span>}
                    {item.material_form && <span className="capitalize">{item.material_form}</span>}
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Item</AlertDialogTitle>
                          <AlertDialogDescription>Delete "{item.name}"? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteItem(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 text-sm grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-muted-foreground">
                    {item.item_type !== "material" && (
                      <>
                        {item.unit_of_measure && <div><span className="font-medium text-foreground">Storage unit:</span> {item.unit_of_measure}</div>}
                        {item.units_per_container && <div><span className="font-medium text-foreground">Per container:</span> {item.units_per_container} {item.unit_of_measure}</div>}
                        {item.unit_of_usage && <div><span className="font-medium text-foreground">Usage unit:</span> {item.unit_of_usage}</div>}
                        {item.state && <div><span className="font-medium text-foreground">State:</span> {item.state}</div>}
                      </>
                    )}
                    {item.item_type === "material" && item.material_form === "container" && (
                      <div><span className="font-medium text-foreground">Items per container:</span> {item.items_per_container}</div>
                    )}
                    {item.item_type === "material" && item.material_form === "roll" && (
                      <>
                        <div><span className="font-medium text-foreground">Usage unit:</span> {item.roll_unit}</div>
                        <div><span className="font-medium text-foreground">Roll size:</span> {item.roll_size} {item.roll_unit}</div>
                      </>
                    )}
                    {item.recipe?.length > 0 && (
                      <div className="col-span-full">
                        <span className="font-medium text-foreground">Recipe:</span>{" "}
                        {item.recipe.map((r) => `${r.amount} ${getUsageUnit(r.item_id)} ${getItemName(r.item_id)}`).join(", ")}
                      </div>
                    )}
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