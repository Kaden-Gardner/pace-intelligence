import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CounterPanel from "@/components/work-aid/CounterPanel";
import FillingPanel from "@/components/work-aid/FillingPanel";

const FILLING_KEYS = ["filling_flavor_1", "filling_flavor_2", "filling_flavor_3", "filling_flavor_4"];

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
  const [busyKeys, setBusyKeys] = useState(new Set());
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

  function markBusy(key, isBusy) {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function adjustCounter(key, delta) {
    if (busyKeys.has(key)) return;
    const rec = countersRef.current[key];
    const currentVal = rec?.cases || 0;
    const newVal = Math.max(0, currentVal + delta);
    if (newVal === currentVal) return;

    markBusy(key, true);
    setCounters((prev) => ({
      ...prev,
      [key]: prev[key] ? { ...prev[key], cases: newVal } : { position: key, cases: newVal },
    }));

    try {
      if (!rec) {
        const created = await base44.entities.WorkAidCounter.create({ position: key, cases: newVal });
        setCounters((prev) => ({ ...prev, [key]: created }));
      } else {
        await base44.entities.WorkAidCounter.update(rec.id, { cases: newVal });
      }
    } catch (err) {
      setCounters((prev) => ({
        ...prev,
        [key]: rec ? { ...rec } : prev[key],
      }));
    } finally {
      markBusy(key, false);
    }
  }

  async function reset(key) {
    if (busyKeys.has(key)) return;
    const rec = countersRef.current[key];
    if (!rec || (rec.cases || 0) === 0) return;

    markBusy(key, true);
    const prevVal = rec.cases || 0;
    setCounters((prev) => ({ ...prev, [key]: { ...prev[key], cases: 0 } }));

    try {
      await base44.entities.WorkAidCounter.update(rec.id, { cases: 0 });
    } catch (err) {
      setCounters((prev) => ({ ...prev, [key]: { ...prev[key], cases: prevVal } }));
    } finally {
      markBusy(key, false);
    }
  }

  async function resetAll(keys) {
    const active = keys.filter((k) => {
      const rec = countersRef.current[k];
      return rec && (rec.cases || 0) > 0;
    });
    if (active.length === 0) return;

    keys.forEach((k) => markBusy(k, true));

    setCounters((prev) => {
      const next = { ...prev };
      active.forEach((k) => { if (next[k]) next[k] = { ...next[k], cases: 0 }; });
      return next;
    });

    await Promise.all(active.map(async (key) => {
      const rec = countersRef.current[key];
      if (!rec) return;
      try {
        await base44.entities.WorkAidCounter.update(rec.id, { cases: 0 });
      } catch (err) {
        console.error(`Failed to reset ${key}:`, err);
      }
    }));

    keys.forEach((k) => markBusy(k, false));
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
        <TabsContent value="boxing">
          <CounterPanel
            label="Boxing Cases"
            counter={counters["boxing"]}
            unit="cases"
            onIncrement={() => adjustCounter("boxing", +1)}
            onDecrement={() => adjustCounter("boxing", -1)}
            onReset={() => reset("boxing")}
            disabled={busyKeys.has("boxing")}
          />
        </TabsContent>
        <TabsContent value="filling">
          <FillingPanel
            counters={counters}
            onIncrement={(key) => adjustCounter(key, +1)}
            onDecrement={(key) => adjustCounter(key, -1)}
            onResetAll={() => resetAll(FILLING_KEYS)}
            busyKeys={busyKeys}
          />
        </TabsContent>
        <TabsContent value="bagging">
          <CounterPanel
            label="Bags Bagged"
            counter={counters["bagging"]}
            unit="bags"
            onIncrement={() => adjustCounter("bagging", +1)}
            onDecrement={() => adjustCounter("bagging", -1)}
            onReset={() => reset("bagging")}
            disabled={busyKeys.has("bagging")}
          />
        </TabsContent>
        <TabsContent value="pulling">
          <CounterPanel
            label="Pulling Waste"
            counter={counters["pulling"]}
            unit="popsicles"
            secondaryLabel="Gallons of Punch"
            conversionDivisor={48}
            onIncrement={() => adjustCounter("pulling", +1)}
            onDecrement={() => adjustCounter("pulling", -1)}
            onReset={() => reset("pulling")}
            disabled={busyKeys.has("pulling")}
          />
        </TabsContent>
        <TabsContent value="sorting">
          <CounterPanel
            label="Sorting Waste"
            counter={counters["sorting"]}
            unit="popsicles"
            secondaryLabel="Gallons of Punch"
            conversionDivisor={48}
            onIncrement={() => adjustCounter("sorting", +1)}
            onDecrement={() => adjustCounter("sorting", -1)}
            onReset={() => reset("sorting")}
            disabled={busyKeys.has("sorting")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}