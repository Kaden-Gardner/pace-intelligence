import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Flag, Timer } from "lucide-react";

function formatTimeOfDay(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function BatchPredictor({ shiftElapsedMs, cases, shiftStartMs }) {
  const [batchSize, setBatchSize] = useState("");

  const shiftHours = shiftElapsedMs / 3600000;
  const casesPerHour = shiftHours > 0 ? cases / shiftHours : 0;
  const gallons = parseFloat(batchSize) || 0;
  const casesForBatch = gallons / 3; // 3 gallons of punch per case

  let predictedEnd = null;
  if (gallons > 0 && casesPerHour > 0 && shiftStartMs) {
    const hoursNeeded = casesForBatch / casesPerHour;
    predictedEnd = new Date(shiftStartMs + hoursNeeded * 3600000);
  }

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div className="bg-card rounded-xl border border-border p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Flag className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Shift Batch Size</p>
        </div>
        <Input
          type="number"
          min="0"
          value={batchSize}
          onChange={(e) => setBatchSize(e.target.value)}
          placeholder="Enter gallons"
          className="h-8 text-sm font-semibold"
        />
        {gallons > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">≈ {casesForBatch.toFixed(0)} cases</p>
        )}
      </div>
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Predicted Shift End</p>
        </div>
        <p className="text-xl font-heading font-bold tabular-nums">
          {predictedEnd ? formatTimeOfDay(predictedEnd) : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {casesPerHour > 0 ? `at ${casesPerHour.toFixed(0)} cases/hr` : "awaiting speed"}
        </p>
      </div>
    </div>
  );
}