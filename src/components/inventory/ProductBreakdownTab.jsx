import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Package, Layers, Box } from "lucide-react";
import { INGREDIENTS } from "@/components/inventory/IngredientsTab";

// These are the per-popsicle / per-case config keys we track
// Some are in MaterialDefaults, some in BagInventory (bags_per_case, popsicles_per_bag via CaseSize)
// We'll store pops_per_bag and pops_per_case in MaterialDefaults as pseudo-entries

const WRAP_KEYS = ["individual_wrap", "clear_wrap"];
const WRAP_LABELS = { individual_wrap: "Individual Wrap", clear_wrap: "Clear Wrap" };

// "Global" pack config keys stored in MaterialDefaults
const PACK_CONFIG = [
  { key: "popsicles_per_gallon", label: "Popsicles per Gallon (Mold Size)", unit: "pops/gallon", description: "How many popsicles fit in one gallon of base mix (mold size)" },
  { key: "popsicles_per_bag",    label: "Popsicles per Bag",                unit: "pops/bag" },
  { key: "bags_per_case",        label: "Bags per Case",                    unit: "bags/case" },
  { key: "popsicles_per_case",   label: "Popsicles per Case",               unit: "pops/case" },
];

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-heading font-semibold text-lg">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EditableRow({ label, unit, value, onSave, description }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  function start() { setVal(value != null ? String(value) : ""); setEditing(true); }
  function cancel() { setEditing(false); }
  async function save() { await onSave(parseFloat(val) || 0); setEditing(false); }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        <p className="text-xs text-muted-foreground">{unit}</p>
      </div>
      {editing ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Input
            type="number" min="0" step="any" autoFocus
            className="w-28 h-8 text-sm"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <Button size="sm" className="h-8 gap-1" onClick={save}><Check className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={cancel}><X className="w-3 h-3" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="font-heading font-bold text-primary text-lg">
            {value != null && value !== 0 ? value : <span className="text-muted-foreground text-sm font-normal">Not set</span>}
          </span>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={start}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ProductBreakdownTab() {
  const [matDefaults, setMatDefaults] = useState({}); // keyed by material_key
  const [ingDefaults, setIngDefaults] = useState([]); // BaseMixDefaults global
  const [jugDefaults, setJugDefaults] = useState([]); // FlavorJugDefaults
  const [supplyPrices, setSupplyPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [mdef, bmd, jdef, sp] = await Promise.all([
      base44.entities.MaterialDefaults.list(),
      base44.entities.BaseMixDefaults.list(),
      base44.entities.FlavorJugDefaults.list(),
      base44.entities.SupplyPrice.list(),
    ]);
    const map = {};
    mdef.forEach((d) => { map[d.material_key] = d; });
    setMatDefaults(map);
    setIngDefaults(bmd.filter((d) => !d.flavorset_id)); // global only
    setJugDefaults(jdef);
    setSupplyPrices(sp);
    setLoading(false);
  }

  async function saveMatDefault(key, field, value) {
    const existing = matDefaults[key];
    if (existing) {
      await base44.entities.MaterialDefaults.update(existing.id, { [field]: value });
      setMatDefaults((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    } else {
      const created = await base44.entities.MaterialDefaults.create({ material_key: key, [field]: value });
      setMatDefaults((prev) => ({ ...prev, [key]: created }));
    }
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Derived values for the summary breakdown
  const popsPerBag = matDefaults["popsicles_per_bag"]?.qty_per_shift || null;
  const bagsPerCase = matDefaults["bags_per_case"]?.qty_per_shift || null;
  const popsPerCase = matDefaults["popsicles_per_case"]?.qty_per_shift || (popsPerBag && bagsPerCase ? popsPerBag * bagsPerCase : null);
  const sticksPerBox = matDefaults["popsicle_sticks"]?.qty_per_shift || null;
  const casesPerStack = matDefaults["box_stacks"]?.qty_per_shift || null;

  // Wrap: pops per roll = feet_per_roll / feet_per_popsicle
  function wrapPopsPerRoll(key) {
    const fpr = matDefaults[key]?.feet_per_roll;
    const fpp = matDefaults[key]?.feet_per_popsicle;
    if (!fpr || !fpp) return null;
    return fpr / fpp;
  }

  // Ingredient cost per popsicle (using global defaults)
  const GALLONS_PER_BATCH = 240;
  let ingCostPerGallon = null;
  {
    let batchCost = 0;
    let hasAny = false;
    INGREDIENTS.forEach((ing) => {
      const pr = supplyPrices.find((p) => p.item_key === ing.key && p.item_type === "ingredient");
      const def = ingDefaults.find((d) => d.ingredient === ing.key);
      if (pr && def && def.amount_per_batch > 0) { batchCost += def.amount_per_batch * pr.price_per_unit; hasAny = true; }
    });
    if (hasAny) ingCostPerGallon = batchCost / GALLONS_PER_BATCH;
  }
  const ppg = matDefaults["popsicles_per_gallon"]?.qty_per_shift || 24;
  const ingCostPerPop = ingCostPerGallon != null ? ingCostPerGallon / ppg : null;

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted-foreground">
        Configure unit-level defaults to understand exactly what goes into each popsicle, bag, and case. This helps verify cost calculations and production math.
      </p>

      {/* ── Pack Configuration ── */}
      <Section icon={Package} title="Pack Configuration">
        <p className="text-xs text-muted-foreground mb-4">How popsicles pack into bags and bags pack into cases.</p>
        <div className="space-y-2">
          {PACK_CONFIG.map((cfg) => (
            <EditableRow
              key={cfg.key}
              label={cfg.label}
              unit={cfg.unit}
              value={matDefaults[cfg.key]?.qty_per_shift || null}
              onSave={(v) => saveMatDefault(cfg.key, "qty_per_shift", v)}
            />
          ))}
          <EditableRow
            label="Cases per Box Stack"
            unit="cases/stack"
            value={casesPerStack}
            onSave={(v) => saveMatDefault("box_stacks", "qty_per_shift", v)}
          />
          <EditableRow
            label="Sticks per Box"
            unit="sticks/box"
            value={sticksPerBox}
            onSave={(v) => saveMatDefault("popsicle_sticks", "qty_per_shift", v)}
          />
        </div>
      </Section>

      {/* ── Wrap Defaults ── */}
      <Section icon={Layers} title="Wrap Defaults">
        <p className="text-xs text-muted-foreground mb-4">
          Set feet per roll and feet used per popsicle. The app will calculate how many popsicles you get per roll.
        </p>
        <div className="space-y-6">
          {WRAP_KEYS.map((key) => {
            const fpr = matDefaults[key]?.feet_per_roll || null;
            const fpp = matDefaults[key]?.feet_per_popsicle || null;
            const popsPerRoll = wrapPopsPerRoll(key);
            return (
              <div key={key} className="bg-muted/40 rounded-2xl border border-border p-5">
                <p className="font-heading font-semibold mb-3">{WRAP_LABELS[key]}</p>
                <div className="space-y-2">
                  <EditableRow
                    label="Feet per Roll"
                    unit="ft/roll"
                    value={fpr}
                    onSave={(v) => saveMatDefault(key, "feet_per_roll", v)}
                  />
                  <EditableRow
                    label="Feet per Popsicle"
                    unit="ft/popsicle"
                    value={fpp}
                    onSave={(v) => saveMatDefault(key, "feet_per_popsicle", v)}
                  />
                </div>
                {popsPerRoll != null && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Calculated:</span>
                    <span className="text-sm font-semibold text-primary">{Math.round(popsPerRoll).toLocaleString()} popsicles per roll</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Visual Breakdown ── */}
      <Section icon={Box} title="What Goes Into…">
        <p className="text-xs text-muted-foreground mb-5">
          A visual summary based on the defaults above. Set the values above to fill this in.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* One Popsicle */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🍭</span>
              <h4 className="font-heading font-semibold">One Popsicle</h4>
            </div>
            <div className="space-y-2 text-sm">
              <BreakdownLine label="1 popsicle stick" note={sticksPerBox ? `(1 of ${sticksPerBox}/box)` : undefined} />
              {matDefaults["individual_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${matDefaults["individual_wrap"].feet_per_popsicle} ft individual wrap`} />
                : <BreakdownLine label="Individual wrap" note="(set ft/popsicle above)" dim />}
              {matDefaults["clear_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${matDefaults["clear_wrap"].feet_per_popsicle} ft clear wrap`} />
                : <BreakdownLine label="Clear wrap" note="(set ft/popsicle above)" dim />}
              {ingCostPerPop != null && (
                <BreakdownLine label={`~$${ingCostPerPop.toFixed(4)} base mix ingredients`} note={`(÷ ${ppg} pops/gal)`} />
              )}
            </div>
          </div>

          {/* One Bag */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🛍️</span>
              <h4 className="font-heading font-semibold">One Bag</h4>
            </div>
            <div className="space-y-2 text-sm">
              {popsPerBag
                ? <BreakdownLine label={`${popsPerBag} popsicles`} />
                : <BreakdownLine label="? popsicles" note="(set popsicles/bag above)" dim />}
              <BreakdownLine label="1 bag" />
              {popsPerBag && matDefaults["individual_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerBag * matDefaults["individual_wrap"].feet_per_popsicle).toFixed(1)} ft individual wrap`} />
                : <BreakdownLine label="Individual wrap" note="(set defaults above)" dim />}
              {popsPerBag && matDefaults["clear_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerBag * matDefaults["clear_wrap"].feet_per_popsicle).toFixed(1)} ft clear wrap`} />
                : <BreakdownLine label="Clear wrap" note="(set defaults above)" dim />}
              {popsPerBag && sticksPerBox
                ? <BreakdownLine label={`${popsPerBag} sticks (${(popsPerBag / sticksPerBox).toFixed(3)} boxes)`} />
                : <BreakdownLine label="? sticks" note="(set sticks/box above)" dim />}
            </div>
          </div>

          {/* One Case */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📦</span>
              <h4 className="font-heading font-semibold">One Case</h4>
            </div>
            <div className="space-y-2 text-sm">
              {bagsPerCase
                ? <BreakdownLine label={`${bagsPerCase} bags`} />
                : <BreakdownLine label="? bags" note="(set bags/case above)" dim />}
              {popsPerCase
                ? <BreakdownLine label={`${popsPerCase} popsicles`} />
                : <BreakdownLine label="? popsicles" note="(set pops/bag & bags/case)" dim />}
              {popsPerCase && matDefaults["individual_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerCase * matDefaults["individual_wrap"].feet_per_popsicle).toFixed(0)} ft individual wrap`} />
                : <BreakdownLine label="Individual wrap total" note="(set defaults above)" dim />}
              {popsPerCase && matDefaults["clear_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerCase * matDefaults["clear_wrap"].feet_per_popsicle).toFixed(0)} ft clear wrap`} />
                : <BreakdownLine label="Clear wrap total" note="(set defaults above)" dim />}
              {popsPerCase && sticksPerBox
                ? <BreakdownLine label={`${popsPerCase} sticks (${(popsPerCase / sticksPerBox).toFixed(2)} boxes)`} />
                : <BreakdownLine label="? sticks" note="(set sticks/box above)" dim />}
              {casesPerStack && (
                <BreakdownLine label={`1/${casesPerStack} of a box stack`} />
              )}
              {popsPerCase && ingCostPerPop != null && (
                <BreakdownLine label={`~$${(popsPerCase * ingCostPerPop).toFixed(2)} base mix ingredients`} />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Base Mix Ingredient Reference ── */}
      <Section icon={Package} title="Base Mix Per Batch (Global Defaults)">
        <p className="text-xs text-muted-foreground mb-4">
          Reference: global ingredient amounts per batch ({GALLONS_PER_BATCH} gal). Edit these in the Ingredients tab.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {INGREDIENTS.map((ing) => {
            const def = ingDefaults.find((d) => d.ingredient === ing.key);
            const pr = supplyPrices.find((p) => p.item_key === ing.key && p.item_type === "ingredient");
            const batchCost = (def?.amount_per_batch || 0) * (pr?.price_per_unit || 0);
            return (
              <div key={ing.key} className="bg-card rounded-2xl border border-border p-4 text-center">
                <p className="font-medium text-xs mb-1 text-muted-foreground">{ing.label}</p>
                <p className="font-heading font-bold text-xl">{def?.amount_per_batch ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{ing.unit}/batch</p>
                {batchCost > 0 && <p className="text-xs text-primary mt-1">${batchCost.toFixed(2)}</p>}
              </div>
            );
          })}
        </div>
        {ingCostPerGallon != null && (
          <div className="mt-4 bg-muted/50 rounded-2xl p-4 flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Cost per gallon of base</p>
              <p className="font-heading font-bold text-primary text-xl">${ingCostPerGallon.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cost per popsicle (base mix only, {ppg} pops/gal)</p>
              <p className="font-heading font-bold text-primary text-xl">${ingCostPerPop.toFixed(5)}</p>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function BreakdownLine({ label, note, dim }) {
  return (
    <div className={`flex items-baseline gap-1.5 ${dim ? "opacity-40" : ""}`}>
      <span className="text-primary flex-shrink-0">•</span>
      <span className={dim ? "text-muted-foreground" : ""}>{label}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}