import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { INGREDIENTS } from "@/components/inventory/IngredientsTab";
import { Warehouse, Package, FlaskConical, Snowflake } from "lucide-react";
import InfoButton from "@/components/bigboy/InfoButton";

const GALLONS_PER_BATCH = 240;
const CASES_PER_PALLET = 66;
const CONTAINER_GALLONS = { liquid_1gal: 1, liquid_5gal: 5, powder_5gal: 5 };

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }
function trimNum(n) { return Math.round((n || 0) * 10) / 10; }

function ValueTile({ icon: Icon, label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? "bg-primary/10 border border-primary/30" : "bg-muted/40"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className={`font-heading font-bold text-xl ${highlight ? "text-primary" : ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function InventoryValueCard({ info }) {
  const [state, setState] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [matInv, bagInv, ingInv, baseInv, jugInv, freezerItems, prices, bmd, flavors, orderItems] = await Promise.all([
      base44.entities.MaterialInventory.list().catch(() => []),
      base44.entities.BagInventory.list().catch(() => []),
      base44.entities.IngredientInventory.list().catch(() => []),
      base44.entities.BaseInventory.list().catch(() => []),
      base44.entities.FlavorJugInventory.list().catch(() => []),
      base44.entities.FreezerItem.list().catch(() => []),
      base44.entities.SupplyPrice.list().catch(() => []),
      base44.entities.BaseMixDefaults.list().catch(() => []),
      base44.entities.Flavor.list("name").catch(() => []),
      base44.entities.OrderPickupItem.list().catch(() => []),
    ]);

    const price = (key, type) => prices.find((p) => p.item_key === key && p.item_type === type)?.price_per_unit;
    let missingPrices = 0;

    // ── Materials: supplies + bag cases, at cost ──
    let materialsValue = 0;
    matInv.forEach((m) => {
      const p = price(m.material, "material");
      if (p != null) materialsValue += (m.quantity || 0) * p;
      else if ((m.quantity || 0) > 0) missingPrices++;
    });
    const bagCasePrice = price("bag_case", "bags");
    bagInv.forEach((b) => {
      const loose = b.bags_per_case ? (b.loose_bags || 0) / b.bags_per_case : 0;
      const totalCases = (b.cases || 0) + loose;
      if (bagCasePrice != null) materialsValue += totalCases * bagCasePrice;
      else if (totalCases > 0) missingPrices++;
    });

    // ── Ingredients: dry goods + flavor jugs + base on hand, at cost ──
    let ingredientsValue = 0;
    ingInv.forEach((i) => {
      const p = price(i.ingredient, "ingredient");
      if (p != null) ingredientsValue += (i.quantity || 0) * p;
      else if ((i.quantity || 0) > 0) missingPrices++;
    });
    const flavorMap = {};
    flavors.forEach((f) => { flavorMap[f.id] = f; });
    jugInv.forEach((j) => {
      const p = price(`flavor_${j.flavor_id}`, "flavoring");
      const gal = CONTAINER_GALLONS[flavorMap[j.flavor_id]?.container_type] ?? 1;
      if (p != null) ingredientsValue += ((j.gallons || 0) / gal) * p;
      else if ((j.gallons || 0) > 0) missingPrices++;
    });
    // Base on hand: gallons × base cost per gallon (from global batch defaults)
    let ingBatchCost = 0;
    let hasIngPrices = false;
    INGREDIENTS.forEach((ing) => {
      const p = price(ing.key, "ingredient");
      const def = bmd.find((d) => d.ingredient === ing.key && !d.flavorset_id);
      if (p && def && def.amount_per_batch > 0) { ingBatchCost += def.amount_per_batch * p; hasIngPrices = true; }
    });
    const baseGallons = baseInv.reduce((s, b) => s + (b.gallons || 0), 0);
    if (hasIngPrices && baseGallons > 0) {
      ingredientsValue += baseGallons * (ingBatchCost / GALLONS_PER_BATCH);
    } else if (baseGallons > 0) {
      missingPrices++;
    }

    // ── Freezer: pallets + singles, valued at avg case sale price ──
    let pallets = 0;
    let singles = 0;
    freezerItems.forEach((f) => {
      if (f.type === "pallet") pallets += (f.quantity || 0);
      else singles += (f.quantity || 0);
    });
    const freezerCases = pallets * CASES_PER_PALLET + singles;
    const pricedItems = orderItems.filter((i) => i.case_sell_price > 0);
    const avgCasePrice = pricedItems.length > 0
      ? pricedItems.reduce((s, i) => s + i.case_sell_price, 0) / pricedItems.length
      : null;
    const freezerValue = avgCasePrice != null ? freezerCases * avgCasePrice : 0;
    if (avgCasePrice == null && freezerCases > 0) missingPrices++;

    setState({
      materialsValue,
      ingredientsValue,
      baseGallons,
      freezerValue,
      pallets,
      singles,
      total: materialsValue + ingredientsValue + freezerValue,
      missingPrices,
    });
  }

  if (!state) return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-8 flex justify-center py-10">
      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-8">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Warehouse className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Inventory Value In Stock</p>
          {info && <InfoButton {...info} />}
        </div>
        <p className="text-xs text-muted-foreground">Materials & ingredients at cost · freezer product at avg sale price</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ValueTile icon={Package} label="Materials" value={fmt$(state.materialsValue)} sub="supplies + bag cases" />
        <ValueTile icon={FlaskConical} label="Ingredients" value={fmt$(state.ingredientsValue)} sub={`incl. ${trimNum(state.baseGallons)} gal base on hand`} />
        <ValueTile icon={Snowflake} label="Freezer Stock" value={fmt$(state.freezerValue)} sub={`${trimNum(state.pallets)} pallets · ${trimNum(state.singles)} singles`} />
        <ValueTile icon={Warehouse} label="Total" value={fmt$(state.total)} sub="all inventory combined" highlight />
      </div>
      {state.missingPrices > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-3">
          {state.missingPrices} stock item(s) have no price set and aren't included. Set prices in Financials → Supplies.
        </p>
      )}
    </div>
  );
}