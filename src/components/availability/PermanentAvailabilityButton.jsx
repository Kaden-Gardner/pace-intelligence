import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Repeat, CheckCircle, XCircle } from "lucide-react";
import { format, eachDayOfInterval, getDay, addYears } from "date-fns";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const MAX_DATE = addYears(TODAY, 1);

export default function PermanentAvailabilityButton({ user, employees, onUpdated }) {
  const [config, setConfig] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ is_available: true, available_from: "08:00", available_until: "17:00", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await base44.entities.PermanentAvailability.filter({ user_id: user.id });
      if (list.length > 0) {
        const c = list[0];
        setConfig(c);
        setForm({
          is_available: c.is_available ?? true,
          available_from: c.available_from || "08:00",
          available_until: c.available_until || "17:00",
          notes: c.notes || "",
        });
      }
    }
    load();
  }, [user.id]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const linkedEmployee = employees.find((emp) => emp.employee_number === user?.employee_number);

    const days = eachDayOfInterval({ start: TODAY, end: MAX_DATE }).filter((d) => {
      const dow = getDay(d);
      return dow >= 1 && dow <= 5;
    });

    const myAvails = await base44.entities.Availability.filter({ user_id: user.id });
    const availByDate = {};
    myAvails.forEach((a) => { availByDate[a.date] = a; });

    const basePayload = {
      is_available: form.is_available,
      available_from: form.available_from,
      available_until: form.available_until,
      notes: form.notes,
      user_id: user.id,
      employee_id: linkedEmployee?.id || "",
      employee_number: linkedEmployee?.employee_number || user.employee_number || "",
      employee_name: linkedEmployee?.name || user?.full_name || "",
    };

    const operations = days.map((day) => {
      const ds = format(day, "yyyy-MM-dd");
      const payload = { ...basePayload, date: ds };
      const existing = availByDate[ds];
      if (existing) return base44.entities.Availability.update(existing.id, payload);
      return base44.entities.Availability.create(payload);
    });

    await Promise.all(operations);

    if (config) {
      const updated = await base44.entities.PermanentAvailability.update(config.id, {
        is_available: form.is_available,
        available_from: form.available_from,
        available_until: form.available_until,
        notes: form.notes,
      });
      setConfig(updated);
    } else {
      const created = await base44.entities.PermanentAvailability.create(basePayload);
      setConfig(created);
    }

    setSaving(false);
    setShowForm(false);
    if (onUpdated) onUpdated();
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowForm(!showForm)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showForm ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}
      >
        <Repeat className="w-4 h-4" />
        {config ? "Edit Permanent Availability" : "Set Permanent Availability"}
      </button>

      {showForm && (
        <div className="mt-3 bg-card rounded-2xl border border-border p-5 max-w-md">
          <h3 className="font-heading font-semibold mb-1">{config ? "Edit Permanent Availability" : "Set Permanent Availability"}</h3>
          <p className="text-xs text-muted-foreground mb-4">Applies to every Monday–Friday for the next year. Individual weekday overrides will be replaced.</p>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm((f) => ({ ...f, is_available: true }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.is_available ? "bg-green-500 text-white border-green-500" : "border-border hover:bg-muted"}`}>
                <CheckCircle className="w-4 h-4" /> Available
              </button>
              <button type="button" onClick={() => setForm((f) => ({ ...f, is_available: false }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${!form.is_available ? "bg-destructive text-white border-destructive" : "border-border hover:bg-muted"}`}>
                <XCircle className="w-4 h-4" /> Unavailable
              </button>
            </div>
            {form.is_available && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                  <Input type="time" value={form.available_from} onChange={(e) => setForm((f) => ({ ...f, available_from: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Until</label>
                  <Input type="time" value={form.available_until} onChange={(e) => setForm((f) => ({ ...f, available_until: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. available after noon" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Applying..." : "Apply to All Weekdays"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}