import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Truck, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
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

const CASES_PER_PALLET = 66;

export default function Inventory() {
  const [flavorSets, setFlavorSets] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Inventory edit state
  const [editingInvId, setEditingInvId] = useState(null);
  const [editCases, setEditCases] = useState(0);

  // Add inventory manually
  const [showAddInv, setShowAddInv] = useState(false);
  const [addInvForm, setAddInvForm] = useState({ flavorset_id: "", cases: 0 });

  // Pickup form
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [pickupForm, setPickupForm] = useState({ vendor_name: "", flavorset_id: "", pallets: 1, pickup_date: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [fs, inv, pk] = await Promise.all([
      base44.entities.FlavorSet.list("name"),
      base44.entities.Inventory.list(),
      base44.entities.OrderPickup.list("-pickup_date", 100),
    ]);
    setFlavorSets(fs);
    setInventory(inv);
    setPickups(pk);
    setLoading(false);
  }

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });

  // Inventory CRUD
  async function saveEditInv(inv) {
    const updated = await base44.entities.Inventory.update(inv.id, { cases: editCases });
    setInventory((prev) => prev.map((i) => (i.id === inv.id ? { ...i, cases: editCases } : i)));
    setEditingInvId(null);
  }

  async function saveAddInv() {
    if (!addInvForm.flavorset_id) return;
    setSaving(true);
    const existing = inventory.find((i) => i.flavorset_id === addInvForm.flavorset_id);
    if (existing) {
      const newCases = (existing.cases || 0) + Number(addInvForm.cases);
      await base44.entities.Inventory.update(existing.id, { cases: newCases });
      setInventory((prev) => prev.map((i) => (i.id === existing.id ? { ...i, cases: newCases } : i)));
    } else {
      const created = await base44.entities.Inventory.create({ flavorset_id: addInvForm.flavorset_id, cases: Number(addInvForm.cases) });
      setInventory((prev) => [...prev, created]);
    }
    setAddInvForm({ flavorset_id: "", cases: 0 });
    setShowAddInv(false);
    setSaving(false);
  }

  // Pickup
  async function savePickup(e) {
    e.preventDefault();
    setSaving(true);
    const pickupCases = pickupForm.pallets * CASES_PER_PALLET;
    const created = await base44.entities.OrderPickup.create({ ...pickupForm, pallets: Number(pickupForm.pallets), cases: pickupCases });
    setPickups((prev) => [created, ...prev]);

    // Deduct from inventory
    const invRecord = inventory.find((i) => i.flavorset_id === pickupForm.flavorset_id);
    if (invRecord) {
      const newCases = Math.max(0, (invRecord.cases || 0) - pickupCases);
      await base44.entities.Inventory.update(invRecord.id, { cases: newCases });
      setInventory((prev) => prev.map((i) => (i.id === invRecord.id ? { ...i, cases: newCases } : i)));
    }

    setPickupForm({ vendor_name: "", flavorset_id: "", pallets: 1, pickup_date: new Date().toISOString().split("T")[0], notes: "" });
    setShowPickupForm(false);
    setSaving(false);
  }

  async function deletePickup(pickup) {
    await base44.entities.OrderPickup.delete(pickup.id);
    setPickups((prev) => prev.filter((p) => p.id !== pickup.id));
    // Re-add cases to inventory
    const invRecord = inventory.find((i) => i.flavorset_id === pickup.flavorset_id);
    if (invRecord) {
      const newCases = (invRecord.cases || 0) + (pickup.cases || 0);
      await base44.entities.Inventory.update(invRecord.id, { cases: newCases });
      setInventory((prev) => prev.map((i) => (i.id === invRecord.id ? { ...i, cases: newCases } : i)));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground mt-1">Track cases on hand and vendor pickups</p>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="mb-6">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="pickups">Order Pickups</TabsTrigger>
        </TabsList>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => setShowAddInv(true)}>
              <Plus className="w-4 h-4" /> Adjust Inventory
            </Button>
          </div>

          {showAddInv && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">Add Cases to Inventory</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset</label>
                  <Select value={addInvForm.flavorset_id} onValueChange={(v) => setAddInvForm({ ...addInvForm, flavorset_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                    <SelectContent>
                      {flavorSets.map((fs) => (
                        <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

          {inventory.length === 0 ? (
            <EmptyState icon={Package} title="No inventory yet" description="Cases will appear here automatically as shifts are logged." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.map((inv) => {
                const fs = fsMap[inv.flavorset_id];
                const pallets = Math.floor((inv.cases || 0) / CASES_PER_PALLET);
                const remainder = (inv.cases || 0) % CASES_PER_PALLET;
                return (
                  <div key={inv.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-heading font-semibold">{fs?.name || "Unknown Flavorset"}</h4>
                      {editingInvId !== inv.id && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingInvId(inv.id); setEditCases(inv.cases || 0); }}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                    {editingInvId === inv.id ? (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Total Cases</label>
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
                        {remainder > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">+{remainder} cases (partial pallet)</p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ORDER PICKUPS TAB */}
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
                  <Select value={pickupForm.flavorset_id} onValueChange={(v) => setPickupForm({ ...pickupForm, flavorset_id: v })} required>
                    <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                    <SelectContent>
                      {flavorSets.map((fs) => (
                        <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Pallets ({CASES_PER_PALLET} cases each)</label>
                  <Input type="number" min="1" step="1" value={pickupForm.pallets} onChange={(e) => setPickupForm({ ...pickupForm, pallets: parseFloat(e.target.value) || 1 })} required />
                  {pickupForm.pallets > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">= {pickupForm.pallets * CASES_PER_PALLET} cases</p>
                  )}
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
                      <p className="text-sm text-muted-foreground">
                        {fsMap[p.flavorset_id]?.name || "Unknown"} · {p.pallets} pallet{p.pallets !== 1 ? "s" : ""} ({p.cases} cases) · {p.pickup_date}
                      </p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Pickup</AlertDialogTitle>
                        <AlertDialogDescription>This will restore {p.cases} cases back to inventory.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deletePickup(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}