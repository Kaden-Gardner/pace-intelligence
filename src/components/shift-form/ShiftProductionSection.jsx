import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ShiftProductionSection({ form, updateForm, flavors, flavorSets }) {
  return (
    <section className="bg-card rounded-2xl border border-border p-6">
      <h2 className="font-heading font-semibold text-lg mb-4">Production</h2>

      {/* Flavorset */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset</label>
          <Select value={form.flavorset_id} onValueChange={(v) => updateForm("flavorset_id", v)}>
            <SelectTrigger><SelectValue placeholder="Select flavorset" /></SelectTrigger>
            <SelectContent>
              {flavorSets.map((fs) => (
                <SelectItem key={fs.id} value={fs.id}>{fs.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Flavorset Cases</label>
          <Input type="number" min="0" value={form.flavorset_cases} onChange={(e) => updateForm("flavorset_cases", parseInt(e.target.value) || 0)} />
        </div>
      </div>

      {/* Individual Flavors */}
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Individual Flavors (up to 4)</h3>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={form[`individual_flavor_${n}`]} onValueChange={(v) => updateForm(`individual_flavor_${n}`, v)}>
              <SelectTrigger><SelectValue placeholder={`Flavor ${n}`} /></SelectTrigger>
              <SelectContent>
                {flavors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              placeholder="Cases"
              value={form[`individual_flavor_${n}_cases`]}
              onChange={(e) => updateForm(`individual_flavor_${n}_cases`, parseInt(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>

      {/* Waste */}
      <div className="mt-6">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Waste (gallons)</label>
        <Input type="number" min="0" value={form.waste} onChange={(e) => updateForm("waste", parseInt(e.target.value) || 0)} className="max-w-xs" />
      </div>
    </section>
  );
}