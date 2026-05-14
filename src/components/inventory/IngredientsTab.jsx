import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Check, X, Settings, FlaskConical } from "lucide-react";

export const INGREDIENTS = [
  { key: "xanthan_gum", label: "Xanthan Gum",  unit: "lbs" },
  { key: "sugar",       label: "Sugar",         unit: "50 lb bags" },
  { key: "dextrose",    label: "Dextrose",       unit: "50 lb bags" },
  { key: "citric_acid", label: "Citric Acid",   unit: "cups (from 50 lb bag)" },
  { key: "pear_juice",  label: "Pear Juice",    unit: "5-gal buckets" },
];

const GLOBAL_DEFAULTS = { xanthan_gum: 2, sugar: 3, dextrose: 2, citric_acid: 1, pear_juice: 0 };

export default function IngredientsTab({ flavors, flavorSets }) {
  const [ingInv, setIngInv] = useState([]);
  const [jugInv, setJugInv] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editIngKey, setEditIngKey] = useState(null);
  const [editIngVal, setEditIngVal] = useState(0);

  const [editJugId, setEditJugId] = useState(null);
  const [editJugVal, setEditJugVal] = useState(0);

  const [jugDefaults, setJugDefaults] = useState([]);
  const [editJugDefaultId, setEditJugDefaultId] = useState(null); // flavor_id being edited
  const [editJugDefaultVal, setEditJugDefaultVal] = useState("");

  const [showAddJug, setShowAddJug] = useState(false);
  const [addJugFlavor, setAddJugFlavor] = useState("");
  const [addJugQty, setAddJugQty] = useState(1);

  // Defaults modal
  const [showDefaults, setShowDefaults] = useState(false);
  // selectedFsId: null = global, string = flavorset id
  const [selectedFsId, setSelectedFsId] = useState(null);
  const [editDefaults, setEditDefaults] = useState({});
  const [savingDefaults, setSavingDefaults] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [ing, jug, def, jugDef] = await Promise.all([
      base44.entities.IngredientInventory.list(),
      base44.entities.FlavorJugInventory.list(),
      base44.entities.BaseMixDefaults.list(),
      base44.entities.FlavorJugDefaults.list(),
    ]);
    setIngInv(ing);
    setJugInv(jug);
    setDefaults(def);
    setJugDefaults(jugDef);
    setLoading(false);
  }

  async function saveJugDefault(flavorId) {
    const oz = parseFloat(editJugDefaultVal) || 0;
    const existing = jugDefaults.find((d) => d.flavor_id === flavorId);
    if (existing) {
      await base44.entities.FlavorJugDefaults.update(existing.id, { oz_per_gallon_base: oz });
      setJugDefaults((prev) => prev.map((d) => d.id === existing.id ? { ...d, oz_per_gallon_base: oz } : d));
    } else {
      const created = await base44.entities.FlavorJugDefaults.create({ flavor_id: flavorId, oz_per_gallon_base: oz });
      setJugDefaults((prev) => [...prev, created]);
    }
    setEditJugDefaultId(null);
    setEditJugDefaultVal("");
  }

  function getIngRecord(key) {
    return ingInv.find((i) => i.ingredient === key);
  }

  // Get default amount for a given ingredient + optional flavorset (falls back to global)
  function getDefaultAmount(key, fsId = null) {
    if (fsId) {
      const fsRec = defaults.find((d) => d.ingredient === key && d.flavorset_id === fsId);
      if (fsRec) return fsRec.amount_per_batch;
    }
    const globalRec = defaults.find((d) => d.ingredient === key && !d.flavorset_id);
    return globalRec ? globalRec.amount_per_batch : (GLOBAL_DEFAULTS[key] ?? 0);
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

  function openDefaults(fsId = null) {
    setSelectedFsId(fsId);
    const map = {};
    INGREDIENTS.forEach((ing) => { map[ing.key] = getDefaultAmount(ing.key, fsId); });
    setEditDefaults(map);
    setShowDefaults(true);
  }

  async function saveDefaults() {
    setSavingDefaults(true);
    await Promise.all(
      INGREDIENTS.map(async (ing) => {
        const val = Number(editDefaults[ing.key]) || 0;
        // Find existing record matching ingredient + flavorset
        const existing = defaults.find((d) =>
          d.ingredient === ing.key &&
          (selectedFsId ? d.flavorset_id === selectedFsId : !d.flavorset_id)
        );
        if (existing) {
          await base44.entities.BaseMixDefaults.update(existing.id, { amount_per_batch: val });
        } else {
          const payload = { ingredient: ing.key, amount_per_batch: val };
          if (selectedFsId) payload.flavorset_id = selectedFsId;
          await base44.entities.BaseMixDefaults.create(payload);
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
      {/* ─── Dry Ingredients & Pear Juice ─── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-heading font-semibold text-lg">Ingredients</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Set defaults:</span>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openDefaults(null)}>
              <Settings className="w-3 h-3" /> Global
            </Button>
            {flavorSets.map((fs) => (
              <Button key={fs.id} variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openDefaults(fs.id)}>
                {fs.color && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                {fs.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {INGREDIENTS.map((ing) => {
            const rec = getIngRecord(ing.key);
            const qty = rec?.quantity ?? 0;
            const globalDefault = getDefaultAmount(ing.key, null);
            return (
              <div key={ing.key} className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-heading font-semibold text-sm leading-tight">{ing.label}</h4>
                  {editIngKey !== ing.key && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => { setEditIngKey(ing.key); setEditIngVal(qty); }}>
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
                    <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{globalDefault} {ing.unit}/batch (global)</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Per-flavorset default preview */}
        {flavorSets.length > 0 && (
          <div className="mt-4 bg-muted/50 rounded-2xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">Per-Flavorset Overrides (amounts per batch)</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    <th className="text-left text-muted-foreground font-medium pb-2 pr-4">Flavorset</th>
                    {INGREDIENTS.map((ing) => (
                      <th key={ing.key} className="text-left text-muted-foreground font-medium pb-2 pr-4 whitespace-nowrap">{ing.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flavorSets.map((fs) => (
                    <tr key={fs.id}>
                      <td className="pr-4 py-1 font-medium flex items-center gap-1.5">
                        {fs.color && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                        {fs.name}
                      </td>
                      {INGREDIENTS.map((ing) => {
                        const fsSpecific = defaults.find((d) => d.ingredient === ing.key && d.flavorset_id === fs.id);
                        const val = fsSpecific ? fsSpecific.amount_per_batch : null;
                        return (
                          <td key={ing.key} className="pr-4 py-1">
                            {val !== null ? <span className="text-foreground font-medium">{val}</span> : <span className="text-muted-foreground/50">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── Flavor Jugs ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-lg">Flavor Containers</h3>
          <Button className="gap-2" size="sm" onClick={() => setShowAddJug(true)}>
            <Plus className="w-4 h-4" /> Add Containers
          </Button>
        </div>

        {showAddJug && (
          <div className="bg-card rounded-2xl border border-border p-5 mb-4">
            <h4 className="font-heading font-semibold mb-3">Add Flavor Containers</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavor</label>
                <Select value={addJugFlavor} onValueChange={setAddJugFlavor}>
                  <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                  <SelectContent>{flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Containers to Add</label>
                <Input type="number" min="1" step="1" value={addJugQty} onChange={(e) => setAddJugQty(parseFloat(e.target.value) || 1)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addJug} disabled={saving} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
              <Button variant="ghost" onClick={() => setShowAddJug(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {jugInv.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flavor jugs recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {jugInv.map((jug) => {
              const fl = flavorMap[jug.flavor_id];
              const jugDefault = jugDefaults.find((d) => d.flavor_id === jug.flavor_id);
              const isEditingDefault = editJugDefaultId === jug.flavor_id;
              return (
                <div key={jug.id} className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-1">
                     {fl?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fl.color }} />}
                     <p className="font-medium text-sm">{fl?.name || "Unknown"}</p>
                   </div>
                   {fl?.container_type && (
                     <p className="text-[10px] text-muted-foreground mb-1">
                       {{ liquid_1gal: "1-gal jug", liquid_5gal: "5-gal jug", powder_5gal: "5-gal bucket (powder)" }[fl.container_type]}
                     </p>
                   )}
                  {editJugId === jug.id ? (
                    <div className="space-y-2">
                      <Input type="number" min="0" step="1" value={editJugVal} onChange={(e) => setEditJugVal(parseFloat(e.target.value) || 0)} autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" className="gap-1 h-7" onClick={() => saveJugQty(jug)}><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditJugId(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-heading font-bold">{jug.gallons ?? 0}</p>
                          <p className="text-xs text-muted-foreground">containers</p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditJugId(jug.id); setEditJugVal(jug.gallons ?? 0); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                      {/* oz per gallon default */}
                      <div className="mt-2 pt-2 border-t border-border">
                        {isEditingDefault ? (
                          <div className="flex items-center gap-1">
                            <Input type="number" min="0" step="0.1" className="h-7 text-xs w-20" value={editJugDefaultVal}
                              onChange={(e) => setEditJugDefaultVal(e.target.value)} autoFocus
                              onKeyDown={(e) => e.key === "Enter" && saveJugDefault(jug.flavor_id)} />
                            <span className="text-[10px] text-muted-foreground">oz/gal</span>
                            <Button size="sm" className="h-6 w-6 p-0" onClick={() => saveJugDefault(jug.flavor_id)}><Check className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditJugDefaultId(null)}><X className="w-3 h-3" /></Button>
                          </div>
                        ) : (
                          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
                            onClick={() => { setEditJugDefaultId(jug.flavor_id); setEditJugDefaultVal(jugDefault?.oz_per_gallon_base ?? ""); }}>
                            <FlaskConical className="w-3 h-3 flex-shrink-0" />
                            {jugDefault ? `${jugDefault.oz_per_gallon_base} oz/gal base` : "Set oz/gal default"}
                          </button>
                        )}
                      </div>
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
            <p className="text-sm text-muted-foreground mb-1">
              {selectedFsId
                ? <>Override amounts for <span className="font-medium text-foreground">{flavorSets.find((f) => f.id === selectedFsId)?.name}</span>.</>
                : "Global defaults — used when no flavorset-specific override exists."}
            </p>
            <p className="text-xs text-muted-foreground mb-5">Amounts per batch. Deducted automatically when a base mixing shift is saved.</p>
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