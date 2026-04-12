import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ShiftProductionSection({ form, updateForm, flavors, flavorSets, caseSizes }) {
  const selectedSet = flavorSets.find((fs) => fs.id === form.flavorset_id);
  const flavorMap = {};
  flavors.forEach((f) => { flavorMap[f.id] = f; });

  const setFlavorIds = selectedSet
    ? [selectedSet.flavor_1, selectedSet.flavor_2, selectedSet.flavor_3, selectedSet.flavor_4].filter(Boolean)
    : [];

  return (
    <section className="bg-card rounded-2xl border border-border p-6 space-y-6">
      <h2 className="font-heading font-semibold text-lg">Production</h2>

      {/* Mold size */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Mold Size (popsicles per gallon)</label>
        <Select
          value={String(form.popsicles_per_gallon || 24)}
          onValueChange={(v) => updateForm("popsicles_per_gallon", Number(v))}
        >
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24">24 popsicles = 1 gallon</SelectItem>
            <SelectItem value="48">48 popsicles = 1 gallon</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Case size */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Case Size (popsicles per case)</label>
        {caseSizes && caseSizes.length > 0 ? (
          <Select
            value={String(form.popsicles_per_case || 144)}
            onValueChange={(v) => updateForm("popsicles_per_case", Number(v))}
          >
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {caseSizes.map((cs) => (
                <SelectItem key={cs.id} value={String(cs.popsicles_per_case)}>
                  {cs.name} — {cs.popsicles_per_case} pops/case
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 max-w-xs">
            <input
              type="number" min="1" step="1"
              value={form.popsicles_per_case || 144}
              onChange={(e) => updateForm("popsicles_per_case", parseFloat(e.target.value) || 144)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">pops / case</span>
          </div>
        )}
      </div>

      {/* Flavorset + cases */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <Input type="number" min="0" step="0.25" value={form.flavorset_cases} onChange={(e) => updateForm("flavorset_cases", parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      {/* Starting gallons per flavor in the set */}
      {selectedSet && setFlavorIds.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Starting Gallons per Flavor (in flavorset)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setFlavorIds.map((flavorId, i) => {
              const flavor = flavorMap[flavorId];
              const fieldKey = `starting_gallons_flavor_${i + 1}`;
              return (
                <div key={flavorId}>
                  <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    {flavor && (
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: flavor.color || "hsl(192 75% 42%)" }} />
                    )}
                    {flavor?.name || `Flavor ${i + 1}`} — Starting Gallons
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={form[fieldKey] || 0}
                    onChange={(e) => updateForm(fieldKey, parseFloat(e.target.value) || 0)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual Flavors */}
      <div>
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
                step="0.25"
                placeholder="Cases"
                value={form[`individual_flavor_${n}_cases`]}
                onChange={(e) => updateForm(`individual_flavor_${n}_cases`, parseFloat(e.target.value) || 0)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Waste */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Waste (gallons)</label>
        <Input type="number" min="0" step="0.25" value={form.waste} onChange={(e) => updateForm("waste", parseFloat(e.target.value) || 0)} className="max-w-xs" />
      </div>
    </section>
  );
}