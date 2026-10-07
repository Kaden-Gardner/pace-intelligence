import { useState, useEffect } from "react";
import { Calendar, Gauge, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Two editable cards: minimum shifts per week and minimum speed required.
// These feed the employee performance score (T and S components).
export default function PerformanceSettingsCard({ settings, unlocked, onSave }) {
  const [minShifts, setMinShifts] = useState("");
  const [minSpeed, setMinSpeed] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setMinShifts(settings?.min_shifts_per_week != null ? String(settings.min_shifts_per_week) : "");
    setMinSpeed(settings?.min_speed_required != null ? String(settings.min_speed_required) : "");
  }, [settings]);

  const curShifts = settings?.min_shifts_per_week ?? 0;
  const curSpeed = settings?.min_speed_required ?? 0;

  function handleSave() {
    onSave(parseFloat(minShifts) || 0, parseFloat(minSpeed) || 0);
    setEditing(false);
  }
  function handleCancel() {
    setMinShifts(curShifts ? String(curShifts) : "");
    setMinSpeed(curSpeed ? String(curSpeed) : "");
    setEditing(false);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      {/* Min shifts per week */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-primary" />
          <p className="font-medium text-sm">Min Shifts / Week</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Required shifts per week — drives the T component of the performance score.</p>
        {unlocked && editing ? (
          <div className="flex items-center gap-2">
            <Input type="number" min="0" step="0.5" value={minShifts} onChange={(e) => setMinShifts(e.target.value)} className="w-24" autoFocus />
            <span className="text-xs text-muted-foreground">/wk</span>
            <Button size="sm" onClick={handleSave} className="gap-1"><Check className="w-3 h-3" /></Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}><X className="w-3 h-3" /></Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-primary text-lg">{curShifts}<span className="text-sm font-normal text-muted-foreground"> /wk</span></span>
            {unlocked && <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditing(true)}>Edit</Button>}
          </div>
        )}
      </div>

      {/* Min speed required */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gauge className="w-4 h-4 text-primary" />
          <p className="font-medium text-sm">Min Speed Required</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Minimum cases per hour — drives the S component of the performance score.</p>
        {unlocked && editing ? (
          <div className="flex items-center gap-2">
            <Input type="number" min="0" step="0.1" value={minSpeed} onChange={(e) => setMinSpeed(e.target.value)} className="w-24" />
            <span className="text-xs text-muted-foreground">cph</span>
            <Button size="sm" onClick={handleSave} className="gap-1"><Check className="w-3 h-3" /></Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}><X className="w-3 h-3" /></Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-primary text-lg">{curSpeed}<span className="text-sm font-normal text-muted-foreground"> cph</span></span>
            {unlocked && <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditing(true)}>Edit</Button>}
          </div>
        )}
      </div>
    </div>
  );
}