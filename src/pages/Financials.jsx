import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Lock, Unlock, Package, Calendar, Check, X, Flame } from "lucide-react";
import { getTotalCases } from "@/lib/analyticsHelpers";
import { differenceInMinutes, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subYears } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import SuppliesPricingTab from "@/components/financials/SuppliesPricingTab";
import CostBreakdownTab from "@/components/financials/CostBreakdownTab";
import { INGREDIENTS } from "@/components/inventory/IngredientsTab";

const GALLONS_PER_BATCH = 240;

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

// Parses a free-text downtime note into hours.
// Recognizes "1.5 hours", "30 min", "45m", "2h"; a bare number is treated as minutes.
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

// Returns true if a time entry overlaps with a shift window at all
function entryOverlapsShift(shiftDate, shiftTime, shiftDuration, clockIn, clockOut) {
  if (!clockIn) return false;
  const shiftStart = new Date(`${shiftDate}T${shiftTime || "00:00"}:00`);
  const shiftEnd = new Date(shiftStart.getTime() + (shiftDuration || 8) * 3600000);
  const entryStart = parseISO(clockIn);
  const entryEnd = clockOut ? parseISO(clockOut) : new Date();
  return entryStart < shiftEnd && entryEnd > shiftStart;
}

// Returns the total actual hours for a time entry (not clamped to shift window)
function entryTotalHours(clockIn, clockOut) {
  if (!clockIn) return 0;
  const entryStart = parseISO(clockIn);
  const entryEnd = clockOut ? parseISO(clockOut) : new Date();
  const mins = differenceInMinutes(entryEnd, entryStart);
  return Math.max(0, mins / 60);
}

// Kept for any legacy references (not used in main logic anymore)
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
  const [orderItems, setOrderItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rates, setRates] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [baseMixShifts, setBaseMixShifts] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [supplyPrices, setSupplyPrices] = useState([]);
  const [baseMixDefaults, setBaseMixDefaults] = useState([]);
  const [matDefaults, setMatDefaults] = useState([]);
  const [jugDefaults, setJugDefaults] = useState([]);
  const [flavorPrices, setFlavorPrices] = useState([]);
  const [loading, setLoading] = useState(false);

  // Rates UI state
  const [ratesUnlocked, setRatesUnlocked] = useState(false);
  const [ratesPwInput, setRatesPwInput] = useState("");
  const [ratesPwError, setRatesPwError] = useState("");
  const [editingRateId, setEditingRateId] = useState(null);
  const [editRateVal, setEditRateVal] = useState("");

  // Orders UI state — per item pricing
  const [pricingItemId, setPricingItemId] = useState(null); // item id being priced
  const [priceInput, setPriceInput] = useState("");

  // Analytics period
  const [period, setPeriod] = useState("all");
  // Shift type filter (used in both Shifts tab and Analytics tab)
  const [shiftTypeFilter, setShiftTypeFilter] = useState("all"); // "all" | "production" | "basemix"
  // ROI display mode: false = predicted revenue / cost, true = cost / predicted revenue
  const [reverseRoi, setReverseRoi] = useState(false);

  function handleUnlock() {
    if (pwInput !== "ecap") { setPwError("Incorrect password."); return; }
    setUnlocked(true);
    loadData();
  }

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    const [ord, oi, emps, rt, sh, bms, te, fs, sp, bmd, mdef, jdef, fp] = await Promise.all([
      base44.entities.OrderPickup.list("-pickup_date", 500),
      base44.entities.OrderPickupItem.list().catch(() => []),
      base44.entities.Employee.list("name"),
      base44.entities.EmployeeRate.list(),
      base44.entities.Shift.list("-shift_date", 500),
      base44.entities.BaseMixingShift.list("-shift_date", 500),
      base44.entities.TimeEntry.list("-clock_in", 2000),
      base44.entities.FlavorSet.list("name"),
      base44.entities.SupplyPrice.list(),
      base44.entities.BaseMixDefaults.list(),
      base44.entities.MaterialDefaults.list(),
      base44.entities.FlavorJugDefaults.list(),
      base44.entities.FlavorPrice.list(),
    ]);
    // Migrate legacy orders: create items for any order that has a flavorset_id but no items
    const legacyOrders = ord.filter((o) => o.flavorset_id && !oi.some((i) => i.order_id === o.id));
    const migratedItems = await Promise.all(legacyOrders.map((o) =>
      base44.entities.OrderPickupItem.create({
        order_id: o.id,
        item_type: "flavorset",
        flavorset_id: o.flavorset_id,
        pallets: o.pallets || 0,
        cases: o.cases || 0,
        case_sell_price: o.case_sell_price || 0,
      }).catch(() => null)
    ));
    const allItems = [...oi, ...migratedItems.filter(Boolean)];
    setOrders(ord);
    setOrderItems(allItems);
    setEmployees(emps);
    setRates(rt);
    setShifts(sh);
    setBaseMixShifts(bms);
    setTimeEntries(te);
    setFlavorSets(fs);
    setSupplyPrices(sp);
    setBaseMixDefaults(bmd);
    setMatDefaults(mdef);
    setJugDefaults(jdef);
    setFlavorPrices(fp);
    setLoading(false);
  }

  useAutoRefresh(() => { if (unlocked) loadData(false); });

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

  // Helper: total revenue for an order (items-based or legacy)
  function orderRevenue(order) {
    const items = orderItems.filter((i) => i.order_id === order.id);
    if (items.length > 0) {
      return items.reduce((sum, i) => sum + (i.case_sell_price || 0) * Math.round(i.cases || 0), 0);
    }
    // Legacy
    return (order.case_sell_price || 0) * Math.round(order.cases || 0);
  }

  function orderTotalCases(order) {
    const items = orderItems.filter((i) => i.order_id === order.id);
    if (items.length > 0) return items.reduce((sum, i) => sum + Math.round(i.cases || 0), 0);
    return Math.round(order.cases || 0);
  }

  async function handlePriceItem(item, orderId) {
    const price = parseFloat(priceInput);
    if (!price || price <= 0) return;
    await base44.entities.OrderPickupItem.update(item.id, { case_sell_price: price });
    setOrderItems((prev) => prev.map((i) => i.id === item.id ? { ...i, case_sell_price: price } : i));
    // Check if all items for this order are priced now
    const updatedItems = orderItems.map((i) => i.id === item.id ? { ...i, case_sell_price: price } : i);
    const thisOrderItems = updatedItems.filter((i) => i.order_id === orderId);
    const allPriced = thisOrderItems.length > 0 && thisOrderItems.every((i) => i.case_sell_price > 0);
    if (allPriced) {
      await base44.entities.OrderPickup.update(orderId, { is_priced: true });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, is_priced: true } : o));
    }
    setPricingItemId(null);
    setPriceInput("");
  }

  async function handlePriceLegacyOrder(order) {
    // Legacy order with no items — price the order directly
    const price = parseFloat(priceInput);
    if (!price || price <= 0) return;
    await base44.entities.OrderPickup.update(order.id, { case_sell_price: price, is_priced: true });
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, case_sell_price: price, is_priced: true } : o));
    setPricingItemId(null);
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

  // Helper: get age for an employee at time of a shift
  function getEmpAge(empId) {
    const emp = empMap[empId];
    if (!emp?.birthday) return null;
    const today = new Date();
    const bDate = new Date(emp.birthday);
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;
    return age;
  }

  // Shift cost calculation
  // Labor hours come from actual clock-in time — the full clocked time is used
  // for every shift the employee is mentioned in on that day (no division across shifts).
  function getAttributedHours(te, shiftDate, shiftTime, shiftDuration) {
    if (!entryOverlapsShift(shiftDate, shiftTime, shiftDuration, te.clock_in, te.clock_out)) return 0;
    return entryTotalHours(te.clock_in, te.clock_out);
  }

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
    empIds = [...new Set(empIds)].filter(Boolean);

    let totalCost = 0;
    empIds.forEach((empId) => {
      const rate = getRateForEmp(empId);
      if (!rate) return;
      const age = getEmpAge(empId);
      const isMinor = age !== null && age < 15;
      const MINOR_MAX_HOURS = 3;

      // Find time entries overlapping this shift
      const emp = empMap[empId];
      const empEntries = timeEntries.filter((te) => te.employee_id === empId || te.employee_number === emp?.employee_number);
      const overlapping = empEntries.filter((te) => entryOverlapsShift(shiftDate, shiftTime, shiftDuration, te.clock_in, te.clock_out));

      let hours;
      if (overlapping.length > 0) {
        // Use the employee's full clocked-in time for this shift
        hours = overlapping.reduce((sum, te) => sum + getAttributedHours(te, shiftDate, shiftTime, shiftDuration), 0);
      } else {
        // No clock-in found — fall back to shift duration
        hours = shiftDuration;
      }

      // Apply 3-hour cap for minors under 15
      if (isMinor) hours = Math.min(hours, MINOR_MAX_HOURS);
      totalCost += hours * rate;
    });
    return totalCost;
  }

  // Base mix ingredient costs are now counted in production shifts (calcProductionSupplyCost)
  // to avoid double-counting. Base mix shifts show labor cost only.
  function calcBaseMixSupplyCost(shift) {
    return 0;
  }

  // Helper: get per-oz price for a specific flavor (uses FlavorPrice if available, else falls back to global flavor_case)
  function getFlavorPricePerOz(flavorId) {
    const fp = flavorPrices.find((p) => p.flavor_id === flavorId);
    if (fp) {
      // If price_per_oz is set directly, use it
      if (fp.price_per_oz && fp.price_per_oz > 0) return fp.price_per_oz;
      // Otherwise derive from container price ÷ container oz
      if (fp.price_per_container && fp.container_oz && fp.container_oz > 0) {
        return fp.price_per_container / fp.container_oz;
      }
    }
    // Fallback: global flavor_case price (1 case = 4 gal = 512 oz)
    const globalRec = supplyPrices.find((p) => p.item_key === "flavor_case" && p.item_type === "flavoring");
    if (globalRec) return globalRec.price_per_unit / (4 * 128);
    return null;
  }

  // Supply cost for a production shift: base mix ingredients, flavoring, bags, box stacks, popsicle sticks, wrap
  function calcProductionSupplyCost(shift) {
    const totalCases = getTotalCases(shift);
    const ppCase = shift.popsicles_per_case || 144;
    let total = 0;

    // ── Base mix ingredients: gallons consumed × cost per gallon ──
    // Gallons consumed = popsicles produced ÷ popsicles per gallon
    const ppgShift = shift.popsicles_per_gallon || matDefaults.find((d) => d.material_key === "popsicles_per_gallon")?.qty_per_shift || 24;
    const gallonsConsumed = ppgShift > 0 ? (totalCases * ppCase) / ppgShift : 0;
    if (gallonsConsumed > 0) {
      let ingBatchCost = 0;
      let hasIngPrices = false;
      INGREDIENTS.forEach((ing) => {
        const ingPriceRec = supplyPrices.find((p) => p.item_key === ing.key && p.item_type === "ingredient");
        if (!ingPriceRec || !ingPriceRec.price_per_unit) return;
        const fsDefault = shift.flavorset_id ? baseMixDefaults.find((d) => d.ingredient === ing.key && d.flavorset_id === shift.flavorset_id) : null;
        const globalDefault = baseMixDefaults.find((d) => d.ingredient === ing.key && !d.flavorset_id);
        const amtPerBatch = fsDefault ? fsDefault.amount_per_batch : (globalDefault ? globalDefault.amount_per_batch : 0);
        if (amtPerBatch > 0) { ingBatchCost += amtPerBatch * ingPriceRec.price_per_unit; hasIngPrices = true; }
      });
      if (hasIngPrices) total += gallonsConsumed * (ingBatchCost / GALLONS_PER_BATCH);
    }

    // ── Flavoring: starting gallons per flavor × oz/gal × per-flavor price/oz ──
    const flavorGallonFields = [
      { gallons: shift.starting_gallons_flavor_1, flavorId: fsMap[shift.flavorset_id]?.flavor_1 },
      { gallons: shift.starting_gallons_flavor_2, flavorId: fsMap[shift.flavorset_id]?.flavor_2 },
      { gallons: shift.starting_gallons_flavor_3, flavorId: fsMap[shift.flavorset_id]?.flavor_3 },
      { gallons: shift.starting_gallons_flavor_4, flavorId: fsMap[shift.flavorset_id]?.flavor_4 },
      { gallons: shift.individual_flavor_1_cases, flavorId: shift.individual_flavor_1 },
      { gallons: shift.individual_flavor_2_cases, flavorId: shift.individual_flavor_2 },
      { gallons: shift.individual_flavor_3_cases, flavorId: shift.individual_flavor_3 },
      { gallons: shift.individual_flavor_4_cases, flavorId: shift.individual_flavor_4 },
    ];
    flavorGallonFields.forEach(({ gallons, flavorId }) => {
      if (!gallons || !flavorId) return;
      const jugDefault = jugDefaults.find((d) => d.flavor_id === flavorId);
      const ozPerGal = jugDefault?.oz_per_gallon_base || 0;
      const pricePerOz = getFlavorPricePerOz(flavorId);
      if (pricePerOz && ozPerGal > 0) {
        total += gallons * ozPerGal * pricePerOz;
      } else if (pricePerOz) {
        // No oz/gal default — use gallons × 128 oz/gal as fallback
        total += gallons * 128 * pricePerOz;
      }
    });

    // ── Bags: bags_per_case (popsicle case) bags per case produced, ÷ bags_per_bag_case (empty bag case) = cases of bags purchased ──
    const bagCasePriceRec = supplyPrices.find((p) => p.item_key === "bag_case" && p.item_type === "bags");
    if (bagCasePriceRec && totalCases > 0) {
      const bagsPerPopCase = matDefaults.find((d) => d.material_key === "bags_per_case")?.qty_per_shift || 12;
      const bagsPerBagCase = matDefaults.find((d) => d.material_key === "bags_per_bag_case")?.qty_per_shift || 1000;
      const bagsUsed = totalCases * bagsPerPopCase;
      const bagCasesUsed = bagsUsed / bagsPerBagCase;
      total += bagCasesUsed * bagCasePriceRec.price_per_unit;
    }

    // ── Box stacks (cases): totalCases ÷ cases_per_stack × price per stack ──
    const boxStackPriceRec = supplyPrices.find((p) => p.item_key === "box_stacks" && p.item_type === "material");
    const casesPerStack = matDefaults.find((d) => d.material_key === "box_stacks")?.qty_per_shift || 0;
    if (boxStackPriceRec && casesPerStack > 0 && totalCases > 0) {
      const stacksUsed = totalCases / casesPerStack;
      total += stacksUsed * boxStackPriceRec.price_per_unit;
    }

    // ── Popsicle sticks: totalCases × popsicles_per_case ÷ sticks_per_box × price_per_box ──
    const stickPriceRec = supplyPrices.find((p) => p.item_key === "popsicle_sticks" && p.item_type === "material");
    const sticksPerBox = matDefaults.find((d) => d.material_key === "popsicle_sticks")?.qty_per_shift || 0;
    if (stickPriceRec && sticksPerBox > 0 && totalCases > 0) {
      const sticksUsed = totalCases * ppCase;
      const boxesUsed = sticksUsed / sticksPerBox;
      total += boxesUsed * stickPriceRec.price_per_unit;
    }

    // ── Wrap (individual + clear): use qty_per_shift defaults if set × price ──
    ["individual_wrap", "clear_wrap"].forEach((key) => {
      const priceRec = supplyPrices.find((p) => p.item_key === key && p.item_type === "material");
      const defRec = matDefaults.find((d) => d.material_key === key);
      if (priceRec && defRec?.qty_per_shift > 0) {
        total += defRec.qty_per_shift * priceRec.price_per_unit;
      }
    });

    return total;
  }

  // Waste cost estimate for a production shift (includes downtime labor cost)
  function calcWasteInfo(shift) {
    const wasteGallons = shift.waste || 0;
    const downtimeHours = parseDowntimeHours(shift.downtime);

    // Crew hourly labor rate — used to cost downtime (paid time with no production)
    let crewHourlyRate = 0;
    {
      let empIds = [];
      [shift.filling_employee, shift.pulling_employee_1, shift.pulling_employee_2, shift.pulling_employee_3,
       shift.sorting_employee, shift.bagging_employee, shift.boxing_employee, shift.shift_lead].forEach((id) => { if (id) empIds.push(id); });
      if (shift.training_employees) empIds.push(...shift.training_employees);
      empIds = [...new Set(empIds)].filter(Boolean);
      crewHourlyRate = empIds.reduce((sum, id) => sum + getRateForEmp(id), 0);
    }
    const downtimeLaborCost = downtimeHours > 0 && crewHourlyRate > 0 ? downtimeHours * crewHourlyRate : null;

    // ── Downtime lost production: cases not made = shift speed (cases/hr) × downtime ──
    // Value of product not made = cases lost × avg case sell price
    let downtimeCasesLost = null;
    let downtimeProductValue = null;
    if (downtimeHours > 0) {
      const shiftHours = shift.shift_duration || 8;
      const shiftCases = getTotalCases(shift);
      const speed = shiftHours > 0 ? shiftCases / shiftHours : 0;
      downtimeCasesLost = speed * downtimeHours;
      const pricedOrders = orders.filter((o) => o.is_priced && o.case_sell_price > 0);
      if (pricedOrders.length > 0 && downtimeCasesLost > 0) {
        const avgCasePrice = pricedOrders.reduce((sum, o) => sum + o.case_sell_price, 0) / pricedOrders.length;
        downtimeProductValue = downtimeCasesLost * avgCasePrice;
      }
    }

    if (!wasteGallons && downtimeHours <= 0) return null;

    const ppg = shift.popsicles_per_gallon || 24; // popsicles per gallon (mold size)
    const popWasted = Math.round(wasteGallons * ppg);

    // ── Base mix ingredient cost per wasted gallon ──
    // Sum (amount_per_batch × price_per_unit) across all ingredients using global defaults,
    // then divide by gallons per batch (each batch = 240 gal) to get cost per gallon.
    const GALLONS_PER_BATCH = 240;
    let ingCostPerGallon = null;
    {
      let batchCost = 0;
      let hasAnyIngPrice = false;
      INGREDIENTS.forEach((ing) => {
        const priceRec = supplyPrices.find((p) => p.item_key === ing.key && p.item_type === "ingredient");
        if (!priceRec) return;
        const fsDefault = shift.flavorset_id
          ? baseMixDefaults.find((d) => d.ingredient === ing.key && d.flavorset_id === shift.flavorset_id)
          : null;
        const globalDefault = baseMixDefaults.find((d) => d.ingredient === ing.key && !d.flavorset_id);
        const amtPerBatch = fsDefault ? fsDefault.amount_per_batch : (globalDefault ? globalDefault.amount_per_batch : 0);
        if (amtPerBatch > 0) {
          batchCost += amtPerBatch * priceRec.price_per_unit;
          hasAnyIngPrice = true;
        }
      });
      if (hasAnyIngPrice) ingCostPerGallon = batchCost / GALLONS_PER_BATCH;
    }
    const ingWasteCost = ingCostPerGallon != null ? wasteGallons * ingCostPerGallon : null;

    // ── Flavor jug cost per wasted gallon ──
    // Average cost per oz across the flavors used, weighted by oz/gal default
    let flavorWasteCost = null;
    {
      // Collect flavors used in this shift
      const usedFlavorIds = [
        shift.individual_flavor_1, shift.individual_flavor_2,
        shift.individual_flavor_3, shift.individual_flavor_4,
      ].filter(Boolean);
      const fs = fsMap[shift.flavorset_id];
      if (fs) {
        [fs.flavor_1, fs.flavor_2, fs.flavor_3, fs.flavor_4].forEach((fid) => { if (fid && !usedFlavorIds.includes(fid)) usedFlavorIds.push(fid); });
      }
      // For each flavor, compute oz_per_gal × price_per_oz
      const costPerGalSamples = usedFlavorIds.map((fid) => {
        const ozPerGal = jugDefaults.find((d) => d.flavor_id === fid)?.oz_per_gallon_base || 0;
        const pricePerOz = getFlavorPricePerOz(fid);
        if (ozPerGal > 0 && pricePerOz) return ozPerGal * pricePerOz;
        return null;
      }).filter((v) => v != null);

      if (costPerGalSamples.length > 0) {
        const avgCostPerGal = costPerGalSamples.reduce((a, b) => a + b, 0) / costPerGalSamples.length;
        flavorWasteCost = wasteGallons * avgCostPerGal;
      } else {
        // Absolute fallback: global flavor_case price per gallon
        const globalRec = supplyPrices.find((p) => p.item_key === "flavor_case" && p.item_type === "flavoring");
        if (globalRec) flavorWasteCost = wasteGallons * (globalRec.price_per_unit / 4);
      }
    }

    // ── Popsicle stick cost: price per box ÷ sticks per box × popsicles wasted ──
    const stickDef = matDefaults.find((d) => d.material_key === "popsicle_sticks");
    const sticksPerBox = stickDef?.qty_per_shift || null;
    const stickPriceRec = supplyPrices.find((p) => p.item_key === "popsicle_sticks" && p.item_type === "material");
    const costPerStick = (sticksPerBox && stickPriceRec) ? stickPriceRec.price_per_unit / sticksPerBox : null;
    const stickWasteCost = costPerStick != null ? popWasted * costPerStick : null;

    // ── Total (waste materials + downtime labor + lost product value) ──
    const components = [ingWasteCost, flavorWasteCost, stickWasteCost, downtimeLaborCost, downtimeProductValue].filter((v) => v != null);
    const totalWasteCost = components.length > 0 ? components.reduce((a, b) => a + b, 0) : null;

    return {
      wasteGallons,
      popWasted,
      sticksPerBox,
      stickBoxesWasted: sticksPerBox ? popWasted / sticksPerBox : null,
      ingWasteCost,
      flavorWasteCost,
      stickWasteCost,
      downtimeHours,
      downtimeLaborCost,
      downtimeCasesLost,
      downtimeProductValue,
      totalWasteCost,
    };
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
  const totalBaseMixSupplyCost = analyticsBaseMix.reduce((sum, s) => sum + calcBaseMixSupplyCost(s), 0);
  const totalProductionSupplyCost = analyticsShifts.reduce((sum, s) => sum + calcProductionSupplyCost(s), 0);
  const totalSupplyCost = totalBaseMixSupplyCost + totalProductionSupplyCost;
  const totalShiftCount = allShiftCosts.length + allBaseMixCosts.length;
  const avgShiftCost = totalShiftCount > 0 ? totalShiftCost / totalShiftCount : 0;
  const totalCasesProduced = analyticsShifts.reduce((sum, s) => sum + getTotalCases(s), 0);
  const avgLaborPerCase = totalCasesProduced > 0 ? totalShiftCost / totalCasesProduced : 0;
  const avgTotalCostPerCase = totalCasesProduced > 0 ? (totalShiftCost + totalSupplyCost) / totalCasesProduced : 0;
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + orderRevenue(o), 0);
  const totalCasesSold = filteredOrders.reduce((sum, o) => sum + orderTotalCases(o), 0);
  const avgSalePricePerCase = totalCasesSold > 0 ? totalRevenue / totalCasesSold : null;

  // Avg cases/hour across filtered production shifts
  const totalProductionHours = analyticsShifts.reduce((sum, s) => sum + (s.shift_duration || 0), 0);
  const avgCasesPerHour = totalProductionHours > 0 ? totalCasesProduced / totalProductionHours : 0;

  // Avg wholesale revenue per hour: total revenue / total production hours
  const avgRevenuePerHour = totalProductionHours > 0 ? totalRevenue / totalProductionHours : 0;

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
        <TabsList className="mb-6 flex flex-wrap gap-1 h-auto w-full">
          <TabsTrigger value="new-orders" className="text-[11px] sm:text-sm px-2 truncate">New</TabsTrigger>
          <TabsTrigger value="previous-orders" className="text-[11px] sm:text-sm px-2 truncate">Orders</TabsTrigger>
          <TabsTrigger value="employees" className="text-[11px] sm:text-sm px-2 truncate">Staff</TabsTrigger>
          <TabsTrigger value="shifts" className="text-[11px] sm:text-sm px-2 truncate">Shifts</TabsTrigger>
          <TabsTrigger value="supplies" className="text-[11px] sm:text-sm px-2 truncate">Supplies</TabsTrigger>
          <TabsTrigger value="breakdown" className="text-[11px] sm:text-sm px-2 truncate">Breakdown</TabsTrigger>
          <TabsTrigger value="analytics" className="text-[11px] sm:text-sm px-2 truncate">Analytics</TabsTrigger>
        </TabsList>

        {/* ===== NEW ORDERS ===== */}
        <TabsContent value="new-orders">
          <p className="text-sm text-muted-foreground mb-4">Orders awaiting pricing. Set a price per case for each item.</p>
          {newOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No new orders — all orders have been priced.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {newOrders.map((o) => {
                const items = orderItems.filter((i) => i.order_id === o.id);
                return (
                  <div key={o.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="mb-3">
                      <p className="font-heading font-semibold">{o.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">{o.pickup_date}{o.notes ? ` · ${o.notes}` : ""}</p>
                    </div>
                    {/* Items */}
                    {items.length > 0 ? (
                      <div className="space-y-3">
                        {items.map((item) => {
                          const fs = fsMap[item.flavorset_id];
                          const fl = flavorSets.length > 0 ? null : null; // flavors not loaded here, show id fallback
                          const label = item.item_type === "flavorset" ? (fs?.name || "Flavorset") : (item.flavor_id ? `Flavor #${item.flavor_id.slice(-4)}` : "Individual");
                          const color = fs?.color;
                          const isPricingThis = pricingItemId === item.id;
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-3 flex-wrap bg-muted/40 rounded-xl px-4 py-3">
                              <div>
                                <p className="text-sm font-medium flex items-center gap-1.5">
                                  {color && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />}
                                  {label}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.pallets > 0 ? `${item.pallets} pal · ` : ""}{Math.round(item.cases || 0)} cases
                                  {item.case_sell_price > 0 && <span className="text-primary font-medium ml-1">· ${item.case_sell_price}/case ✓</span>}
                                </p>
                              </div>
                              {isPricingThis ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={priceInput}
                                      onChange={(e) => setPriceInput(e.target.value)} className="pl-7 w-28" autoFocus
                                      onKeyDown={(e) => e.key === "Enter" && handlePriceItem(item, o.id)} />
                                  </div>
                                  <span className="text-xs text-muted-foreground">per case</span>
                                  {priceInput && <span className="text-xs font-medium text-primary">= ${(parseFloat(priceInput) * Math.round(item.cases || 0)).toFixed(2)}</span>}
                                  <Button size="sm" onClick={() => handlePriceItem(item, o.id)} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setPricingItemId(null); setPriceInput(""); }}><X className="w-3 h-3" /></Button>
                                </div>
                              ) : (
                                <Button size="sm" variant={item.case_sell_price > 0 ? "outline" : "default"} className="gap-1 text-xs"
                                  onClick={() => { setPricingItemId(item.id); setPriceInput(item.case_sell_price > 0 ? String(item.case_sell_price) : ""); }}>
                                  <DollarSign className="w-3 h-3" /> {item.case_sell_price > 0 ? "Edit Price" : "Set Price"}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Legacy order — no items, price the whole order */
                      <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/40 rounded-xl px-4 py-3">
                        <p className="text-sm text-muted-foreground">
                          {fsMap[o.flavorset_id]?.name || "Unknown"} · {o.pallets} pal · {Math.round(o.cases || 0)} cases
                        </p>
                        {pricingItemId === o.id ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                              <Input type="number" min="0" step="0.01" placeholder="0.00" value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)} className="pl-7 w-28" autoFocus
                                onKeyDown={(e) => e.key === "Enter" && handlePriceLegacyOrder(o)} />
                            </div>
                            <span className="text-xs text-muted-foreground">per case</span>
                            <Button size="sm" onClick={() => handlePriceLegacyOrder(o)} className="gap-1"><Check className="w-3 h-3" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => { setPricingItemId(null); setPriceInput(""); }}><X className="w-3 h-3" /></Button>
                          </div>
                        ) : (
                          <Button size="sm" className="gap-1 text-xs" onClick={() => { setPricingItemId(o.id); setPriceInput(""); }}>
                            <DollarSign className="w-3 h-3" /> Set Price
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
              {prevOrders.map((o) => {
                const items = orderItems.filter((i) => i.order_id === o.id);
                const rev = orderRevenue(o);
                const totalCs = orderTotalCases(o);
                return (
                  <div key={o.id} className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                      <div>
                        <p className="font-heading font-semibold">{o.vendor_name}</p>
                        <p className="text-xs text-muted-foreground">{o.pickup_date} · {totalCs} cases total</p>
                        {o.notes && <p className="text-xs text-muted-foreground">{o.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-heading font-bold text-primary text-lg">{fmt$(rev)}</p>
                        <p className="text-xs text-muted-foreground">{totalCs} cases</p>
                      </div>
                    </div>
                    {/* Items breakdown */}
                    {items.length > 0 ? (
                      <div className="space-y-1 mt-2">
                        {items.map((item) => {
                          const fs = fsMap[item.flavorset_id];
                          const label = item.item_type === "flavorset" ? (fs?.name || "Flavorset") : (item.flavor_id ? `Flavor #${item.flavor_id.slice(-4)}` : "Individual");
                          const color = fs?.color;
                          return (
                            <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                              <span className="flex items-center gap-1.5">
                                {color && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />}
                                {label} · {Math.round(item.cases || 0)} cases
                              </span>
                              <span className="font-medium text-foreground">
                                {fmt$(item.case_sell_price)}/case = {fmt$((item.case_sell_price || 0) * Math.round(item.cases || 0))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : o.flavorset_id ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        {fsMap[o.flavorset_id]?.name} · {fmt$(o.case_sell_price)}/case
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div className="bg-muted rounded-2xl p-4 flex justify-between items-center">
                <p className="font-medium">Total Revenue (all time)</p>
                <p className="font-heading font-bold text-xl text-primary">{fmt$(prevOrders.reduce((sum, o) => sum + orderRevenue(o), 0))}</p>
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
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex gap-2">
              {[{ key: "all", label: "All Shifts" }, { key: "production", label: "Production" }, { key: "basemix", label: "Base Mix" }].map((t) => (
                <button key={t.key} onClick={() => setShiftTypeFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${shiftTypeFilter === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs whitespace-nowrap transition-colors ${!reverseRoi ? "text-foreground font-medium" : "text-muted-foreground"}`}>Rev / Cost</span>
              <Switch checked={reverseRoi} onCheckedChange={setReverseRoi} aria-label="Toggle ROI calculation order" />
              <span className={`text-xs whitespace-nowrap transition-colors ${reverseRoi ? "text-foreground font-medium" : "text-muted-foreground"}`}>Cost / Rev</span>
            </div>
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
                const laborCost = calcShiftCost(shift, isBaseMix);
                const supplyCost = isBaseMix ? calcBaseMixSupplyCost(shift) : calcProductionSupplyCost(shift);
                const cost = laborCost; // keep for profit ratio (labor only, consistent with before)
                const totalCost = laborCost + supplyCost;
                const cases = isBaseMix ? null : getTotalCases(shift);

                // Predicted revenue: avg case sell price * cases produced
                const pricedOrders = orders.filter((o) => o.is_priced && o.case_sell_price > 0);
                const avgCasePrice = pricedOrders.length > 0
                  ? pricedOrders.reduce((sum, o) => sum + o.case_sell_price, 0) / pricedOrders.length
                  : null;
                const predictedRevenue = (!isBaseMix && cases > 0 && avgCasePrice) ? avgCasePrice * cases : null;
                const profitRatio = (predictedRevenue && totalCost > 0) ? predictedRevenue / totalCost : null;
                const laborRatio = (predictedRevenue && laborCost > 0) ? predictedRevenue / laborCost : null;

                function roiColor(r) {
                  if (r === null) return null;
                  return r >= 5.0 ? "bg-purple-100 text-purple-800 border-purple-200"
                    : r >= 4.0 ? "bg-green-100 text-green-800 border-green-200"
                    : r >= 2.0 ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                    : r >= 1.0 ? "bg-orange-100 text-orange-800 border-orange-200"
                    : "bg-red-100 text-red-800 border-red-200";
                }
                function roiDot(r) {
                  if (r === null) return null;
                  return r >= 5.0 ? "bg-purple-500" : r >= 4.0 ? "bg-green-500" : r >= 2.0 ? "bg-yellow-500" : r >= 1.0 ? "bg-orange-500" : "bg-red-500";
                }
                function roiLabel(r) {
                  if (r === null) return null;
                  return r >= 5.0 ? "Extremely High ROI" : r >= 4.0 ? "High ROI" : r >= 2.0 ? "Good ROI" : r >= 1.0 ? "Low ROI" : "Unprofitable";
                }

                const profitColor = roiColor(profitRatio);
                const profitDot = roiDot(profitRatio);
                const profitLabel = roiLabel(profitRatio);
                const profitPct = profitRatio !== null ? `${Math.round(reverseRoi ? (1 / profitRatio) * 100 : profitRatio * 100)}%` : null;

                const laborColor = roiColor(laborRatio);
                const laborDot = roiDot(laborRatio);
                const laborLabel = roiLabel(laborRatio);
                const laborPct = laborRatio !== null ? `${Math.round(reverseRoi ? (1 / laborRatio) * 100 : laborRatio * 100)}%` : null;

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
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div>
                        <p className="font-heading font-semibold flex items-center gap-2 flex-wrap">
                          {fsMap[shift.flavorset_id]?.color && <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: fsMap[shift.flavorset_id].color }} />}
                          {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{isBaseMix ? "Base Mix" : "Production"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{shift.shift_time} · {shift.shift_duration}h{cases != null ? ` · ${cases} cases` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading font-bold text-xl text-primary">{totalCost > 0 ? fmt$(totalCost) : "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmt$(laborCost)} labor{supplyCost > 0 ? ` + ${fmt$(supplyCost)} supplies` : ""}
                        </p>
                        {predictedRevenue && (
                          <p className="text-xs text-muted-foreground mt-0.5">~{fmt$(predictedRevenue)} predicted rev.</p>
                        )}
                      </div>
                    </div>
                    {(profitColor || laborColor) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {profitColor && (
                          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${profitColor}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${profitDot}`} />
                            {profitLabel} · {profitPct}
                          </div>
                        )}
                        {laborColor && (
                          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${laborColor}`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${laborDot}`} />
                            Labor only · {laborPct}
                          </div>
                        )}
                      </div>
                    )}
                    {empIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {empIds.map((id) => {
                          const emp = empMap[id];
                          const rate = getRateForEmp(id);
                          const empEntries = timeEntries.filter((te) => te.employee_id === id || te.employee_number === emp?.employee_number);
                          const overlapping = empEntries.filter((te) => entryOverlapsShift(shift.shift_date, shift.shift_time || "06:00", shift.shift_duration || 8, te.clock_in, te.clock_out));
                          const usedDuration = overlapping.length === 0;
                          let finalHrs = usedDuration
                            ? (shift.shift_duration || 8)
                            : overlapping.reduce((sum, te) => sum + getAttributedHours(te, shift.shift_date, shift.shift_time || "06:00", shift.shift_duration || 8), 0);
                          const empAge = getEmpAge(id);
                          const isEmpMinor = empAge !== null && empAge < 15;
                          const wasCapped = isEmpMinor && finalHrs > 3;
                          if (isEmpMinor) finalHrs = Math.min(finalHrs, 3);
                          const displayName = emp?.name || `Emp #${id.slice(-4)}`;
                          return (
                            <span key={id} className="text-xs px-2 py-1 bg-muted rounded-lg flex items-center gap-1">
                              {displayName}
                              {isEmpMinor && <span className="inline-flex items-center text-[9px] px-1 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: "#7dd3fc" }}>&lt;15</span>}
                              · {fmtHours(finalHrs)}{usedDuration ? " (est)" : ""}{wasCapped ? " (capped)" : ""} · {rate > 0 ? fmt$(finalHrs * rate) : "no rate"}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {/* Waste estimate — production shifts only (includes downtime labor) */}
                    {!isBaseMix && (() => {
                      const w = calcWasteInfo(shift);
                      if (!w) return null;
                      const hasMaterialWaste = w.wasteGallons > 0;
                      return (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-400" /> Waste Estimate
                            </p>
                            {w.totalWasteCost != null && (
                              <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full">
                                ~{fmt$(w.totalWasteCost)} total waste cost
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {hasMaterialWaste && (
                              <span className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg">
                                {w.wasteGallons} gal wasted
                              </span>
                            )}
                            {hasMaterialWaste && (
                              <span className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg">
                                ~{w.popWasted} popsicles lost
                              </span>
                            )}
                            {hasMaterialWaste && w.sticksPerBox && (
                              <span className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg">
                                ~{w.popWasted} sticks ({w.stickBoxesWasted.toFixed(2)} boxes)
                              </span>
                            )}
                            {hasMaterialWaste && w.ingWasteCost != null && (
                              <span className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg">
                                ~{fmt$(w.ingWasteCost)} base mix
                              </span>
                            )}
                            {hasMaterialWaste && w.flavorWasteCost != null && (
                              <span className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg">
                                ~{fmt$(w.flavorWasteCost)} flavoring
                              </span>
                            )}
                            {hasMaterialWaste && w.stickWasteCost != null && (
                              <span className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg">
                                ~{fmt$(w.stickWasteCost)} sticks
                              </span>
                            )}
                            {w.downtimeHours > 0 && (
                              <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg">
                                {fmtHours(w.downtimeHours)} downtime
                              </span>
                            )}
                            {w.downtimeLaborCost != null && (
                              <span className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg">
                                ~{fmt$(w.downtimeLaborCost)} downtime labor
                              </span>
                            )}
                            {w.downtimeCasesLost != null && w.downtimeCasesLost > 0 && (
                              <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg">
                                ~{w.downtimeCasesLost.toFixed(1)} cases not made
                              </span>
                            )}
                            {w.downtimeProductValue != null && (
                              <span className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-lg">
                                ~{fmt$(w.downtimeProductValue)} lost product
                              </span>
                            )}
                          </div>
                          {shift.downtime && (
                            <p className="text-xs text-muted-foreground italic mt-1.5">{shift.downtime}</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
          </div>
        </TabsContent>

        {/* ===== SUPPLIES ===== */}
        <TabsContent value="supplies">
          <SuppliesPricingTab />
        </TabsContent>

        {/* ===== BREAKDOWN ===== */}
        <TabsContent value="breakdown">
          <CostBreakdownTab />
        </TabsContent>

        {/* ===== ANALYTICS ===== */}
        <TabsContent value="analytics">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <span className="font-semibold">Disclaimer:</span> All financial figures in this app are based on <span className="font-semibold">estimates and approximations</span> (labor hours, case counts, pricing). Before making any conclusive financial decisions, all administrators should consult verified financial records and statistics outside of this application.
            </p>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Total Labor Cost", value: fmt$(totalShiftCost), sub: `${totalShiftCount} shifts` },
              { label: "Total Supply Cost", value: fmt$(totalSupplyCost), sub: "production + base mix materials" },
              { label: "Total Combined Cost", value: fmt$(totalShiftCost + totalSupplyCost), sub: "labor + all supplies" },
              { label: "Avg Labor Cost Per Shift", value: fmt$(avgShiftCost), sub: shiftTypeFilter === "all" ? "production + base mix" : shiftTypeFilter === "production" ? "production only" : "base mix only" },
              { label: "Avg Labor Per Case", value: shiftTypeFilter === "basemix" ? "—" : fmt$(avgLaborPerCase), sub: `${totalCasesProduced} cases produced` },
              { label: "Avg Total Cost Per Case", value: shiftTypeFilter === "basemix" ? "—" : fmt$(avgTotalCostPerCase), sub: "labor + supplies" },
              { label: "Total Sales Revenue", value: fmt$(totalRevenue), sub: `${totalCasesSold} cases sold` },
              { label: "Avg Sale Price Per Case", value: avgSalePricePerCase != null ? fmt$(avgSalePricePerCase) : "—", sub: "revenue ÷ cases sold" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-2xl border border-border p-5">
                <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                <p className="font-heading font-bold text-2xl text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
          {/* Production rate & revenue rate card */}
          {shiftTypeFilter !== "basemix" && (
            <div className="bg-card rounded-2xl border border-border p-5 mb-8">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Production Rate vs. Wholesale Revenue Rate</p>
                  <div className="flex flex-wrap items-end gap-6 mt-2">
                    <div>
                      <p className="font-heading font-bold text-2xl text-primary">
                        {avgCasesPerHour > 0 ? `${avgCasesPerHour.toFixed(1)} cases/hr` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg cases per hour</p>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-2xl" style={{ color: "hsl(var(--chart-3))" }}>
                        {avgRevenuePerHour > 0 ? `${fmt$(avgRevenuePerHour)}/hr` : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Avg wholesale revenue per hour</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 max-w-xs">
                  <span className="text-amber-500 text-sm flex-shrink-0">💡</span>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    These are <span className="font-semibold">wholesale numbers before any costs</span> (labor, ingredients, overhead) are deducted.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Based on {totalProductionHours.toFixed(1)} total production hours and {totalCasesSold} cases sold in this period.</p>
            </div>
          )}
          {totalRevenue > 0 && (totalShiftCost > 0 || totalSupplyCost > 0) && (
            <div className="bg-card rounded-2xl border border-border p-5 mb-6">
              <p className="text-sm font-medium mb-3">Profit Estimate</p>
              <div className="flex flex-wrap gap-6 mb-3">
                <div>
                  <p className="font-heading font-bold text-3xl" style={{ color: totalRevenue - totalShiftCost >= 0 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))" }}>
                    {fmt$(totalRevenue - totalShiftCost)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">After labor only</p>
                </div>
                {totalSupplyCost > 0 && (
                  <div>
                    <p className="font-heading font-bold text-3xl" style={{ color: totalRevenue - totalShiftCost - totalSupplyCost >= 0 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))" }}>
                      {fmt$(totalRevenue - totalShiftCost - totalSupplyCost)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">After labor + ingredients</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Based on {fmt$(totalRevenue)} revenue, {fmt$(totalShiftCost)} labor{totalSupplyCost > 0 ? `, ${fmt$(totalSupplyCost)} supplies` : ""}</p>
            </div>
          )}

          {/* ── Bar Charts ── */}
          {(() => {
            // Last 8 shifts (respecting type filter), oldest → newest
            const last8Shifts = [...analyticsShifts.map((s) => ({ ...s, _type: "production" })), ...analyticsBaseMix.map((s) => ({ ...s, _type: "basemix" }))]
              .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
              .slice(-8)
              .map((s) => ({
                label: new Date(s.shift_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) + (s._type === "basemix" ? " (BM)" : ""),
                cost: parseFloat(calcShiftCost(s, s._type === "basemix").toFixed(2)),
              }));

            // Last 8 priced orders, oldest → newest
            const last8Orders = [...filteredOrders]
              .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))
              .slice(-8)
              .map((o) => ({
                label: `${o.vendor_name?.slice(0, 10)}… ${o.pickup_date?.slice(5)}`,
                revenue: parseFloat(orderRevenue(o).toFixed(2)),
              }));

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-2xl border border-border p-5">
                  <p className="text-sm font-medium mb-4">Shift Cost — Last 8 Shifts</p>
                  {last8Shifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No shift data available.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={last8Shifts} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} width={55} />
                        <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, "Cost"]} contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }} />
                        <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-card rounded-2xl border border-border p-5">
                  <p className="text-sm font-medium mb-4">Order Revenue — Last 8 Orders</p>
                  {last8Orders.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No priced orders in this period.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={last8Orders} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} width={65} />
                        <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, "Revenue"]} contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }} />
                        <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}