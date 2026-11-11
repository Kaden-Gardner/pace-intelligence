// Lot traceability helpers: base-batch ingredients/materials and finished pallet/case lots.
import { getIngredientAmountPerBatch } from "@/lib/inventoryUsage";
import { CONSUMABLE_MATERIALS } from "@/components/inventory/consumableMaterials";

export const CASES_PER_PALLET = 66;

export const BASE_INGREDIENTS = [
  { key: "xanthan_gum", label: "Xanthan Gum", unit: "lbs" },
  { key: "sugar", label: "Sugar", unit: "50 lb bags" },
  { key: "dextrose", label: "Dextrose", unit: "50 lb bags" },
  { key: "citric_acid", label: "Citric Acid", unit: "50 lb bags" },
  { key: "pear_juice", label: "Pear Juice", unit: "5-gal buckets" },
];

// Only the ingredients a flavorset actually uses (amount per batch > 0).
export function ingredientsUsedInFlavorset(flavorsetId, baseMixDefaults) {
  return BASE_INGREDIENTS.filter(
    (ing) => getIngredientAmountPerBatch(ing.key, flavorsetId || null, baseMixDefaults || []) > 0
  );
}

export function ingredientLabel(key) {
  return BASE_INGREDIENTS.find((i) => i.key === key)?.label || key;
}

export function materialLabel(key) {
  return CONSUMABLE_MATERIALS.find((m) => m.key === key)?.label || key;
}

export function formatShortDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function batchLabel(batch) {
  const batches = Number(batch?.batch_size) || 0;
  const gallons = Math.round(batches * 240);
  return `${formatShortDate(batch?.shift_date)} · ${batches} batch${batches === 1 ? "" : "es"} · ${gallons} gal`;
}

function casesOf(shift, target) {
  if (target.flavorsetId) {
    return shift.flavorset_id === target.flavorsetId ? Number(shift.flavorset_cases) || 0 : 0;
  }
  if (target.flavorId) {
    let total = 0;
    for (let n = 1; n <= 4; n++) {
      if (shift[`individual_flavor_${n}`] === target.flavorId) {
        total += Number(shift[`individual_flavor_${n}_cases`]) || 0;
      }
    }
    return total;
  }
  return 0;
}

// Every finished case of a product, oldest first, tagged with its shift.
export function buildProductCases(shifts, target) {
  const entries = (shifts || [])
    .map((shift) => ({ shift, cases: casesOf(shift, target) }))
    .filter((e) => e.cases > 0)
    .sort((a, b) => String(a.shift.shift_date).localeCompare(String(b.shift.shift_date)));

  const cases = [];
  entries.forEach(({ shift, cases: count }) => {
    for (let i = 0; i < Math.floor(count); i++) {
      cases.push({ date: shift.shift_date, shiftId: shift.id });
    }
  });
  return cases;
}

// Keep only what is still on hand (newest production) and split into pallets + loose cases.
export function groupLots(allCases, casesOnHand) {
  const held = casesOnHand == null || casesOnHand >= allCases.length
    ? allCases
    : allCases.slice(Math.max(0, allCases.length - Math.round(casesOnHand)));

  const pallets = [];
  for (let i = 0; i + CASES_PER_PALLET <= held.length; i += CASES_PER_PALLET) {
    pallets.push(held.slice(i, i + CASES_PER_PALLET));
  }
  return { held, pallets, loose: held.slice(pallets.length * CASES_PER_PALLET) };
}

export function lotFinishDate(lotCases) {
  if (!lotCases || lotCases.length === 0) return null;
  return lotCases[lotCases.length - 1].date;
}

export function lotShiftIds(lotCases) {
  return [...new Set((lotCases || []).map((c) => c.shiftId))];
}