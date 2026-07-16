export const POSITIONS = [
  { key: "filling", label: "Filling", color: "bg-blue-100 text-blue-800" },
  { key: "pulling", label: "Pulling", color: "bg-orange-100 text-orange-800" },
  { key: "sorting", label: "Sorting", color: "bg-purple-100 text-purple-800" },
  { key: "bagging", label: "Bagging", color: "bg-pink-100 text-pink-800" },
  { key: "boxing", label: "Boxing", color: "bg-yellow-100 text-yellow-800" },
];

export const POSITION_KEYS = POSITIONS.map((p) => p.key);

export function positionLabel(key) {
  return POSITIONS.find((p) => p.key === key)?.label || key;
}

export function positionColor(key) {
  return POSITIONS.find((p) => p.key === key)?.color || "bg-muted text-muted-foreground";
}

export function getAvailablePositions(emp) {
  return [...new Set([emp.hired_for, ...(emp.cross_trained_positions || [])].filter(Boolean))];
}