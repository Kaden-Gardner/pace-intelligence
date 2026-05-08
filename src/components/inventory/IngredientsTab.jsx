import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Check, X, Settings } from "lucide-react";

const INGREDIENTS = [
  { key: "xanthan_gum",  label: "Xanthan Gum",  unit: "lbs" },
  { key: "sugar",        label: "Sugar",         unit: "50 lb bags" },
  { key: "dextrose",     label: "Dextrose",      unit: "50 lb bags" },
  { key: "citric_acid",  label: "Citric Acid",   unit: "cups" },
];

const DEFAULT_AMOUNTS = {
  xanthan_gum: 2,
  sugar: 3,
  dextrose: 2,
  citric_acid: 1,
};

export default function IngredientsTab({ flavors }) {
  const [ingInv, setIngInv] = useState([]);
  const [jugInv, setJugInv] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editing ingredient qty
  const [editIngKey, setEditIngKey] = useState(null);
  const [editIngVal, setEditIngVal] = useState(0);

  // Editing jug qty
  const [editJugId, setEditJugId] = useState(null);
  const [editJugVal, setEditJugVal] = useState(0);

  // Add jug form
  const [showAddJug, setShowAddJug] = useState(false);
  const [addJugFlavor, setAddJugFlavor] = useState("");
  const [addJugQty, setAddJugQty] = useState(1);

  // Defaults editor
  const [showDefaults, setShowDefaults] = useState(false);
  const [editDefaults, setEditDefaults] = useState({});
  const [savingDefaults, setSavingDefaults] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [ing, jug, def] = await Promise.all([
      base44.entities.IngredientInventory.list(),
      base44.entities.FlavorJugInventory.list(),
      base44.entities.BaseMixDefaults.list(),
    ]);
    setIngInv(ing);
    setJugInv(jug);
    setDefaults(def);
    setLoading(false);
  }

  function getIngRecord(key) {
    return ingInv.find((i) => i.ingredient === key);
  }

  async function saveIngQty(key) {
    const existing = getIngRecord(key);
    if (existing) {
      await base44.entities.IngredientInventory.update(existing.id, { quantity: editIngVal });
      setIngInv((prev) => prev.map((i) => i.id === existing.id ? { ...i, quantity: editIngVal } : i));
    } else {
      const created = await base44.entities.IngredientInventory.create({ ingredient: key, quantity: editIngVal });
      setIngInv((prev) => [...prev, created]);
    }
    setEditIngKey(null);
  }

  async function saveJugQty(jug) {
    await base44.entities.FlavorJugInventory.update(jug.id, { gallons: editJugVal });
    setJugInv((prev) => prev.map((j) => j.id === jug.id ? { ...j, gallons: editJugVal } : j));
    setEditJugId(null);
  }

  async function addJug() {
    if (!addJugFlavor) return;
    setSaving(true);
    const existing = jugInv.find((j) => j.flavor_id === addJugFlavor);
    if (existing) {
      const newVal = (existing.gallons || 0) + Number(addJugQty);
      await base44.entities.FlavorJugInventory.update(existing.id, { gallons: newVal });
      setJugInv((prev) => prev.map((j) => j.id === existing.id ? { ...j, gallons: newVal } : j));
    } else {
      const created = await base44.entities.FlavorJugInventory.create({ flavor_id: addJugFlavor, gallons: Number(addJugQty) });
      setJugInv((prev) => [...prev, created]);
    }
    setShowAddJug(false);
    setAddJugFlavor("");
    setAddJugQty(1);
    setSaving(false);
  }

  function getDefaultAmount(key) {
    const rec = defaults.find((d) => d.ingredient === key);
    return rec ? rec.amount_per_batch : (DEFAULT_AMOUNTS[key] ?? 0);
  }

  function openDefaults() {
    const map = {};
    INGREDIENTS.forEach((ing) => { map[ing.key] = getDefaultAmount(ing.key); });
    setEditDefaults(map);
    setShowDefaults(true);
  }

  async function saveDefaults() {
    setSavingDefaults(true);
    await Promise.all(
      INGREDIENTS.map(async (ing) => {
        const existing = defaults.find((d) => d.ingredient === ing.key);
        const val = Number(editDefaults[ing.key]) || 0;
        if (existing) {
          await base44.entities.BaseMixDefaults.update(existing.id, { amount_per_batch: val });
        } else {
          await base44.entities.BaseMixDefaults.create({ ingredient: ing.key, amount_per_batch: val });
        }
      })
    );
    const fresh = await base44.entities.BaseMixDefaults.list();
    setDefaults(fresh);
    setSavingDefaults(false);
    setShowDefaults(false);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  const flavorMap = {};
  flavors.forEach((f) => { flavorMap[f.id] = f; });

  return (
    <div className="space-y-8">
      {/* ─── Dry Ingredients ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-lg">Dry Ingredients</h3>
          <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={openDefaults}>
            <Settings className="w-3 h-3" /> Base Mix Defaults
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {INGREDIENTS.map((ing) => {
            const rec = getIngRecord(ing.key);
            const qty = rec?.quantity ?? 0;
            const perBatch = getDefaultAmount(ing.key);
            return (
              <div key={ing.key} className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-heading font-semibold text-sm">{ing.label}</h4>
                  {editIngKey !== ing.key && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditIngKey(ing.key); setEditIngVal(qty); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {editIngKey === ing.key ? (
                  <div className="space-y-2">
                    <Input type="number" min="0" step="0.01" value={editIngVal} onChange={(e) => setEditIngVal(parseFloat(e.target.value) || 0)} autoFocus />
                    <div className="flex gap-1">
                      <Button size="sm" className="gap-1 h-7" onClick={() => saveIngQty(ing.key)}><Check className="w-3 h-3" /> Save</Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditIngKey(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-heading font-bold">{qty}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ing.unit}</p>
                    <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{perBatch} {ing.unit}/batch default</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Flavor Jugs ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-lg">Flavor Jugs</h3>
          <Button className="gap-2" size="sm" onClick={() => setShowAddJug(true)}>
            <Plus className="w-4 h-4" /> Add Jugs
          </Button>
        </div>

        {showAddJug && (
          <div className="bg-card rounded-2xl border border-border p-5 mb-4">
            <h4 className="font-heading font-semibold mb-3">Add Flavor Jugs</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavor</label>
                <Select value={addJugFlavor} onValueChange={setAddJugFlavor}>
                  <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                  <SelectContent>{flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Gallons (jugs) to Add</label>
                <Input type="number" min="1" value={addJugQty} onChange={(e) => setAddJugQty(parseFloat(e.target.value) || 1)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addJug} disabled={saving} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
              <Button variant="ghost" onClick={() => setShowAddJug(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {jugInv.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flavor jugs recorded yet. Add jugs above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {jugInv.map((jug) => {
              const fl = flavorMap[jug.flavor_id];
              return (
                <div key={jug.id} className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {fl?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fl.color }} />}
                    <p className="font-medium text-sm">{fl?.name || "Unknown"}</p>
                  </div>
                  {editJugId === jug.id ? (
                    <div className="space-y-2">
                      <Input type="number" min="0" step="0.5" value={editJugVal} onChange={(e) => setEditJugVal(parseFloat(e.target.value) || 0)} autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" className="gap-1 h-7" onClick={() => saveJugQty(jug)}><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditJugId(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-heading font-bold">{jug.gallons ?? 0}</p>
                        <p className="text-xs text-muted-foreground">gallons</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditJugId(jug.id); setEditJugVal(jug.gallons ?? 0); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Base Mix Defaults Modal ─── */}
      {showDefaults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">Base Mix Defaults</h3>
            <p className="text-sm text-muted-foreground mb-5">Set how much of each ingredient is consumed per batch during base mixing. These amounts will be deducted automatically when a base mixing shift is logged.</p>
            <div className="space-y-4">
              {INGREDIENTS.map((ing) => (
                <div key={ing.key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium">{ing.label}</label>
                    <p className="text-xs text-muted-foreground">{ing.unit} per batch</p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24"
                    value={editDefaults[ing.key] ?? ""}
                    onChange={(e) => setEditDefaults((prev) => ({ ...prev, [ing.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button variant="outline" onClick={() => setShowDefaults(false)}>Cancel</Button>
              <Button onClick={saveDefaults} disabled={savingDefaults}>{savingDefaults ? "Saving..." : "Save Defaults"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}