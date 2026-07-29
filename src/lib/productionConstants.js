// Shared production conversion constants for the Work Aid speed metrics.

// Gallons of punch per finished case (used for gallons/hour + batch end prediction).
export const GALLONS_PER_CASE = 3;

// MaterialDefaults keys (material_key) that hold the editable pack-conversion values
// configured on the Inventory → Product Breakdown tab.
export const MD_BAGS_PER_CASE = "bags_per_case";
export const MD_POPS_PER_CASE = "popsicles_per_case";
export const MD_POPS_PER_MOLD = "popsicles_per_mold"; // "Popsicles per Mold" (each mold ≈ ½ gallon)

// Fallbacks used when a MaterialDefaults value has not been configured yet.
export const DEFAULT_BAGS_PER_CASE = 12;
export const DEFAULT_POPS_PER_CASE = 144;
export const DEFAULT_POPS_PER_MOLD = 24;