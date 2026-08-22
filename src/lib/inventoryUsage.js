// Reorder logic for the inventory "Order Check" popups.
// An item is flagged for reorder when its on-hand supply sits in the
// "barely more than 2 weeks" band — strictly between 2 and 3 weeks of
// average weekly usage (computed over the last 6 months / 26 weeks).

export const ORDER_WINDOW_WEEKS = 26;
export const ORDER_LOWER_WEEKS = 2;
export const ORDER_UPPER_WEEKS = 3;

export const INGREDIENT_GLOBAL_DEFAULTS = {
  xanthan_gum: 2,
  sugar: 3,
  dextrose: 2,
  citric_acid: 0.01,
  pear_juice: 0,
};

// Amount of an ingredient used per base-mix batch, honoring flavorset overrides
// then falling back to the global default.
export function getIngredientAmountPerBatch(ingredient, flavorsetId, baseMixDefaults) {
  if (flavorsetId) {
    const fsRec = baseMixDefaults.find((d) => d.ingredient === ingredient && d.flavorset_id === flavorsetId);
    if (fsRec) return fsRec.amount_per_batch || 0;
  }
  const globalRec = baseMixDefaults.find((d) => d.ingredient === ingredient && !d.flavorset_id);
  return globalRec ? globalRec.amount_per_batch || 0 : INGREDIENT_GLOBAL_DEFAULTS[ingredient] ?? 0;
}

// Total ingredient consumption across the given base-mix shifts.
export function computeIngredientUsage(baseMixShifts, baseMixDefaults) {
  const totals = {};
  const keys = Object.keys(INGREDIENT_GLOBAL_DEFAULTS);
  baseMixShifts.forEach((shift) => {
    const batches = Number(shift.batch_size) || 0;
    if (batches <= 0) return;
    const fsId = shift.flavorset_id || null;
    keys.forEach((key) => {
      const perBatch = getIngredientAmountPerBatch(key, fsId, baseMixDefaults);
      if (perBatch > 0) totals[key] = (totals[key] || 0) + perBatch * batches;
    });
  });
  return totals;
}

// Material consumption for a single production shift (mirrors ShiftForm deduction).
// `matDefaultsMap` is keyed by material_key.
export function computeMaterialUsageForShift(shift, matDefaultsMap) {
  const popsPerCase = shift.popsicles_per_case || 144;
  const flavorsetCases = Number(shift.flavorset_cases) || 0;
  const indCasesTotal = [
    shift.individual_flavor_1_cases,
    shift.individual_flavor_2_cases,
    shift.individual_flavor_3_cases,
    shift.individual_flavor_4_cases,
  ].reduce((sum, c) => sum + (Number(c) || 0), 0);
  const totalPopsFlavorset = flavorsetCases * popsPerCase;
  const totalPopsIndividual = indCasesTotal * popsPerCase;
  const totalPops = totalPopsFlavorset + totalPopsIndividual;
  const totalCases = flavorsetCases + indCasesTotal;
  const usage = {};

  const sticksPerBox = matDefaultsMap["popsicle_sticks"]?.qty_per_shift;
  if (sticksPerBox > 0 && totalPops > 0) usage["popsicle_sticks"] = totalPops / sticksPerBox;

  const clearFpr = matDefaultsMap["clear_wrap"]?.feet_per_roll;
  const clearFpp = matDefaultsMap["clear_wrap"]?.feet_per_popsicle;
  if (clearFpr > 0 && clearFpp > 0 && totalPopsFlavorset > 0) {
    usage["clear_wrap"] = (totalPopsFlavorset * clearFpp) / clearFpr;
  }

  const indivFpr = matDefaultsMap["individual_wrap"]?.feet_per_roll;
  const indivFpp = matDefaultsMap["individual_wrap"]?.feet_per_popsicle;
  if (indivFpr > 0 && indivFpp > 0 && totalPopsIndividual > 0) {
    usage["individual_wrap"] = (totalPopsIndividual * indivFpp) / indivFpr;
  }

  const casesPerStack = matDefaultsMap["box_stacks"]?.qty_per_shift;
  if (casesPerStack > 0 && totalCases > 0) usage["box_stacks"] = totalCases / casesPerStack;

  (shift.materials_used || []).forEach((m) => {
    if (!m.material_key || !m.quantity) return;
    usage[m.material_key] = (usage[m.material_key] || 0) + Number(m.quantity);
  });

  return usage;
}

// Total material consumption across the given production shifts.
export function computeMaterialUsage(productionShifts, matDefaultsMap) {
  const totals = {};
  productionShifts.forEach((shift) => {
    const usage = computeMaterialUsageForShift(shift, matDefaultsMap);
    Object.entries(usage).forEach(([k, v]) => {
      totals[k] = (totals[k] || 0) + v;
    });
  });
  return totals;
}

// Build the order-check list. `items`: [{ key, label, unit, onHand }].
// `totalsConsumed`: { key: totalConsumedOverWindow }.
export function buildOrderList(items, totalsConsumed, weeks = ORDER_WINDOW_WEEKS) {
  return items.map((it) => {
    const onHand = Number(it.onHand) || 0;
    const consumed = totalsConsumed[it.key] || 0;
    const avgWeekly = weeks > 0 ? consumed / weeks : 0;
    const weeksOnHand = avgWeekly > 0 ? onHand / avgWeekly : null;
    const needsOrder =
      weeksOnHand !== null && weeksOnHand > ORDER_LOWER_WEEKS && weeksOnHand < ORDER_UPPER_WEEKS;
    return { ...it, consumed, avgWeekly, weeksOnHand, needsOrder };
  });
}

// ISO date string for 6 months ago (inclusive lower bound for shift_date filtering).
export function getOrderCutoffDateStr() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  return cutoff.toISOString().split("T")[0];
}