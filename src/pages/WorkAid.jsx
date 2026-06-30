import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CounterPanel from "@/components/work-aid/CounterPanel";

const POSITIONS = [
  { key: "boxing", label: "Boxing" },
  { key: "filling", label: "Filling" },
  { key: "bagging", label: "Bagging" },
  { key: "pulling", label: "Pulling" },
];

export default function WorkAid() {
  const [counters, setCounters] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub;
    (async () => {
      const list = await base44.entities.WorkAidCounter.list();
      const map = {};
      list.forEach((c) => { if (c.position) map[c.position] = c; });
      setCounters(map);
      setLoading(false);
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

  async function increment(pos) {
    const rec = counters[pos];
    if (!rec) {
      const created = await base44.entities.WorkAidCounter.create({ position: pos, cases: 1 });
      setCounters((prev) => ({ ...prev, [pos]: created }));
    } else {
      const newVal = (rec.cases || 0) + 1;
      await base44.entities.WorkAidCounter.update(rec.id, { cases: newVal });
      setCounters((prev) => ({ ...prev, [pos]: { ...prev[pos], cases: newVal } }));
    }
  }

  async function decrement(pos) {
    const rec = counters[pos];
    if (!rec) return;
    const newVal = Math.max(0, (rec.cases || 0) - 1);
    await base44.entities.WorkAidCounter.update(rec.id, { cases: newVal });
    setCounters((prev) => ({ ...prev, [pos]: { ...prev[pos], cases: newVal } }));
  }

  async function reset(pos) {
    const rec = counters[pos];
    if (!rec) return;
    await base44.entities.WorkAidCounter.update(rec.id, { cases: 0 });
    setCounters((prev) => ({ ...prev, [pos]: { ...prev[pos], cases: 0 } }));
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
            {p.key === "boxing" ? (
              <CounterPanel
                label={p.label}
                counter={counters[p.key]}
                onIncrement={() => increment(p.key)}
                onDecrement={() => decrement(p.key)}
                onReset={() => reset(p.key)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-muted-foreground">Nothing here yet.</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}