import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import ShiftPositionsSection from "../components/shift-form/ShiftPositionsSection";
import ShiftProductionSection from "../components/shift-form/ShiftProductionSection";

export default function ShiftForm() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get("id");

  const [employees, setEmployees] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [caseSizes, setCaseSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    shift_date: new Date().toISOString().split("T")[0],
    shift_time: "08:00",
    shift_duration: 8,
    popsicles_per_gallon: 24,
    popsicles_per_case: 144,
    flavorset_id: "",
    flavorset_cases: 0,
    individual_flavor_1: "",
    individual_flavor_1_cases: 0,
    individual_flavor_2: "",
    individual_flavor_2_cases: 0,
    individual_flavor_3: "",
    individual_flavor_3_cases: 0,
    individual_flavor_4: "",
    individual_flavor_4_cases: 0,
    waste: 0,
    filling_employee: "",
    pulling_employee_1: "",
    pulling_employee_2: "",
    pulling_employee_3: "",
    sorting_employee: "",
    bagging_employee: "",
    boxing_employee: "",
    training_employees: [],
    shift_lead: "",
    notes: "",
  });

  useEffect(() => {
    async function load() {
      const [e, f, fs, cs] = await Promise.all([
        base44.entities.Employee.list("name"),
        base44.entities.Flavor.list("name"),
        base44.entities.FlavorSet.list("name"),
        base44.entities.CaseSize.list("name"),
      ]);
      setEmployees(e.filter((emp) => emp.active !== false));
      setFlavors(f);
      setFlavorSets(fs);
      setCaseSizes(cs);

      if (editId) {
        const shifts = await base44.entities.Shift.filter({ id: editId });
        if (shifts.length > 0) {
          const s = shifts[0];
          setForm({
            shift_date: s.shift_date || "",
            shift_time: s.shift_time || "08:00",
            shift_duration: s.shift_duration || 8,
            flavorset_id: s.flavorset_id || "",
            flavorset_cases: s.flavorset_cases || 0,
            individual_flavor_1: s.individual_flavor_1 || "",
            individual_flavor_1_cases: s.individual_flavor_1_cases || 0,
            individual_flavor_2: s.individual_flavor_2 || "",
            individual_flavor_2_cases: s.individual_flavor_2_cases || 0,
            individual_flavor_3: s.individual_flavor_3 || "",
            individual_flavor_3_cases: s.individual_flavor_3_cases || 0,
            individual_flavor_4: s.individual_flavor_4 || "",
            individual_flavor_4_cases: s.individual_flavor_4_cases || 0,
            waste: s.waste || 0,
            filling_employee: s.filling_employee || "",
            pulling_employee_1: s.pulling_employee_1 || "",
            pulling_employee_2: s.pulling_employee_2 || "",
            pulling_employee_3: s.pulling_employee_3 || "",
            sorting_employee: s.sorting_employee || "",
            bagging_employee: s.bagging_employee || "",
            boxing_employee: s.boxing_employee || "",
            training_employees: s.training_employees || [],
            popsicles_per_gallon: s.popsicles_per_gallon || 24,
            popsicles_per_case: s.popsicles_per_case || 144,
            starting_gallons_flavor_1: s.starting_gallons_flavor_1 || 0,
            starting_gallons_flavor_2: s.starting_gallons_flavor_2 || 0,
            starting_gallons_flavor_3: s.starting_gallons_flavor_3 || 0,
            starting_gallons_flavor_4: s.starting_gallons_flavor_4 || 0,
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

    const payload = { ...form };
    // Clean empty strings
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") delete payload[key];
    });

    if (editId) {
      await base44.entities.Shift.update(editId, payload);
    } else {
      await base44.entities.Shift.create(payload);
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

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/shifts")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Shifts
      </button>

      <h1 className="font-heading text-3xl font-bold mb-2">{editId ? "Edit" : "New"} Shift</h1>
      <p className="text-muted-foreground mb-8">Fill in the shift details below</p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
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
              <Input type="number" step="0.5" min="0.5" value={form.shift_duration} onChange={(e) => updateForm("shift_duration", parseFloat(e.target.value) || 0)} required />
            </div>
          </div>
        </section>

        {/* Production */}
        <ShiftProductionSection
          form={form}
          updateForm={updateForm}
          flavors={flavors}
          flavorSets={flavorSets}
          caseSizes={caseSizes}
        />

        {/* Positions */}
        <ShiftPositionsSection
          form={form}
          updateForm={updateForm}
          employees={employees}
        />

        {/* Notes */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-heading font-semibold text-lg mb-4">Notes</h2>
          <Textarea
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
            placeholder="Optional notes about this shift..."
            rows={3}
          />
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : editId ? "Update Shift" : "Create Shift"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/shifts")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}