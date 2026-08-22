import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClipboardCheck, PackageCheck } from "lucide-react";

export default function InventoryCheckDialog({ open, onOpenChange, title, entries, loading }) {
  const orderItems = (entries || [])
    .filter((e) => e.needsOrder)
    .sort((a, b) => (a.weeksOnHand ?? Infinity) - (b.weeksOnHand ?? Infinity));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" /> {title || "Inventory Check"}
          </DialogTitle>
          <DialogDescription>
            Items flagged when on-hand is between 2 and 3 weeks of average weekly usage (over the last 6 months).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : orderItems.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10 text-muted-foreground">
            <PackageCheck className="w-10 h-10 mb-3 text-green-500 opacity-70" />
            <p className="font-medium text-foreground">Everything's stocked</p>
            <p className="text-sm">No items are in the 2–3 week reorder window right now.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {orderItems.length} item{orderItems.length !== 1 ? "s" : ""} to order · sorted by supply remaining
            </p>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {orderItems.map((e) => (
                <div key={e.key} className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(e.onHand)} {e.unit} on hand · ~{e.avgWeekly.toFixed(1)} {e.unit}/wk avg
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-heading font-bold text-primary">{e.weeksOnHand.toFixed(1)} wk</p>
                    <p className="text-[11px] text-muted-foreground">of supply left</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}