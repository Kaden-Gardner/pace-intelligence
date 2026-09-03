import { useMemo } from "react";
import { getShiftEmployees, getTotalCases } from "@/lib/analyticsHelpers";
import Section from "@/components/bigboy/Section";
import Tile from "@/components/bigboy/Tile";
import InfoButton from "@/components/bigboy/InfoButton";
import { INFO } from "@/components/bigboy/explanations";
import { fmtInt, fmtNum, fmtPct, fmt$ } from "@/components/bigboy/format";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Same parser used by the Financials page and BigBoyPage so downtime numbers match.
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

function cphOf(list) {
  let c = 0, h = 0;
  list.forEach((s) => { c += getTotalCases(s); h += s.shift_duration || 0; });
  return h > 0 ? c / h : 0;
}

function CompareCard({ title, withLabel, withoutLabel, withVal, withoutVal, withN, withoutN, info }) {
  const diff = withVal - withoutVal;
  const pct = withoutVal > 0 ? (diff / withoutVal) * 100 : 0;
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        {info && <InfoButton {...info} />}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground mb-0.5">{withLabel} · {withN} shifts</p>
          <p className="font-heading font-bold text-lg text-primary">{fmtNum(withVal)} <span className="text-xs font-normal text-muted-foreground">cases/hr</span></p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground mb-0.5">{withoutLabel} · {withoutN} shifts</p>
          <p className="font-heading font-bold text-lg">{fmtNum(withoutVal)} <span className="text-xs font-normal text-muted-foreground">cases/hr</span></p>
        </div>
      </div>
      <p className={`text-xs mt-3 font-medium ${diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
        {diff > 0 ? "+" : ""}{fmtNum(diff)} cases/hr ({diff > 0 ? "+" : ""}{Math.round(pct)}%) when {withLabel.toLowerCase()}
      </p>
    </div>
  );
}

export default function ComparisonsSection({ shifts, rates, taxRate, avgCasePrice, casesSold, stockCases, spanDays }) {
  const rateMap = useMemo(() => Object.fromEntries(rates.map((r) => [r.employee_id, r])), [rates]);

  const stats = useMemo(() => {
    let produced = 0, wasteGallons = 0, wastePops = 0;
    let downtimeHours = 0, downtimeLabor = 0, downtimeCasesLost = 0, downtimeShifts = 0;
    const dayMap = {}, crewMap = {}, startMap = {};

    shifts.forEach((s) => {
      const cases = getTotalCases(s);
      const hours = s.shift_duration || 0;
      produced += cases;
      wasteGallons += s.waste || 0;
      wastePops += (s.waste || 0) * (s.popsicles_per_gallon || 24);

      if (s.shift_date) {
        const d = new Date(s.shift_date + "T12:00:00").getDay();
        if (!dayMap[d]) dayMap[d] = { key: d, shifts: 0, cases: 0, hours: 0 };
        dayMap[d].shifts++; dayMap[d].cases += cases; dayMap[d].hours += hours;
      }
      const size = getShiftEmployees(s).length;
      if (!crewMap[size]) crewMap[size] = { key: size, shifts: 0, cases: 0, hours: 0 };
      crewMap[size].shifts++; crewMap[size].cases += cases; crewMap[size].hours += hours;

      const time = s.shift_time || "—";
      if (!startMap[time]) startMap[time] = { key: time, shifts: 0, cases: 0, hours: 0 };
      startMap[time].shifts++; startMap[time].cases += cases; startMap[time].hours += hours;

      const dt = parseDowntimeHours(s.downtime);
      if (dt > 0) {
        downtimeShifts++;
        downtimeHours += dt;
        const crewRate = getShiftEmployees(s).reduce((sum, id) => sum + (rateMap[id]?.hourly_rate || 0), 0) * (1 + (taxRate || 0) / 100);
        downtimeLabor += dt * crewRate;
        downtimeCasesLost += (hours > 0 ? cases / hours : 0) * dt;
      }
    });

    const finalize = (m) => Object.values(m)
      .map((r) => ({ ...r, cph: r.hours > 0 ? r.cases / r.hours : 0, avgCases: r.shifts > 0 ? r.cases / r.shifts : 0 }));
    const weekdayRows = finalize(dayMap).sort((a, b) => a.key - b.key);
    const crewRows = finalize(crewMap).sort((a, b) => a.key - b.key);
    const startRows = finalize(startMap).sort((a, b) => b.shifts - a.shifts || String(a.key).localeCompare(String(b.key)));

    const bestOf = (rows) => (rows.length > 0 ? rows.reduce((a, b) => (b.cph > a.cph ? b : a)) : null);
    const bestDay = bestOf(weekdayRows);
    const bestCrew = bestOf(crewRows);
    const bestStart = bestOf(startRows.filter((r) => r.shifts >= 2));

    const withLead = shifts.filter((s) => s.shift_lead);
    const noLead = shifts.filter((s) => !s.shift_lead);
    const withTraining = shifts.filter((s) => (s.training_employees || []).length > 0);
    const noTraining = shifts.filter((s) => (s.training_employees || []).length === 0);

    const weeks = spanDays > 0 ? spanDays / 7 : 0;
    const weeklySales = weeks > 0 ? casesSold / weeks : 0;

    return {
      produced, wasteGallons, wastePops,
      downtimeHours, downtimeLabor, downtimeCasesLost, downtimeShifts,
      weekdayRows, crewRows, startRows,
      bestDay, bestCrew, bestStart,
      lead: { with: cphOf(withLead), without: cphOf(noLead), withN: withLead.length, withoutN: noLead.length },
      training: { with: cphOf(withTraining), without: cphOf(noTraining), withN: withTraining.length, withoutN: noTraining.length },
      sellThrough: produced > 0 ? (casesSold / produced) * 100 : null,
      runwayWeeks: weeklySales > 0 && stockCases > 0 ? stockCases / weeklySales : null,
    };
  }, [shifts, rateMap, taxRate, casesSold, stockCases, spanDays]);

  return (
    <Section title="Comparisons & Insights" subtitle="How shift setup and conditions affect output — weekday vs weekday, crew size, start times, leadership, and training.">
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile label="Best Weekday" value={stats.bestDay ? DAY_NAMES[stats.bestDay.key] : "—"} sub={stats.bestDay ? `${fmtNum(stats.bestDay.cph)} cases/hr` : null} highlight info={INFO.comparisons.bestDay} />
          <Tile label="Best Crew Size" value={stats.bestCrew ? `${stats.bestCrew.key} people` : "—"} sub={stats.bestCrew ? `${fmtNum(stats.bestCrew.cph)} cases/hr` : null} highlight info={INFO.comparisons.bestCrew} />
          <Tile label="Best Start Time" value={stats.bestStart?.key || "—"} sub={stats.bestStart ? `${fmtNum(stats.bestStart.cph)} cases/hr · ${stats.bestStart.shifts} shifts` : null} info={INFO.comparisons.bestStart} />
          <Tile label="Downtime Cost" value={fmt$(stats.downtimeLabor)} sub={`${fmtNum(stats.downtimeHours)} hr across ${stats.downtimeShifts} shifts`} info={INFO.comparisons.downtimeCost} />
          <Tile label="Lost to Downtime" value={fmtInt(stats.downtimeCasesLost)} sub={avgCasePrice != null ? `${fmt$(stats.downtimeCasesLost * avgCasePrice)} est. value` : "cases not made"} info={INFO.comparisons.downtimeLost} />
          <Tile label="Waste (Pops)" value={fmtInt(stats.wastePops)} sub={`${fmtInt(stats.wasteGallons)} gallons`} info={INFO.comparisons.wastePops} />
          <Tile label="Sell-Through" value={stats.sellThrough != null ? fmtPct(stats.sellThrough) : "—"} sub={`${fmtInt(casesSold)} sold ÷ ${fmtInt(stats.produced)} made`} info={INFO.comparisons.sellThrough} />
          <Tile label="Stock Runway" value={stats.runwayWeeks != null ? `${fmtNum(stats.runwayWeeks)} wks` : "—"} sub={`${fmtInt(stockCases)} cases on hand`} info={INFO.comparisons.runway} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekday Showdown</p>
            <InfoButton {...INFO.comparisons.weekdayTable} />
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Day</th>
                <th className="py-1.5 pr-3 font-medium">Shifts</th>
                <th className="py-1.5 pr-3 font-medium">Cases</th>
                <th className="py-1.5 pr-3 font-medium">Cases/Hr</th>
              </tr>
            </thead>
            <tbody>
              {stats.weekdayRows.map((r) => (
                <tr key={r.key} className={`border-b border-border/40 ${stats.bestDay && r.key === stats.bestDay.key ? "text-primary font-semibold" : ""}`}>
                  <td className="py-1.5 pr-3">{DAY_NAMES[r.key]}</td>
                  <td className="py-1.5 pr-3">{r.shifts}</td>
                  <td className="py-1.5 pr-3">{fmtInt(r.cases)}</td>
                  <td className="py-1.5 pr-3">{fmtNum(r.cph)}</td>
                </tr>
              ))}
              {stats.weekdayRows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No shifts yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Crew Size vs Speed</p>
            <InfoButton {...INFO.comparisons.crewTable} />
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Crew</th>
                <th className="py-1.5 pr-3 font-medium">Shifts</th>
                <th className="py-1.5 pr-3 font-medium">Avg Cases</th>
                <th className="py-1.5 pr-3 font-medium">Cases/Hr</th>
              </tr>
            </thead>
            <tbody>
              {stats.crewRows.map((r) => (
                <tr key={r.key} className={`border-b border-border/40 ${stats.bestCrew && r.key === stats.bestCrew.key ? "text-primary font-semibold" : ""}`}>
                  <td className="py-1.5 pr-3">{r.key} {r.key === 1 ? "person" : "people"}</td>
                  <td className="py-1.5 pr-3">{r.shifts}</td>
                  <td className="py-1.5 pr-3">{fmtInt(r.avgCases)}</td>
                  <td className="py-1.5 pr-3">{fmtNum(r.cph)}</td>
                </tr>
              ))}
              {stats.crewRows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No shifts yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Start Time Comparison</p>
            <InfoButton {...INFO.comparisons.startTable} />
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="py-1.5 pr-3 font-medium">Start</th>
                <th className="py-1.5 pr-3 font-medium">Shifts</th>
                <th className="py-1.5 pr-3 font-medium">Cases</th>
                <th className="py-1.5 pr-3 font-medium">Cases/Hr</th>
              </tr>
            </thead>
            <tbody>
              {stats.startRows.map((r) => (
                <tr key={r.key} className={`border-b border-border/40 ${stats.bestStart && r.key === stats.bestStart.key ? "text-primary font-semibold" : ""}`}>
                  <td className="py-1.5 pr-3">{r.key}</td>
                  <td className="py-1.5 pr-3">{r.shifts}</td>
                  <td className="py-1.5 pr-3">{fmtInt(r.cases)}</td>
                  <td className="py-1.5 pr-3">{fmtNum(r.cph)}</td>
                </tr>
              ))}
              {stats.startRows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No shifts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <CompareCard
          title="Shift Lead On Deck?"
          withLabel="With a lead" withoutLabel="No lead"
          withVal={stats.lead.with} withoutVal={stats.lead.without}
          withN={stats.lead.withN} withoutN={stats.lead.withoutN}
          info={INFO.comparisons.leadCard}
        />
        <CompareCard
          title="Training Shifts"
          withLabel="Trainees present" withoutLabel="Full crew"
          withVal={stats.training.with} withoutVal={stats.training.without}
          withN={stats.training.withN} withoutN={stats.training.withoutN}
          info={INFO.comparisons.trainingCard}
        />
      </div>
    </Section>
  );
}