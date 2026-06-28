import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { INGREDIENTS } from "@/components/inventory/IngredientsTab";

const GALLONS_PER_BATCH = 240;

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(4)}`; }
function fmt$2(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }

function CostCard({ emoji, title, subtitle, lines, total, totalLabel }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h4 className="font-heading font-semibold">{title}</h4>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {lines.map((line, i) => (
          <div key={i} className={`flex items-baseline justify-between gap-2 ${line.dim ? "opacity-40" : ""}`}>
            <span className={`flex items-baseline gap-1.5 ${line.dim ? "text-muted-foreground" : ""}`}>
              <span className="text-primary flex-shrink-0">•</span>
              {line.label}
            </span>
            {line.cost != null && (
              <span className="font-medium text-xs text-muted-foreground flex-shrink-0">{fmt$(line.cost)}</span>
            )}
          </div>
        ))}
      </div>
      {total != null && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{totalLabel || "Est. total cost"}</span>
          <span className="font-heading font-bold text-primary text-lg">{fmt$2(total)}</span>
        </div>
      )}
    </div>
  );
}

export default function CostBreakdownTab() {
  const [matDefaults, setMatDefaults] = useState({});
  const [ingDefaults, setIngDefaults] = useState([]);
  const [jugDefaults, setJugDefaults] = useState([]);
  const [supplyPrices, setSupplyPrices] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [flavorPrices, setFlavorPrices] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [mdef, bmd, jdef, sp, fl, fp] = await Promise.all([
      base44.entities.MaterialDefaults.list(),
      base44.entities.BaseMixDefaults.list(),
      base44.entities.FlavorJugDefaults.list(),
      base44.entities.SupplyPrice.list(),
      base44.entities.Flavor.list("name"),
      base44.entities.FlavorPrice.list(),
    ]);
    const map = {};
    mdef.forEach((d) => { map[d.material_key] = d; });
    setMatDefaults(map);
    setIngDefaults(bmd.filter((d) => !d.flavorset_id));
    setJugDefaults(jdef);
    setSupplyPrices(sp);
    setFlavors(fl);
    setFlavorPrices(fp);
    setLoading(false);
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const ppg = matDefaults["popsicles_per_gallon"]?.qty_per_shift || 24;
  const popsPerBag = matDefaults["popsicles_per_bag"]?.qty_per_shift || null;
  const bagsPerCase = matDefaults["bags_per_case"]?.qty_per_shift || null;
  const bagsPerBagCase = matDefaults["bags_per_bag_case"]?.qty_per_shift || 1000;
  const popsPerCase = matDefaults["popsicles_per_case"]?.qty_per_shift || (popsPerBag && bagsPerCase ? popsPerBag * bagsPerCase : null);
  const sticksPerBox = matDefaults["popsicle_sticks"]?.qty_per_shift || null;
  const casesPerStack = matDefaults["box_stacks"]?.qty_per_shift || null;

  // ── Base mix ingredient cost per popsicle ──
  let ingBatchCost = 0;
  let hasIngPrices = false;
  INGREDIENTS.forEach((ing) => {
    const pr = supplyPrices.find((p) => p.item_key === ing.key && p.item_type === "ingredient");
    const def = ingDefaults.find((d) => d.ingredient === ing.key);
    if (pr && def && def.amount_per_batch > 0) { ingBatchCost += def.amount_per_batch * pr.price_per_unit; hasIngPrices = true; }
  });
  const ingCostPerGallon = hasIngPrices ? ingBatchCost / GALLONS_PER_BATCH : null;
  const ingCostPerPop = ingCostPerGallon != null ? ingCostPerGallon / ppg : null;

  // ── Stick cost per popsicle ──
  const stickPriceRec = supplyPrices.find((p) => p.item_key === "popsicle_sticks" && p.item_type === "material");
  const stickCostPerPop = (stickPriceRec && sticksPerBox) ? stickPriceRec.price_per_unit / sticksPerBox : null;

  // ── Wrap cost per popsicle ──
  function wrapCostPerPop(key) {
    const pr = supplyPrices.find((p) => p.item_key === key && p.item_type === "material");
    const fpr = matDefaults[key]?.feet_per_roll;
    const fpp = matDefaults[key]?.feet_per_popsicle;
    if (!pr || !fpr || !fpp || fpr === 0) return null;
    const popsPerRoll = fpr / fpp;
    return pr.price_per_unit / popsPerRoll;
  }
  const clearWrapCostPerPop = wrapCostPerPop("clear_wrap");
  const indivWrapCostPerPop = wrapCostPerPop("individual_wrap");

  // ── Bag cost per popsicle ──
  const bagCasePriceRec = supplyPrices.find((p) => p.item_key === "bag_case" && p.item_type === "bags");

  // price per case of empty bags ÷ bags_per_bag_case = price per bag; price per bag ÷ pops_per_bag = cost per pop
  const bagCostPerPopCalc = (() => {
    if (!bagCasePriceRec || !popsPerBag) return null;
    const pricePerBag = bagCasePriceRec.price_per_unit / bagsPerBagCase;
    return pricePerBag / popsPerBag;
  })();

  // ── Box stack cost per case ──
  const boxStackPriceRec = supplyPrices.find((p) => p.item_key === "box_stacks" && p.item_type === "material");
  const boxStackCostPerCase = (boxStackPriceRec && casesPerStack) ? boxStackPriceRec.price_per_unit / casesPerStack : null;

  const flavorMap = {};
  flavors.forEach((f) => { flavorMap[f.id] = f; });

  // Container size in oz by container_type (default: 1-gallon jug = 128 oz)
  const containerOzMap = { liquid_1gal: 128, liquid_5gal: 640, powder_5gal: 640 };

  // Helper: get per-oz price for a flavor using SuppliesPricingTab's per-flavor price (price per container)
  function getFlavorPricePerOz(flavorId) {
    const fl = flavorMap[flavorId];
    const containerOz = containerOzMap[fl?.container_type] ?? 128;
    // SuppliesPricingTab stores price-per-container under key `flavor_${flavorId}` type `flavoring`
    const supplyRec = supplyPrices.find((p) => p.item_key === `flavor_${flavorId}` && p.item_type === "flavoring");
    if (supplyRec && supplyRec.price_per_unit > 0) return supplyRec.price_per_unit / containerOz;
    // Legacy FlavorPrice records
    const fp = flavorPrices.find((p) => p.flavor_id === flavorId);
    if (fp) {
      if (fp.price_per_oz && fp.price_per_oz > 0) return fp.price_per_oz;
      if (fp.price_per_container && fp.container_oz && fp.container_oz > 0) return fp.price_per_container / fp.container_oz;
    }
    return null;
  }

  // Global fallback price per oz (for avg display)
  const flavorCasePriceRec = supplyPrices.find((p) => p.item_key === "flavor_case" && p.item_type === "flavoring");

  // Per-flavor cost per popsicle: oz/gal_base × price/oz / ppg
  const flavorBreakdown = jugDefaults.map((jd) => {
    const fl = flavorMap[jd.flavor_id];
    if (!fl || !jd.oz_per_gallon_base) return null;
    const pricePerOz = getFlavorPricePerOz(jd.flavor_id);
    if (!pricePerOz) return null;
    const costPerPop = (jd.oz_per_gallon_base * pricePerOz) / ppg;
    const hasPerFlavorPrice = !!supplyPrices.find((p) => p.item_key === `flavor_${jd.flavor_id}` && p.item_type === "flavoring" && p.price_per_unit > 0)
      || flavorPrices.some((p) => p.flavor_id === jd.flavor_id && (p.price_per_oz > 0 || (p.price_per_container > 0 && p.container_oz > 0)));
    return { flavor: fl, ozPerGallon: jd.oz_per_gallon_base, costPerPop, pricePerOz, hasPerFlavorPrice };
  }).filter(Boolean);

  const avgFlavorCostPerPop = flavorBreakdown.length > 0
    ? flavorBreakdown.reduce((s, f) => s + f.costPerPop, 0) / flavorBreakdown.length
    : null;

  // For display note
  const allFlavorsHaveCustomPrice = flavorBreakdown.length > 0 && flavorBreakdown.every((f) => f.hasPerFlavorPrice);

  // ── Totals ──
  // Flavorset popsicle: base mix + stick + clear wrap + flavoring
  const flavorsetPopCost = [ingCostPerPop, stickCostPerPop, clearWrapCostPerPop, avgFlavorCostPerPop].every(v => v != null)
    ? ingCostPerPop + stickCostPerPop + clearWrapCostPerPop + avgFlavorCostPerPop : null;
  // Individual popsicle: base mix + stick + individual wrap + flavoring
  const individualPopCost = [ingCostPerPop, stickCostPerPop, indivWrapCostPerPop, avgFlavorCostPerPop].every(v => v != null)
    ? ingCostPerPop + stickCostPerPop + indivWrapCostPerPop + avgFlavorCostPerPop : null;

  const flavorsetBagCost = (flavorsetPopCost != null && popsPerBag) ? flavorsetPopCost * popsPerBag + (bagCostPerPopCalc ? bagCostPerPopCalc * popsPerBag : 0) : null;
  const flavorsetCaseCost = (flavorsetBagCost != null && bagsPerCase) ? flavorsetBagCost * bagsPerCase + (boxStackCostPerCase || 0) : null;
  const individualCaseCost = (individualPopCost != null && popsPerCase) ? individualPopCost * popsPerCase + (boxStackCostPerCase || 0) : null;

  return (
    <div className="space-y-10">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Estimates only.</span> Costs are calculated from supply prices and production defaults set in this app. Always verify against actual invoices before making financial decisions.
        </p>
      </div>

      {/* ── Per-Popsicle Cost ── */}
      <div>
        <h3 className="font-heading font-semibold text-lg mb-1">Cost Per Popsicle</h3>
        <p className="text-xs text-muted-foreground mb-4">Based on {ppg} popsicles/gallon (mold size). Flavoring cost is averaged across all configured flavors.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CostCard
            emoji="🍭"
            title="Flavorset Popsicle"
            subtitle="Uses clear wrap"
            total={flavorsetPopCost}
            totalLabel="Est. cost per popsicle"
            lines={[
              { label: "Base mix ingredients", cost: ingCostPerPop ?? undefined, dim: ingCostPerPop == null },
              { label: "Popsicle stick", cost: stickCostPerPop ?? undefined, dim: stickCostPerPop == null },
              { label: "Clear wrap", cost: clearWrapCostPerPop ?? undefined, dim: clearWrapCostPerPop == null },
              { label: "Flavoring (avg)", cost: avgFlavorCostPerPop ?? undefined, dim: avgFlavorCostPerPop == null },
            ]}
          />
          <CostCard
            emoji="🍦"
            title="Individual Popsicle"
            subtitle="Uses individual wrap"
            total={individualPopCost}
            totalLabel="Est. cost per popsicle"
            lines={[
              { label: "Base mix ingredients", cost: ingCostPerPop ?? undefined, dim: ingCostPerPop == null },
              { label: "Popsicle stick", cost: stickCostPerPop ?? undefined, dim: stickCostPerPop == null },
              { label: "Individual wrap", cost: indivWrapCostPerPop ?? undefined, dim: indivWrapCostPerPop == null },
              { label: "Flavoring (avg)", cost: avgFlavorCostPerPop ?? undefined, dim: avgFlavorCostPerPop == null },
            ]}
          />
        </div>
      </div>

      {/* ── Per-Bag & Per-Case Cost ── */}
      <div>
        <h3 className="font-heading font-semibold text-lg mb-1">Cost Per Bag & Case</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {popsPerBag ? `${popsPerBag} popsicles/bag` : "Set popsicles/bag in Breakdown tab"}{bagsPerCase ? ` · ${bagsPerCase} bags/case` : ""}{popsPerCase ? ` · ${popsPerCase} popsicles/case` : ""}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CostCard
            emoji="🛍️"
            title="One Bag"
            subtitle="Flavorset · clear wrap"
            total={flavorsetBagCost}
            totalLabel="Est. cost per bag"
            lines={[
              { label: `${popsPerBag ?? "?"} × popsicle (flavorset)`, cost: (flavorsetPopCost && popsPerBag) ? flavorsetPopCost * popsPerBag : undefined, dim: !flavorsetPopCost || !popsPerBag },
              { label: "1 bag", cost: (bagCostPerPopCalc && popsPerBag) ? bagCostPerPopCalc * popsPerBag : undefined, dim: !bagCostPerPopCalc },
            ]}
          />
          <CostCard
            emoji="📦"
            title="Flavorset Case"
            subtitle="Bags of clear-wrap popsicles"
            total={flavorsetCaseCost}
            totalLabel="Est. cost per case"
            lines={[
              { label: `${bagsPerCase ?? "?"} bags`, cost: (flavorsetBagCost && bagsPerCase) ? flavorsetBagCost * bagsPerCase : undefined, dim: !flavorsetBagCost || !bagsPerCase },
              { label: "Box stack share", cost: boxStackCostPerCase ?? undefined, dim: boxStackCostPerCase == null },
            ]}
          />
          <CostCard
            emoji="📦"
            title="Individual Case"
            subtitle="Individual-wrap popsicles"
            total={individualCaseCost}
            totalLabel="Est. cost per case"
            lines={[
              { label: `${popsPerCase ?? "?"} popsicles (individual)`, cost: (individualPopCost && popsPerCase) ? individualPopCost * popsPerCase : undefined, dim: !individualPopCost || !popsPerCase },
              { label: "Box stack share", cost: boxStackCostPerCase ?? undefined, dim: boxStackCostPerCase == null },
            ]}
          />
        </div>
      </div>

      {/* ── Per-Flavor Breakdown ── */}
      <div>
        <h3 className="font-heading font-semibold text-lg mb-1">Flavoring Cost Per Popsicle</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Each flavor's oz/gallon-of-base × price/oz ÷ popsicles per gallon. Price per oz is derived from the per-container price set in <strong>Financials → Supplies</strong> ÷ container size (1-gal = 128 oz, 5-gal = 640 oz).
        </p>
        {!allFlavorsHaveCustomPrice && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3 inline-block">
            Some flavors are missing a price. Set per-flavor container prices in Financials → Supplies.
          </p>
        )}
        {flavorBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flavor defaults configured yet. Set oz/gal values in the Ingredients → Flavor Jugs section.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {flavorBreakdown.map(({ flavor, ozPerGallon, costPerPop, pricePerOz, hasPerFlavorPrice }) => (
              <div key={flavor.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  {flavor.color && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: flavor.color }} />}
                  <p className="font-medium text-sm truncate flex-1">{flavor.name}</p>
                  {hasPerFlavorPrice && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">custom $</span>
                  )}
                </div>
                <p className="text-xl font-heading font-bold text-primary">{fmt$(costPerPop)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">per popsicle</p>
                <p className="text-xs text-muted-foreground mt-1">{ozPerGallon} oz/gal · {fmt$(pricePerOz)}/oz</p>
              </div>
            ))}
          </div>
        )}
        {flavorBreakdown.length === 0 && (
          <p className="text-xs text-amber-600 mt-3">Set per-flavor container prices in Financials → Supplies, and set oz/gal defaults in Inventory → Flavor Containers.</p>
        )}
      </div>

      {/* ── Base Mix Reference ── */}
      <div>
        <h3 className="font-heading font-semibold text-lg mb-1">Base Mix Ingredients (Global Defaults)</h3>
        <p className="text-xs text-muted-foreground mb-4">Per batch ({GALLONS_PER_BATCH} gal). Edit amounts in the Inventory → Ingredients tab.</p>
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
                {batchCost > 0 && <p className="text-xs text-primary mt-1">${batchCost.toFixed(2)}/batch</p>}
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
              <p className="text-xs text-muted-foreground">Base mix cost per popsicle ({ppg} pops/gal)</p>
              <p className="font-heading font-bold text-primary text-xl">${ingCostPerPop.toFixed(5)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}