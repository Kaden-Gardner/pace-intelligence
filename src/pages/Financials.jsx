import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Lock, Unlock, Package, Users, Calendar, BarChart3, Check, X } from "lucide-react";
import { getTotalCases } from "@/lib/analyticsHelpers";
import { differenceInMinutes, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subYears } from "date-fns";

const PERIODS = [
  { label: "Last Shift", key: "lastshift" },
  { label: "This Week", key: "week" },
  { label: "Last Week", key: "lastweek" },
  { label: "This Month", key: "month" },
  { label: "Last Month", key: "lastmonth" },
  { label: "Last Year", key: "lastyear" },
  { label: "All Time", key: "all" },
];

function getPeriodRange(key, shifts) {
  const now = new Date();
  if (key === "week") return [startOfWeek(now), endOfWeek(now)];
  if (key === "lastweek") { const s = startOfWeek(new Date(now - 7 * 86400000)); return [s, endOfWeek(s)]; }
  if (key === "month") return [startOfMonth(now), endOfMonth(now)];
  if (key === "lastmonth") { const lm = subMonths(now, 1); return [startOfMonth(lm), endOfMonth(lm)]; }
  if (key === "lastyear") return [subYears(now, 1), now];
  if (key === "lastshift") {
    const sorted = [...shifts].sort((a, b) => b.shift_date.localeCompare(a.shift_date));
    if (sorted.length === 0) return [null, null];
    const d = new Date(sorted[0].shift_date + "T00:00:00");
    return [d, new Date(d.getTime() + 86400000)];
  }
  return [null, null];
}

function fmt$(n) { return n == null ? "—" : `$${Number(n).toFixed(2)}`; }
function fmtHours(h) { if (!h) return "0h 0m"; const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return `${hrs}h ${mins}m`; }

function calcOverlapHours(shiftDate, shiftTime, shiftDuration, clockIn, clockOut) {
  if (!clockIn) return 0;
  const shiftStart = new Date(`${shiftDate}T${shiftTime || "00:00"}:00`);
  const shiftEnd = new Date(shiftStart.getTime() + (shiftDuration || 8) * 3600000);
  const entryStart = parseISO(clockIn);
  const entryEnd = clockOut ? parseISO(clockOut) : new Date();
  const overlapStart = entryStart > shiftStart ? entryStart : shiftStart;
  const overlapEnd = entryEnd < shiftEnd ? entryEnd : shiftEnd;
  const mins = differenceInMinutes(overlapEnd, overlapStart);
  return Math.max(0, mins / 60);
}

export default function Financials() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rates, setRates] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [baseMixShifts, setBaseMixShifts] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [loading, setLoading] = useState(false);

  // Rates UI state
  const [ratesUnlocked, setRatesUnlocked] = useState(false);
  const [ratesPwInput, setRatesPwInput] = useState("");
  const [ratesPwError, setRatesPwError] = useState("");
  const [editingRateId, setEditingRateId] = useState(null);
  const [editRateVal, setEditRateVal] = useState("");

  // Orders UI state
  const [pricingId, setPricingId] = useState(null);
  const [priceInput, setPriceInput] = useState("");

  // Analytics period
  const [period, setPeriod] = useState("all");
  // Shift type filter (used in both Shifts tab and Analytics tab)
  const [shiftTypeFilter, setShiftTypeFilter] = useState("all"); // "all" | "production" | "basemix"

  function handleUnlock() {
    if (pwInput !== "ecap") { setPwError("Incorrect password."); return; }
    setUnlocked(true);
    loadData();
  }

  async function loadData() {
    setLoading(true);
    const [ord, emps, rt, sh, bms, te, fs] = await Promise.all([
      base44.entities.OrderPickup.list("-pickup_date", 500),
      base44.entities.Employee.list("name"),
      base44.entities.EmployeeRate.list(),
      base44.entities.Shift.list("-shift_date", 500),
      base44.entities.BaseMixingShift.list("-shift_date", 500),
      base44.entities.TimeEntry.list("-clock_in", 2000),
      base44.entities.FlavorSet.list("name"),
    ]);
    setOrders(ord);
    setEmployees(emps);
    setRates(rt);
    setShifts(sh);
    setBaseMixShifts(bms);
    setTimeEntries(te);
    setFlavorSets(fs);
    setLoading(false);
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        Access restricted to admins.
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Financials</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Enter the admin password to access financial data.</p>
          <Input
            type="password"
            placeholder="Admin password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className={pwError ? "border-destructive" : ""}
          />
          {pwError && <p className="text-xs text-destructive mt-1">{pwError}</p>}
          <Button className="w-full mt-4" onClick={handleUnlock}>Unlock</Button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const fsMap = {};
  flavorSets.forEach((fs) => { fsMap[fs.id] = fs; });
  const empMap = {};
  employees.forEach((e) => { empMap[e.id] = e; });
  const rateMap = {};
  rates.forEach((r) => { rateMap[r.employee_id] = r; });

  const newOrders = orders.filter((o) => !o.is_priced);
  const prevOrders = orders.filter((o) => o.is_priced);

  async function handlePriceOrder(order) {
    const price = parseFloat(priceInput);
    if (!price || price <= 0) return;
    const totalRevenue = price * (order.cases || 0);
    await base44.entities.OrderPickup.update(order.id, { case_sell_price: price, is_priced: true });
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, case_sell_price: price, is_priced: true } : o));
    setPricingId(null);
    setPriceInput("");
  }

  // Rate helpers
  function getRateForEmp(empId) {
    return rateMap[empId]?.hourly_rate || 0;
  }

  async function saveRate(emp) {
    const val = parseFloat(editRateVal);
    if (isNaN(val) || val < 0) return;
    const existing = rateMap[emp.id];
    if (existing) {
      await base44.entities.EmployeeRate.update(existing.id, { hourly_rate: val });
      setRates((prev) => prev.map((r) => r.id === existing.id ? { ...r, hourly_rate: val } : r));
    } else {
      const created = await base44.entities.EmployeeRate.create({ employee_id: emp.id, employee_name: emp.name, hourly_rate: val });
      setRates((prev) => [...prev, created]);
    }
    setEditingRateId(null);
    setEditRateVal("");
  }

  // Shift cost calculation
  function calcShiftCost(shift, isBaseMix = false) {
    const shiftDate = shift.shift_date;
    const shiftTime = shift.shift_time || "06:00";
    const shiftDuration = shift.shift_duration || 8;

    let empIds = [];
    if (isBaseMix) {
      [shift.mixer_1, shift.mixer_2, shift.mixer_3, shift.shift_lead].forEach((id) => { if (id) empIds.push(id); });
    } else {
      [shift.filling_employee, shift.pulling_employee_1, shift.pulling_employee_2, shift.pulling_employee_3,
       shift.sorting_employee, shift.bagging_employee, shift.boxing_employee, shift.shift_lead].forEach((id) => { if (id) empIds.push(id); });
      if (shift.training_employees) empIds.push(...shift.training_employees);
    }
    empIds = [...new Set(empIds)];

    let totalCost = 0;
    empIds.forEach((empId) => {
      const rate = getRateForEmp(empId);
      if (!rate) return;
      // Find time entries overlapping this shift
      const empEntries = timeEntries.filter((te) => te.employee_id === empId || te.employee_number === empMap[empId]?.employee_number);
      let hoursWorked = 0;
      empEntries.forEach((te) => {
        hoursWorked += calcOverlapHours(shiftDate, shiftTime, shiftDuration, te.clock_in, te.clock_out);
      });
      // If no clock-in found, use shift duration
      const hours = hoursWorked > 0 ? hoursWorked : shiftDuration;
      totalCost += hours * rate;
    });
    return totalCost;
  }

  // Analytics
  const [start, end] = getPeriodRange(period, [...shifts, ...baseMixShifts]);
  function inPeriod(dateStr) {
    if (!start) return true;
    const d = new Date(dateStr + "T12:00:00");
    return d >= start && d <= end;
  }

  const filteredShifts = shifts.filter((s) => inPeriod(s.shift_date));
  const filteredBaseMix = baseMixShifts.filter((s) => inPeriod(s.shift_date));
  const filteredOrders = prevOrders.filter((o) => inPeriod(o.pickup_date));

  // Apply shift type filter
  const analyticsShifts = shiftTypeFilter === "basemix" ? [] : filteredShifts;
  const analyticsBaseMix = shiftTypeFilter === "production" ? [] : filteredBaseMix;

  const allShiftCosts = analyticsShifts.map((s) => calcShiftCost(s, false));
  const allBaseMixCosts = analyticsBaseMix.map((s) => calcShiftCost(s, true));
  const totalShiftCost = [...allShiftCosts, ...allBaseMixCosts].reduce((a, b) => a + b, 0);
  const totalShiftCount = allShiftCosts.length + allBaseMixCosts.length;
  const avgShiftCost = totalShiftCount > 0 ? totalShiftCost / totalShiftCount : 0;
  const totalCasesProduced = analyticsShifts.reduce((sum, s) => sum + getTotalCases(s), 0);
  const avgCostPerCase = totalCasesProduced > 0 ? totalShiftCost / totalCasesProduced : 0;
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + ((o.case_sell_price || 0) * (o.cases || 0)), 0);
  const totalCasesSold = filteredOrders.reduce((sum, o) => sum + (o.cases || 0), 0);

  // Shifts tab list (filtered by type)
  const shiftsTabList = [
    ...(shiftTypeFilter === "basemix" ? [] : shifts.map((s) => ({ ...s, _type: "production" }))),
    ...(shiftTypeFilter === "production" ? [] : baseMixShifts.map((s) => ({ ...s, _type: "basemix" }))),
  ].sort((a, b) => b.shift_date.localeCompare(a.shift_date));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Financials</h1>
          <p className="text-muted-foreground mt-1">Financial overview — admin access only</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setUnlocked(false)}>
          <Lock className="w-4 h-4" /> Lock
        </Button>
      </div>

      <Tabs defaultValue="new-orders">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="new-orders">New Orders</TabsTrigger>
          <TabsTrigger value="previous-orders">Previous Orders</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ===== NEW ORDERS ===== */}
        <TabsContent value="new-orders">
          <p className="text-sm text-muted-foreground mb-4">Orders awaiting a sell price. Click an order to enter the price per case.</p>
          {newOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No new orders — all orders have been priced.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {newOrders.map((o) => (
                <div key={o.id} className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-heading font-semibold">{o.vendor_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {fsMap[o.flavorset_id]?.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fsMap[o.flavorset_id].color }} />}
                        {fsMap[o.flavorset_id]?.name || "?"} · {o.pallets} pallets · {o.cases} cases · {o.pickup_date}
                      </p>
                      {o.notes && <p className="text-xs text-muted-foreground mt-0.5">{o.notes}</p>}
                    </div>
                    {pricingId === o.id ? (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={priceInput}
                            onChange={(e) => setPriceInput(e.target.value)}
                            className="pl-7 w-32"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handlePriceOrder(o)}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">per case</span>
                        {priceInput && <span className="text-xs font-medium text-primary">= ${(parseFloat(priceInput) * (o.cases || 0)).toFixed(2)} total</span>}
                        <Button size="sm" onClick={() => handlePriceOrder(o)} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPricingId(null); setPriceInput(""); }}><X className="w-3 h-3" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" className="gap-2" onClick={() => { setPricingId(o.id); setPriceInput(""); }}>
                        <DollarSign className="w-4 h-4" /> Set Price
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== PREVIOUS ORDERS ===== */}
        <TabsContent value="previous-orders">
          {prevOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No priced orders yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prevOrders.map((o) => (
                <div key={o.id} className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-heading font-semibold">{o.vendor_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        {fsMap[o.flavorset_id]?.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fsMap[o.flavorset_id].color }} />}
                        {fsMap[o.flavorset_id]?.name || "?"} · {o.pallets} pallets · {o.cases} cases · {o.pickup_date}
                      </p>
                      {o.notes && <p className="text-xs text-muted-foreground mt-0.5">{o.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{fmt$(o.case_sell_price)}/case</p>
                      <p className="font-heading font-bold text-primary text-lg">{fmt$(o.case_sell_price * o.cases)}</p>
                      <p className="text-xs text-muted-foreground">{o.cases} cases</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-muted rounded-2xl p-4 flex justify-between items-center">
                <p className="font-medium">Total Revenue (all time)</p>
                <p className="font-heading font-bold text-xl text-primary">{fmt$(prevOrders.reduce((sum, o) => sum + (o.case_sell_price || 0) * (o.cases || 0), 0))}</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== EMPLOYEES ===== */}
        <TabsContent value="employees">
          <div className="flex items-center gap-3 mb-6">
            <p className="text-sm text-muted-foreground flex-1">Set hourly rates for each employee. Rates are used to calculate shift costs.</p>
            {ratesUnlocked ? (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setRatesUnlocked(false)}>
                <Lock className="w-4 h-4" /> Lock Rates
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder="Password to edit"
                  value={ratesPwInput}
                  onChange={(e) => { setRatesPwInput(e.target.value); setRatesPwError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { if (ratesPwInput === "ecap") { setRatesUnlocked(true); setRatesPwInput(""); } else setRatesPwError("Wrong password"); } }}
                  className={`w-40 ${ratesPwError ? "border-destructive" : ""}`}
                />
                <Button size="sm" onClick={() => { if (ratesPwInput === "ecap") { setRatesUnlocked(true); setRatesPwInput(""); } else setRatesPwError("Wrong password"); }}>
                  <Unlock className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
          {ratesPwError && <p className="text-xs text-destructive mb-3">{ratesPwError}</p>}
          <div className="space-y-2">
            {employees.map((emp) => {
              const rate = getRateForEmp(emp.id);
              return (
                <div key={emp.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">#{emp.employee_number}</p>
                  </div>
                  {ratesUnlocked && editingRateId === emp.id ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input type="number" min="0" step="0.25" value={editRateVal} onChange={(e) => setEditRateVal(e.target.value)} className="pl-7 w-28" autoFocus onKeyDown={(e) => e.key === "Enter" && saveRate(emp)} />
                      </div>
                      <span className="text-xs text-muted-foreground">/hr</span>
                      <Button size="sm" onClick={() => saveRate(emp)} className="gap-1"><Check className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingRateId(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-heading font-bold text-primary">{rate > 0 ? `$${rate.toFixed(2)}/hr` : "Not set"}</span>
                      {ratesUnlocked && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => { setEditingRateId(emp.id); setEditRateVal(rate > 0 ? rate.toString() : ""); }}>
                          Edit
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== SHIFTS ===== */}
        <TabsContent value="shifts">
          <p className="text-sm text-muted-foreground mb-4">
            Shift labor cost is calculated using time tracking overlap. If an employee has no clock-in for a shift, their cost is estimated from the shift duration.
          </p>
          <div className="flex gap-2 mb-4">
            {[{ key: "all", label: "All Shifts" }, { key: "production", label: "Production" }, { key: "basemix", label: "Base Mix" }].map((t) => (
              <button key={t.key} onClick={() => setShiftTypeFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${shiftTypeFilter === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {shiftsTabList.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No shifts recorded yet.</p>
              </div>
            )}
            {shiftsTabList.map((shift) => {
                const isBaseMix = shift._type === "basemix";
                const cost = calcShiftCost(shift, isBaseMix);
                const cases = isBaseMix ? null : getTotalCases(shift);

                let empIds = [];
                if (isBaseMix) {
                  [shift.mixer_1, shift.mixer_2, shift.mixer_3, shift.shift_lead].forEach((id) => { if (id) empIds.push(id); });
                } else {
                  [shift.filling_employee, shift.pulling_employee_1, shift.pulling_employee_2, shift.pulling_employee_3,
                   shift.sorting_employee, shift.bagging_employee, shift.boxing_employee, shift.shift_lead].forEach((id) => { if (id) empIds.push(id); });
                  if (shift.training_employees) empIds.push(...shift.training_employees);
                }
                empIds = [...new Set(empIds)].filter(Boolean);

                return (
                  <div key={shift.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                      <div>
                        <p className="font-heading font-semibold flex items-center gap-2 flex-wrap">
                          {fsMap[shift.flavorset_id]?.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fsMap[shift.flavorset_id].color }} />}
                          {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{isBaseMix ? "Base Mix" : "Production"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{shift.shift_time} · {shift.shift_duration}h{cases != null ? ` · ${cases} cases` : ""}</p>
                      </div>
                      <p className="font-heading font-bold text-xl text-primary">{cost > 0 ? fmt$(cost) : "—"}</p>
                    </div>
                    {empIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {empIds.map((id) => {
                          const emp = empMap[id];
                          const rate = getRateForEmp(id);
                          const empEntries = timeEntries.filter((te) => te.employee_id === id || te.employee_number === emp?.employee_number);
                          let hrs = 0;
                          empEntries.forEach((te) => { hrs += calcOverlapHours(shift.shift_date, shift.shift_time, shift.shift_duration, te.clock_in, te.clock_out); });
                          const usedDuration = hrs === 0;
                          const finalHrs = hrs > 0 ? hrs : (shift.shift_duration || 8);
                          return (
                            <span key={id} className="text-xs px-2 py-1 bg-muted rounded-lg">
                              {emp?.name || "?"} · {fmtHours(finalHrs)}{usedDuration ? " (est)" : ""} · {rate > 0 ? fmt$(finalHrs * rate) : "no rate"}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </TabsContent>

        {/* ===== ANALYTICS ===== */}
        <TabsContent value="analytics">
          <div className="flex flex-wrap gap-2 mb-4">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-6">
            {[{ key: "all", label: "All Shifts" }, { key: "production", label: "Production" }, { key: "basemix", label: "Base Mix" }].map((t) => (
              <button key={t.key} onClick={() => setShiftTypeFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${shiftTypeFilter === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Shift Cost", value: fmt$(totalShiftCost), sub: `${totalShiftCount} shifts` },
              { label: "Avg Cost Per Shift", value: fmt$(avgShiftCost), sub: shiftTypeFilter === "all" ? "production + base mix" : shiftTypeFilter === "production" ? "production only" : "base mix only" },
              { label: "Avg Cost Per Case", value: shiftTypeFilter === "basemix" ? "—" : fmt$(avgCostPerCase), sub: `${totalCasesProduced} cases produced` },
              { label: "Total Sales Revenue", value: fmt$(totalRevenue), sub: `${totalCasesSold} cases sold` },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-2xl border border-border p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                <p className="font-heading font-bold text-2xl text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
          {totalRevenue > 0 && totalShiftCost > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5">
              <p className="text-sm font-medium mb-2">Profit Estimate</p>
              <p className="font-heading font-bold text-3xl" style={{ color: totalRevenue - totalShiftCost >= 0 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))" }}>
                {fmt$(totalRevenue - totalShiftCost)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Revenue minus labor costs for this period</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}