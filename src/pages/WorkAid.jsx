import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CounterPanel from "@/components/work-aid/CounterPanel";

const POSITIONS = [
  { key: "boxing", label: "Boxing" },
  { key: "filling", label: "Filling" },
  { key: "bagging", label: "Bagging" },
  { key: "pulling", label: "Pulling" },
  { key: "sorting", label: "Sorting" },
];

export default function WorkAid() {
  const [counters, setCounters] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyPos, setBusyPos] = useState(null);

  // Ref to always read the latest counters without stale closure issues
  const countersRef = useRef(counters);
  countersRef.current = counters;

  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const list = await base44.entities.WorkAidCounter.list();
        const map = {};
        list.forEach((c) => { if (c.position) map[c.position] = c; });
        setCounters(map);
      } catch (err) {
        console.error("Failed to load counters:", err);
      } finally {
        setLoading(false);
      }
      unsub = base44.entities.WorkAidCounter.subscribe((event) => {
        setCounters((prev) => {
          const next = { ...prev };
          if (event.type === "delete") {
            for (const k of Object.keys(next)) {
              if (next[k]?.id === event.id) next[k] = { ...next[k], cases: 0 };
            }
          } else if (event.data?.position) {
            next[event.data.position] = event.data;
          }
          return next;
        });
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  async function adjustCounter(pos, delta) {
    if (busyPos === pos) return;
    const rec = countersRef.current[pos];
    const currentVal = rec?.cases || 0;
    const newVal = Math.max(0, currentVal + delta);
    if (newVal === currentVal) return;

    setBusyPos(pos);
    // Optimistic update
    setCounters((prev) => ({
      ...prev,
      [pos]: prev[pos] ? { ...prev[pos], cases: newVal } : { position: pos, cases: newVal },
    }));

    try {
      if (!rec) {
        const created = await base44.entities.WorkAidCounter.create({ position: pos, cases: newVal });
        setCounters((prev) => ({ ...prev, [pos]: created }));
      } else {
        await base44.entities.WorkAidCounter.update(rec.id, { cases: newVal });
      }
    } catch (err) {
      // Rollback on failure — subscription will also correct eventually
      setCounters((prev) => ({
        ...prev,
        [pos]: rec ? { ...rec } : prev[pos],
      }));
    } finally {
      setBusyPos(null);
    }
  }

  async function reset(pos) {
    if (busyPos === pos) return;
    const rec = countersRef.current[pos];
    if (!rec || (rec.cases || 0) === 0) return;

    setBusyPos(pos);
    const prevVal = rec.cases || 0;
    setCounters((prev) => ({ ...prev, [pos]: { ...prev[pos], cases: 0 } }));

    try {
      await base44.entities.WorkAidCounter.update(rec.id, { cases: 0 });
    } catch (err) {
      setCounters((prev) => ({ ...prev, [pos]: { ...prev[pos], cases: prevVal } }));
    } finally {
      setBusyPos(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Work Aid</h1>
      <Tabs defaultValue="boxing">
        <TabsList className="w-full justify-start overflow-x-auto mb-6">
          {POSITIONS.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
          ))}
        </TabsList>
        {POSITIONS.map((p) => (
          <TabsContent key={p.key} value={p.key}>
            <CounterPanel
              label={p.label}
              counter={counters[p.key]}
              onIncrement={() => adjustCounter(p.key, +1)}
              onDecrement={() => adjustCounter(p.key, -1)}
              onReset={() => reset(p.key)}
              disabled={busyPos === p.key}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}