import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Trash2, Play, Square } from "lucide-react";

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(val) {
  return new Date(val).toISOString();
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function GeneralPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shiftStartInput, setShiftStartInput] = useState("");
  const [shiftEndInput, setShiftEndInput] = useState("");
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const list = await base44.entities.MachineLog.list();
        setLogs(list);
        const start = list.find((l) => l.entry_type === "shift_start");
        const end = list.find((l) => l.entry_type === "shift_end");
        if (start) setShiftStartInput(toLocalInput(start.timestamp));
        if (end) setShiftEndInput(toLocalInput(end.timestamp));
      } catch (err) {
        console.error("Failed to load machine logs:", err);
      } finally {
        setLoading(false);
      }
      unsub = base44.entities.MachineLog.subscribe((event) => {
        setLogs((prev) => {
          if (event.type === "delete") {
            return prev.filter((l) => l.id !== event.id);
          } else if (event.type === "create") {
            return [...prev, event.data];
          } else if (event.type === "update") {
            return prev.map((l) => (l.id === event.data.id ? event.data : l));
          }
          return prev;
        });
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const shiftStart = logs.find((l) => l.entry_type === "shift_start");
  const shiftEnd = logs.find((l) => l.entry_type === "shift_end");
  const machineEvents = logs
    .filter((l) => l.entry_type === "machine_down" || l.entry_type === "machine_up")
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  async function saveShiftStart() {
    if (!shiftStartInput || saving) return;
    setSaving("shift_start");
    const iso = fromLocalInput(shiftStartInput);
    try {
      if (shiftStart) {
        await base44.entities.MachineLog.update(shiftStart.id, { timestamp: iso });
      } else {
        await base44.entities.MachineLog.create({ entry_type: "shift_start", timestamp: iso });
      }
    } catch (err) {
      console.error("Failed to save shift start:", err);
    } finally {
      setSaving(null);
    }
  }

  async function saveShiftEnd() {
    if (!shiftEndInput || saving) return;
    setSaving("shift_end");
    const iso = fromLocalInput(shiftEndInput);
    try {
      if (shiftEnd) {
        await base44.entities.MachineLog.update(shiftEnd.id, { timestamp: iso });
      } else {
        await base44.entities.MachineLog.create({ entry_type: "shift_end", timestamp: iso });
      }
    } catch (err) {
      console.error("Failed to save shift end:", err);
    } finally {
      setSaving(null);
    }
  }

  async function logEvent(type) {
    if (saving) return;
    setSaving(type);
    try {
      await base44.entities.MachineLog.create({ entry_type: type, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to log event:", err);
    } finally {
      setSaving(null);
    }
  }

  async function deleteEvent(id) {
    try {
      await base44.entities.MachineLog.delete(id);
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      {/* Shift Start */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Play className="w-4 h-4" /> Shift Start
        </h3>
        <div className="flex gap-2">
          <Input type="datetime-local" value={shiftStartInput} onChange={(e) => setShiftStartInput(e.target.value)} />
          <Button size="sm" onClick={saveShiftStart} disabled={!shiftStartInput || saving === "shift_start"}>
            {shiftStart ? "Update" : "Set"}
          </Button>
        </div>
        {shiftStart && (
          <p className="text-xs text-muted-foreground mt-2">Started at {formatTime(shiftStart.timestamp)}</p>
        )}
      </div>

      {/* Machine Down / Up Log */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-heading font-semibold text-sm mb-3">Machine Down / Up Log</h3>
        {machineEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No events logged.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {machineEvents.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${ev.entry_type === "machine_down" ? "text-destructive" : "text-primary"}`}>
                    {ev.entry_type === "machine_down" ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                    {ev.entry_type === "machine_down" ? "Down" : "Up"}
                  </span>
                  <span className="text-sm">{formatTime(ev.timestamp)}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteEvent(ev.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => logEvent("machine_down")} disabled={saving === "machine_down"}>
            <ArrowDown className="w-4 h-4" /> Log Down
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => logEvent("machine_up")} disabled={saving === "machine_up"}>
            <ArrowUp className="w-4 h-4" /> Log Up
          </Button>
        </div>
      </div>

      {/* Shift End */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h3 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Square className="w-4 h-4" /> Shift End
        </h3>
        <div className="flex gap-2">
          <Input type="datetime-local" value={shiftEndInput} onChange={(e) => setShiftEndInput(e.target.value)} />
          <Button size="sm" onClick={saveShiftEnd} disabled={!shiftEndInput || saving === "shift_end"}>
            {shiftEnd ? "Update" : "Set"}
          </Button>
        </div>
        {shiftEnd && (
          <p className="text-xs text-muted-foreground mt-2">Ended at {formatTime(shiftEnd.timestamp)}</p>
        )}
      </div>
    </div>
  );
}