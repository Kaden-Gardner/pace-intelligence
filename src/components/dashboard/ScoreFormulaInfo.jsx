import { Sigma } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Small clickable icon that explains how the composite performance score shown
// on Top Employees is calculated.
export default function ScoreFormulaInfo() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How the performance score is calculated"
          className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
        >
          <Sigma className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-2">
        <p className="text-sm font-semibold">Performance score</p>
        <p className="text-xs text-muted-foreground">
          A weighted blend of four components:
        </p>
        <div className="rounded-lg bg-muted p-2 font-mono text-[11px] leading-relaxed">
          score = 0.30·S + 0.25·E + 0.10·T + 0.35·P
        </div>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>
            <span className="font-medium text-foreground">S — Speed: </span>
            100 × (avg cases/hr − minimum required) ÷ 10
          </li>
          <li>
            <span className="font-medium text-foreground">E — Shift rating: </span>
            10 × average shift score (0–10)
          </li>
          <li>
            <span className="font-medium text-foreground">T — Attendance: </span>
            100 × min shifts/week × (shifts in last 30 days ÷ 20)
          </li>
          <li>
            <span className="font-medium text-foreground">P — Production value: </span>
            100 × (PVR − 1) ÷ 99
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}