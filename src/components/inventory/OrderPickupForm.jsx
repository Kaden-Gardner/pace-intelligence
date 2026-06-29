import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Plus, Trash2 } from "lucide-react";

const CASES_PER_PALLET = 66;

export default function OrderPickupForm({ flavorSets, flavors, onSaved, onCancel, existingOrder = null, existingItems = [] }) {
  const [form, setForm] = useState({
    vendor_name: existingOrder?.vendor_name || "",
    pickup_date: existingOrder?.pickup_date || new Date().toISOString().split("T")[0],
    notes: existingOrder?.notes || "",
  });

  const blankItem = { item_type: "flavorset", flavorset_id: "", flavor_id: "", pallets: "", cases: "" };

  const [items, setItems] = useState(() => {
    if (existingItems.length > 0) {
      return existingItems.map((i) => ({
        id: i.id,
        item_type: i.item_type || "flavorset",
        flavorset_id: i.flavorset_id || "",
        flavor_id: i.flavor_id || "",
        pallets: i.pallets != null ? String(i.pallets) : "",
        cases: i.cases != null ? String(i.cases) : "",
      }));
    }
    // Legacy single-item order
    if (existingOrder?.flavorset_id) {
      return [{
        item_type: "flavorset",
        flavorset_id: existingOrder.flavorset_id,
        flavor_id: "",
        pallets: existingOrder.pallets != null ? String(existingOrder.pallets) : "",
        cases: existingOrder.cases != null ? String(existingOrder.cases) : "",
      }];
    }
    return [{ ...blankItem }];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...blankItem }]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function computeCases(item) {
    if (item.cases !== "" && item.cases !== undefined) return parseFloat(item.cases) || 0;
    if (item.pallets !== "" && item.pallets !== undefined) return Math.round((parseFloat(item.pallets) || 0) * CASES_PER_PALLET);
    return 0;
  }

  function computePallets(item) {
    if (item.pallets !== "" && item.pallets !== undefined) return parseFloat(item.pallets) || 0;
    if (item.cases !== "" && item.cases !== undefined) return (parseFloat(item.cases) || 0) / CASES_PER_PALLET;
    return 0;
  }

  async function handleSave() {
    if (!form.vendor_name || !form.pickup_date) return;
    if (items.length === 0) return;
    for (const it of items) {
      if (it.item_type === "flavorset" && !it.flavorset_id) return;
      if (it.item_type === "individual" && !it.flavor_id) return;
    }
    setSaving(true);
    setError("");

    // Validate inventory availability before saving
    const checks = items.map((it) => {
      const cases = computeCases(it);
      const label = it.item_type === "flavorset"
        ? (flavorSets.find((fs) => fs.id === it.flavorset_id)?.name || "Unknown flavorset")
        : (flavors.find((f) => f.id === it.flavor_id)?.name || "Unknown flavor");
      if (it.item_type === "flavorset" && it.flavorset_id) {
        return { type: "flavorset", id: it.flavorset_id, cases, label };
      }
      if (it.item_type === "individual" && it.flavor_id) {
        return { type: "individual", id: it.flavor_id, cases, label };
      }
      return null;
    }).filter(Boolean);

    // Fetch inventory once per item and verify enough stock
    const shortageMsgs = [];
    for (const c of checks) {
      if (c.type === "flavorset") {
        const invRows = await base44.entities.Inventory.filter({ flavorset_id: c.id });
        const invRow = invRows.find((r) => !r.flavor_id);
        const avail = invRow?.cases || 0;
        if (avail < c.cases) shortageMsgs.push(`${c.label} (need ${c.cases}, have ${avail})`);
      } else {
        const invRows = await base44.entities.Inventory.filter({ flavor_id: c.id });
        const invRow = invRows.find((r) => !r.flavorset_id);
        const avail = invRow?.cases || 0;
        if (avail < c.cases) shortageMsgs.push(`${c.label} (need ${c.cases}, have ${avail})`);
      }
    }

    if (shortageMsgs.length > 0) {
      setError("Insufficient inventory: " + shortageMsgs.join("; "));
      setSaving(false);
      return;
    }

    let order;
    if (existingOrder) {
      await base44.entities.OrderPickup.update(existingOrder.id, {
        vendor_name: form.vendor_name,
        pickup_date: form.pickup_date,
        notes: form.notes,
      });
      order = { ...existingOrder, ...form };
      // Delete old items, recreate
      await Promise.all(existingItems.map((i) => base44.entities.OrderPickupItem.delete(i.id)));
    } else {
      order = await base44.entities.OrderPickup.create({
        vendor_name: form.vendor_name,
        pickup_date: form.pickup_date,
        notes: form.notes,
        is_priced: false,
      });
    }

    const createdItems = await Promise.all(items.map((it) => {
      const pallets = computePallets(it);
      const cases = computeCases(it);
      const payload = {
        order_id: order.id,
        item_type: it.item_type,
        pallets,
        cases,
      };
      if (it.item_type === "flavorset") payload.flavorset_id = it.flavorset_id;
      else payload.flavor_id = it.flavor_id;
      return base44.entities.OrderPickupItem.create(payload);
    }));

    // Deduct from inventory — only items actually in the order
    for (const it of createdItems) {
      if (it.item_type === "flavorset" && it.flavorset_id) {
        const invRows = await base44.entities.Inventory.filter({ flavorset_id: it.flavorset_id });
        const invRow = invRows.find((r) => !r.flavor_id);
        if (invRow) {
          const newCases = (invRow.cases || 0) - (it.cases || 0);
          await base44.entities.Inventory.update(invRow.id, { cases: newCases });
        }
      } else if (it.item_type === "individual" && it.flavor_id) {
        const invRows = await base44.entities.Inventory.filter({ flavor_id: it.flavor_id });
        const invRow = invRows.find((r) => !r.flavorset_id);
        if (invRow) {
          const newCases = (invRow.cases || 0) - (it.cases || 0);
          await base44.entities.Inventory.update(invRow.id, { cases: newCases });
        }
      }
    }

    setSaving(false);
    onSaved(order, createdItems);
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 mb-6">
      <h3 className="font-heading font-semibold mb-4">{existingOrder ? "Edit Order" : "Record Order Pickup"}</h3>

      {/* Order header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Vendor Name</label>
          <Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} placeholder="Vendor Co." />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Pickup Date</label>
          <Input type="date" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </div>

      {/* Line items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">Items</h4>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addItem}>
            <Plus className="w-3 h-3" /> Add Item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="bg-muted/50 rounded-xl p-4 border border-border">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                {/* Type */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                  <Select value={it.item_type} onValueChange={(v) => updateItem(idx, "item_type", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flavorset">Flavorset</SelectItem>
                      <SelectItem value="individual">Individual Flavor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Flavorset or Flavor */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {it.item_type === "flavorset" ? "Flavorset" : "Flavor"}
                  </label>
                  {it.item_type === "flavorset" ? (
                    <Select value={it.flavorset_id} onValueChange={(v) => updateItem(idx, "flavorset_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{flavorSets.map((fs) => <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Select value={it.flavor_id} onValueChange={(v) => updateItem(idx, "flavor_id", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{flavors.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>

                {/* Quantity */}
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantity</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number" min="0" step="any"
                        placeholder="Pallets"
                        value={it.pallets}
                        onChange={(e) => updateItem(idx, "pallets", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">pallets</p>
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number" min="0" step="any"
                        placeholder="Cases"
                        value={it.cases}
                        onChange={(e) => updateItem(idx, "cases", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">cases</p>
                    </div>
                  </div>
                  {(it.pallets || it.cases) && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      = {Math.round(computeCases(it))} cases / {computePallets(it).toFixed(2)} pal
                    </p>
                  )}
                </div>

                {/* Remove */}
                <div className="flex justify-end">
                  {items.length > 1 && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive mb-3">{error}</p>
      )}

      <div className="flex gap-2 mt-4">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Check className="w-4 h-4" /> {saving ? "Saving..." : "Save Order"}
        </Button>
        <Button variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}