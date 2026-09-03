import { useMemo, useState } from "react";
import { excludeShiftsWithTerminated, getTotalCases, getTraineeId } from "@/lib/analyticsHelpers";
import { Users, Trophy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PALLET_CASES = 66;
const GALLONS_PER_CASE = 3;

const STAT_OPTIONS = [
  { value: "pallets", label: "Pallets" },
  { value: "gallons", label: "Gallons" },
  { value: "molds", label: "Molds" },
  { value: "pops", label: "Pops" },
  { value: "bags", label: "Bags" },
  { value: "cases", label: "Cases" },
];

const POSITION_FIELDS = [
  "filling_employee",
  "pulling_employee_1",
  "pulling_employee_2",
  "pulling_employee_3",
  "sorting_employee",
  "bagging_employee",
  "boxing_employee",
  "shift_lead",
];

// Everyone who worked a shift together (all positions + training), sorted for a stable signature.
function getShiftCrew(shift) {
  const ids = new Set();
  POSITION_FIELDS.forEach((f) => { if (shift[f]) ids.add(shift[f]); });
  (shift.training_employees || []).forEach((t) => ids.add(getTraineeId(t)));
  return Array.from(ids).filter(Boolean).sort();
}

// A shift's total output for a given metric (whole-crew, not per-position).
function getShiftMetric(shift, statKey, pack) {
  const totalCases = getTotalCases(shift);
  const popsPerCase = pack.popsPerCase || 144;
  const popsPerMold = pack.popsPerMold || 24;
  const bagsPerCase = pack.bagsPerCase || 12;
  const totalPops = totalCases * popsPerCase;
  switch (statKey) {
    case "cases": return totalCases;
    case "pallets": return Math.floor(totalCases / PALLET_CASES);
    case "gallons": return totalCases * GALLONS_PER_CASE;
    case "molds": return popsPerMold > 0 ? totalPops / popsPerMold : 0;
    case "pops": return totalPops;
    case "bags": return totalCases * bagsPerCase;
    default: return 0;
  }
}

import InfoButton from "@/components/bigboy/InfoButton";

export default function MostValuableTeamCard({ shifts, employees, packConstants, avgCasePrice, info }) {
  const [stat, setStat] = useState("pallets");
  const empMap = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees]);

  const [selectedSig, setSelectedSig] = useState(null);

  // Any shift featuring a terminated employee is excluded from the data set entirely.
  const eligibleShifts = useMemo(
    () => excludeShiftsWithTerminated(shifts, employees),
    [shifts, employees]
  );

  // All recurring team combinations (same exact crew, 2+ shifts together),
  // ranked by the currently selected stat.
  const teams = useMemo(() => {
    const groups = {};
    eligibleShifts.forEach((shift) => {
      const ids = getShiftCrew(shift);
      if (ids.length < 2) return; // a team needs at least 2 members
      const sig = ids.join(",");
      if (!groups[sig]) groups[sig] = { ids, shifts: [] };
      groups[sig].shifts.push(shift);
    });

    return Object.values(groups)
      .filter((g) => g.shifts.length >= 2) // recurring team only
      .map((g) => {
        const totalCases = g.shifts.reduce((sum, s) => sum + getTotalCases(s), 0);
        // Pallets use the same math as the MVL: sum cases first, then divide by 66.
        const pallets = Math.floor(totalCases / PALLET_CASES);
        const total = stat === "pallets"
          ? pallets
          : g.shifts.reduce((sum, s) => sum + getShiftMetric(s, stat, packConstants), 0);
        return { sig: g.ids.join(","), ids: g.ids, shiftCount: g.shifts.length, totalCases, pallets, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [eligibleShifts, stat, packConstants]);

  const selected = teams.find((t) => t.sig === selectedSig) || teams[0] || null;
  const teamNames = (t) => t.ids.map((id) => empMap[id]?.name).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const statLabel = STAT_OPTIONS.find((o) => o.value === stat)?.label.toLowerCase() || stat;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-semibold text-lg">MVT — Most Valuable Team</h2>
        {info && <InfoButton {...info} />}
      </div>
      <p className="text-xs text-muted-foreground mb-4">All time · recurring crew with the highest combined output</p>
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-xs font-medium text-muted-foreground">Filter by stat</span>
          <Select value={stat} onValueChange={setStat}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {teams.length > 0 ? (
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Team combination</span>
            <Select value={selected.sig} onValueChange={setSelectedSig}>
              <SelectTrigger className="flex-1 min-w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.sig} value={t.sig} className="text-xs whitespace-normal">
                    {teamNames(t).join(", ")} — {t.shiftCount} shifts · {t.pallets} pallets
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {selected ? (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              {selected.ids
                .map((id) => empMap[id]?.name)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b))
                .map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
                    <Users className="w-3 h-3" />
                    {name}
                  </span>
                ))}
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-heading font-bold text-primary">{Math.round(selected.total).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{statLabel} combined</p>
                {avgCasePrice != null && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    {(selected.totalCases * avgCasePrice).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{selected.shiftCount} shifts together</p>
                <p className="text-xs text-muted-foreground">{selected.pallets.toLocaleString()} pallets completed together</p>
                <p className="text-xs text-muted-foreground">{selected.ids.length} crew members</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No recurring team yet — the same crew needs to work 2+ shifts together.</p>
        )}
      </div>
    </div>
  );
}