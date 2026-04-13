import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Truck, Plus, Pencil, Check, X, Trash2, Snowflake, Star, MoveRight } from "lucide-react";
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
import { getDefaultFreezerId, setDefaultFreezerId, syncToDefaultFreezer } from "../lib/freezerSync";

const GALLONS_PER_BATCH = 240;

const CASES_PER_PALLET = 66;

export default function Inventory() {
  const [flavorSets, setFlavorSets] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [freezers, setFreezers] = useState([]);
  const [freezerItems, setFreezerItems] = useState([]);
  const [baseInventory, setBaseInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultFreezer, setDefaultFreezer] = useState(() => getDefaultFreezerId());

  // Inventory edit
  const [editingInvId, setEditingInvId] = useState(null);
  const [editCases, setEditCases] = useState(0);

  // Add inventory manually
  const [showAddInv, setShowAddInv] = useState(false);
  const [addInvType, setAddInvType] = useState("flavorset");
  const [addInvForm, setAddInvForm] = useState({ flavorset_id: "", flavor_id: "", cases: 0 });

  // Pickup form
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [pickupForm, setPickupForm] = useState({ vendor_name: "", flavorset_id: "", pallets: 1, pickup_date: new Date().toISOString().split("T")[0], notes: "" });

  // Freezer forms
  const [showFreezerForm, setShowFreezerForm] = useState(false);
  const [editingFreezerId, setEditingFreezerId] = useState(null);
  const [freezerForm, setFreezerForm] = useState({ name: "", notes: "" });
  const [showItemForm, setShowItemForm] = useState(null);
  const [itemForm, setItemForm] = useState({ type: "pallet", flavorset_id: "", flavor_id: "", quantity: 1 });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemQty, setEditItemQty] = useState(0);
  const [movingItemId, setMovingItemId] = useState(null);
  const [moveTargetFreezer, setMoveTargetFreezer] = useState("");

  const [saving, setSaving] = useState(false);

  // Password gate for default freezer
  const [freezerPwOpen, setFreezerPwOpen] = useState(false);
  const [freezerPwInput, setFreezerPwInput] = useState("");
  const [freezerPwError, setFreezerPwError] = useState("");
  const [freezerSelectUnlocked, setFreezerSelectUnlocked] = useState(false);

  function openFreezerPw() {
    setFreezerPwInput("");
    setFreezerPwError("");
    setFreezerPwOpen(true);
  }

  function confirmFreezerPw() {
    if (freezerPwInput !== "ecap") { setFreezerPwError("Incorrect password."); return; }
    setFreezerPwOpen(false);
    setFreezerSelectUnlocked(true);
  }

  // Password gate for freezer CRUD
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
    if (action === "add-freezer") { setFreezerForm({ name: "", notes: "" }); setEditingFreezerId(null); setShowFreezerForm(true); }
    else if (action === "edit-freezer") { setFreezerForm({ name: data.name, notes: data.notes || "" }); setEditingFreezerId(data.id); setShowFreezerForm(true); }
    else if (action === "delete-freezer") { deleteFreezer(data.id); }
  }

  useEffect(() => { load(); }, []);

  async function load() {
    const [fs, fl, inv, pk, frz, fi, bi] = await Promise.all([
      base44.entities.FlavorSet.list("name"),
      base44.entities.Flavor.list("name"),
      base44.entities.Inventory.list(),
      base44.entities.OrderPickup.list("-pickup_date", 100),
      base44.entities.Freezer.list("name"),
      base44.entities.FreezerItem.list(),
      base44.entities.BaseInventory.list(),
    ]);
    setFlavorSets(fs);
    setFlavors(fl);
    setInventory(inv);
    setPickups(pk);
    setFreezers(frz);
    setFreezerItems(fi);
    setBaseInventory(bi);
    setLoading(false);
  }

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const flMap = {};
  flavors.forEach((f) => { flMap[f.id] = f; });

  function handleSetDefault(freezerId) {
    setDefaultFreezerId(freezerId);
    setDefaultFreezer(freezerId);
  }

  // ---- INVENTORY HELPERS ----
  async function saveEditInv(inv) {
    await base44.entities.Inventory.update(inv.id, { cases: editCases });
    const updated = { ...inv, cases: editCases };
    setInventory((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
    setEditingInvId(null);
    // Sync to default freezer
    await syncToDefaultFreezer({ flavorset_id: inv.flavorset_id, flavor_id: inv.flavor_id, cases: editCases });
    setFreezerItems(await base44.entities.FreezerItem.list());
  }

  async function saveAddInv() {
    if (addInvType === "flavorset" && !addInvForm.flavorset_id) return;
    if (addInvType === "individual" && !addInvForm.flavor_id) return;
    setSaving(true);
    let record;
    if (addInvType === "flavorset") {
      const existing = inventory.find((i) => i.flavorset_id === addInvForm.flavorset_id && !i.flavor_id);
      if (existing) {
        const newCases = (existing.cases || 0) + Number(addInvForm.cases);
        await base44.entities.Inventory.update(existing.id, { cases: newCases });
        record = { ...existing, cases: newCases };
        setInventory((prev) => prev.map((i) => (i.id === existing.id ? record : i)));
      } else {
        record = await base44.entities.Inventory.create({ flavorset_id: addInvForm.flavorset_id, cases: Number(addInvForm.cases) });
        setInventory((prev) => [...prev, record]);
      }
      await syncToDefaultFreezer({ flavorset_id: record.flavorset_id, cases: record.cases });
    } else {
      const existing = inventory.find((i) => i.flavor_id === addInvForm.flavor_id && !i.flavorset_id);
      if (existing) {
        const newCases = (existing.cases || 0) + Number(addInvForm.cases);
        await base44.entities.Inventory.update(existing.id, { cases: newCases });
        record = { ...existing, cases: newCases };
        setInventory((prev) => prev.map((i) => (i.id === existing.id ? record : i)));
      } else {
        record = await base44.entities.Inventory.create({ flavor_id: addInvForm.flavor_id, cases: Number(addInvForm.cases) });
        setInventory((prev) => [...prev, record]);
      }
      await syncToDefaultFreezer({ flavor_id: record.flavor_id, cases: record.cases });
    }
    setFreezerItems(await base44.entities.FreezerItem.list());
    setAddInvForm({ flavorset_id: "", flavor_id: "", cases: 0 });
    setShowAddInv(false);
    setSaving(false);
  }

  async function deleteInv(id) {
    await base44.entities.Inventory.delete(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  // ---- PICKUP HELPERS ----
  async function savePickup(e) {
    e.preventDefault();
    setSaving(true);
    const pickupCases = pickupForm.pallets * CASES_PER_PALLET;
    const created = await base44.entities.OrderPickup.create({ ...pickupForm, pallets: Number(pickupForm.pallets), cases: pickupCases });
    setPickups((prev) => [created, ...prev]);
    const invRecord = inventory.find((i) => i.flavorset_id === pickupForm.flavorset_id && !i.flavor_id);
    if (invRecord) {
      const newCases = Math.max(0, (invRecord.cases || 0) - pickupCases);
      await base44.entities.Inventory.update(invRecord.id, { cases: newCases });
      setInventory((prev) => prev.map((i) => (i.id === invRecord.id ? { ...i, cases: newCases } : i)));
      await syncToDefaultFreezer({ flavorset_id: invRecord.flavorset_id, cases: newCases });
      setFreezerItems(await base44.entities.FreezerItem.list());
    }
    setPickupForm({ vendor_name: "", flavorset_id: "", pallets: 1, pickup_date: new Date().toISOString().split("T")[0], notes: "" });
    setShowPickupForm(false);
    setSaving(false);
  }

  async function deletePickup(pickup) {
    await base44.entities.OrderPickup.delete(pickup.id);
    setPickups((prev) => prev.filter((p) => p.id !== pickup.id));
    const invRecord = inventory.find((i) => i.flavorset_id === pickup.flavorset_id && !i.flavor_id);
    if (invRecord) {
      const newCases = (invRecord.cases || 0) + (pickup.cases || 0);
      await base44.entities.Inventory.update(invRecord.id, { cases: newCases });
      setInventory((prev) => prev.map((i) => (i.id === invRecord.id ? { ...i, cases: newCases } : i)));
    }
  }

  // ---- FREEZER HELPERS ----
  async function saveFreezer() {
    if (!freezerForm.name) return;
    setSaving(true);
    if (editingFreezerId) {
      await base44.entities.Freezer.update(editingFreezerId, freezerForm);
      setFreezers((prev) => prev.map((f) => (f.id === editingFreezerId ? { ...f, ...freezerForm } : f)));
    } else {
      const created = await base44.entities.Freezer.create(freezerForm);
      setFreezers((prev) => [...prev, created]);
    }
    setFreezerForm({ name: "", notes: "" });
    setEditingFreezerId(null);
    setShowFreezerForm(false);
    setSaving(false);
  }

  async function deleteFreezer(id) {
    await base44.entities.Freezer.delete(id);
    const items = freezerItems.filter((fi) => fi.freezer_id === id);
    await Promise.all(items.map((fi) => base44.entities.FreezerItem.delete(fi.id)));
    setFreezers((prev) => prev.filter((f) => f.id !== id));
    setFreezerItems((prev) => prev.filter((fi) => fi.freezer_id !== id));
    if (defaultFreezer === id) handleSetDefault(null);
  }

  async function saveFreezerItem(freezer_id) {
    if (itemForm.type === "pallet" && !itemForm.flavorset_id) return;
    if (itemForm.type === "individual" && !itemForm.flavor_id) return;
    setSaving(true);
    const payload = { freezer_id, type: itemForm.type, quantity: Number(itemForm.quantity) };
    if (itemForm.type === "pallet") payload.flavorset_id = itemForm.flavorset_id;
    else payload.flavor_id = itemForm.flavor_id;
    const created = await base44.entities.FreezerItem.create(payload);
    setFreezerItems((prev) => [...prev, created]);
    setItemForm({ type: "pallet", flavorset_id: "", flavor_id: "", quantity: 1 });
    setShowItemForm(null);
    setSaving(false);
  }

  async function saveEditItem(item) {
    await base44.entities.FreezerItem.update(item.id, { quantity: editItemQty });
    setFreezerItems((prev) => prev.map((fi) => (fi.id === item.id ? { ...fi, quantity: editItemQty } : fi)));
    setEditingItemId(null);
  }

  async function deleteFreezerItem(id) {
    await base44.entities.FreezerItem.delete(id);
    setFreezerItems((prev) => prev.filter((fi) => fi.id !== id));
  }

  async function moveItem(item) {
    if (!moveTargetFreezer || moveTargetFreezer === item.freezer_id) { setMovingItemId(null); return; }
    setSaving(true);
    // Check if target freezer already has this item type
    const filterKey = item.type === "pallet" ? "flavorset_id" : "flavor_id";
    const targetExisting = freezerItems.find(
      (fi) => fi.freezer_id === moveTargetFreezer && fi.type === item.type && fi[filterKey] === item[filterKey]
    );
    if (targetExisting) {
      // Merge quantities
      await base44.entities.FreezerItem.update(targetExisting.id, { quantity: (targetExisting.quantity || 0) + (item.quantity || 0) });
      await base44.entities.FreezerItem.delete(item.id);
      setFreezerItems((prev) => prev
        .filter((fi) => fi.id !== item.id)
        .map((fi) => fi.id === targetExisting.id ? { ...fi, quantity: (fi.quantity || 0) + (item.quantity || 0) } : fi)
      );
    } else {
      await base44.entities.FreezerItem.update(item.id, { freezer_id: moveTargetFreezer });
      setFreezerItems((prev) => prev.map((fi) => fi.id === item.id ? { ...fi, freezer_id: moveTargetFreezer } : fi));
    }
    setMovingItemId(null);
    setMoveTargetFreezer("");
    setSaving(false);
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
  const defaultFreezerName = freezers.find((f) => f.id === defaultFreezer)?.name;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground mt-1">Track cases on hand, freezer locations, and vendor pickups</p>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="mb-6">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="base">Base on Hand</TabsTrigger>
          <TabsTrigger value="freezers">Freezers</TabsTrigger>
          <TabsTrigger value="pickups">Order Pickups</TabsTrigger>
        </TabsList>

        {/* ====== INVENTORY TAB ====== */}
        <TabsContent value="inventory">
          {/* Default Freezer Banner */}
          <div className="bg-muted rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Snowflake className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">
                Default Freezer:{" "}
                <span className={defaultFreezerName ? "text-foreground" : "text-muted-foreground"}>
                  {defaultFreezerName || "None set — new inventory won't auto-assign to a freezer"}
                </span>
              </span>
            </div>
            {freezerSelectUnlocked ? (
              <div className="flex items-center gap-2">
                <Select value={defaultFreezer || ""} onValueChange={(v) => handleSetDefault(v || null)}>
                  <SelectTrigger className="w-full sm:w-48 h-8 text-xs"><SelectValue placeholder="Set default freezer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {freezers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setFreezerSelectUnlocked(false)}>Lock</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={openFreezerPw}>🔒 Change</Button>
            )}
          </div>

          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => setShowAddInv(true)}>
              <Plus className="w-4 h-4" /> Adjust Inventory
            </Button>
          </div>

          {showAddInv && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">Add Cases to Inventory</h3>
              {defaultFreezerName && (
                <p className="text-xs text-muted-foreground mb-3">Will auto-sync to <span className="font-medium text-foreground">{defaultFreezerName}</span></p>
              )}
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
            <h3 className="font-heading font-semibold mb-3">Flavorset Cases (Pallet Tracked)</h3>
            {flavorsetInv.length === 0 ? (
              <p className="text-sm text-muted-foreground">No flavorset inventory yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {flavorsetInv.map((inv) => {
                  const fs = fsMap[inv.flavorset_id];
                  const pallets = Math.floor((inv.cases || 0) / CASES_PER_PALLET);
                  const remainder = (inv.cases || 0) % CASES_PER_PALLET;
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
                          {defaultFreezerName && <p className="text-xs text-muted-foreground">Will sync to {defaultFreezerName}</p>}
                          <Input type="number" min="0" value={editCases} onChange={(e) => setEditCases(parseFloat(e.target.value) || 0)} autoFocus />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEditInv(inv)} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingInvId(null)}><X className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted rounded-xl p-3 text-center">
                              <p className="text-2xl font-heading font-bold">{pallets}</p>
                              <p className="text-xs text-muted-foreground mt-1">Full Pallets</p>
                            </div>
                            <div className="bg-muted rounded-xl p-3 text-center">
                              <p className="text-2xl font-heading font-bold">{inv.cases || 0}</p>
                              <p className="text-xs text-muted-foreground mt-1">Total Cases</p>
                            </div>
                          </div>
                          {remainder > 0 && <p className="text-xs text-muted-foreground mt-2">+{remainder} cases (partial pallet)</p>}
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
                        <p className="font-medium text-sm">{fl?.name || "Unknown Flavor"}</p>
                      </div>
                      {editingInvId === inv.id ? (
                        <div className="space-y-2">
                          {defaultFreezerName && <p className="text-xs text-muted-foreground">Will sync to {defaultFreezerName}</p>}
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
                    <div className="flex items-center gap-2 mb-3">
                      {fs?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                      <h4 className="font-heading font-semibold">{fs?.name || "Unknown"}</h4>
                    </div>
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
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ====== FREEZERS TAB ====== */}
        <TabsContent value="freezers">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => openCrudPw("add-freezer")}>
              <Plus className="w-4 h-4" /> Add Freezer
            </Button>
          </div>

          {showFreezerForm && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">{editingFreezerId ? "Edit" : "New"} Freezer</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Freezer Name</label>
                  <Input value={freezerForm.name} onChange={(e) => setFreezerForm({ ...freezerForm, name: e.target.value })} placeholder="Freezer A" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                  <Input value={freezerForm.notes} onChange={(e) => setFreezerForm({ ...freezerForm, notes: e.target.value })} placeholder="Location, capacity..." />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveFreezer} disabled={saving} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
                <Button variant="ghost" onClick={() => setShowFreezerForm(false)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {freezers.length === 0 && !showFreezerForm ? (
            <EmptyState icon={Snowflake} title="No freezers yet" description="Add freezers to track product storage locations." />
          ) : (
            <div className="space-y-4">
              {freezers.map((freezer) => {
                const items = freezerItems.filter((fi) => fi.freezer_id === freezer.id);
                const isDefault = defaultFreezer === freezer.id;
                return (
                  <div key={freezer.id} className={`bg-card rounded-2xl border p-5 ${isDefault ? "border-primary" : "border-border"}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading font-semibold text-lg">{freezer.name}</h4>
                        {isDefault && (
                          <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3" /> Default
                          </span>
                        )}
                        {freezer.notes && <span className="text-xs text-muted-foreground">· {freezer.notes}</span>}
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">

                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openCrudPw("edit-freezer", freezer)}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => openCrudPw("delete-freezer", freezer)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Items list */}
                    {items.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                        {items.map((item) => (
                          <div key={item.id} className="bg-muted rounded-xl px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate flex items-center gap-1">
                                  {item.type === "pallet" && fsMap[item.flavorset_id]?.color && (
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: fsMap[item.flavorset_id].color }} />
                                  )}
                                  {item.type === "individual" && flMap[item.flavor_id]?.color && (
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: flMap[item.flavor_id].color }} />
                                  )}
                                  {item.type === "pallet"
                                    ? `${fsMap[item.flavorset_id]?.name || "?"} — Pallets`
                                    : `${flMap[item.flavor_id]?.name || "?"} — Cases`}
                                </p>
                                {editingItemId === item.id ? (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Input type="number" min="0" value={editItemQty} onChange={(e) => setEditItemQty(parseFloat(e.target.value) || 0)} className="h-6 text-xs px-1 w-16" autoFocus />
                                    <Button size="sm" className="h-6 px-1" onClick={() => saveEditItem(item)}><Check className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setEditingItemId(null)}><X className="w-3 h-3" /></Button>
                                  </div>
                                ) : movingItemId === item.id ? (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Select value={moveTargetFreezer} onValueChange={setMoveTargetFreezer}>
                                      <SelectTrigger className="h-6 text-xs w-32"><SelectValue placeholder="To freezer..." /></SelectTrigger>
                                      <SelectContent>
                                        {freezers.filter((f) => f.id !== freezer.id).map((f) => (
                                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button size="sm" className="h-6 px-1" disabled={saving} onClick={() => moveItem(item)}><Check className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setMovingItemId(null)}><X className="w-3 h-3" /></Button>
                                  </div>
                                ) : (
                                  <p className="text-lg font-heading font-bold">{item.quantity}</p>
                                )}
                              </div>
                              {editingItemId !== item.id && movingItemId !== item.id && (
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Move to another freezer" onClick={() => { setMovingItemId(item.id); setMoveTargetFreezer(""); }}>
                                    <MoveRight className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingItemId(item.id); setEditItemQty(item.quantity); }}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteFreezerItem(item.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add item form */}
                    {showItemForm === freezer.id ? (
                      <div className="border border-border rounded-xl p-4 bg-background space-y-3">
                        <div className="flex gap-2">
                          <button onClick={() => setItemForm({ ...itemForm, type: "pallet", flavor_id: "" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${itemForm.type === "pallet" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Pallets</button>
                          <button onClick={() => setItemForm({ ...itemForm, type: "individual", flavorset_id: "" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${itemForm.type === "individual" ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>Individual Cases</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">{itemForm.type === "pallet" ? "Flavorset" : "Flavor"}</label>
                            {itemForm.type === "pallet" ? (
                              <Select value={itemForm.flavorset_id} onValueChange={(v) => setItemForm({ ...itemForm, flavorset_id: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                                <SelectContent>{flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}</SelectContent>
                              </Select>
                            ) : (
                              <Select value={itemForm.flavor_id} onValueChange={(v) => setItemForm({ ...itemForm, flavor_id: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select flavor" /></SelectTrigger>
                                <SelectContent>{flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                            <Input type="number" min="0" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveFreezerItem(freezer.id)} disabled={saving} className="gap-1"><Check className="w-3 h-3" /> Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowItemForm(null)}><X className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setItemForm({ type: "pallet", flavorset_id: "", flavor_id: "", quantity: 1 }); setShowItemForm(freezer.id); }}>
                        <Plus className="w-3 h-3" /> Add Item
                      </Button>
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
            <Button className="gap-2" onClick={() => setShowPickupForm(true)}>
              <Plus className="w-4 h-4" /> Record Pickup
            </Button>
          </div>

          {showPickupForm && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">Record Order Pickup</h3>
              <form onSubmit={savePickup} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendor Name</label>
                  <Input value={pickupForm.vendor_name} onChange={(e) => setPickupForm({ ...pickupForm, vendor_name: e.target.value })} placeholder="Vendor Co." required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Pickup Date</label>
                  <Input type="date" value={pickupForm.pickup_date} onChange={(e) => setPickupForm({ ...pickupForm, pickup_date: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset</label>
                  <Select value={pickupForm.flavorset_id} onValueChange={(v) => setPickupForm({ ...pickupForm, flavorset_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                    <SelectContent>{flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Pallets ({CASES_PER_PALLET} cases each)</label>
                  <Input type="number" min="1" step="1" value={pickupForm.pallets} onChange={(e) => setPickupForm({ ...pickupForm, pallets: parseFloat(e.target.value) || 1 })} required />
                  {pickupForm.pallets > 0 && <p className="text-xs text-muted-foreground mt-1">= {pickupForm.pallets * CASES_PER_PALLET} cases</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
                  <Textarea value={pickupForm.notes} onChange={(e) => setPickupForm({ ...pickupForm, notes: e.target.value })} rows={2} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving} className="gap-2"><Check className="w-4 h-4" /> Save Pickup</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowPickupForm(false)}><X className="w-4 h-4" /></Button>
                </div>
              </form>
            </div>
          )}

          {pickups.length === 0 ? (
            <EmptyState icon={Truck} title="No pickups recorded" description="Record vendor pickups to track outgoing inventory." />
          ) : (
            <div className="space-y-3">
              {pickups.map((p) => (
                <div key={p.id} className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{p.vendor_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {fsMap[p.flavorset_id]?.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fsMap[p.flavorset_id].color }} />}
                        {fsMap[p.flavorset_id]?.name || "Unknown"} · {p.pallets} pallet{p.pallets !== 1 ? "s" : ""} ({p.cases} cases) · {p.pickup_date}
                      </p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive flex-shrink-0"><Trash2 className="w-4 h-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete Pickup</AlertDialogTitle><AlertDialogDescription>This will restore {p.cases} cases back to inventory.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletePickup(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {crudPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">
              {crudPw.action === "add-freezer" ? "Add Freezer" : crudPw.action === "edit-freezer" ? `Edit ${crudPw.data?.name}` : `Delete ${crudPw.data?.name}`}
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
              <Button size="sm" className={crudPw.action === "delete-freezer" ? "bg-red-600 hover:bg-red-700 text-white" : ""} onClick={confirmCrudPw}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {freezerPwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">Change Default Freezer</h3>
            <p className="text-sm text-muted-foreground mb-4">Enter the admin password to continue.</p>
            <input
              type="password"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mb-2"
              placeholder="Admin password"
              value={freezerPwInput}
              onChange={(e) => { setFreezerPwInput(e.target.value); setFreezerPwError(""); }}
              onKeyDown={(e) => e.key === "Enter" && confirmFreezerPw()}
              autoFocus
            />
            {freezerPwError && <p className="text-xs text-destructive mb-2">{freezerPwError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setFreezerPwOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={confirmFreezerPw}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}