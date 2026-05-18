import { base44 } from "@/api/base44Client";

const CASES_PER_PALLET = 66;

/**
 * Get the default freezer ID from the database.
 * Returns null if none is set.
 */
export async function getDefaultFreezerIdFromDB() {
  const freezers = await base44.entities.Freezer.filter({ is_default: true });
  return freezers.length > 0 ? freezers[0].id : null;
}

/**
 * Set the default freezer in the database.
 * Clears any existing default first.
 */
export async function setDefaultFreezerInDB(newId) {
  // Clear existing defaults
  const existing = await base44.entities.Freezer.filter({ is_default: true });
  await Promise.all(existing.map((f) => base44.entities.Freezer.update(f.id, { is_default: false })));
  // Set new default
  if (newId) {
    await base44.entities.Freezer.update(newId, { is_default: true });
  }
}

/**
 * Add produced cases (delta) to the default freezer.
 * This ADDS to existing quantity, it does NOT overwrite.
 * flavorset_id → tracked as pallets (cases / CASES_PER_PALLET)
 * flavor_id    → tracked as individual cases
 */
export async function addToDefaultFreezer({ flavorset_id, flavor_id, deltaCases, overrideFreezerIdForAdd }) {
  const defaultFreezerId = overrideFreezerIdForAdd || await getDefaultFreezerIdFromDB();
  if (!defaultFreezerId) return;

  const deltaQty = flavorset_id
    ? (deltaCases || 0) / CASES_PER_PALLET
    : (deltaCases || 0);

  if (deltaQty <= 0) return;

  const filterQuery = flavorset_id
    ? { freezer_id: defaultFreezerId, flavorset_id, type: "pallet" }
    : { freezer_id: defaultFreezerId, flavor_id, type: "individual" };

  const existing = await base44.entities.FreezerItem.filter(filterQuery);

  if (existing.length > 0) {
    await base44.entities.FreezerItem.update(existing[0].id, {
      quantity: (existing[0].quantity || 0) + deltaQty,
    });
  } else {
    const payload = { freezer_id: defaultFreezerId, type: flavorset_id ? "pallet" : "individual", quantity: deltaQty };
    if (flavorset_id) payload.flavorset_id = flavorset_id;
    else payload.flavor_id = flavor_id;
    await base44.entities.FreezerItem.create(payload);
  }
}