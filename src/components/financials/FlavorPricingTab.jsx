import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }
function fmtSmall$(n) { return n == null ? "—" : `$${Number(n).toFixed(4)}`; }

export default function FlavorPricingTab() {
  const [flavors, setFlavors] = useState([]);
  const [flavorPrices, setFlavorPrices] = useState([]);
  const [jugDefaults, setJugDefaults] = useState([]);
  const [loading, setLoading] = useState(true);

  // editing state: { flavorId, field: "container_oz"|"price_per_container", value }
  const [editing, setEditing] = useState(null);
  const [editVal, setEditVal] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const [fl, fp, jd] = await Promise.all([
      base44.entities.Flavor.list("name"),
      base44.entities.FlavorPrice.list(),
      base44.entities.FlavorJugDefaults.list(),
    ]);
    setFlavors(fl);
    setFlavorPrices(fp);
    setJugDefaults(jd);
    setLoading(false);
  }

  function getPriceRec(flavorId) {
    return flavorPrices.find((p) => p.flavor_id === flavorId);
  }

  function getJugDefault(flavorId) {
    return jugDefaults.find((d) => d.flavor_id === flavorId);
  }

  async function saveField(flavorId, field, rawVal) {
    const val = parseFloat(rawVal);
    if (isNaN(val) || val < 0) { setEditing(null); return; }

    const existing = getPriceRec(flavorId);
    let updated;
    if (existing) {
      await base44.entities.FlavorPrice.update(existing.id, { [field]: val });
      updated = { ...existing, [field]: val };
      setFlavorPrices((prev) => prev.map((p) => p.id === existing.id ? updated : p));
    } else {
      const created = await base44.entities.FlavorPrice.create({ flavor_id: flavorId, [field]: val });
      setFlavorPrices((prev) => [...prev, created]);
      updated = created;
    }
    setEditing(null);
    setEditVal("");
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          Set a price and container size for each flavor. The app will calculate cost per oz and cost per popsicle automatically.
        </p>
        <p className="text-xs text-muted-foreground">
          "Container size" = how many oz in one jug/container you purchase (e.g. 128 oz = 1 gallon). "Price per container" = what you pay for that container.
        </p>
      </div>

      <div className="space-y-3">
        {flavors.length === 0 && (
          <p className="text-sm text-muted-foreground">No flavors configured yet. Add flavors in the Flavors page first.</p>
        )}
        {flavors.map((flavor) => {
          const rec = getPriceRec(flavor.id);
          const jugDef = getJugDefault(flavor.id);
          const ozPerGalBase = jugDef?.oz_per_gallon_base || null;

          const containerOz = rec?.container_oz || null;
          const pricePerContainer = rec?.price_per_container || null;
          const pricePerOz = (containerOz && pricePerContainer && containerOz > 0)
            ? pricePerContainer / containerOz
            : (rec?.price_per_oz || null);

          // Cost per popsicle: oz_per_gallon_base × price_per_oz / ppg (default 24)
          // We'll display this here as a reference
          const ppg = 24;
          const costPerPop = (ozPerGalBase && pricePerOz) ? (ozPerGalBase * pricePerOz) / ppg : null;

          const isEditingContainer = editing?.flavorId === flavor.id && editing?.field === "container_oz";
          const isEditingPrice = editing?.flavorId === flavor.id && editing?.field === "price_per_container";

          return (
            <div key={flavor.id} className="rounded-2xl border-2 p-5" style={{ backgroundColor: `color-mix(in srgb, ${flavor.color || "hsl(192 75% 42%)"} 12%, transparent)`, borderColor: flavor.color || "hsl(192 75% 42%)" }}>
              <div className="flex items-center gap-2 mb-4">
                {flavor.color && <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: flavor.color }} />}
                <p className="font-heading font-semibold">{flavor.name}</p>
                {ozPerGalBase && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                    {ozPerGalBase} oz/gal base
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Container size */}
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Container Size (oz)</p>
                  {isEditingContainer ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number" min="0" step="1" autoFocus
                        className="h-8 text-sm w-24"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveField(flavor.id, "container_oz", editVal)}
                      />
                      <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveField(flavor.id, "container_oz", editVal)}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-lg">{containerOz != null ? `${containerOz} oz` : "—"}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { setEditing({ flavorId: flavor.id, field: "container_oz" }); setEditVal(containerOz != null ? containerOz.toString() : ""); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {containerOz === 128 && <p className="text-[10px] text-muted-foreground mt-0.5">= 1 gallon jug</p>}
                  {containerOz === 256 && <p className="text-[10px] text-muted-foreground mt-0.5">= 2 gallon jug</p>}
                </div>

                {/* Price per container */}
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Price Per Container</p>
                  {isEditingPrice ? (
                    <div className="flex items-center gap-1">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number" min="0" step="0.01" autoFocus
                          className="h-8 text-sm w-28 pl-6"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveField(flavor.id, "price_per_container", editVal)}
                        />
                      </div>
                      <Button size="sm" className="h-7 w-7 p-0" onClick={() => saveField(flavor.id, "price_per_container", editVal)}><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-lg text-primary">{pricePerContainer != null ? fmt$(pricePerContainer) : "—"}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { setEditing({ flavorId: flavor.id, field: "price_per_container" }); setEditVal(pricePerContainer != null ? pricePerContainer.toString() : ""); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Derived: price per oz + cost per pop */}
                <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Price Per Oz</p>
                    <p className="font-heading font-bold text-primary">{pricePerOz != null ? fmtSmall$(pricePerOz) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Cost Per Popsicle</p>
                    <p className="font-heading font-bold text-primary">{costPerPop != null ? fmtSmall$(costPerPop) : "—"}</p>
                    {!ozPerGalBase && <p className="text-[10px] text-muted-foreground">Set oz/gal in Ingredients tab</p>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}