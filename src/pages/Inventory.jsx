import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Truck, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import IngredientsTab from "../components/inventory/IngredientsTab";
import MaterialsTab from "../components/inventory/MaterialsTab";
import ProductBreakdownTab from "../components/inventory/ProductBreakdownTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EmptyState from "../components/EmptyState";

const GALLONS_PER_BATCH = 240;
const CASES_PER_PALLET = 66;

export default function Inventory() {
  const [flavorSets, setFlavorSets] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pickups, setPickups] = useState([]); // each has _items array
  const [pickupItemsMap, setPickupItemsMap] = useState({}); // orderId -> items[]
  const [scheduledShifts, setScheduledShifts] = useState([]);
  const [baseInventory, setBaseInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inventory edit
  const [editingInvId, setEditingInvId] = useState(null);
  const [editCases, setEditCases] = useState(0);

  // Add inventory manually
  const [showAddInv, setShowAddInv] = useState(false);
  const [addInvType, setAddInvType] = useState("flavorset");
  const [addInvForm, setAddInvForm] = useState({ flavorset_id: "", flavor_id: "", cases: 0 });

  // Pickup form
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [pickupForm, setPickupForm] = useState({ vendor_name: "", pickup_date: new Date().toISOString().split("T")[0], notes: "" });
  const [pickupItems, setPickupItems] = useState([]); // [{type:"flavorset"|"individual", flavorset_id, flavor_id, pallets, cases}]
  const [newItem, setNewItem] = useState({ type: "flavorset", flavorset_id: "", flavor_id: "", pallets: "", cases: "" });

  // Password gate for pickup CRUD
  const [crudPw, setCrudPw] = useState(null); // { action, data }
  const [crudPwInput, setCrudPwInput] = useState("");
  const [crudPwError, setCrudPwError] = useState("");

  function openCrudPw(action, data = null) {
    setCrudPw({ action, data });
    setCrudPwInput("");
    setCrudPwError("");
  }

  function confirmCrudPw() {
    if (crudPwInput !== "ecap") { setCrudPwError("Incorrect password."); return; }
    const { action, data } = crudPw;
    setCrudPw(null);
    if (action === "add-pickup") { setShowPickupForm(true); }
    else if (action === "delete-pickup") { deletePickup(data); }
  }

  // Flavorset display toggle: "pallets" | "cases"
  const [flavorsetDisplayMode, setFlavorsetDisplayMode] = useState("pallets");

  // Base inventory edit/delete
  const [editingBaseId, setEditingBaseId] = useState(null);
  const [editBaseGallons, setEditBaseGallons] = useState(0);

  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [fs, fl, inv, pk, bi, ss, allItems] = await Promise.all([
      base44.entities.FlavorSet.list("name").catch(() => []),
      base44.entities.Flavor.list("name").catch(() => []),
      base44.entities.Inventory.list().catch(() => []),
      base44.entities.OrderPickup.list("-pickup_date", 100).catch(() => []),
      base44.entities.BaseInventory.list().catch(() => []),
      base44.entities.ScheduledShift.list("-shift_date", 200).catch(() => []),
      base44.entities.OrderPickupItem.list().catch(() => []),
    ]);
    setFlavorSets(fs);
    setFlavors(fl);
    setInventory(inv);
    // Build items map
    const imap = {};
    allItems.forEach((item) => {
      if (!imap[item.order_id]) imap[item.order_id] = [];
      imap[item.order_id].push(item);
    });
    setPickupItemsMap(imap);
    setPickups(pk);
    setBaseInventory(bi);
    setScheduledShifts(ss);
    setLoading(false);
  }

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const flMap = {};
  flavors.forEach((f) => { flMap[f.id] = f; });

  const specialOrderNames = new Set(
    scheduledShifts
      .filter((s) => s.special_order && s.special_order_name)
      .map((s) => s.special_order_name.trim().toLowerCase())
  );

  // ---- INVENTORY HELPERS ----
  async function saveEditInv(inv) {
    await base44.entities.Inventory.update(inv.id, { cases: editCases });
    setInventory((prev) => prev.map((i) => (i.id === inv.id ? { ...i, cases: editCases } : i)));
    setEditingInvId(null);
  }

  async function saveAddInv() {
    if (addInvType === "flavorset" && !addInvForm.flavorset_id) return;
    if (addInvType === "individual" && !addInvForm.flavor_id) return;
    setSaving(true);
    if (addInvType === "flavorset") {
      const existing = inventory.find((i) => i.flavorset_id === addInvForm.flavorset_id && !i.flavor_id);
      if (existing) {
        const newCases = (existing.cases || 0) + Number(addInvForm.cases);
        await base44.entities.Inventory.update(existing.id, { cases: newCases });
        setInventory((prev) => prev.map((i) => (i.id === existing.id ? { ...i, cases: newCases } : i)));
      } else {
        const record = await base44.entities.Inventory.create({ flavorset_id: addInvForm.flavorset_id, cases: Number(addInvForm.cases) });
        setInventory((prev) => [...prev, record]);
      }
    } else {
      const existing = inventory.find((i) => i.flavor_id === addInvForm.flavor_id && !i.flavorset_id);
      if (existing) {
        const newCases = (existing.cases || 0) + Number(addInvForm.cases);
        await base44.entities.Inventory.update(existing.id, { cases: newCases });
        setInventory((prev) => prev.map((i) => (i.id === existing.id ? { ...i, cases: newCases } : i)));
      } else {
        const record = await base44.entities.Inventory.create({ flavor_id: addInvForm.flavor_id, cases: Number(addInvForm.cases) });
        setInventory((prev) => [...prev, record]);
      }
    }
    setAddInvForm({ flavorset_id: "", flavor_id: "", cases: 0 });
    setShowAddInv(false);
    setSaving(false);
  }

  async function deleteInv(id) {
    await base44.entities.Inventory.delete(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  // ---- PICKUP HELPERS ----
  function addPickupItem() {
    const item = { ...newItem };
    if (item.type === "flavorset") {
      if (!item.flavorset_id) return;
      const pallets = parseFloat(item.pallets) || 0;
      const cases = pallets > 0 ? Math.round(pallets * CASES_PER_PALLET) : parseFloat(item.cases) || 0;
      setPickupItems((prev) => [...prev, { type: "flavorset", flavorset_id: item.flavorset_id, flavor_id: null, pallets, cases }]);
    } else {
      if (!item.flavor_id) return;
      const cases = parseFloat(item.cases) || 0;
      setPickupItems((prev) => [...prev, { type: "individual", flavorset_id: null, flavor_id: item.flavor_id, pallets: 0, cases }]);
    }
    setNewItem({ type: newItem.type, flavorset_id: "", flavor_id: "", pallets: "", cases: "" });
  }

  async function savePickup(e) {
    e.preventDefault();
    if (pickupItems.length === 0) return;
    setSaving(true);
    const created = await base44.entities.OrderPickup.create({ ...pickupForm });
    // Create each item and deduct inventory
    const itemRecords = await Promise.all(pickupItems.map((item) =>
      base44.entities.OrderPickupItem.create({ order_id: created.id, ...item })
    ));
    setPickups((prev) => [{ ...created, _items: itemRecords }, ...prev]);

    // Deduct inventory for each item
    let updatedInv = [...inventory];
    for (const item of pickupItems) {
      if (item.type === "flavorset" && item.flavorset_id) {
        const idx = updatedInv.findIndex((i) => i.flavorset_id === item.flavorset_id && !i.flavor_id);
        if (idx >= 0) {
          const newCases = Math.max(0, (updatedInv[idx].cases || 0) - item.cases);
          await base44.entities.Inventory.update(updatedInv[idx].id, { cases: newCases });
          updatedInv[idx] = { ...updatedInv[idx], cases: newCases };
        }
      } else if (item.type === "individual" && item.flavor_id) {
        const idx = updatedInv.findIndex((i) => i.flavor_id === item.flavor_id && !i.flavorset_id);
        if (idx >= 0) {
          const newCases = Math.max(0, (updatedInv[idx].cases || 0) - item.cases);
          await base44.entities.Inventory.update(updatedInv[idx].id, { cases: newCases });
          updatedInv[idx] = { ...updatedInv[idx], cases: newCases };
        }
      }
    }
    setInventory(updatedInv);
    setPickupForm({ vendor_name: "", pickup_date: new Date().toISOString().split("T")[0], notes: "" });
    setPickupItems([]);
    setNewItem({ type: "flavorset", flavorset_id: "", flavor_id: "", pallets: "", cases: "" });
    setShowPickupForm(false);
    setSaving(false);
  }

  async function deletePickup(pickup) {
    // Get items to restore inventory
    const items = await base44.entities.OrderPickupItem.filter({ order_id: pickup.id });
    await base44.entities.OrderPickup.delete(pickup.id);
    await Promise.all(items.map((item) => base44.entities.OrderPickupItem.delete(item.id)));
    setPickups((prev) => prev.filter((p) => p.id !== pickup.id));
    // Restore inventory
    let updatedInv = [...inventory];
    for (const item of items) {
      if (item.flavorset_id) {
        const idx = updatedInv.findIndex((i) => i.flavorset_id === item.flavorset_id && !i.flavor_id);
        if (idx >= 0) {
          const newCases = (updatedInv[idx].cases || 0) + (item.cases || 0);
          await base44.entities.Inventory.update(updatedInv[idx].id, { cases: newCases });
          updatedInv[idx] = { ...updatedInv[idx], cases: newCases };
        }
      } else if (item.flavor_id) {
        const idx = updatedInv.findIndex((i) => i.flavor_id === item.flavor_id && !i.flavorset_id);
        if (idx >= 0) {
          const newCases = (updatedInv[idx].cases || 0) + (item.cases || 0);
          await base44.entities.Inventory.update(updatedInv[idx].id, { cases: newCases });
          updatedInv[idx] = { ...updatedInv[idx], cases: newCases };
        }
      }
    }
    setInventory(updatedInv);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const flavorsetInv = inventory.filter((i) => i.flavorset_id && !i.flavor_id);
  const individualInv = inventory.filter((i) => i.flavor_id && !i.flavorset_id);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground mt-1">Track cases on hand and vendor pickups</p>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="base">Base on Hand</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="pickups">Order Pickups</TabsTrigger>
        </TabsList>

        {/* ====== INVENTORY TAB ====== */}
        <TabsContent value="inventory">

          {/* ── Inventory controls ── */}
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => setShowAddInv(true)}>
              <Plus className="w-4 h-4" /> Adjust Inventory
            </Button>
          </div>

          {showAddInv && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">Add Cases to Inventory</h3>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setAddInvType("flavorset")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${addInvType === "flavorset" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Flavorset Cases</button>
                <button onClick={() => setAddInvType("individual")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${addInvType === "individual" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Individual Flavor Cases</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{addInvType === "flavorset" ? "Flavorset" : "Flavor"}</label>
                  {addInvType === "flavorset" ? (
                    <Select value={addInvForm.flavorset_id} onValueChange={(v) => setAddInvForm({ ...addInvForm, flavorset_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                      <SelectContent>{flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Select value={addInvForm.flavor_id} onValueChange={(v) => setAddInvForm({ ...addInvForm, flavor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                      <SelectContent>{flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cases to Add</label>
                  <Input type="number" min="0" value={addInvForm.cases} onChange={(e) => setAddInvForm({ ...addInvForm, cases: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveAddInv} disabled={saving} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
                <Button variant="ghost" onClick={() => setShowAddInv(false)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {/* Flavorset Cases */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold">Flavorset Cases</h3>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button onClick={() => setFlavorsetDisplayMode("pallets")} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${flavorsetDisplayMode === "pallets" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Pallets</button>
                <button onClick={() => setFlavorsetDisplayMode("cases")} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${flavorsetDisplayMode === "cases" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Cases</button>
              </div>
            </div>
            {flavorsetInv.length === 0 ? (
              <p className="text-sm text-muted-foreground">No flavorset inventory yet. Inventory is added automatically when shifts are submitted.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {flavorsetInv.map((inv) => {
                  const fs = fsMap[inv.flavorset_id];
                  const totalCases = inv.cases || 0;
                  const totalPallets = totalCases / CASES_PER_PALLET;
                  const fullPallets = Math.floor(totalPallets);
                  const remainder = Math.round(totalCases % CASES_PER_PALLET);
                  return (
                    <div key={inv.id} className="bg-card rounded-2xl border border-border p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {fs?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                          <h4 className="font-heading font-semibold">{fs?.name || "Unknown Flavorset"}</h4>
                        </div>
                        <div className="flex gap-1">
                          {editingInvId !== inv.id && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingInvId(inv.id); setEditCases(inv.cases || 0); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Remove from Inventory</AlertDialogTitle><AlertDialogDescription>Delete this inventory record?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteInv(inv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      {editingInvId === inv.id ? (
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground block">Cases on hand</label>
                          <Input type="number" min="0" value={editCases} onChange={(e) => setEditCases(parseFloat(e.target.value) || 0)} autoFocus />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEditInv(inv)} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingInvId(null)}><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {flavorsetDisplayMode === "pallets" ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-muted rounded-xl p-3 text-center">
                                <p className="text-2xl font-heading font-bold">{fullPallets}</p>
                                <p className="text-xs text-muted-foreground mt-1">Full Pallets</p>
                              </div>
                              <div className="bg-muted rounded-xl p-3 text-center">
                                <p className="text-2xl font-heading font-bold">{totalPallets.toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Total Pallets</p>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-muted rounded-xl p-3 text-center">
                                <p className="text-2xl font-heading font-bold">{totalCases}</p>
                                <p className="text-xs text-muted-foreground mt-1">Total Cases</p>
                              </div>
                              <div className="bg-muted rounded-xl p-3 text-center">
                                <p className="text-2xl font-heading font-bold">{fullPallets}</p>
                                <p className="text-xs text-muted-foreground mt-1">Full Pallets</p>
                              </div>
                            </div>
                          )}
                          {remainder > 0 && <p className="text-xs text-muted-foreground mt-2">+{remainder} loose cases (partial pallet)</p>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Individual Flavor Cases */}
          <div>
            <h3 className="font-heading font-semibold mb-3">Individual Flavor Cases</h3>
            {individualInv.length === 0 ? (
              <p className="text-sm text-muted-foreground">No individual flavor inventory yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {individualInv.map((inv) => {
                  const fl = flMap[inv.flavor_id];
                  return (
                    <div key={inv.id} className="bg-card rounded-2xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {fl?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fl.color }} />}
                        <p className="font-medium text-sm flex-1 truncate">{fl?.name || "Unknown Flavor"}</p>
                      </div>
                      {editingInvId === inv.id ? (
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground block">Cases on hand</label>
                          <Input type="number" min="0" value={editCases} onChange={(e) => setEditCases(parseFloat(e.target.value) || 0)} autoFocus />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => saveEditInv(inv)} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingInvId(null)}><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-heading font-bold">{inv.cases || 0}</p>
                            <p className="text-xs text-muted-foreground">cases</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => { setEditingInvId(inv.id); setEditCases(inv.cases || 0); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Remove from Inventory</AlertDialogTitle><AlertDialogDescription>Delete this record?</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteInv(inv.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ====== INGREDIENTS TAB ====== */}
        <TabsContent value="ingredients">
          <IngredientsTab flavors={flavors} flavorSets={flavorSets} />
        </TabsContent>

        {/* ====== MATERIALS TAB ====== */}
        <TabsContent value="materials">
          <MaterialsTab flavorSets={flavorSets} />
        </TabsContent>

        {/* ====== BREAKDOWN TAB ====== */}
        <TabsContent value="breakdown">
          <ProductBreakdownTab />
        </TabsContent>

        {/* ====== BASE ON HAND TAB ====== */}
        <TabsContent value="base">
          <p className="text-sm text-muted-foreground mb-6">Gallons of base on hand per flavorset. Updated automatically from base mixing shifts and deducted by production shifts.</p>
          {baseInventory.filter((bi) => flavorSets.some((fs) => fs.id === bi.flavorset_id)).length === 0 ? (
            <EmptyState icon={Package} title="No base inventory" description="Base inventory is automatically tracked from base mixing shifts." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {baseInventory.filter((bi) => flavorSets.some((fs) => fs.id === bi.flavorset_id)).map((bi) => {
                const fs = fsMap[bi.flavorset_id];
                const batches = (bi.gallons || 0) / GALLONS_PER_BATCH;
                return (
                  <div key={bi.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {fs?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                        <h4 className="font-heading font-semibold">{fs?.name || "Unknown"}</h4>
                      </div>
                      <div className="flex gap-1">
                        {editingBaseId !== bi.id && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingBaseId(bi.id); setEditBaseGallons(bi.gallons || 0); }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete Base Inventory</AlertDialogTitle><AlertDialogDescription>Remove this base inventory record for {fs?.name}?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
                                await base44.entities.BaseInventory.delete(bi.id);
                                setBaseInventory((prev) => prev.filter((b) => b.id !== bi.id));
                              }}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {editingBaseId === bi.id ? (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground block">Gallons on hand</label>
                        <Input type="number" min="0" step="0.25" value={editBaseGallons} onChange={(e) => setEditBaseGallons(parseFloat(e.target.value) || 0)} autoFocus />
                        <div className="flex gap-2">
                          <Button size="sm" className="gap-1" onClick={async () => {
                            await base44.entities.BaseInventory.update(bi.id, { gallons: editBaseGallons });
                            setBaseInventory((prev) => prev.map((b) => b.id === bi.id ? { ...b, gallons: editBaseGallons } : b));
                            setEditingBaseId(null);
                          }}><Check className="w-3 h-3" /> Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingBaseId(null)}><X className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted rounded-xl p-3 text-center">
                          <p className="text-2xl font-heading font-bold">{batches.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground mt-1">Batches</p>
                        </div>
                        <div className="bg-muted rounded-xl p-3 text-center">
                          <p className="text-2xl font-heading font-bold">{bi.gallons || 0}</p>
                          <p className="text-xs text-muted-foreground mt-1">Gallons</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ====== ORDER PICKUPS TAB ====== */}
        <TabsContent value="pickups">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => openCrudPw("add-pickup")}>
              <Plus className="w-4 h-4" /> Record Pickup
            </Button>
          </div>

          {showPickupForm && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">Record Order Pickup</h3>
              <form onSubmit={savePickup}>
                {/* Order header */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendor Name</label>
                    <Input value={pickupForm.vendor_name} onChange={(e) => setPickupForm({ ...pickupForm, vendor_name: e.target.value })} placeholder="Vendor Co." required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Pickup Date</label>
                    <Input type="date" value={pickupForm.pickup_date} onChange={(e) => setPickupForm({ ...pickupForm, pickup_date: e.target.value })} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                    <Textarea value={pickupForm.notes} onChange={(e) => setPickupForm({ ...pickupForm, notes: e.target.value })} rows={2} />
                  </div>
                </div>

                {/* Items */}
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Order Items</p>
                  {pickupItems.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {pickupItems.map((item, idx) => {
                        const label = item.type === "flavorset"
                          ? `${fsMap[item.flavorset_id]?.name || "?"} — ${item.pallets > 0 ? `${item.pallets} pal / ` : ""}${item.cases} cases`
                          : `${flMap[item.flavor_id]?.name || "?"} — ${item.cases} cases (individual)`;
                        return (
                          <div key={idx} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2 text-sm">
                            <span>{label}</span>
                            <button type="button" onClick={() => setPickupItems((prev) => prev.filter((_, i) => i !== idx))} className="text-destructive hover:opacity-70 ml-2"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add item row */}
                  <div className="bg-muted/50 rounded-xl border border-border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Add Item</p>
                    <div className="flex gap-2 mb-2">
                      <button type="button" onClick={() => setNewItem({ ...newItem, type: "flavorset", flavor_id: "" })} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${newItem.type === "flavorset" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Flavorset</button>
                      <button type="button" onClick={() => setNewItem({ ...newItem, type: "individual", flavorset_id: "" })} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${newItem.type === "individual" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Individual Flavor</button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-end">
                      {newItem.type === "flavorset" ? (
                        <>
                          <div className="flex-1 min-w-[140px]">
                            <label className="text-xs text-muted-foreground mb-1 block">Flavorset</label>
                            <Select value={newItem.flavorset_id} onValueChange={(v) => setNewItem({ ...newItem, flavorset_id: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-muted-foreground mb-1 block">Pallets</label>
                            <Input type="number" min="0" step="any" value={newItem.pallets} onChange={(e) => setNewItem({ ...newItem, pallets: e.target.value })} className="h-8 text-xs" placeholder="0" />
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-muted-foreground mb-1 block">Cases</label>
                            <Input type="number" min="0" value={newItem.cases} onChange={(e) => setNewItem({ ...newItem, cases: e.target.value })} className="h-8 text-xs" placeholder="auto" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-[140px]">
                            <label className="text-xs text-muted-foreground mb-1 block">Flavor</label>
                            <Select value={newItem.flavor_id} onValueChange={(v) => setNewItem({ ...newItem, flavor_id: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-muted-foreground mb-1 block">Cases</label>
                            <Input type="number" min="0" value={newItem.cases} onChange={(e) => setNewItem({ ...newItem, cases: e.target.value })} className="h-8 text-xs" placeholder="0" />
                          </div>
                        </>
                      )}
                      <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={addPickupItem}><Plus className="w-3 h-3" /> Add</Button>
                    </div>
                    {newItem.type === "flavorset" && parseFloat(newItem.pallets) > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">= {Math.round(parseFloat(newItem.pallets) * CASES_PER_PALLET)} cases auto-calculated</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || pickupItems.length === 0} className="gap-2"><Check className="w-4 h-4" /> Save Order ({pickupItems.length} item{pickupItems.length !== 1 ? "s" : ""})</Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowPickupForm(false); setPickupItems([]); }}><X className="w-4 h-4" /></Button>
                </div>
              </form>
            </div>
          )}

          {pickups.length === 0 ? (
            <EmptyState icon={Truck} title="No pickups recorded" description="Record vendor pickups to track outgoing inventory." />
          ) : (
            <div className="space-y-3">
              {pickups.map((p) => {
                const isSpecial = specialOrderNames.has((p.vendor_name || "").trim().toLowerCase());
                const items = pickupItemsMap[p.id] || [];
                const totalCases = items.reduce((sum, i) => sum + (i.cases || 0), 0);
                return (
                  <div key={p.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {isSpecial && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-green-500" />}
                            {p.vendor_name}
                            {isSpecial && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Special Order</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.pickup_date} · {items.length} item{items.length !== 1 ? "s" : ""} · {totalCases} total cases</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive flex-shrink-0" onClick={() => openCrudPw("delete-pickup", p)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    {items.length > 0 && (
                      <div className="ml-12 space-y-1">
                        {items.map((item) => {
                          const label = item.flavorset_id
                            ? `${fsMap[item.flavorset_id]?.name || "?"} · ${item.pallets > 0 ? `${item.pallets} pal / ` : ""}${item.cases} cases`
                            : `${flMap[item.flavor_id]?.name || "?"} · ${item.cases} cases (individual)`;
                          return (
                            <p key={item.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                              {item.flavorset_id && fsMap[item.flavorset_id]?.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fsMap[item.flavorset_id].color }} />}
                              {label}
                            </p>
                          );
                        })}
                      </div>
                    )}
                    {p.notes && <p className="text-xs text-muted-foreground mt-1 ml-12">{p.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Password gate modal */}
      {crudPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">
              {crudPw.action === "add-pickup" ? "Record Pickup" : `Delete Pickup — ${crudPw.data?.vendor_name}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Enter the admin password to continue.</p>
            <input
              type="password"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mb-2"
              placeholder="Admin password"
              value={crudPwInput}
              onChange={(e) => { setCrudPwInput(e.target.value); setCrudPwError(""); }}
              onKeyDown={(e) => e.key === "Enter" && confirmCrudPw()}
              autoFocus
            />
            {crudPwError && <p className="text-xs text-destructive mb-2">{crudPwError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCrudPw(null)}>Cancel</Button>
              <Button size="sm" className={crudPw.action === "delete-pickup" ? "bg-red-600 hover:bg-red-700 text-white" : ""} onClick={confirmCrudPw}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}