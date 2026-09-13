import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CounterPanel from "@/components/work-aid/CounterPanel";
import LotNumberTracker from "@/components/work-aid/LotNumberTracker";
import FillingPanel from "@/components/work-aid/FillingPanel";
import GeneralPanel from "@/components/work-aid/GeneralPanel";
import Scoreboard from "@/components/work-aid/Scoreboard";
import BatchPredictor from "@/components/work-aid/BatchPredictor";
import VideoSections from "@/components/work-aid/VideoSections";
import FlavorBoxingTrackers from "@/components/work-aid/FlavorBoxingTrackers";
import { MD_BAGS_PER_CASE, MD_POPS_PER_CASE, MD_POPS_PER_MOLD, DEFAULT_BAGS_PER_CASE, DEFAULT_POPS_PER_CASE, DEFAULT_POPS_PER_MOLD } from "@/lib/productionConstants";

const FILLING_KEYS = ["filling_flavor_1", "filling_flavor_2", "filling_flavor_3", "filling_flavor_4"];
const FLAVOR_BOXING_KEYS = ["boxing_flavor_1", "boxing_flavor_2", "boxing_flavor_3", "boxing_flavor_4"];

const TABS = [
  { key: "scoreboard", label: "Scoreboard", isScoreboard: true },
  { key: "general", label: "General", isGeneral: true },
  { key: "boxing", label: "Boxing", panelLabel: "Boxing Cases", unit: "cases" },
  { key: "filling", label: "Filling", isMulti: true },
  { key: "bagging", label: "Bagging", panelLabel: "Bags Bagged", unit: "bags" },
  { key: "pulling", label: "Pulling", panelLabel: "Pulling Waste", unit: "popsicles", secondaryLabel: "Gallons of Punch", conversionDivisor: 48 },
  { key: "sorting", label: "Sorting", panelLabel: "Sorting Waste", unit: "popsicles", secondaryLabel: "Gallons of Punch", conversionDivisor: 48 },
];

export default function WorkAid() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [counters, setCounters] = useState({});
  const [machineLogs, setMachineLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState("scoreboard");
  const [packConstants, setPackConstants] = useState(null);
  const [avgCasePrice, setAvgCasePrice] = useState(0);
  const [flavors, setFlavors] = useState([]);
  const [flavorEnabled, setFlavorEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("boxingFlavorEnabled");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA');
        const shifts = await base44.entities.ScheduledShift.list("shift_date", 200);
        const todayShift = shifts.find((s) => s.shift_date === today);
        if (!todayShift || !todayShift.flavorset_id) { setFlavors([]); return; }
        const [fsList, allFlavors] = await Promise.all([
          base44.entities.FlavorSet.list(),
          base44.entities.Flavor.list(),
        ]);
        const fs = fsList.find((f) => f.id === todayShift.flavorset_id);
        if (!fs) { setFlavors([]); return; }
        const flavorMap = {};
        allFlavors.forEach((f) => { flavorMap[f.id] = f; });
        const result = [];
        for (const key of ["flavor_1", "flavor_2", "flavor_3", "flavor_4"]) {
          if (fs[key] && flavorMap[fs[key]]) {
            result.push({ key: `boxing_${key}`, name: flavorMap[fs[key]].name, color: flavorMap[fs[key]].color });
          }
        }
        setFlavors(result);
      } catch (err) {
        console.error("Failed to load flavors:", err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [mdef, orderItems] = await Promise.all([
          base44.entities.MaterialDefaults.list(),
          base44.entities.OrderPickupItem.list(),
        ]);
        const map = {};
        mdef.forEach((d) => { map[d.material_key] = d; });
        setPackConstants({
          bagsPerCase: map[MD_BAGS_PER_CASE]?.qty_per_shift || DEFAULT_BAGS_PER_CASE,
          popsPerCase: map[MD_POPS_PER_CASE]?.qty_per_shift || DEFAULT_POPS_PER_CASE,
          popsPerMold: map[MD_POPS_PER_MOLD]?.qty_per_shift || DEFAULT_POPS_PER_MOLD,
        });
        const priced = orderItems.filter((i) => i.case_sell_price > 0);
        setAvgCasePrice(priced.length > 0 ? priced.reduce((s, i) => s + i.case_sell_price, 0) / priced.length : 0);
      } catch (err) {
        console.error("Failed to load pack constants:", err);
        setPackConstants({
          bagsPerCase: DEFAULT_BAGS_PER_CASE,
          popsPerCase: DEFAULT_POPS_PER_CASE,
          popsPerMold: DEFAULT_POPS_PER_MOLD,
        });
      }
    })();
  }, []);

  useEffect(() => {
    let unsub;
    (async () => {
      try {
        const list = await base44.entities.MachineLog.list();
        setMachineLogs(list);
      } catch (err) {
        console.error("Failed to load machine logs:", err);
      }
      unsub = base44.entities.MachineLog.subscribe((event) => {
        setMachineLogs((prev) => {
          if (event.type === "delete") return prev.filter((l) => l.id !== event.id);
          if (event.type === "create") return [...prev, event.data];
          if (event.type === "update") return prev.map((l) => (l.id === event.data.id ? event.data : l));
          return prev;
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

  async function setLotNumber(val) {
    const key = "lot_number";
    if (busyRef.current.has(key)) return;
    const rec = countersRef.current[key];
    markBusy(key, true);
    setCounters((prev) => ({ ...prev, [key]: rec ? { ...rec, cases: val } : { position: key, cases: val } }));
    try {
      if (!rec) {
        const created = await base44.entities.WorkAidCounter.create({ position: key, cases: val });
        setCounters((prev) => ({ ...prev, [key]: created }));
      } else {
        await base44.entities.WorkAidCounter.update(rec.id, { cases: val });
      }
    } catch (err) {
      setCounters((prev) => ({ ...prev, [key]: rec ? { ...rec } : prev[key] }));
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

  function toggleFlavor(key) {
    setFlavorEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("boxingFlavorEnabled", JSON.stringify(next));
      return next;
    });
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const shiftStartLog = machineLogs.find((l) => l.entry_type === "shift_start");
  const shiftStartMs = shiftStartLog ? new Date(shiftStartLog.timestamp).getTime() : null;
  const shiftEndLog = machineLogs.find((l) => l.entry_type === "shift_end");
  const shiftElapsedMs = shiftStartLog
    ? (shiftEndLog ? new Date(shiftEndLog.timestamp).getTime() : now) - new Date(shiftStartLog.timestamp).getTime()
    : 0;
  const boxingMain = counters["boxing"]?.cases || 0;
  const flavorBoxingTotal = flavors.reduce((sum, f) => flavorEnabled[f.key] ? sum + (counters[f.key]?.cases || 0) : sum, 0);
  const boxingTotal = boxingMain + flavorBoxingTotal;

  const machineEvents = machineLogs
    .filter((l) => l.entry_type === "machine_down" || l.entry_type === "machine_up")
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let totalDowntimeMs = 0;
  let openDownStart = null;
  for (const ev of machineEvents) {
    if (ev.entry_type === "machine_down") {
      openDownStart = new Date(ev.timestamp).getTime();
    } else if (ev.entry_type === "machine_up" && openDownStart !== null) {
      totalDowntimeMs += new Date(ev.timestamp).getTime() - openDownStart;
      openDownStart = null;
    }
  }
  if (openDownStart !== null) {
    totalDowntimeMs += now - openDownStart;
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Work Aid</h1>
      <Tabs defaultValue="scoreboard" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {t.isScoreboard ? (
              <Scoreboard
                shiftElapsedMs={shiftElapsedMs}
                cases={boxingTotal}
                downtimeMs={totalDowntimeMs}
                packConstants={packConstants}
                avgCasePrice={avgCasePrice}
              />
            ) : (
              <>
                {t.isGeneral && (
                  <BatchPredictor shiftElapsedMs={shiftElapsedMs} cases={boxingTotal} shiftStartMs={shiftStartMs} />
                )}
                {t.isGeneral ? (
                  <GeneralPanel />
                ) : t.isMulti ? (
                  <>
                    <FillingPanel
                      counters={counters}
                      onIncrement={(key) => adjustCounter(key, +1)}
                      onDecrement={(key) => adjustCounter(key, -1)}
                      onResetAll={() => resetAll(FILLING_KEYS)}
                      busyKeys={busyKeys}
                    />
                    <VideoSections position={t.key} />
                  </>
                ) : (
                  <>
                    {t.key === "boxing" && (
                      <LotNumberTracker
                        lotNumber={counters["lot_number"]?.cases || 0}
                        isAdmin={isAdmin}
                        onIncrement={() => adjustCounter("lot_number", +1)}
                        onSet={setLotNumber}
                        busy={busyKeys.has("lot_number")}
                      />
                    )}
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
                    {t.key === "boxing" && (
                      <FlavorBoxingTrackers
                        flavors={flavors}
                        counters={counters}
                        onIncrement={(key) => adjustCounter(key, +1)}
                        onDecrement={(key) => adjustCounter(key, -1)}
                        busyKeys={busyKeys}
                        enabledStates={flavorEnabled}
                        onToggle={toggleFlavor}
                      />
                    )}
                    <VideoSections position={t.key} />
                  </>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}