import Section from "@/components/bigboy/Section";
import Tile from "@/components/bigboy/Tile";
import { fmtInt, fmtNum, fmtPct, fmt$ } from "@/components/bigboy/format";
import WeeklyChart from "@/components/dashboard/WeeklyChart";
import MilestoneCountdown from "@/components/dashboard/MilestoneCountdown";

function Group({ label, children }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{children}</div>
    </div>
  );
}

export default function OverviewSection({ t, records, yearRows, weeklyData, weeklyShifts, flavorSets, individualColor, milestone }) {
  return (
    <Section title="All-Time Overview" subtitle="Every production, time, and cadence number the app tracks — lifetime totals across all shifts.">
      <div className="bg-card rounded-2xl border border-border p-5">
        <Group label="Production Totals">
          <Tile label="Popsicles" value={fmtInt(t.pops)} sub="all time" highlight />
          <Tile label="Cases" value={fmtInt(t.cases)} sub="all types" />
          <Tile label="Pallets" value={fmtInt(t.pallets)} sub="66 cases each" />
          <Tile label="Gallons" value={fmtInt(t.gallons)} sub="3 gal per case" />
          <Tile label="Molds" value={fmtInt(t.molds)} sub="pops ÷ mold size" />
          <Tile label="Bags" value={fmtInt(t.bags)} sub={`${t.bagsPerCase} per case`} />
        </Group>
        <Group label="Speed & Efficiency">
          <Tile label="Avg Cases / Hour" value={fmtNum(t.avgCph)} sub="per production shift hour" highlight />
          <Tile label="Avg Pops / Min" value={fmtNum(t.popsPerMin)} />
          <Tile label="Cases / Shift" value={fmtNum(t.casesPerShift)} />
          <Tile label="Avg Shift Length" value={`${fmtNum(t.avgShiftHours)} hr`} />
          <Tile label="Downtime" value={`${fmtNum(t.downtime)} hr`} sub="parsed from notes" />
          <Tile label="Waste" value={fmtInt(t.waste)} sub={`${fmtPct(t.wastePct)} of total gallons`} />
        </Group>
        <Group label="Volume & Cadence">
          <Tile label="Production Shifts" value={fmtInt(t.shiftsCount)} />
          <Tile label="Base Mix Shifts" value={fmtInt(t.basemixCount)} />
          <Tile label="Shift Hours" value={fmtNum(t.hours)} sub="scheduled" />
          <Tile label="Clocked Hours" value={fmtNum(t.clockedHours)} sub="time tracking" />
          <Tile label="Shifts / Week" value={fmtNum(t.shiftsPerWeek)} />
          <Tile label="Cases / Week" value={fmtNum(t.casesPerWeek)} />
        </Group>
        <Group label="People & Setup">
          <Tile label="Employees" value={fmtInt(t.employeeCount)} sub={`${t.activeCount} active · ${t.terminatedCount} terminated`} />
          <Tile label="First Shift" value={t.firstDate || "—"} />
          <Tile label="Last Shift" value={t.lastDate || "—"} />
          <Tile label="History Span" value={`${fmtInt(t.spanDays)} days`} />
          <Tile label="Avg Labor Cost / Shift" value={t.avgLaborPerShift != null ? fmt$(t.avgLaborPerShift) : "—"} sub="incl. facility + tax" />
          <Tile label="Avg Revenue / Shift" value={t.avgRevenuePerShift != null ? fmt$(t.avgRevenuePerShift) : "—"} />
        </Group>
        <Group label="All-Time Records">
          <Tile label="Fastest Shift" value={records.fastest ? `${fmtNum(records.fastest.cph)} cph` : "—"} sub={records.fastest?.date} />
          <Tile label="Biggest Shift" value={records.biggest ? fmtInt(records.biggest.cases) : "—"} sub={records.biggest?.date} />
          <Tile label="Longest Shift" value={records.longest ? `${fmtNum(records.longest.dur)} hr` : "—"} sub={records.longest?.date} />
          <Tile label="Best Profit Month" value={records.bestMonth ? fmt$(records.bestMonth.profit) : "—"} sub={records.bestMonth?.month} />
          <Tile label="Worst Profit Month" value={records.worstMonth ? fmt$(records.worstMonth.profit) : "—"} sub={records.worstMonth?.month} />
          <Tile label="Top Year" value={records.topYear ? fmtInt(records.topYear.cases) : "—"} sub={records.topYear ? `${records.topYear.year} cases` : null} />
        </Group>

        <MilestoneCountdown year={milestone.year} yearPops={milestone.yearPops} yearDollars={milestone.yearDollars} />
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Production by Year</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="py-2 pr-4 font-medium">Year</th>
                <th className="py-2 pr-4 font-medium">Shifts</th>
                <th className="py-2 pr-4 font-medium">Cases</th>
                <th className="py-2 pr-4 font-medium">Popsicles</th>
                <th className="py-2 pr-4 font-medium">Gallons</th>
                <th className="py-2 pr-4 font-medium">Waste</th>
                <th className="py-2 pr-4 font-medium">Hours</th>
                <th className="py-2 pr-4 font-medium">Cases/Hr</th>
                <th className="py-2 pr-4 font-medium">Est. Value</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map((r) => (
                <tr key={r.year} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-semibold">{r.year}</td>
                  <td className="py-2 pr-4">{r.shifts}</td>
                  <td className="py-2 pr-4">{fmtInt(r.cases)}</td>
                  <td className="py-2 pr-4">{fmtInt(r.pops)}</td>
                  <td className="py-2 pr-4">{fmtInt(r.gallons)}</td>
                  <td className="py-2 pr-4">{fmtInt(r.waste)} gal</td>
                  <td className="py-2 pr-4">{fmtNum(r.hours)}</td>
                  <td className="py-2 pr-4">{fmtNum(r.cph)}</td>
                  <td className="py-2 pr-4">{r.value != null ? fmt$(r.value) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 mt-6">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Weekly Production (Last 7 Days)</p>
        <WeeklyChart data={weeklyData} shifts={weeklyShifts} flavorSets={flavorSets} individualColor={individualColor} />
      </div>
    </Section>
  );
}