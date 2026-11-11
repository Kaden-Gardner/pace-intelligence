import { useState } from "react";
import { ChevronDown, ChevronRight, Box } from "lucide-react";
import { buildProductCases, groupLots, formatShortDate, lotFinishDate, lotShiftIds, CASES_PER_PALLET } from "@/lib/lots";
import LotTraceability from "./LotTraceability";

function LotRow({ title, subtitle, open, onToggle, children }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="text-xs font-medium flex-1 min-w-0 truncate">{title}</span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">{subtitle}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export default function ProductLotsPanel({ target, shifts, batches, casesOnHand }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const allCases = buildProductCases(shifts, target);
  const { held, pallets, loose } = groupLots(allCases, casesOnHand);

  if (held.length === 0) {
    return <p className="text-xs text-muted-foreground mt-3">No finished lots on hand.</p>;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Box className="w-3.5 h-3.5" />
        {pallets.length} pallet{pallets.length === 1 ? "" : "s"} · {loose.length} loose case{loose.length === 1 ? "" : "s"}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {pallets.map((palletCases, index) => {
            const key = `pallet-${index}`;
            return (
              <LotRow
                key={key}
                title={`Pallet ${index + 1} · ${palletCases.length} cases`}
                subtitle={`finished ${formatShortDate(lotFinishDate(palletCases))}`}
                open={expanded === key}
                onToggle={() => setExpanded(expanded === key ? null : key)}
              >
                <LotTraceability shiftIds={lotShiftIds(palletCases)} shifts={shifts} batches={batches} />
              </LotRow>
            );
          })}

          {loose.length > 0 && (
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {loose.map((oneCase, index) => {
                const key = `case-${index}`;
                return (
                  <LotRow
                    key={key}
                    title={`Case ${index + 1} of ${CASES_PER_PALLET}`}
                    subtitle={formatShortDate(oneCase.date)}
                    open={expanded === key}
                    onToggle={() => setExpanded(expanded === key ? null : key)}
                  >
                    <LotTraceability shiftIds={[oneCase.shiftId]} shifts={shifts} batches={batches} />
                  </LotRow>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}