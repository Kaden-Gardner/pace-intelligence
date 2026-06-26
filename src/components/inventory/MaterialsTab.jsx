import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Check, X, Plus, Trash2, Settings } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const MATERIALS = [
  { key: "individual_wrap", label: "Individual Wrap",    unit: "rolls" },
  { key: "clear_wrap",      label: "Clear Wrap",         unit: "rolls" },
  { key: "popsicle_sticks", label: "Popsicle Sticks",   unit: "boxes" },
  { key: "gloves_small",    label: "Gloves (Small)",     unit: "boxes" },
  { key: "gloves_medium",   label: "Gloves (Medium)",    unit: "boxes" },
  { key: "gloves_large",    label: "Gloves (Large)",     unit: "boxes" },
  { key: "gloves_xlarge",   label: "Gloves (XL)",        unit: "boxes" },
  { key: "box_stacks",      label: "Box Stacks",         unit: "stacks" },
];

const STACKS_PER_PALLET = 10;

// MaterialDefaults entity key format: material key, stored as "material_default_{key}"
// We reuse BaseMixDefaults but with ingredient field = material key and a special marker

export default function MaterialsTab({ flavorSets }) {
  const [matInv, setMatInv] = useState([]);
  const [bagInv, setBagInv] = useState([]);
  const [matDefaults, setMatDefaults] = useState({});
  const [loading, setLoading] = useState(true);

  const [editMatKey, setEditMatKey] = useState(null);
  const [editMatVal, setEditMatVal] = useState(0);

  // Defaults modal
  const [showDefaults, setShowDefaults] = useState(false);
  const [editDefaultsMap, setEditDefaultsMap] = useState({});
  const [savingDefaults, setSavingDefaults] = useState(false);

  // Bag adjustments
  const [editBagId, setEditBagId] = useState(null);
  const [editBagCases, setEditBagCases] = useState(0);
  const [editBagLoose, setEditBagLoose] = useState(0);

  // Add bag stock
  const [showAddBag, setShowAddBag] = useState(false);
  const [addBagFs, setAddBagFs] = useState("");
  const [addBagCases, setAddBagCases] = useState(1);
  const [addBagPerCase, setAddBagPerCase] = useState(100);
  const [saving, setSaving] = useState(false);



  useEffect(() => { load(); }, []);

  async function load() {
    const [mat, bag, matDef] = await Promise.all([
      base44.entities.MaterialInventory.list(),
      base44.entities.BagInventory.list(),
      base44.entities.MaterialDefaults.list(),
    ]);
    setMatInv(mat);
    setBagInv(bag);
    const map = {};
    matDef.forEach((d) => { map[d.material_key] = d; });
    setMatDefaults(map);
    setLoading(false);
  }

  // Only these materials have configurable qty defaults
  const DEFAULTABLE_MATERIALS = [
    { key: "box_stacks",      label: "Box Stacks",      description: "Cases per stack", unit: "cases/stack" },
    { key: "popsicle_sticks", label: "Popsicle Sticks", description: "Sticks per box",  unit: "sticks/box" },
  ];

  // Wrap defaults (feet per roll + feet per popsicle)
  const WRAP_MATERIALS = [
    { key: "individual_wrap", label: "Individual Wrap" },
    { key: "clear_wrap",      label: "Clear Wrap" },
  ];
  const [editWrapMap, setEditWrapMap] = useState({}); // { [key]: { feet_per_roll, feet_per_popsicle } }
  const [showWrapDefaults, setShowWrapDefaults] = useState(false);
  const [savingWrap, setSavingWrap] = useState(false);

  function openWrapDefaults() {
    const map = {};
    WRAP_MATERIALS.forEach((m) => {
      map[m.key] = {
        feet_per_roll: matDefaults[m.key]?.feet_per_roll ?? 0,
        feet_per_popsicle: matDefaults[m.key]?.feet_per_popsicle ?? 0,
      };
    });
    setEditWrapMap(map);
    setShowWrapDefaults(true);
  }

  async function saveWrapDefaults() {
    setSavingWrap(true);
    await Promise.all(
      WRAP_MATERIALS.map(async (m) => {
        const { feet_per_roll, feet_per_popsicle } = editWrapMap[m.key] || {};
        const existing = matDefaults[m.key];
        if (existing) {
          await base44.entities.MaterialDefaults.update(existing.id, {
            feet_per_roll: Number(feet_per_roll) || 0,
            feet_per_popsicle: Number(feet_per_popsicle) || 0,
          });
        } else {
          await base44.entities.MaterialDefaults.create({
            material_key: m.key,
            feet_per_roll: Number(feet_per_roll) || 0,
            feet_per_popsicle: Number(feet_per_popsicle) || 0,
          });
        }
      })
    );
    const fresh = await base44.entities.MaterialDefaults.list();
    const map = {};
    fresh.forEach((d) => { map[d.material_key] = d; });
    setMatDefaults(map);
    setSavingWrap(false);
    setShowWrapDefaults(false);
  }

  function openDefaults() {
    const map = {};
    DEFAULTABLE_MATERIALS.forEach((m) => { map[m.key] = matDefaults[m.key]?.qty_per_shift ?? 0; });
    setEditDefaultsMap(map);
    setShowDefaults(true);
  }

  async function saveMatDefaults() {
    setSavingDefaults(true);
    await Promise.all(
      DEFAULTABLE_MATERIALS.map(async (m) => {
        const val = Number(editDefaultsMap[m.key]) || 0;
        const existing = matDefaults[m.key];
        if (existing) {
          await base44.entities.MaterialDefaults.update(existing.id, { qty_per_shift: val });
        } else {
          await base44.entities.MaterialDefaults.create({ material_key: m.key, qty_per_shift: val });
        }
      })
    );
    const fresh = await base44.entities.MaterialDefaults.list();
    const map = {};
    fresh.forEach((d) => { map[d.material_key] = d; });
    setMatDefaults(map);
    setSavingDefaults(false);
    setShowDefaults(false);
  }

  function getMatRecord(key) {
    return matInv.find((m) => m.material === key);
  }

  async function saveMatQty(key) {
    const existing = getMatRecord(key);
    if (existing) {
      await base44.entities.MaterialInventory.update(existing.id, { quantity: editMatVal });
      setMatInv((prev) => prev.map((m) => m.id === existing.id ? { ...m, quantity: editMatVal } : m));
    } else {
      const created = await base44.entities.MaterialInventory.create({ material: key, quantity: editMatVal });
      setMatInv((prev) => [...prev, created]);
    }
    setEditMatKey(null);
  }

  async function addBagStock() {
    if (!addBagFs) return;
    setSaving(true);
    const existing = bagInv.find((b) => b.flavorset_id === addBagFs);
    if (existing) {
      const newCases = (existing.cases || 0) + Number(addBagCases);
      await base44.entities.BagInventory.update(existing.id, { cases: newCases, bags_per_case: Number(addBagPerCase) });
      setBagInv((prev) => prev.map((b) => b.id === existing.id ? { ...b, cases: newCases, bags_per_case: Number(addBagPerCase) } : b));
    } else {
      const created = await base44.entities.BagInventory.create({ flavorset_id: addBagFs, cases: Number(addBagCases), loose_bags: 0, bags_per_case: Number(addBagPerCase) });
      setBagInv((prev) => [...prev, created]);
    }
    setShowAddBag(false);
    setAddBagFs("");
    setAddBagCases(1);
    setSaving(false);
  }

  async function saveBagEdit(bag) {
    await base44.entities.BagInventory.update(bag.id, { cases: editBagCases, loose_bags: editBagLoose });
    setBagInv((prev) => prev.map((b) => b.id === bag.id ? { ...b, cases: editBagCases, loose_bags: editBagLoose } : b));
    setEditBagId(null);
  }

  async function deleteBag(id) {
    await base44.entities.BagInventory.delete(id);
    setBagInv((prev) => prev.filter((b) => b.id !== id));
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });

  return (
    <div className="space-y-8">
      {/* ─── General Materials ─── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-heading font-semibold text-lg">General Materials</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openWrapDefaults}>
              <Settings className="w-3 h-3" /> Wrap Defaults
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={openDefaults}>
              <Settings className="w-3 h-3" /> Other Defaults
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MATERIALS.map((mat) => {
            const rec = getMatRecord(mat.key);
            const qty = rec?.quantity ?? 0;
            return (
              <div key={mat.key} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-sm leading-tight">{mat.label}</p>
                  {editMatKey !== mat.key && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={() => { setEditMatKey(mat.key); setEditMatVal(qty); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                {editMatKey === mat.key ? (
                  <div className="space-y-2 mt-2">
                    <Input type="number" min="0" step="1" value={editMatVal} onChange={(e) => setEditMatVal(parseFloat(e.target.value) || 0)} autoFocus />
                    <div className="flex gap-1">
                      <Button size="sm" className="gap-1 h-7" onClick={() => saveMatQty(mat.key)}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditMatKey(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-heading font-bold">{Math.floor(qty)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mat.unit}</p>
                    {mat.key === "box_stacks" && matDefaults[mat.key] && qty > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">≈ {qty * (matDefaults[mat.key].qty_per_shift || STACKS_PER_PALLET)} cases capacity</p>
                    )}
                    {mat.key === "box_stacks" && matDefaults[mat.key] && (
                      <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{matDefaults[mat.key].qty_per_shift} cases/stack</p>
                    )}
                    {mat.key === "popsicle_sticks" && matDefaults[mat.key] && (
                      <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{matDefaults[mat.key].qty_per_shift} sticks/box</p>
                    )}
                    {(mat.key === "individual_wrap" || mat.key === "clear_wrap") && matDefaults[mat.key] && (
                      <div className="mt-2 border-t border-border pt-2 space-y-0.5">
                        {matDefaults[mat.key].feet_per_roll > 0 && (
                          <p className="text-xs text-muted-foreground">{matDefaults[mat.key].feet_per_roll} ft/roll</p>
                        )}
                        {matDefaults[mat.key].feet_per_popsicle > 0 && (
                          <p className="text-xs text-muted-foreground">{matDefaults[mat.key].feet_per_popsicle} ft/popsicle</p>
                        )}
                        {matDefaults[mat.key].feet_per_roll > 0 && matDefaults[mat.key].feet_per_popsicle > 0 && (
                          <p className="text-xs font-medium text-primary">
                            ≈ {Math.round(matDefaults[mat.key].feet_per_roll / matDefaults[mat.key].feet_per_popsicle).toLocaleString()} pops/roll
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Bags ─── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-lg">Bags</h3>
          <Button size="sm" className="gap-2" onClick={() => setShowAddBag(true)}>
            <Plus className="w-4 h-4" /> Add Cases
          </Button>
        </div>

        {showAddBag && (
          <div className="bg-card rounded-2xl border border-border p-5 mb-4">
            <h4 className="font-heading font-semibold mb-3">Add Bag Cases</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset (bag type)</label>
                <Select value={addBagFs} onValueChange={setAddBagFs}>
                  <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                  <SelectContent>{flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cases to Add</label>
                <Input type="number" min="1" value={addBagCases} onChange={(e) => setAddBagCases(parseFloat(e.target.value) || 1)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Bags per Case</label>
                <Input type="number" min="1" value={addBagPerCase} onChange={(e) => setAddBagPerCase(parseFloat(e.target.value) || 100)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addBagStock} disabled={saving} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
              <Button variant="ghost" onClick={() => setShowAddBag(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {bagInv.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bags recorded yet. Add cases above.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bagInv.map((bag) => {
              const fs = fsMap[bag.flavorset_id];
              const bpc = bag.bags_per_case || 100;
              const totalBags = (bag.cases || 0) * bpc + (bag.loose_bags || 0);
              return (
                <div key={bag.id} className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {fs?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                      <h4 className="font-heading font-semibold">{fs?.name || "Unknown"}</h4>
                    </div>
                    <div className="flex gap-1">
                      {editBagId !== bag.id && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditBagId(bag.id); setEditBagCases(bag.cases || 0); setEditBagLoose(bag.loose_bags || 0); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Bag Record</AlertDialogTitle><AlertDialogDescription>Remove this bag inventory entry?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteBag(bag.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>

                  {editBagId === bag.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Full Cases</label>
                          <Input type="number" min="0" value={editBagCases} onChange={(e) => setEditBagCases(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Loose Bags</label>
                          <Input type="number" min="0" value={editBagLoose} onChange={(e) => setEditBagLoose(parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1" onClick={() => saveBagEdit(bag)}><Check className="w-3 h-3" /> Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditBagId(null)}><X className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-muted rounded-xl p-2 text-center">
                          <p className="text-xl font-heading font-bold">{bag.cases || 0}</p>
                          <p className="text-[10px] text-muted-foreground">cases</p>
                        </div>
                        <div className="bg-muted rounded-xl p-2 text-center">
                          <p className="text-xl font-heading font-bold">{bag.loose_bags || 0}</p>
                          <p className="text-[10px] text-muted-foreground">loose bags</p>
                        </div>
                        <div className="bg-muted rounded-xl p-2 text-center">
                          <p className="text-xl font-heading font-bold">{totalBags}</p>
                          <p className="text-[10px] text-muted-foreground">total bags</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{bpc} bags/case</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Wrap Defaults Modal ─── */}
      {showWrapDefaults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">Wrap Defaults</h3>
            <p className="text-sm text-muted-foreground mb-5">Set feet per roll and feet used per popsicle for each wrap type.</p>
            <div className="space-y-6">
              {WRAP_MATERIALS.map((m) => (
                <div key={m.key}>
                  <p className="font-medium text-sm mb-3">{m.label}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1">Feet per Roll</label>
                        <Input
                          type="number" min="0" step="1" className="w-full"
                          value={editWrapMap[m.key]?.feet_per_roll ?? ""}
                          onChange={(e) => setEditWrapMap((prev) => ({ ...prev, [m.key]: { ...prev[m.key], feet_per_roll: e.target.value } }))}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-5 flex-shrink-0">ft/roll</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground block mb-1">Feet per Popsicle</label>
                        <Input
                          type="number" min="0" step="0.01" className="w-full"
                          value={editWrapMap[m.key]?.feet_per_popsicle ?? ""}
                          onChange={(e) => setEditWrapMap((prev) => ({ ...prev, [m.key]: { ...prev[m.key], feet_per_popsicle: e.target.value } }))}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-5 flex-shrink-0">ft/pop</span>
                    </div>
                  </div>
                  {editWrapMap[m.key]?.feet_per_roll > 0 && editWrapMap[m.key]?.feet_per_popsicle > 0 && (
                    <p className="text-xs text-primary mt-2">
                      ≈ {Math.round(editWrapMap[m.key].feet_per_roll / editWrapMap[m.key].feet_per_popsicle).toLocaleString()} popsicles per roll
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button variant="outline" onClick={() => setShowWrapDefaults(false)}>Cancel</Button>
              <Button onClick={saveWrapDefaults} disabled={savingWrap}>{savingWrap ? "Saving..." : "Save Defaults"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Material Defaults Modal ─── */}
      {showDefaults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">Material Defaults</h3>
            <p className="text-sm text-muted-foreground mb-5">Configure capacity/usage constants for each material.</p>
            <div className="space-y-4">
              {DEFAULTABLE_MATERIALS.map((m) => (
                <div key={m.key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium">{m.label}</label>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  <Input
                    type="number" min="0" step="1" className="w-24"
                    value={editDefaultsMap[m.key] ?? ""}
                    onChange={(e) => setEditDefaultsMap((prev) => ({ ...prev, [m.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6 justify-end">
              <Button variant="outline" onClick={() => setShowDefaults(false)}>Cancel</Button>
              <Button onClick={saveMatDefaults} disabled={savingDefaults}>{savingDefaults ? "Saving..." : "Save Defaults"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}