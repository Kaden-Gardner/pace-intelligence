import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MobileSelect from "@/components/MobileSelect";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import ShiftPositionsSection from "../components/shift-form/ShiftPositionsSection";
import ShiftProductionSection from "../components/shift-form/ShiftProductionSection";
import ShiftMaterialsUsageSection from "../components/shift-form/ShiftMaterialsUsageSection";


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
  const [scheduledShifts, setScheduledShifts] = useState([]);
  const [selectedScheduledShiftId, setSelectedScheduledShiftId] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState({});

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
      const [e, f, fs, cs, allProdShifts, allSchedShifts] = await Promise.all([
        base44.entities.Employee.list("name"),
        base44.entities.Flavor.list("name"),
        base44.entities.FlavorSet.list("name"),
        base44.entities.CaseSize.list("name"),
        base44.entities.Shift.list("shift_date", 500),
        base44.entities.ScheduledShift.list("shift_date", 500),
      ]);
      setEmployees(e.filter((emp) => emp.active !== false && !emp.terminated));
      setFlavors(f);
      setFlavorSets(fs);
      setCaseSizes(cs);
      // Only show scheduled shifts that don't already have a recorded production shift on same date
      const usedDates = new Set(allProdShifts.map((s) => s.shift_date));
      // Allow autofill up to 1 day past the scheduled shift date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const available = allSchedShifts.filter((s) => !usedDates.has(s.shift_date) && s.shift_date >= yesterdayStr);
      setScheduledShifts(available);

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
          const usedMap = {};
          (s.materials_used || []).forEach((m) => { if (m.material_key) usedMap[m.material_key] = m.quantity || 0; });
          setMaterialsUsed(usedMap);
        }
      }
      setLoading(false);
    }
    load();
  }, [editId]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applyScheduledShift(id) {
    setSelectedScheduledShiftId(id);
    if (!id) return;
    const ss = scheduledShifts.find((s) => s.id === id);
    if (!ss) return;
    setForm((prev) => ({
      ...prev,
      shift_date: ss.shift_date || prev.shift_date,
      shift_time: ss.shift_time || prev.shift_time,
      flavorset_id: ss.flavorset_id || prev.flavorset_id,
    }));
  }

  // Employees to show in position dropdowns and training when a scheduled shift is selected
  const scheduledEmpIds = selectedScheduledShiftId
    ? (scheduledShifts.find((s) => s.id === selectedScheduledShiftId)?.assigned_employees || [])
    : null;
  const positionEmployees = scheduledEmpIds
    ? employees.filter((e) => scheduledEmpIds.includes(e.id))
    : employees;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const payload = { ...form };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") delete payload[key];
    });
    payload.materials_used = Object.entries(materialsUsed)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => ({ material_key: key, quantity: qty }));

    let previousShiftData = null;
    let previousFlavorsetId = null;
    let previousFlavorsetCases = 0;

    if (editId) {
      // Fetch old shift BEFORE updating so we can correctly reverse inventory
      const old = await base44.entities.Shift.filter({ id: editId });
      if (old.length > 0) {
        previousShiftData = old[0];
        previousFlavorsetId = old[0].flavorset_id || null;
        previousFlavorsetCases = old[0].flavorset_cases || 0;
      }
      await base44.entities.Shift.update(editId, payload);
    } else {
      await base44.entities.Shift.create(payload);
    }

    // Update inventory for flavorset cases
    if (payload.flavorset_id) {
      const allInv = await base44.entities.Inventory.filter({ flavorset_id: payload.flavorset_id });
      const newCases = payload.flavorset_cases || 0;
      if (allInv.length > 0) {
        let base = allInv[0].cases || 0;
        const finalCases = Math.max(0, editId && previousFlavorsetId === payload.flavorset_id
          ? base - previousFlavorsetCases + newCases
          : base + newCases);
        await base44.entities.Inventory.update(allInv[0].id, { cases: finalCases });
      } else {
        await base44.entities.Inventory.create({ flavorset_id: payload.flavorset_id, cases: newCases });
      }
    }

    // If editing and flavorset changed, restore old inventory
    if (editId && previousFlavorsetId && previousFlavorsetId !== payload.flavorset_id && previousFlavorsetCases > 0) {
      const oldInv = await base44.entities.Inventory.filter({ flavorset_id: previousFlavorsetId });
      if (oldInv.length > 0) {
        await base44.entities.Inventory.update(oldInv[0].id, { cases: Math.max(0, (oldInv[0].cases || 0) - previousFlavorsetCases) });
      }
    }

    // Subtract base gallons used in this production shift
    if (payload.flavorset_id) {
      const galFields = [
        payload.starting_gallons_flavor_1 || 0,
        payload.starting_gallons_flavor_2 || 0,
        payload.starting_gallons_flavor_3 || 0,
        payload.starting_gallons_flavor_4 || 0,
      ];
      const totalGallonsUsed = galFields.reduce((sum, g) => sum + g, 0);

      if (totalGallonsUsed > 0) {
        let previousGallonsUsed = 0;
        if (editId && previousShiftData) {
          previousGallonsUsed = [
            previousShiftData.starting_gallons_flavor_1 || 0,
            previousShiftData.starting_gallons_flavor_2 || 0,
            previousShiftData.starting_gallons_flavor_3 || 0,
            previousShiftData.starting_gallons_flavor_4 || 0,
          ].reduce((s, g) => s + g, 0);
        }
        const baseInvRows = await base44.entities.BaseInventory.filter({ flavorset_id: payload.flavorset_id });
        if (baseInvRows.length > 0) {
          const currentGallons = baseInvRows[0].gallons || 0;
          const net = editId
            ? currentGallons + previousGallonsUsed - totalGallonsUsed
            : currentGallons - totalGallonsUsed;
          await base44.entities.BaseInventory.update(baseInvRows[0].id, { gallons: Math.max(0, net) });
        }
      }
    }

    // Deduct flavor jug usage — handles create and edit (reverses old, applies new)
    {
      const [jugDefs, jugInvRows] = await Promise.all([
        base44.entities.FlavorJugDefaults.list(),
        base44.entities.FlavorJugInventory.list(),
      ]);
      const containerOzMap = { liquid_1gal: 128, liquid_5gal: 640, powder_5gal: 640 };

      function computeJugUsage(shiftData) {
        if (!shiftData || !shiftData.flavorset_id) return {};
        const fs = flavorSets.find(f => f.id === shiftData.flavorset_id);
        const pairs = [
          { flavorId: fs?.flavor_1 || null, gallons: shiftData.starting_gallons_flavor_1 || 0 },
          { flavorId: fs?.flavor_2 || null, gallons: shiftData.starting_gallons_flavor_2 || 0 },
          { flavorId: fs?.flavor_3 || null, gallons: shiftData.starting_gallons_flavor_3 || 0 },
          { flavorId: fs?.flavor_4 || null, gallons: shiftData.starting_gallons_flavor_4 || 0 },
        ].filter(p => p.flavorId && p.gallons > 0);
        const usage = {};
        pairs.forEach(({ flavorId, gallons }) => {
          const def = jugDefs.find(d => d.flavor_id === flavorId);
          if (!def || !def.oz_per_gallon_base) return;
          const fl = flavors.find(f => f.id === flavorId);
          const containerOz = containerOzMap[fl?.container_type] ?? 128;
          usage[flavorId] = (def.oz_per_gallon_base * gallons) / containerOz;
        });
        return usage;
      }

      const newUsage = computeJugUsage(payload);
      const oldUsage = editId && previousShiftData ? computeJugUsage(previousShiftData) : {};
      const allJugFlavorIds = new Set([...Object.keys(newUsage), ...Object.keys(oldUsage)]);

      await Promise.all([...allJugFlavorIds].map(async (flavorId) => {
        const netAddBack = (oldUsage[flavorId] || 0) - (newUsage[flavorId] || 0);
        if (Math.abs(netAddBack) < 0.0001) return;
        const jugRec = jugInvRows.find(j => j.flavor_id === flavorId);
        if (jugRec) {
          await base44.entities.FlavorJugInventory.update(jugRec.id, {
            gallons: Math.max(0, (jugRec.gallons || 0) + netAddBack)
          });
        }
      }));
    }

    // Deduct materials — handles create and edit (reverses old, applies new)
    {
      const computeMaterialUsage = (shiftData) => {
        if (!shiftData) return null;
        const popsPerCase = shiftData.popsicles_per_case || 144;
        const flavorsetCases = shiftData.flavorset_cases || 0;
        const indCasesTotal = [
          shiftData.individual_flavor_1_cases || 0,
          shiftData.individual_flavor_2_cases || 0,
          shiftData.individual_flavor_3_cases || 0,
          shiftData.individual_flavor_4_cases || 0,
        ].reduce((s, c) => s + c, 0);
        const totalPopsFlavorset = flavorsetCases * popsPerCase;
        const totalPopsIndividual = indCasesTotal * popsPerCase;
        return {
          totalPops: totalPopsFlavorset + totalPopsIndividual,
          totalPopsFlavorset,
          totalPopsIndividual,
          totalCases: flavorsetCases + indCasesTotal,
          flavorsetCases,
          flavorsetId: shiftData.flavorset_id,
        };
      };

      const newUsage = computeMaterialUsage(payload);
      const oldUsage = editId ? computeMaterialUsage(previousShiftData) : null;

      if ((newUsage && (newUsage.totalPops > 0 || newUsage.totalCases > 0)) || (oldUsage && (oldUsage.totalPops > 0 || oldUsage.totalCases > 0))) {
        const [matDefaults, matInv, bagInv] = await Promise.all([
          base44.entities.MaterialDefaults.list(),
          base44.entities.MaterialInventory.list(),
          base44.entities.BagInventory.list(),
        ]);
        const matMap = {};
        matDefaults.forEach((d) => { matMap[d.material_key] = d; });
        const matInvMap = {};
        matInv.forEach((m) => { matInvMap[m.material] = m; });

        async function adjustMaterial(key, deltaAmount) {
          if (Math.abs(deltaAmount) < 0.0001) return;
          const rec = matInvMap[key];
          if (rec) {
            await base44.entities.MaterialInventory.update(rec.id, { quantity: Math.max(0, (rec.quantity || 0) + deltaAmount) });
          }
        }

        // Popsicle sticks: 1 stick per popsicle, sticks per box from defaults
        const sticksPerBox = matMap["popsicle_sticks"]?.qty_per_shift;
        if (sticksPerBox) {
          const oldAmt = oldUsage ? oldUsage.totalPops / sticksPerBox : 0;
          const newAmt = newUsage.totalPops / sticksPerBox;
          await adjustMaterial("popsicle_sticks", oldAmt - newAmt);
        }

        // Clear wrap (flavorset popsicles)
        const clearFpr = matMap["clear_wrap"]?.feet_per_roll;
        const clearFpp = matMap["clear_wrap"]?.feet_per_popsicle;
        if (clearFpr && clearFpp) {
          const oldAmt = oldUsage ? (oldUsage.totalPopsFlavorset * clearFpp) / clearFpr : 0;
          const newAmt = (newUsage.totalPopsFlavorset * clearFpp) / clearFpr;
          await adjustMaterial("clear_wrap", oldAmt - newAmt);
        }

        // Individual wrap (individual-case popsicles)
        const indivFpr = matMap["individual_wrap"]?.feet_per_roll;
        const indivFpp = matMap["individual_wrap"]?.feet_per_popsicle;
        if (indivFpr && indivFpp) {
          const oldAmt = oldUsage ? (oldUsage.totalPopsIndividual * indivFpp) / indivFpr : 0;
          const newAmt = (newUsage.totalPopsIndividual * indivFpp) / indivFpr;
          await adjustMaterial("individual_wrap", oldAmt - newAmt);
        }

        // Box stacks: cases ÷ cases_per_stack
        const casesPerStack = matMap["box_stacks"]?.qty_per_shift;
        if (casesPerStack) {
          const oldAmt = oldUsage ? oldUsage.totalCases / casesPerStack : 0;
          const newAmt = newUsage.totalCases / casesPerStack;
          await adjustMaterial("box_stacks", oldAmt - newAmt);
        }

        // Bags: flavorset bags only — reverse old flavorset, apply new
        const popsPerBag = matMap["popsicles_per_bag"]?.qty_per_shift || null;
        const bagsPerCase = matMap["bags_per_case"]?.qty_per_shift || null;
        const computeBagsUsed = (usage) => {
          if (!usage || !usage.flavorsetId || usage.flavorsetCases <= 0) return 0;
          if (bagsPerCase) return usage.flavorsetCases * bagsPerCase;
          if (popsPerBag) return usage.totalPopsFlavorset / popsPerBag;
          return 0;
        };
        const oldBags = computeBagsUsed(oldUsage);
        const newBags = computeBagsUsed(newUsage);
        if (Math.abs(oldBags - newBags) > 0.0001) {
          // Add back old flavorset bags
          if (oldBags > 0 && oldUsage.flavorsetId) {
            const oldBagRec = bagInv.find((b) => b.flavorset_id === oldUsage.flavorsetId);
            if (oldBagRec) {
              await base44.entities.BagInventory.update(oldBagRec.id, {
                cases: oldBagRec.cases || 0,
                loose_bags: Math.max(0, (oldBagRec.loose_bags || 0) + oldBags),
              });
            }
          }
          // Subtract new flavorset bags
          if (newBags > 0 && newUsage.flavorsetId) {
            const newBagRec = bagInv.find((b) => b.flavorset_id === newUsage.flavorsetId);
            if (newBagRec) {
              const bpc = newBagRec.bags_per_case || 100;
              let loose = (newBagRec.loose_bags || 0) - newBags;
              let cases = newBagRec.cases || 0;
              while (loose < 0 && cases > 0) { cases -= 1; loose += bpc; }
              loose = Math.max(0, loose);
              await base44.entities.BagInventory.update(newBagRec.id, { cases, loose_bags: loose });
            }
          }
        }
      }
    }

    // Deduct manually-tracked consumable materials (gloves, tape, etc.) — reverses old, applies new
    {
      const oldUsedMap = {};
      if (editId && previousShiftData?.materials_used) {
        previousShiftData.materials_used.forEach((m) => { if (m.material_key) oldUsedMap[m.material_key] = m.quantity || 0; });
      }
      const newUsedMap = {};
      (payload.materials_used || []).forEach((m) => { if (m.material_key) newUsedMap[m.material_key] = m.quantity || 0; });

      const allMatKeys = new Set([...Object.keys(oldUsedMap), ...Object.keys(newUsedMap)]);
      if (allMatKeys.size > 0) {
        const matInvList = await base44.entities.MaterialInventory.list();
        const matInvMap = {};
        matInvList.forEach((m) => { matInvMap[m.material] = m; });

        await Promise.all([...allMatKeys].map(async (key) => {
          const delta = (oldUsedMap[key] || 0) - (newUsedMap[key] || 0);
          if (Math.abs(delta) < 0.0001) return;
          const rec = matInvMap[key];
          if (rec) {
            await base44.entities.MaterialInventory.update(rec.id, { quantity: Math.max(0, (rec.quantity || 0) + delta) });
          } else if (delta < 0) {
            await base44.entities.MaterialInventory.create({ material: key, quantity: 0 });
          }
        }));
      }
    }

    // Update inventory for individual flavor cases (handles add, remove, and change on edit)
    {
      const oldIndFlavors = {};
      if (editId && previousShiftData) {
        for (let i = 1; i <= 4; i++) {
          const fid = previousShiftData[`individual_flavor_${i}`];
          const cases = previousShiftData[`individual_flavor_${i}_cases`] || 0;
          if (fid && cases > 0) oldIndFlavors[fid] = (oldIndFlavors[fid] || 0) + cases;
        }
      }
      const newIndFlavors = {};
      for (let i = 1; i <= 4; i++) {
        const fid = payload[`individual_flavor_${i}`];
        const cases = payload[`individual_flavor_${i}_cases`] || 0;
        if (fid && cases > 0) newIndFlavors[fid] = (newIndFlavors[fid] || 0) + cases;
      }

      const allIndFlavorIds = new Set([...Object.keys(oldIndFlavors), ...Object.keys(newIndFlavors)]);
      for (const flavorId of allIndFlavorIds) {
        const oldCases = oldIndFlavors[flavorId] || 0;
        const newCases = newIndFlavors[flavorId] || 0;
        const delta = newCases - oldCases;
        if (delta === 0) continue;
        const existing = await base44.entities.Inventory.filter({ flavor_id: flavorId });
        if (existing.length > 0) {
          const base = existing[0].cases || 0;
          await base44.entities.Inventory.update(existing[0].id, { cases: Math.max(0, base + delta) });
        } else if (delta > 0) {
          await base44.entities.Inventory.create({ flavor_id: flavorId, cases: delta });
        }
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

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/shifts")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Shifts
      </button>

      <h1 className="font-heading text-3xl font-bold mb-2">{editId ? "Edit" : "New"} Shift</h1>
      <p className="text-muted-foreground mb-8">Fill in the shift details below</p>

      {!editId && scheduledShifts.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-8">
          <label className="text-sm font-medium mb-2 block">Autopopulate from Scheduled Shift</label>
          <MobileSelect
            value={selectedScheduledShiftId}
            onValueChange={applyScheduledShift}
            placeholder="Select a scheduled shift to prefill..."
            label="Scheduled Shift"
          >
            <SelectItem value={null}>— None —</SelectItem>
            {scheduledShifts.map((ss) => {
              const fs = flavorSets.find((f) => f.id === ss.flavorset_id);
              return (
                <SelectItem key={ss.id} value={ss.id}>
                  {ss.shift_date} · {ss.shift_time}{fs ? ` · ${fs.name}` : ""}
                </SelectItem>
              );
            })}
          </MobileSelect>
          {selectedScheduledShiftId && (
            <p className="text-xs text-muted-foreground mt-2">Date, time, flavorset, and working employees have been prefilled. You can still edit anything below.</p>
          )}
        </div>
      )}

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
              <Input type="number" step="0.25" min="0.25" value={form.shift_duration} onChange={(e) => updateForm("shift_duration", parseFloat(e.target.value) || 0)} required />
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
          employees={positionEmployees}
        />

        {/* Materials Used */}
        <ShiftMaterialsUsageSection materialsUsed={materialsUsed} setMaterialsUsed={setMaterialsUsed} />

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