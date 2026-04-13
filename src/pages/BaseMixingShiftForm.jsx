import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";

const GALLONS_PER_BATCH = 240;

export default function BaseMixingShiftForm() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  const [employees, setEmployees] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    shift_date: new Date().toISOString().split("T")[0],
    shift_time: "08:00",
    shift_duration: 4,
    batch_size: 1,
    flavorset_id: "",
    mixer_1: "",
    mixer_2: "",
    mixer_3: "",
    shift_lead: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      const [e, fs] = await Promise.all([
        base44.entities.Employee.list("name"),
        base44.entities.FlavorSet.list("name"),
      ]);
      setEmployees(e.filter((emp) => emp.active !== false));
      setFlavorSets(fs);

      if (editId) {
        const rows = await base44.entities.BaseMixingShift.filter({ id: editId });
        if (rows.length > 0) {
          const s = rows[0];
          setForm({
            shift_date: s.shift_date || "",
            shift_time: s.shift_time || "08:00",
            shift_duration: s.shift_duration || 4,
            batch_size: s.batch_size || 1,
            flavorset_id: s.flavorset_id || "",
            mixer_1: s.mixer_1 || "",
            mixer_2: s.mixer_2 || "",
            mixer_3: s.mixer_3 || "",
            shift_lead: s.shift_lead || "",
            notes: s.notes || "",
          });
        }
      }
      setLoading(false);
    }
    load();
  }, [editId]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const payload = { ...form, batch_size: Number(form.batch_size), shift_duration: Number(form.shift_duration) };
    Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });

    const newGallons = Number(form.batch_size) * GALLONS_PER_BATCH;

    let previousBatchSize = 0;
    let previousFlavorsetId = null;

    if (editId) {
      const old = await base44.entities.BaseMixingShift.filter({ id: editId });
      if (old.length > 0) {
        previousBatchSize = old[0].batch_size || 0;
        previousFlavorsetId = old[0].flavorset_id || null;
      }
      await base44.entities.BaseMixingShift.update(editId, payload);
    } else {
      await base44.entities.BaseMixingShift.create(payload);
    }

    // Update BaseInventory
    const allBaseInv = await base44.entities.BaseInventory.filter({ flavorset_id: form.flavorset_id });
    if (allBaseInv.length > 0) {
      let base = allBaseInv[0].gallons || 0;
      if (editId && previousFlavorsetId === form.flavorset_id) {
        base = base - (previousBatchSize * GALLONS_PER_BATCH) + newGallons;
      } else {
        base = base + newGallons;
      }
      await base44.entities.BaseInventory.update(allBaseInv[0].id, { gallons: Math.max(0, base) });
    } else {
      await base44.entities.BaseInventory.create({ flavorset_id: form.flavorset_id, gallons: newGallons });
    }

    // If editing and flavorset changed, restore gallons to old flavorset
    if (editId && previousFlavorsetId && previousFlavorsetId !== form.flavorset_id && previousBatchSize > 0) {
      const oldInv = await base44.entities.BaseInventory.filter({ flavorset_id: previousFlavorsetId });
      if (oldInv.length > 0) {
        await base44.entities.BaseInventory.update(oldInv[0].id, {
          gallons: Math.max(0, (oldInv[0].gallons || 0) - previousBatchSize * GALLONS_PER_BATCH),
        });
      }
    }

    setSaving(false);
    navigate("/shifts");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const employeeOptions = employees;

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate("/shifts")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Shifts
      </button>

      <h1 className="font-heading text-3xl font-bold mb-2">{editId ? "Edit" : "New"} Base Mixing Shift</h1>
      <p className="text-muted-foreground mb-8">Record base mixing production — 1 batch = {GALLONS_PER_BATCH} gallons</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Shift Details */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Shift Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={form.shift_date} onChange={(e) => updateForm("shift_date", e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</label>
              <Input type="time" value={form.shift_time} onChange={(e) => updateForm("shift_time", e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (hours)</label>
              <Input type="number" step="0.5" min="0.5" value={form.shift_duration} onChange={(e) => updateForm("shift_duration", e.target.value)} required />
            </div>
          </div>
        </section>

        {/* Production */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Production</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                {form.flavorset_id && flavorSets.find((fs) => fs.id === form.flavorset_id)?.color && (
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: flavorSets.find((fs) => fs.id === form.flavorset_id).color }} />
                )}
                Flavorset
              </label>
              <Select value={form.flavorset_id || undefined} onValueChange={(v) => updateForm("flavorset_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
                <SelectContent>
                  {flavorSets.map((fs) => (
                    <SelectItem key={fs.id} value={fs.id}>
                      <span className="flex items-center gap-2">
                        {fs.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                        {fs.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Number of Batches</label>
              <Input type="number" min="1" step="1" value={form.batch_size} onChange={(e) => updateForm("batch_size", e.target.value)} required />
              {form.batch_size > 0 && (
                <p className="text-xs text-muted-foreground mt-1">= {Number(form.batch_size) * GALLONS_PER_BATCH} gallons total</p>
              )}
            </div>
          </div>
        </section>

        {/* Employees */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Employees</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n}>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mixer {n}{n === 1 ? " (Required)" : ""}</label>
                <Select value={form[`mixer_${n}`] || undefined} onValueChange={(v) => updateForm(`mixer_${n}`, v)}>
                  <SelectTrigger><SelectValue placeholder={`Mixer ${n}`} /></SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Lead</label>
              <Select value={form.shift_lead || undefined} onValueChange={(v) => updateForm("shift_lead", v)}>
                <SelectTrigger><SelectValue placeholder="Select shift lead" /></SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Notes</h2>
          <Textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Optional notes..." rows={3} />
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : editId ? "Update Shift" : "Create Shift"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/shifts")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}