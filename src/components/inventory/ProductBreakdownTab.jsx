import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Package, Layers, Box } from "lucide-react";

const WRAP_KEYS = ["individual_wrap", "clear_wrap"];
const WRAP_LABELS = { individual_wrap: "Individual Wrap", clear_wrap: "Clear Wrap" };

const PACK_CONFIG = [
  { key: "popsicles_per_gallon", label: "Popsicles per Gallon (Mold Size)", unit: "pops/gallon", description: "How many popsicles fit in one gallon of base mix (mold size)" },
  { key: "popsicles_per_bag",    label: "Popsicles per Bag",                unit: "pops/bag" },
  { key: "bags_per_case",        label: "Bags per Popsicle Case",           unit: "bags/case", description: "How many bags of popsicles fit in one popsicle case" },
  { key: "bags_per_bag_case",    label: "Bags per Bag Case (empty)",        unit: "bags/case", description: "How many empty bags come in one case of bags (for purchasing)" },
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

function BreakdownLine({ label, note, dim }) {
  return (
    <div className={`flex items-baseline gap-1.5 ${dim ? "opacity-40" : ""}`}>
      <span className="text-primary flex-shrink-0">•</span>
      <span className={dim ? "text-muted-foreground" : ""}>{label}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

export default function ProductBreakdownTab() {
  const [matDefaults, setMatDefaults] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const mdef = await base44.entities.MaterialDefaults.list();
    const map = {};
    mdef.forEach((d) => { map[d.material_key] = d; });
    setMatDefaults(map);
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

  const popsPerBag = matDefaults["popsicles_per_bag"]?.qty_per_shift || null;
  const bagsPerCase = matDefaults["bags_per_case"]?.qty_per_shift || null;
  const popsPerCase = matDefaults["popsicles_per_case"]?.qty_per_shift || (popsPerBag && bagsPerCase ? popsPerBag * bagsPerCase : null);
  const sticksPerBox = matDefaults["popsicle_sticks"]?.qty_per_shift || null;
  const casesPerStack = matDefaults["box_stacks"]?.qty_per_shift || null;

  function wrapPopsPerRoll(key) {
    const fpr = matDefaults[key]?.feet_per_roll;
    const fpp = matDefaults[key]?.feet_per_popsicle;
    if (!fpr || !fpp) return null;
    return fpr / fpp;
  }

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted-foreground">
        Configure unit-level defaults to understand exactly what goes into each popsicle, bag, and case. Cost breakdowns are available in the Financials page.
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
              description={cfg.description}
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
          A visual summary of materials based on the defaults above. For cost breakdowns, see the Financials page.
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
            </div>
            <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">If flavorset case → clear wrap:</p>
              {matDefaults["clear_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${matDefaults["clear_wrap"].feet_per_popsicle} ft clear wrap`} />
                : <BreakdownLine label="Clear wrap" note="(set ft/popsicle above)" dim />}
            </div>
            <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">If individual case → individual wrap:</p>
              {matDefaults["individual_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${matDefaults["individual_wrap"].feet_per_popsicle} ft individual wrap`} />
                : <BreakdownLine label="Individual wrap" note="(set ft/popsicle above)" dim />}
            </div>
          </div>

          {/* One Bag (flavorset — clear wrap) */}
          <div className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🛍️</span>
              <div>
                <h4 className="font-heading font-semibold">One Bag</h4>
                <p className="text-xs text-muted-foreground">Flavorset case → clear wrap</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {popsPerBag
                ? <BreakdownLine label={`${popsPerBag} popsicles`} />
                : <BreakdownLine label="? popsicles" note="(set popsicles/bag above)" dim />}
              <BreakdownLine label="1 bag" />
              {popsPerBag && matDefaults["clear_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerBag * matDefaults["clear_wrap"].feet_per_popsicle).toFixed(1)} ft clear wrap`} />
                : <BreakdownLine label="Clear wrap" note="(set ft/popsicle above)" dim />}
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
              {popsPerCase && sticksPerBox
                ? <BreakdownLine label={`${popsPerCase} sticks (${(popsPerCase / sticksPerBox).toFixed(2)} boxes)`} />
                : <BreakdownLine label="? sticks" note="(set sticks/box above)" dim />}
              {casesPerStack && (
                <BreakdownLine label={`1/${casesPerStack} of a box stack`} />
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">If flavorset case → clear wrap:</p>
              {popsPerCase && matDefaults["clear_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerCase * matDefaults["clear_wrap"].feet_per_popsicle).toFixed(0)} ft clear wrap`} />
                : <BreakdownLine label="Clear wrap total" note="(set defaults above)" dim />}
            </div>
            <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">If individual case → individual wrap:</p>
              {popsPerCase && matDefaults["individual_wrap"]?.feet_per_popsicle
                ? <BreakdownLine label={`${(popsPerCase * matDefaults["individual_wrap"].feet_per_popsicle).toFixed(0)} ft individual wrap`} />
                : <BreakdownLine label="Individual wrap total" note="(set defaults above)" dim />}
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}