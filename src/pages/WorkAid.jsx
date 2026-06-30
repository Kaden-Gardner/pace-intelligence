import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CounterPanel from "@/components/work-aid/CounterPanel";
import FillingPanel from "@/components/work-aid/FillingPanel";

const FILLING_KEYS = ["filling_flavor_1", "filling_flavor_2", "filling_flavor_3", "filling_flavor_4"];

const TABS = [
  { key: "boxing", label: "Boxing", panelLabel: "Boxing Cases", unit: "cases" },
  { key: "filling", label: "Filling", isMulti: true },
  { key: "bagging", label: "Bagging", panelLabel: "Bags Bagged", unit: "bags" },
  { key: "pulling", label: "Pulling", panelLabel: "Pulling Waste", unit: "popsicles", secondaryLabel: "Gallons of Punch", conversionDivisor: 48 },
  { key: "sorting", label: "Sorting", panelLabel: "Sorting Waste", unit: "popsicles", secondaryLabel: "Gallons of Punch", conversionDivisor: 48 },
];

export default function WorkAid() {
  const [counters, setCounters] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const countersRef = useRef(counters);
  countersRef.current = counters;
  const busyRef = useRef(new Set());

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
    const next = new Set(busyRef.current);
    if (isBusy) next.add(key); else next.delete(key);
    busyRef.current = next;
    setBusyKeys(next);
  }

  async function adjustCounter(key, delta) {
    if (busyRef.current.has(key)) return;
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
    if (busyRef.current.has(key)) return;
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

    active.forEach((k) => markBusy(k, true));

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

    active.forEach((k) => markBusy(k, false));
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Work Aid</h1>
      <Tabs defaultValue="boxing">
        <TabsList className="w-full justify-start overflow-x-auto mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {t.isMulti ? (
              <FillingPanel
                counters={counters}
                onIncrement={(key) => adjustCounter(key, +1)}
                onDecrement={(key) => adjustCounter(key, -1)}
                onResetAll={() => resetAll(FILLING_KEYS)}
                busyKeys={busyKeys}
              />
            ) : (
              <CounterPanel
                label={t.panelLabel}
                counter={counters[t.key]}
                unit={t.unit}
                secondaryLabel={t.secondaryLabel}
                conversionDivisor={t.conversionDivisor}
                onIncrement={() => adjustCounter(t.key, +1)}
                onDecrement={() => adjustCounter(t.key, -1)}
                onReset={() => reset(t.key)}
                disabled={busyKeys.has(t.key)}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}