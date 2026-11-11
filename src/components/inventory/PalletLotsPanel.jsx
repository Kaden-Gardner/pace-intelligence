import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { CASES_PER_PALLET, formatShortDate } from "@/lib/lots";

function blankForm() {
  return {
    lot_number: "",
    finished_date: new Date().toISOString().split("T")[0],
    cases: CASES_PER_PALLET,
  };
}

function LotForm({ form, setForm, onSave, onCancel }) {
  return (
    <div className="bg-muted/60 rounded-lg p-2 space-y-1.5">
      <Input
        className="h-7 text-xs"
        placeholder="Lot #"
        value={form.lot_number}
        onChange={(e) => setForm({ ...form, lot_number: e.target.value })}
      />
      <div className="flex gap-1.5">
        <Input
          type="date"
          className="h-7 text-xs"
          value={form.finished_date}
          onChange={(e) => setForm({ ...form, finished_date: e.target.value })}
        />
        <Input
          type="number"
          min="0"
          className="h-7 text-xs w-20"
          value={form.cases}
          onChange={(e) => setForm({ ...form, cases: e.target.value })}
        />
      </div>
      <div className="flex gap-1">
        <Button size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={onSave}>
          <Check className="w-3 h-3" /> Save
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default function PalletLotsPanel({ target, lots = [], onChanged }) {
  const [form, setForm] = useState(null);

  const productLots = (lots || []).filter((l) =>
    target.flavorsetId
      ? l.flavorset_id === target.flavorsetId
      : l.flavor_id === target.flavorId && !l.flavorset_id
  );

  async function save() {
    if (!form.lot_number.trim() || !form.finished_date) return;
    const payload = {
      item_type: target.flavorsetId ? "flavorset" : "individual",
      flavorset_id: target.flavorsetId || "",
      flavor_id: target.flavorId || "",
      lot_number: form.lot_number.trim(),
      finished_date: form.finished_date,
      cases: Number(form.cases) || 0,
    };
    if (form.id) await base44.entities.PalletLot.update(form.id, payload);
    else await base44.entities.PalletLot.create(payload);
    setForm(null);
    onChanged?.();
  }

  async function remove(id) {
    await base44.entities.PalletLot.delete(id);
    onChanged?.();
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Finished pallets
        </p>
        {!form && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" onClick={() => setForm(blankForm())}>
            <Plus className="w-3 h-3" /> Mark pallet
          </Button>
        )}
      </div>

      {productLots.length === 0 && !form && (
        <p className="text-[11px] text-muted-foreground">No pallets marked finished yet.</p>
      )}

      <div className="space-y-1">
        {productLots.map((lot) =>
          form?.id === lot.id ? (
            <LotForm key={lot.id} form={form} setForm={setForm} onSave={save} onCancel={() => setForm(null)} />
          ) : (
            <div key={lot.id} className="flex items-center gap-2 text-[11px] rounded-lg bg-muted/50 px-2 py-1.5">
              <span className="font-medium truncate">{lot.lot_number}</span>
              <span className="text-muted-foreground flex-1 truncate">
                {formatShortDate(lot.finished_date)} · {lot.cases || 0} cases
              </span>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setForm({ ...lot, cases: lot.cases || 0 })}>
                <Pencil className="w-3 h-3" />
              </button>
              <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => remove(lot.id)}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )
        )}
      </div>

      {form && !form.id && (
        <div className="mt-1">
          <LotForm form={form} setForm={setForm} onSave={save} onCancel={() => setForm(null)} />
        </div>
      )}
    </div>
  );
}