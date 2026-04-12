import { base44 } from "@/api/base44Client";

const CASES_PER_PALLET = 66;

export function getDefaultFreezerId() {
  return localStorage.getItem("defaultFreezerId") || null;
}

export function setDefaultFreezerId(id) {
  if (id) localStorage.setItem("defaultFreezerId", id);
  else localStorage.removeItem("defaultFreezerId");
}

/**
 * Sync an inventory record to the default freezer.
 * flavorset → tracked as pallets; flavor → tracked as cases.
 */
export async function syncToDefaultFreezer({ flavorset_id, flavor_id, cases }) {
  const defaultFreezerId = getDefaultFreezerId();
  if (!defaultFreezerId) return;

  const type = flavorset_id ? "pallet" : "individual";
  const quantity = flavorset_id ? Math.floor((cases || 0) / CASES_PER_PALLET) : (cases || 0);

  const filterQuery = flavorset_id
    ? { freezer_id: defaultFreezerId, flavorset_id, type: "pallet" }
    : { freezer_id: defaultFreezerId, flavor_id, type: "individual" };

  const existing = await base44.entities.FreezerItem.filter(filterQuery);

  if (existing.length > 0) {
    await base44.entities.FreezerItem.update(existing[0].id, { quantity });
  } else if (quantity > 0) {
    const payload = { freezer_id: defaultFreezerId, type, quantity };
    if (flavorset_id) payload.flavorset_id = flavorset_id;
    else payload.flavor_id = flavor_id;
    await base44.entities.FreezerItem.create(payload);
  }
}