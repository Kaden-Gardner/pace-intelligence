import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CONSUMABLE_MATERIALS } from "@/components/inventory/consumableMaterials";

export default function ShiftMaterialsUsageSection({ materialsUsed, setMaterialsUsed }) {
  function isChecked(key) {
    return materialsUsed[key] != null && materialsUsed[key] > 0;
  }

  function toggle(key, checked) {
    setMaterialsUsed((prev) => {
      const next = { ...prev };
      if (checked) {
        next[key] = next[key] && next[key] > 0 ? next[key] : 1;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function setQty(key, val) {
    setMaterialsUsed((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <section className="bg-card rounded-2xl border border-border p-6">
      <h2 className="font-heading font-semibold text-lg mb-1">Materials Used</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Check off any item you finished a unit of, then enter how many were used during the shift.
      </p>
      <div className="divide-y divide-border">
        {CONSUMABLE_MATERIALS.map((item) => {
          const checked = isChecked(item.key);
          return (
            <div key={item.key} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Checkbox checked={checked} onCheckedChange={(c) => toggle(item.key, c === true)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">Did you finish a {item.singular}?</p>
              </div>
              {checked && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    className="w-20"
                    value={materialsUsed[item.key] || 1}
                    onChange={(e) => setQty(item.key, parseInt(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.unit} used</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}