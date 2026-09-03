import Section from "@/components/bigboy/Section";
import Tile from "@/components/bigboy/Tile";
import InfoButton from "@/components/bigboy/InfoButton";
import { INFO } from "@/components/bigboy/explanations";
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
          <Tile label="Popsicles" value={fmtInt(t.pops)} sub="all time" highlight info={INFO.overview.pops} />
          <Tile label="Cases" value={fmtInt(t.cases)} sub="all types" info={INFO.overview.cases} />
          <Tile label="Pallets" value={fmtInt(t.pallets)} sub="66 cases each" info={INFO.overview.pallets} />
          <Tile label="Gallons" value={fmtInt(t.gallons)} sub="3 gal per case" info={INFO.overview.gallons} />
          <Tile label="Molds" value={fmtInt(t.molds)} sub="pops ÷ mold size" info={INFO.overview.molds} />
          <Tile label="Bags" value={fmtInt(t.bags)} sub={`${t.bagsPerCase} per case`} info={INFO.overview.bags} />
        </Group>
        <Group label="Speed & Efficiency">
          <Tile label="Avg Cases / Hour" value={fmtNum(t.avgCph)} sub="per production shift hour" highlight info={INFO.overview.avgCph} />
          <Tile label="Avg Pops / Min" value={fmtNum(t.popsPerMin)} info={INFO.overview.popsPerMin} />
          <Tile label="Cases / Shift" value={fmtNum(t.casesPerShift)} info={INFO.overview.casesPerShift} />
          <Tile label="Avg Shift Length" value={`${fmtNum(t.avgShiftHours)} hr`} info={INFO.overview.avgShiftHours} />
          <Tile label="Downtime" value={`${fmtNum(t.downtime)} hr`} sub="parsed from notes" info={INFO.overview.downtime} />
          <Tile label="Waste" value={fmtInt(t.waste)} sub={`${fmtPct(t.wastePct)} of total gallons`} info={INFO.overview.waste} />
        </Group>
        <Group label="Volume & Cadence">
          <Tile label="Production Shifts" value={fmtInt(t.shiftsCount)} info={INFO.overview.prodShifts} />
          <Tile label="Base Mix Shifts" value={fmtInt(t.basemixCount)} info={INFO.overview.bmShifts} />
          <Tile label="Shift Hours" value={fmtNum(t.hours)} sub="scheduled" info={INFO.overview.shiftHours} />
          <Tile label="Clocked Hours" value={fmtNum(t.clockedHours)} sub="time tracking" info={INFO.overview.clockedHours} />
          <Tile label="Shifts / Week" value={fmtNum(t.shiftsPerWeek)} info={INFO.overview.shiftsPerWeek} />
          <Tile label="Cases / Week" value={fmtNum(t.casesPerWeek)} info={INFO.overview.casesPerWeek} />
        </Group>
        <Group label="People & Setup">
          <Tile label="Employees" value={fmtInt(t.employeeCount)} sub={`${t.activeCount} active · ${t.terminatedCount} terminated`} info={INFO.overview.employees} />
          <Tile label="First Shift" value={t.firstDate || "—"} info={INFO.overview.firstShift} />
          <Tile label="Last Shift" value={t.lastDate || "—"} info={INFO.overview.lastShift} />
          <Tile label="History Span" value={`${fmtInt(t.spanDays)} days`} info={INFO.overview.spanDays} />
          <Tile label="Avg Labor Cost / Shift" value={t.avgLaborPerShift != null ? fmt$(t.avgLaborPerShift) : "—"} sub="incl. facility + tax" info={INFO.overview.avgLaborShift} />
          <Tile label="Avg Revenue / Shift" value={t.avgRevenuePerShift != null ? fmt$(t.avgRevenuePerShift) : "—"} info={INFO.overview.avgRevenueShift} />
        </Group>
        <Group label="All-Time Records">
          <Tile label="Fastest Shift" value={records.fastest ? `${fmtNum(records.fastest.cph)} cph` : "—"} sub={records.fastest?.date} info={INFO.overview.fastest} />
          <Tile label="Biggest Shift" value={records.biggest ? fmtInt(records.biggest.cases) : "—"} sub={records.biggest?.date} info={INFO.overview.biggest} />
          <Tile label="Longest Shift" value={records.longest ? `${fmtNum(records.longest.dur)} hr` : "—"} sub={records.longest?.date} info={INFO.overview.longest} />
          <Tile label="Best Profit Month" value={records.bestMonth ? fmt$(records.bestMonth.profit) : "—"} sub={records.bestMonth?.month} info={INFO.overview.bestMonth} />
          <Tile label="Worst Profit Month" value={records.worstMonth ? fmt$(records.worstMonth.profit) : "—"} sub={records.worstMonth?.month} info={INFO.overview.worstMonth} />
          <Tile label="Top Year" value={records.topYear ? fmtInt(records.topYear.cases) : "—"} sub={records.topYear ? `${records.topYear.year} cases` : null} info={INFO.overview.topYear} />
        </Group>

        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Yearly Milestone Countdown</p>
          <InfoButton {...INFO.overview.milestone} />
        </div>
        <MilestoneCountdown year={milestone.year} yearPops={milestone.yearPops} yearDollars={milestone.yearDollars} />
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 mt-6">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Production by Year</p>
          <InfoButton {...INFO.overview.yearTable} />
        </div>
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
        <div className="flex items-center gap-1.5 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Production (Last 7 Days)</p>
          <InfoButton {...INFO.overview.weeklyChart} />
        </div>
        <WeeklyChart data={weeklyData} shifts={weeklyShifts} flavorSets={flavorSets} individualColor={individualColor} />
      </div>
    </Section>
  );
}