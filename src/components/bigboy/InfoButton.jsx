import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Info button used across the Big Boy Page: click it to see how a number is
// calculated, how to use it, and how it's displayed.
export default function InfoButton({ title = "Metric", calc, usage, display }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
        >
          <Info className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-1.5">
        <p className="text-sm font-semibold">{title}</p>
        {calc && (
          <p className="text-xs">
            <span className="font-medium">How it's calculated: </span>
            <span className="text-muted-foreground">{calc}</span>
          </p>
        )}
        {usage && (
          <p className="text-xs">
            <span className="font-medium">How to use it: </span>
            <span className="text-muted-foreground">{usage}</span>
          </p>
        )}
        {display && (
          <p className="text-xs">
            <span className="font-medium">How it's displayed: </span>
            <span className="text-muted-foreground">{display}</span>
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}