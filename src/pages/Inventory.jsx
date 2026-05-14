import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Truck, Plus, Pencil, Check, X, Trash2, Snowflake, Star, ArrowRightLeft } from "lucide-react";
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
import { getDefaultFreezerIdFromDB, setDefaultFreezerInDB, addToDefaultFreezer } from "../lib/freezerSync";

const GALLONS_PER_BATCH = 240;

const CASES_PER_PALLET = 66;

export default function Inventory() {
  const [flavorSets, setFlavorSets] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [scheduledShifts, setScheduledShifts] = useState([]);
  const [freezers, setFreezers] = useState([]);
  const [freezerItems, setFreezerItems] = useState([]);
  const [baseInventory, setBaseInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultFreezer, setDefaultFreezer] = useState(null);

  // Inventory edit
  const [editingInvId, setEditingInvId] = useState(null);
  const [editCases, setEditCases] = useState(0);

  // Add inventory manually
  const [showAddInv, setShowAddInv] = useState(false);
  const [addInvType, setAddInvType] = useState("flavorset");
  const [addInvForm, setAddInvForm] = useState({ flavorset_id: "", flavor_id: "", cases: 0, location_id: "" });

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
    else if (action === "add-pickup") { setShowPickupForm(true); }
    else if (action === "delete-pickup") { deletePickup(data); }
  }

  // Flavorset display toggle: "pallets" | "cases"
  const [flavorsetDisplayMode, setFlavorsetDisplayMode] = useState("pallets");

  // Move modal state
  const [moveModal, setMoveModal] = useState(null); // { fi, itemType: "pallet"|"individual", allLocItems }
  const [moveForm, setMoveForm] = useState({ toFreezerId: "", qty: 1, unit: "pallets" }); // unit: "pallets"|"cases" (pallet items only)

  // Base inventory edit/delete
  const [editingBaseId, setEditingBaseId] = useState(null);
  const [editBaseGallons, setEditBaseGallons] = useState(0);

  useEffect(() => { load(); }, []);

  async function load() {
    const [fs, fl, inv, pk, frz, fi, bi, ss] = await Promise.all([
      base44.entities.FlavorSet.list("name").catch(() => []),
      base44.entities.Flavor.list("name").catch(() => []),
      base44.entities.Inventory.list().catch(() => []),
      base44.entities.OrderPickup.list("-pickup_date", 100).catch(() => []),
      base44.entities.Freezer.list("name").catch(() => []),
      base44.entities.FreezerItem.list().catch(() => []),
      base44.entities.BaseInventory.list().catch(() => []),
      base44.entities.ScheduledShift.list("-shift_date", 200).catch(() => []),
    ]);
    setFlavorSets(fs);
    setFlavors(fl);
    setInventory(inv);
    setPickups(pk);
    setFreezers(frz);
    setFreezerItems(fi);
    setBaseInventory(bi);
    setScheduledShifts(ss);
    const defaultId = frz.find((f) => f.is_default)?.id || null;
    setDefaultFreezer(defaultId);
    setLoading(false);
  }

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const flMap = {};
  flavors.forEach((f) => { flMap[f.id] = f; });
  // Set of special order names (lowercased) for quick lookup
  const specialOrderNames = new Set(
    scheduledShifts
      .filter((s) => s.special_order && s.special_order_name)
      .map((s) => s.special_order_name.trim().toLowerCase())
  );

  async function handleSetDefault(freezerId) {
    await setDefaultFreezerInDB(freezerId || null);
    // Update local state
    setFreezers((prev) => prev.map((f) => ({ ...f, is_default: f.id === freezerId })));
    setDefaultFreezer(freezerId || null);
  }

  // ---- INVENTORY HELPERS ----
  async function saveEditInv(inv) {
    const oldCases = inv.cases || 0;
    await base44.entities.Inventory.update(inv.id, { cases: editCases });
    const updated = { ...inv, cases: editCases };
    setInventory((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
    setEditingInvId(null);
    // Add the delta to default freezer (manual inventory adjustment)
    const delta = editCases - oldCases;
    if (delta > 0) {
      await addToDefaultFreezer({ flavorset_id: inv.flavorset_id, flavor_id: inv.flavor_id, deltaCases: delta });
      setFreezerItems(await base44.entities.FreezerItem.list());
    }
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
      const targetLocationId = addInvForm.location_id || defaultFreezer;
      if (Number(addInvForm.cases) > 0 && targetLocationId) await addToDefaultFreezer({ flavorset_id: record.flavorset_id, deltaCases: Number(addInvForm.cases), overrideFreezerIdForAdd: targetLocationId });
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
      const targetLocationId = addInvForm.location_id || defaultFreezer;
      if (Number(addInvForm.cases) > 0 && targetLocationId) await addToDefaultFreezer({ flavor_id: record.flavor_id, deltaCases: Number(addInvForm.cases), overrideFreezerIdForAdd: targetLocationId });
    }
    setFreezerItems(await base44.entities.FreezerItem.list());
    setAddInvForm({ flavorset_id: "", flavor_id: "", cases: 0, location_id: "" });
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
    // Always round to nearest case
    const pickupCases = Math.round(pickupForm.pallets * CASES_PER_PALLET);
    const created = await base44.entities.OrderPickup.create({ ...pickupForm, pallets: Number(pickupForm.pallets), cases: pickupCases });
    setPickups((prev) => [created, ...prev]);
    // Deduct from inventory
    const invRecord = inventory.find((i) => i.flavorset_id === pickupForm.flavorset_id && !i.flavor_id);
    if (invRecord) {
      const newCases = Math.max(0, (invRecord.cases || 0) - pickupCases);
      await base44.entities.Inventory.update(invRecord.id, { cases: newCases });
      setInventory((prev) => prev.map((i) => (i.id === invRecord.id ? { ...i, cases: newCases } : i)));
    }
    // Deduct pallets from the default freezer
    if (defaultFreezer && pickupForm.flavorset_id) {
      const freezerItem = freezerItems.find(
        (fi) => fi.freezer_id === defaultFreezer && fi.type === "pallet" && fi.flavorset_id === pickupForm.flavorset_id
      );
      if (freezerItem) {
        const palletsToRemove = Number(pickupForm.pallets);
        const newQty = Math.max(0, (freezerItem.quantity || 0) - palletsToRemove);
        await base44.entities.FreezerItem.update(freezerItem.id, { quantity: newQty });
      }
    }
    setFreezerItems(await base44.entities.FreezerItem.list());
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
    // Restore pallets to default freezer
    if (defaultFreezer && pickup.flavorset_id) {
      const freezerItem = freezerItems.find(
        (fi) => fi.freezer_id === defaultFreezer && fi.type === "pallet" && fi.flavorset_id === pickup.flavorset_id
      );
      if (freezerItem) {
        const newQty = (freezerItem.quantity || 0) + (pickup.pallets || 0);
        await base44.entities.FreezerItem.update(freezerItem.id, { quantity: newQty });
        setFreezerItems(await base44.entities.FreezerItem.list());
      }
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
    if (defaultFreezer === id) { setDefaultFreezer(null); }
  }

  async function saveFreezerItem(freezer_id) {
    if (itemForm.type === "pallet" && !itemForm.flavorset_id) return;
    if (itemForm.type === "individual" && !itemForm.flavor_id) return;
    if (!freezer_id) return;
    setSaving(true);

    // Convert entered quantity to stored unit (pallets for pallet items)
    // itemForm.quantity is entered in the current display mode for pallet items
    const rawQty = Number(itemForm.quantity);
    const storedQty = (itemForm.type === "pallet" && flavorsetDisplayMode === "cases")
      ? rawQty / CASES_PER_PALLET
      : rawQty;

    const filterKey = itemForm.type === "pallet" ? "flavorset_id" : "flavor_id";
    const filterVal = itemForm.type === "pallet" ? itemForm.flavorset_id : itemForm.flavor_id;

    // Merge with existing item at same location instead of creating a duplicate
    const existing = freezerItems.find(
      (fi) => fi.freezer_id === freezer_id && fi.type === itemForm.type && fi[filterKey] === filterVal
    );

    let updatedItems;
    if (existing) {
      const newQty = (existing.quantity || 0) + storedQty;
      await base44.entities.FreezerItem.update(existing.id, { quantity: newQty });
      updatedItems = freezerItems.map((fi) => fi.id === existing.id ? { ...fi, quantity: newQty } : fi);
    } else {
      const payload = { freezer_id, type: itemForm.type, quantity: storedQty };
      payload[filterKey] = filterVal;
      const created = await base44.entities.FreezerItem.create(payload);
      updatedItems = [...freezerItems, created];
    }
    setFreezerItems(updatedItems);

    // Sync parent Inventory total from all location items
    if (itemForm.type === "pallet" && itemForm.flavorset_id) {
      const totalPallets = updatedItems
        .filter((fi) => fi.type === "pallet" && fi.flavorset_id === itemForm.flavorset_id)
        .reduce((sum, fi) => sum + (fi.quantity || 0), 0);
      const totalCases = totalPallets * CASES_PER_PALLET;
      const invRecord = inventory.find((i) => i.flavorset_id === itemForm.flavorset_id && !i.flavor_id);
      if (invRecord) {
        await base44.entities.Inventory.update(invRecord.id, { cases: totalCases });
        setInventory((prev) => prev.map((i) => i.id === invRecord.id ? { ...i, cases: totalCases } : i));
      }
    } else if (itemForm.type === "individual" && itemForm.flavor_id) {
      const totalCases = updatedItems
        .filter((fi) => fi.type === "individual" && fi.flavor_id === itemForm.flavor_id)
        .reduce((sum, fi) => sum + (fi.quantity || 0), 0);
      const invRecord = inventory.find((i) => i.flavor_id === itemForm.flavor_id && !i.flavorset_id);
      if (invRecord) {
        await base44.entities.Inventory.update(invRecord.id, { cases: totalCases });
        setInventory((prev) => prev.map((i) => i.id === invRecord.id ? { ...i, cases: totalCases } : i));
      }
    }

    setItemForm({ type: "pallet", flavorset_id: "", flavor_id: "", quantity: 1 });
    setShowItemForm(null);
    setSaving(false);
  }

  async function saveEditItem(item) {
    await base44.entities.FreezerItem.update(item.id, { quantity: editItemQty });
    setFreezerItems((prev) => prev.map((fi) => (fi.id === item.id ? { ...fi, quantity: editItemQty } : fi)));
    setEditingItemId(null);

    // Sync Inventory entity: update total cases based on all freezer items for this flavorset/flavor
    if (item.type === "pallet" && item.flavorset_id) {
      // Sum all pallet items for this flavorset across all freezers and convert to cases
      const allFreezerItems = await base44.entities.FreezerItem.list();
      const totalPallets = allFreezerItems
        .filter((fi) => fi.type === "pallet" && fi.flavorset_id === item.flavorset_id)
        .reduce((sum, fi) => sum + (fi.id === item.id ? editItemQty : (fi.quantity || 0)), 0);
      const totalCases = totalPallets * CASES_PER_PALLET;
      const invRecord = inventory.find((i) => i.flavorset_id === item.flavorset_id && !i.flavor_id);
      if (invRecord) {
        await base44.entities.Inventory.update(invRecord.id, { cases: totalCases });
        setInventory((prev) => prev.map((i) => i.id === invRecord.id ? { ...i, cases: totalCases } : i));
      }
    } else if (item.type === "individual" && item.flavor_id) {
      const allFreezerItems = await base44.entities.FreezerItem.list();
      const totalCases = allFreezerItems
        .filter((fi) => fi.type === "individual" && fi.flavor_id === item.flavor_id)
        .reduce((sum, fi) => sum + (fi.id === item.id ? editItemQty : (fi.quantity || 0)), 0);
      const invRecord = inventory.find((i) => i.flavor_id === item.flavor_id && !i.flavorset_id);
      if (invRecord) {
        await base44.entities.Inventory.update(invRecord.id, { cases: totalCases });
        setInventory((prev) => prev.map((i) => i.id === invRecord.id ? { ...i, cases: totalCases } : i));
      }
    }
  }

  async function deleteFreezerItem(id) {
    await base44.entities.FreezerItem.delete(id);
    setFreezerItems((prev) => prev.filter((fi) => fi.id !== id));
  }

  async function moveItem(item) {
    if (!moveTargetFreezer || moveTargetFreezer === item.freezer_id) { setMovingItemId(null); return; }
    setSaving(true);
    const filterKey = item.type === "pallet" ? "flavorset_id" : "flavor_id";
    const targetExisting = freezerItems.find(
      (fi) => fi.freezer_id === moveTargetFreezer && fi.type === item.type && fi[filterKey] === item[filterKey]
    );
    if (targetExisting) {
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

  // Move qty (cases or pallets) from one location item to another
  async function handleMoveSubmit() {
    const { fi, itemType } = moveModal;
    const { toFreezerId, qty, unit } = moveForm;
    if (!toFreezerId || qty <= 0) return;
    setSaving(true);

    // Convert move qty to the stored unit (pallets for pallet items, cases for individual)
    const moveQty = (itemType === "pallet" && unit === "cases")
      ? qty / CASES_PER_PALLET   // convert cases → pallets (can be fractional)
      : qty;

    const actualMoveQty = itemType === "pallet" ? Math.max(0, Math.min(moveQty, fi.quantity)) : Math.max(0, Math.min(moveQty, fi.quantity));

    if (actualMoveQty <= 0) { setSaving(false); return; }

    const newSourceQty = fi.quantity - actualMoveQty;
    const filterKey = itemType === "pallet" ? "flavorset_id" : "flavor_id";
    const filterVal = itemType === "pallet" ? fi.flavorset_id : fi.flavor_id;

    // Update or create destination
    const destExisting = freezerItems.find(
      (x) => x.freezer_id === toFreezerId && x.type === fi.type && x[filterKey] === filterVal
    );

    const updates = [];
    if (destExisting) {
      updates.push(base44.entities.FreezerItem.update(destExisting.id, { quantity: (destExisting.quantity || 0) + actualMoveQty }));
    } else {
      const payload = { freezer_id: toFreezerId, type: fi.type, quantity: actualMoveQty };
      if (itemType === "pallet") payload.flavorset_id = fi.flavorset_id;
      else payload.flavor_id = fi.flavor_id;
      updates.push(base44.entities.FreezerItem.create(payload));
    }

    // Update or delete source
    if (newSourceQty <= 0) {
      updates.push(base44.entities.FreezerItem.delete(fi.id));
    } else {
      updates.push(base44.entities.FreezerItem.update(fi.id, { quantity: newSourceQty }));
    }

    await Promise.all(updates);
    const fresh = await base44.entities.FreezerItem.list();
    setFreezerItems(fresh);
    setMoveModal(null);
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
        <p className="text-muted-foreground mt-1">Track cases on hand, storage locations, and vendor pickups</p>
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

          {/* ── Locations Management Section ── */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-primary" /> Storage Locations
              </h3>
              <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => openCrudPw("add-freezer")}>
                <Plus className="w-3 h-3" /> Add Location
              </Button>
            </div>

            {showFreezerForm && (
              <div className="bg-card rounded-2xl border border-border p-5 mb-4">
                <h4 className="font-heading font-semibold mb-3">{editingFreezerId ? "Edit" : "New"} Location</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Location Name</label>
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

            {freezers.length === 0 ? (
              <div className="bg-muted rounded-2xl p-4 text-sm text-muted-foreground">
                No locations yet — add a freezer or storage location to start tracking where inventory is stored.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-center">
                {freezers.map((f) => (
                  <div key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${defaultFreezer === f.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                    {defaultFreezer === f.id && <Star className="w-3 h-3 text-primary flex-shrink-0" />}
                    <span className="font-medium">{f.name}</span>
                    {f.notes && <span className="text-xs text-muted-foreground">· {f.notes}</span>}
                    <div className="flex gap-0.5 ml-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openCrudPw("edit-freezer", f)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => openCrudPw("delete-freezer", f)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
                  <span>Default:</span>
                  {freezerSelectUnlocked ? (
                    <div className="flex items-center gap-1">
                      <Select value={defaultFreezer || "__none__"} onValueChange={(v) => handleSetDefault(v === "__none__" ? null : v)}>
                        <SelectTrigger className="w-36 h-7 text-xs"><SelectValue placeholder="Set default" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {freezers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setFreezerSelectUnlocked(false)}>Lock</Button>
                    </div>
                  ) : (
                    <button className="underline text-xs" onClick={openFreezerPw}>{defaultFreezerName || "None"} 🔒</button>
                  )}
                </div>
              </div>
            )}
          </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Location (optional)</label>
                  <Select value={addInvForm.location_id || "__default__"} onValueChange={(v) => setAddInvForm({ ...addInvForm, location_id: v === "__default__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Use default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">{defaultFreezerName ? `Default (${defaultFreezerName})` : "Default location"}</SelectItem>
                      {freezers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              <h3 className="font-heading font-semibold">Flavorset Cases (Pallet Tracked)</h3>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button onClick={() => setFlavorsetDisplayMode("pallets")} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${flavorsetDisplayMode === "pallets" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Pallets</button>
                <button onClick={() => setFlavorsetDisplayMode("cases")} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${flavorsetDisplayMode === "cases" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Cases</button>
              </div>
            </div>
            {flavorsetInv.length === 0 ? (
              <p className="text-sm text-muted-foreground">No flavorset inventory yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {flavorsetInv.map((inv) => {
                  const fs = fsMap[inv.flavorset_id];
                  const locItems = freezerItems.filter((fi) => fi.type === "pallet" && fi.flavorset_id === inv.flavorset_id);
                  // Derive totals from location items (source of truth), fall back to inv.cases if no loc items yet
                  const totalPalletsFromLocs = locItems.reduce((sum, fi) => sum + (fi.quantity || 0), 0);
                  const totalPallets = locItems.length > 0 ? totalPalletsFromLocs : (inv.cases || 0) / CASES_PER_PALLET;
                  const totalCasesCalc = totalPallets * CASES_PER_PALLET;
                  const fullPallets = Math.floor(totalPallets);
                  const remainder = Math.round(totalCasesCalc % CASES_PER_PALLET);
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
                                <p className="text-2xl font-heading font-bold">{Math.round(totalCasesCalc)}</p>
                                <p className="text-xs text-muted-foreground mt-1">Total Cases</p>
                              </div>
                              <div className="bg-muted rounded-xl p-3 text-center">
                                <p className="text-2xl font-heading font-bold">{fullPallets}</p>
                                <p className="text-xs text-muted-foreground mt-1">Full Pallets</p>
                              </div>
                            </div>
                          )}
                          {remainder > 0 && <p className="text-xs text-muted-foreground mt-2">+{remainder} loose cases (partial pallet)</p>}
                          {/* Per-location breakdown */}
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium text-muted-foreground">By Location</p>
                              <Button variant="ghost" size="sm" className="h-5 text-xs px-1 gap-0.5" onClick={() => { setItemForm({ type: "pallet", flavorset_id: inv.flavorset_id, flavor_id: "", quantity: 1 }); setShowItemForm("inline-" + inv.id); }}>
                                <Plus className="w-3 h-3" /> Add
                              </Button>
                            </div>
                            {locItems.length === 0 && showItemForm !== "inline-" + inv.id && (
                              <p className="text-xs text-muted-foreground italic">No location assigned</p>
                            )}
                            {locItems.map((fi) => {
                              const loc = freezers.find((f) => f.id === fi.freezer_id);
                              const displayQty = flavorsetDisplayMode === "cases"
                                ? `${Math.round(fi.quantity * CASES_PER_PALLET)} cs`
                                : `${fi.quantity} pal`;
                              return (
                                <div key={fi.id} className="flex items-center justify-between text-xs py-0.5">
                                  <span className="text-muted-foreground truncate">{loc?.name || "Unknown"}</span>
                                  {editingItemId === fi.id ? (
                                    <div className="flex items-center gap-1">
                                      <Input type="number" min="0" value={editItemQty} onChange={(e) => setEditItemQty(parseFloat(e.target.value) || 0)} className="h-5 text-xs px-1 w-14" autoFocus />
                                      <Button size="sm" className="h-5 px-1" onClick={() => saveEditItem(fi)}><Check className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => setEditingItemId(null)}><X className="w-3 h-3" /></Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">{displayQty}</span>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" title="Move to another location"
                                        onClick={() => { setMoveModal({ fi, itemType: "pallet", locItems }); setMoveForm({ toFreezerId: "", qty: 1, unit: flavorsetDisplayMode === "cases" ? "cases" : "pallets" }); }}>
                                        <ArrowRightLeft className="w-2.5 h-2.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setEditingItemId(fi.id); setEditItemQty(fi.quantity); }}><Pencil className="w-2.5 h-2.5" /></Button>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteFreezerItem(fi.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {showItemForm === "inline-" + inv.id && (
                              <div className="mt-2 flex items-center gap-2">
                                <Select value={itemForm.flavorset_id === inv.flavorset_id ? (itemForm.freezer_id || "") : ""} onValueChange={(v) => setItemForm({ ...itemForm, flavorset_id: inv.flavorset_id, freezer_id: v })}>
                                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Location" /></SelectTrigger>
                                  <SelectContent>{freezers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input
                                  type="number" min="0"
                                  placeholder={flavorsetDisplayMode === "cases" ? "Cases" : "Pal"}
                                  value={itemForm.quantity}
                                  onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })}
                                  className="h-7 text-xs w-16"
                                />
                                <Button size="sm" className="h-7 px-2" disabled={saving} onClick={() => saveFreezerItem(itemForm.freezer_id)}><Check className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowItemForm(null)}><X className="w-3 h-3" /></Button>
                              </div>
                            )}
                          </div>
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
                  const locItems = freezerItems.filter((fi) => fi.type === "individual" && fi.flavor_id === inv.flavor_id);
                  return (
                    <div key={inv.id} className="bg-card rounded-2xl border border-border p-4">
                      <div className="flex items-center gap-2 mb-3">
                        {fl?.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: fl.color }} />}
                        <p className="font-medium text-sm flex-1 truncate">{fl?.name || "Unknown Flavor"}</p>
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
                        <>
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
                          {/* Per-location breakdown + item editing */}
                          <div className="mt-2 pt-2 border-t border-border">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-xs text-muted-foreground">Locations</p>
                              <Button variant="ghost" size="sm" className="h-5 text-xs px-1 gap-0.5" onClick={() => { setItemForm({ type: "individual", flavorset_id: "", flavor_id: inv.flavor_id, quantity: 1 }); setShowItemForm("inline-ind-" + inv.id); }}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            {locItems.length === 0 && showItemForm !== "inline-ind-" + inv.id && (
                              <p className="text-xs text-muted-foreground italic">None</p>
                            )}
                            {locItems.map((fi) => {
                              const loc = freezers.find((f) => f.id === fi.freezer_id);
                              return (
                                <div key={fi.id} className="flex items-center justify-between text-xs py-0.5">
                                  <span className="text-muted-foreground truncate">{loc?.name || "?"}</span>
                                  {editingItemId === fi.id ? (
                                    <div className="flex items-center gap-1">
                                      <Input type="number" min="0" value={editItemQty} onChange={(e) => setEditItemQty(parseFloat(e.target.value) || 0)} className="h-5 text-xs px-1 w-12" autoFocus />
                                      <Button size="sm" className="h-5 px-1" onClick={() => saveEditItem(fi)}><Check className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" className="h-5 px-1" onClick={() => setEditingItemId(null)}><X className="w-3 h-3" /></Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">{fi.quantity} cs</span>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" title="Move to another location"
                                        onClick={() => { setMoveModal({ fi, itemType: "individual", locItems }); setMoveForm({ toFreezerId: "", qty: 1, unit: "cases" }); }}>
                                        <ArrowRightLeft className="w-2.5 h-2.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { setEditingItemId(fi.id); setEditItemQty(fi.quantity); }}><Pencil className="w-2.5 h-2.5" /></Button>
                                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteFreezerItem(fi.id)}><Trash2 className="w-2.5 h-2.5" /></Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {showItemForm === "inline-ind-" + inv.id && (
                              <div className="mt-1 flex items-center gap-1">
                                <Select value={itemForm.freezer_id || ""} onValueChange={(v) => setItemForm({ ...itemForm, flavor_id: inv.flavor_id, freezer_id: v })}>
                                  <SelectTrigger className="h-6 text-xs flex-1"><SelectValue placeholder="Loc" /></SelectTrigger>
                                  <SelectContent>{freezers.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Input type="number" min="0" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: parseFloat(e.target.value) || 0 })} className="h-6 text-xs w-14" />
                                <Button size="sm" className="h-6 px-1" disabled={saving} onClick={() => saveFreezerItem(itemForm.freezer_id)}><Check className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setShowItemForm(null)}><X className="w-3 h-3" /></Button>
                              </div>
                            )}
                          </div>
                        </>
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
                  <Input type="number" min="0" step="any" value={pickupForm.pallets} onChange={(e) => setPickupForm({ ...pickupForm, pallets: parseFloat(e.target.value) || 0 })} required />
                  {pickupForm.pallets > 0 && <p className="text-xs text-muted-foreground mt-1">= {Math.round(pickupForm.pallets * CASES_PER_PALLET)} cases</p>}
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
              {pickups.map((p) => {
                const isSpecial = specialOrderNames.has((p.vendor_name || "").trim().toLowerCase());
                return (
                <div key={p.id} className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <Truck className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {isSpecial && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-green-500" />}
                        {p.vendor_name}
                        {isSpecial && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Special Order</span>}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {fsMap[p.flavorset_id]?.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fsMap[p.flavorset_id].color }} />}
                        {fsMap[p.flavorset_id]?.name || "Unknown"} · {p.pallets} pallet{p.pallets !== 1 ? "s" : ""} ({Math.round(p.cases)} cases) · {p.pickup_date}
                      </p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive flex-shrink-0" onClick={() => openCrudPw("delete-pickup", p)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {crudPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">
              {crudPw.action === "add-freezer" ? "Add Location" :
               crudPw.action === "edit-freezer" ? `Edit ${crudPw.data?.name}` :
               crudPw.action === "delete-freezer" ? `Delete ${crudPw.data?.name}` :
               crudPw.action === "add-pickup" ? "Record Pickup" :
               `Delete Pickup — ${crudPw.data?.vendor_name}`}
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
              <Button size="sm" className={(crudPw.action === "delete-freezer" || crudPw.action === "delete-pickup") ? "bg-red-600 hover:bg-red-700 text-white" : ""} onClick={confirmCrudPw}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

      {freezerPwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">Change Default Location</h3>
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

      {/* ── Move Modal ── */}
      {moveModal && (() => {
        const { fi, itemType, locItems } = moveModal;
        const sourceLoc = freezers.find((f) => f.id === fi.freezer_id);
        const otherLocs = freezers.filter((f) => f.id !== fi.freezer_id);
        const isPallet = itemType === "pallet";
        const maxPallets = fi.quantity;
        const maxCases = isPallet ? Math.round(fi.quantity * CASES_PER_PALLET) : fi.quantity;
        const moveQtyInPallets = isPallet && moveForm.unit === "cases"
          ? moveForm.qty / CASES_PER_PALLET
          : moveForm.qty;
        const moveQtyInCases = isPallet
          ? (moveForm.unit === "cases" ? moveForm.qty : Math.round(moveForm.qty * CASES_PER_PALLET))
          : moveForm.qty;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
              <h3 className="font-heading font-semibold text-lg mb-1 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" /> Move Inventory
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                From <span className="font-medium text-foreground">{sourceLoc?.name || "Unknown"}</span>
                {isPallet && <span> · {maxPallets} pal ({maxCases} cs) available</span>}
                {!isPallet && <span> · {maxCases} cs available</span>}
              </p>

              {/* Unit toggle — only for pallet items */}
              {isPallet && (
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 mb-4 w-fit">
                  <button onClick={() => setMoveForm({ ...moveForm, unit: "pallets" })} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${moveForm.unit === "pallets" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Pallets</button>
                  <button onClick={() => setMoveForm({ ...moveForm, unit: "cases" })} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${moveForm.unit === "cases" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>Cases</button>
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Quantity to Move ({isPallet ? moveForm.unit : "cases"})
                  </label>
                  <Input
                    type="number" min="0" step={isPallet && moveForm.unit === "pallets" ? "0.5" : "1"}
                    max={isPallet && moveForm.unit === "pallets" ? maxPallets : maxCases}
                    value={moveForm.qty}
                    onChange={(e) => setMoveForm({ ...moveForm, qty: parseFloat(e.target.value) || 0 })}
                    autoFocus
                  />
                  {isPallet && moveForm.qty > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      = {moveForm.unit === "pallets"
                        ? `${Math.round(moveForm.qty * CASES_PER_PALLET)} cases`
                        : `${(moveForm.qty / CASES_PER_PALLET).toFixed(2)} pallets`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Move To</label>
                  {otherLocs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No other locations available. Add another location first.</p>
                  ) : (
                    <Select value={moveForm.toFreezerId} onValueChange={(v) => setMoveForm({ ...moveForm, toFreezerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                      <SelectContent>{otherLocs.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setMoveModal(null)}>Cancel</Button>
                <Button size="sm" disabled={saving || !moveForm.toFreezerId || moveForm.qty <= 0} onClick={handleMoveSubmit} className="gap-1">
                  <ArrowRightLeft className="w-3 h-3" /> Move
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}