import { X, Package, Clock, Users, Layers, Wrench } from "lucide-react";
import { getTotalCases, getCasesPerHour } from "@/lib/analyticsHelpers";
import { Switch } from "@/components/ui/switch";
import { useRateUnit, formatRate } from "@/hooks/useRateUnit";

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-muted rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`font-heading font-bold text-2xl ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function ShiftStatsPanel({ shift, fsMap, empMap, matDefaults, onClose }) {
  const [isPpm, setIsPpm] = useRateUnit();

  if (!shift) return null;

  const totalCases = getTotalCases(shift);
  const cph = getCasesPerHour(shift);
  const rate = formatRate(cph, isPpm);
  const fs = fsMap[shift.flavorset_id];

  const positions = [
    shift.filling_employee,
    shift.pulling_employee_1,
    shift.pulling_employee_2,
    shift.pulling_employee_3,
    shift.sorting_employee,
    shift.bagging_employee,
    shift.boxing_employee,
    shift.shift_lead,
  ].filter(Boolean);
  const trainees = (shift.training_employees || []).map((t) => {
    const idx = t.indexOf("|");
    return idx === -1 ? t : t.substring(0, idx);
  }).filter(Boolean);
  const allEmpIds = [...new Set([...positions, ...trainees])];

  const roiColor = cph >= 18 ? "text-purple-600"
    : cph >= 14 ? "text-green-600"
    : cph >= 10 ? "text-yellow-600"
    : cph >= 6  ? "text-orange-500"
    : "text-destructive";

  const flavorEntries = [
    { name: shift.individual_flavor_1, cases: shift.individual_flavor_1_cases },
    { name: shift.individual_flavor_2, cases: shift.individual_flavor_2_cases },
    { name: shift.individual_flavor_3, cases: shift.individual_flavor_3_cases },
    { name: shift.individual_flavor_4, cases: shift.individual_flavor_4_cases },
  ].filter((f) => f.name && f.cases > 0);

  const flavorsetCases = shift.flavorset_cases || 0;

  return (
    <div className="mt-4 bg-card rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-heading font-semibold text-lg">
            {new Date(shift.shift_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            {fs?.color && <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: fs.color }} />}
            {fs?.name || "No flavorset"} · {shift.shift_time} · {shift.shift_duration}h
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Cases/hr</span>
            <Switch checked={isPpm} onCheckedChange={setIsPpm} className="scale-75" />
            <span>Pops/min</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Cases" value={totalCases} sub="produced" color="text-primary" />
        <StatCard label={isPpm ? "Pops / Min" : "Cases / Hour"} value={rate.value} sub="efficiency" color={roiColor} />
        <StatCard label="Duration" value={`${shift.shift_duration}h`} sub="shift length" />
        <StatCard label="Crew Size" value={allEmpIds.length} sub={`${trainees.length > 0 ? `+${trainees.length} trainee${trainees.length !== 1 ? "s" : ""}` : "no trainees"}`} />
      </div>

      {/* Flavor breakdown */}
      {(flavorsetCases > 0 || flavorEntries.length > 0) && (
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Case Breakdown</p>
          <div className="space-y-1.5">
            {flavorsetCases > 0 && (
              <div className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                <span className="text-sm flex items-center gap-2">
                  {fs?.color && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: fs.color }} />}
                  {fs?.name || "Flavorset"}
                </span>
                <span className="font-medium text-sm">{flavorsetCases} cases</span>
              </div>
            )}
            {flavorEntries.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                <span className="text-sm">{f.name}</span>
                <span className="font-medium text-sm">{f.cases} cases</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materials Used */}
      {matDefaults && (() => {
        const md = matDefaults;
        const popsPerCase = shift.popsicles_per_case || 144;
        const totalPopsFlavorset = (shift.flavorset_cases || 0) * popsPerCase;
        const totalPopsIndividual = [
          shift.individual_flavor_1_cases || 0,
          shift.individual_flavor_2_cases || 0,
          shift.individual_flavor_3_cases || 0,
          shift.individual_flavor_4_cases || 0,
        ].reduce((s, c) => s + c, 0) * popsPerCase;
        const totalPops = totalPopsFlavorset + totalPopsIndividual;
        const totalCasesAll = (shift.flavorset_cases || 0) + [
          shift.individual_flavor_1_cases || 0,
          shift.individual_flavor_2_cases || 0,
          shift.individual_flavor_3_cases || 0,
          shift.individual_flavor_4_cases || 0,
        ].reduce((s, c) => s + c, 0);

        if (totalPops === 0) return null;

        const sticksPerBox = md["popsicle_sticks"]?.qty_per_shift;
        const boxesUsed = sticksPerBox ? totalPops / sticksPerBox : null;

        const clearFpr = md["clear_wrap"]?.feet_per_roll;
        const clearFpp = md["clear_wrap"]?.feet_per_popsicle;
        const clearRollsUsed = (clearFpr && clearFpp && totalPopsFlavorset > 0) ? (totalPopsFlavorset * clearFpp) / clearFpr : null;
        const clearFeetUsed = (clearFpp && totalPopsFlavorset > 0) ? totalPopsFlavorset * clearFpp : null;

        const indivFpr = md["individual_wrap"]?.feet_per_roll;
        const indivFpp = md["individual_wrap"]?.feet_per_popsicle;
        const indivRollsUsed = (indivFpr && indivFpp && totalPopsIndividual > 0) ? (totalPopsIndividual * indivFpp) / indivFpr : null;
        const indivFeetUsed = (indivFpp && totalPopsIndividual > 0) ? totalPopsIndividual * indivFpp : null;

        const popsPerBag = md["popsicles_per_bag"]?.qty_per_shift;
        const bagsPerCase = md["bags_per_case"]?.qty_per_shift;
        const bagsUsed = bagsPerCase ? (shift.flavorset_cases || 0) * bagsPerCase : (popsPerBag ? totalPopsFlavorset / popsPerBag : null);

        const casesPerStack = md["box_stacks"]?.qty_per_shift;
        const stacksUsed = (casesPerStack && totalCasesAll > 0) ? totalCasesAll / casesPerStack : null;

        const lines = [
          { label: "Popsicles produced", value: totalPops.toLocaleString() },
          boxesUsed != null && { label: "Popsicle sticks", value: `${totalPops.toLocaleString()} sticks (${boxesUsed.toFixed(2)} boxes)` },
          bagsUsed != null && totalPopsFlavorset > 0 && { label: "Bags used (flavorset)", value: `${bagsUsed.toFixed(1)} bags` },
          clearFeetUsed != null && { label: "Clear wrap (flavorset)", value: `${clearFeetUsed.toFixed(0)} ft${clearRollsUsed != null ? ` (${clearRollsUsed.toFixed(2)} rolls)` : ""}` },
          indivFeetUsed != null && { label: "Individual wrap", value: `${indivFeetUsed.toFixed(0)} ft${indivRollsUsed != null ? ` (${indivRollsUsed.toFixed(2)} rolls)` : ""}` },
          stacksUsed != null && { label: "Box stacks used", value: `${stacksUsed.toFixed(2)} stacks` },
        ].filter(Boolean);

        if (lines.length === 0) return null;

        return (
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Materials Used</p>
            <div className="space-y-1.5">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                  <span className="text-sm text-muted-foreground">{line.label}</span>
                  <span className="font-medium text-sm">{line.value}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Crew */}
      {allEmpIds.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Crew</p>
          <div className="flex flex-wrap gap-2">
            {allEmpIds.map((id) => (
              <span key={id} className={`text-xs px-2.5 py-1 rounded-full font-medium ${trainees.includes(id) ? "bg-yellow-100 text-yellow-800" : "bg-primary/10 text-primary"}`}>
                {empMap[id] || "?"}
                {trainees.includes(id) && " (trainee)"}
                {id === shift.shift_lead && " ★"}
              </span>
            ))}
          </div>
        </div>
      )}

      {shift.notes && (
        <div className="mt-4 bg-muted rounded-xl px-3 py-2">
          <p className="text-xs text-muted-foreground italic">"{shift.notes}"</p>
        </div>
      )}
    </div>
  );
}