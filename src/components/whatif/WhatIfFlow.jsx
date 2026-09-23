import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { ArrowLeft, Sparkles, TrendingUp, Users, Gauge, DollarSign } from "lucide-react";
import { getTotalCases, getShiftEmployees } from "@/lib/analyticsHelpers";
import { fmt$, fmtNum } from "@/components/bigboy/format";
import WhatIfPage from "@/components/whatif/WhatIfPage";

const TIMEFRAMES = [
  { key: "1w", label: "1 Week", weeks: 1, isOneWeek: true },
  { key: "1m", label: "1 Month", weeks: 52 / 12 },
  { key: "6m", label: "6 Months", weeks: 26 },
  { key: "1y", label: "1 Year", weeks: 52 },
  { key: "5y", label: "5 Years", weeks: 260 },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDowntimeHours(text) {
  if (!text) return 0;
  const s = String(text).toLowerCase().trim();
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) return parseFloat(hourMatch[1]);
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) return parseFloat(minMatch[1]) / 60;
  const plainMatch = s.match(/(\d+(?:\.\d+)?)/);
  if (plainMatch) return parseFloat(plainMatch[1]) / 60;
  return 0;
}

export default function WhatIfFlow({
  shifts, employees, rates, orders, orderItems,
  taxRate, calcShiftCost, calcProductionSupplyCost, onBack,
}) {
  const [step, setStep] = useState("timeframe"); // timeframe | setup | results
  const [tfKey, setTfKey] = useState(null);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [hoursPerDay, setHoursPerDay] = useState(8);

  const timeframe = TIMEFRAMES.find((t) => t.key === tfKey) || null;

  // Historical averages pulled from the Big Boy Page's data set.
  const averages = useMemo(() => {
    const rateMap = Object.fromEntries(rates.map((r) => [r.employee_id, r]));
    let totalCases = 0, totalHours = 0, totalWaste = 0, totalDowntime = 0;
    let totalLabor = 0, totalSupply = 0, totalCrew = 0;
    const crewByWd = {};
    shifts.forEach((s) => {
      const c = getTotalCases(s);
      totalCases += c;
      totalHours += s.shift_duration || 0;
      totalWaste += s.waste || 0;
      totalDowntime += parseDowntimeHours(s.downtime);
      totalLabor += calcShiftCost(s, false);
      totalSupply += calcProductionSupplyCost(s);
      const crew = getShiftEmployees(s).length;
      totalCrew += crew;
      const wd = new Date(s.shift_date + "T12:00:00").getDay();
      if (!crewByWd[wd]) crewByWd[wd] = [];
      crewByWd[wd].push(crew);
    });
    const n = shifts.length || 1;
    const crewByDay = {};
    Object.keys(crewByWd).forEach((wd) => {
      const arr = crewByWd[wd];
      crewByDay[wd] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    });
    const priced = (orderItems || []).filter((i) => i.case_sell_price > 0);
    const avgCasePrice = priced.length > 0 ? priced.reduce((s, i) => s + i.case_sell_price, 0) / priced.length : null;
    const withRate = employees.filter((e) => !e.terminated && (rateMap[e.id]?.hourly_rate || 0) > 0);
    const avgWage = withRate.length > 0
      ? withRate.reduce((s, e) => s + (rateMap[e.id].hourly_rate || 0) * (1 + (taxRate || 0) / 100), 0) / withRate.length
      : 0;
    const avgShiftHours = totalHours / n;
    const avgCrewSize = totalCrew / n;
    const overheadPerShift = Math.max(0, totalLabor / n - avgCrewSize * avgWage * avgShiftHours);
    return {
      avgCasesPerHour: totalHours > 0 ? totalCases / totalHours : 0,
      avgWage,
      avgCasePrice,
      avgWastePerShift: totalWaste / n,
      avgDowntimePerShift: totalDowntime / n,
      avgLaborPerShift: totalLabor / n,
      avgSupplyPerCase: totalCases > 0 ? totalSupply / totalCases : 0,
      avgCrewSize,
      avgShiftHours,
      overheadPerShift,
      crewByDay,
      shiftCount: shifts.length,
    };
  }, [shifts, employees, rates, orderItems, taxRate, calcShiftCost, calcProductionSupplyCost]);

  function handlePickTimeframe(key) {
    setTfKey(key);
    setStep("setup");
  }

  function handleRunSetup() {
    if (weekdays.length === 0 || hoursPerDay <= 0) return;
    setStep("results");
  }

  function restart() {
    setStep("timeframe");
    setTfKey(null);
  }

  if (step === "results" && timeframe) {
    return (
      <WhatIfPage
        timeframe={timeframe}
        weekdays={weekdays}
        hoursPerDay={hoursPerDay}
        averages={averages}
        onBack={onBack}
        onRestart={restart}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" size="sm" className="gap-1" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Back to Analytics
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h1 className="font-heading text-2xl font-bold">What If</h1>
        </div>
      </div>

      {/* Step 1: timeframe selection */}
      <Dialog open={step === "timeframe"} onOpenChange={(open) => { if (!open) onBack(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> What If — Pick a Timeframe
            </DialogTitle>
            <DialogDescription>
              Choose how far into the future you want to project. You'll set your working days and hours next.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 mt-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.key}
                onClick={() => handlePickTimeframe(t.key)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.isOneWeek ? "single week" : `≈ ${fmtNum(t.weeks, 0)} weeks`}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: setup sheet */}
      <Sheet open={step === "setup"} onOpenChange={(open) => { if (!open) onBack(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> What If Setup — {timeframe?.label}
            </SheetTitle>
            <SheetDescription>
              {timeframe?.isOneWeek
                ? "Pick the days you'll work this week and the scheduled hours per day."
                : "Pick which days of the week you work and the scheduled hours per day."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {timeframe?.isOneWeek ? "Working Days This Week" : "Working Days Each Week"}
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d, idx) => {
                  const active = weekdays.includes(idx);
                  return (
                    <button
                      key={d}
                      onClick={() => setWeekdays((prev) => active ? prev.filter((x) => x !== idx) : [...prev, idx].sort((a, b) => a - b))}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {weekdays.length === 0 && <p className="text-[11px] text-destructive mt-1.5">Select at least one day.</p>}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scheduled Hours Per Day</p>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 font-heading font-bold text-lg"
                />
                <span className="text-xs text-muted-foreground">hours / shift</span>
              </div>
            </div>

            <div className="bg-muted/40 rounded-xl border border-border p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Auto-Filled From Your Averages</p>
              <div className="grid grid-cols-1 gap-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" /> Avg speed</span>
                  <span className="font-medium">{fmtNum(averages.avgCasesPerHour, 1)} cases/hr</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Avg wage (incl. tax)</span>
                  <span className="font-medium">{fmt$(averages.avgWage)}/hr</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Avg sale price / case</span>
                  <span className="font-medium">{averages.avgCasePrice != null ? fmt$(averages.avgCasePrice) : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Avg crew size</span>
                  <span className="font-medium">{fmtNum(averages.avgCrewSize, 1)} ppl</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Based on {averages.shiftCount} production shifts on record.</p>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button className="gap-2 w-full" onClick={handleRunSetup} disabled={weekdays.length === 0 || hoursPerDay <= 0}>
              <Sparkles className="w-4 h-4" /> Run Projection
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}