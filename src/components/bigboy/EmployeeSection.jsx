import Section from "@/components/bigboy/Section";
import InfoButton from "@/components/bigboy/InfoButton";
import { INFO } from "@/components/bigboy/explanations";
import { fmtInt, fmtNum, fmt$ } from "@/components/bigboy/format";

export default function EmployeeSection({ rows, avgCasePrice }) {
  return (
    <Section title="Every Employee — Lifetime Stats" subtitle="All-time production per employee across every position they've worked, with pay from clocked hours.">
      <div className="bg-card rounded-2xl border border-border p-5 overflow-x-auto">
        <div className="flex items-center gap-1.5 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">How to read this table</p>
          <InfoButton {...INFO.employees.table} />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left border-b border-border">
              <th className="py-2 pr-4 font-medium">Employee</th>
              <th className="py-2 pr-4 font-medium">Shifts</th>
              <th className="py-2 pr-4 font-medium">Lead</th>
              <th className="py-2 pr-4 font-medium">Sched Hrs</th>
              <th className="py-2 pr-4 font-medium">Clocked Hrs</th>
              <th className="py-2 pr-4 font-medium">Cases</th>
              <th className="py-2 pr-4 font-medium">Cases/Hr</th>
              <th className="py-2 pr-4 font-medium">Filling (gal)</th>
              <th className="py-2 pr-4 font-medium">Pulling (molds)</th>
              <th className="py-2 pr-4 font-medium">Sorting (pops)</th>
              <th className="py-2 pr-4 font-medium">Bagging (bags)</th>
              <th className="py-2 pr-4 font-medium">Boxing (cases)</th>
              <th className="py-2 pr-4 font-medium">Gross Pay</th>
              <th className="py-2 pr-4 font-medium">Prod. Value</th>
              <th className="py-2 pr-4 font-medium">PVR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-border/50 ${r.active ? "" : "opacity-50"}`}>
                <td className="py-2 pr-4 font-medium whitespace-nowrap">
                  {r.name}
                  <span className="text-muted-foreground font-normal"> #{r.number}</span>
                  {!r.active && <span className="ml-1 text-[10px] text-destructive">terminated</span>}
                </td>
                <td className="py-2 pr-4">{r.shifts}</td>
                <td className="py-2 pr-4">{r.leadShifts}</td>
                <td className="py-2 pr-4">{fmtNum(r.schedHours)}</td>
                <td className="py-2 pr-4">{fmtNum(r.clockedH)}</td>
                <td className="py-2 pr-4">{fmtInt(r.cases)}</td>
                <td className="py-2 pr-4">{fmtNum(r.cph)}</td>
                <td className="py-2 pr-4">{fmtInt(r.pos.Filling)}</td>
                <td className="py-2 pr-4">{fmtInt(r.pos.Pulling)}</td>
                <td className="py-2 pr-4">{fmtInt(r.pos.Sorting)}</td>
                <td className="py-2 pr-4">{fmtInt(r.pos.Bagging)}</td>
                <td className="py-2 pr-4">{fmtInt(r.pos.Boxing)}</td>
                <td className="py-2 pr-4">{r.pay > 0 ? fmt$(r.pay) : "—"}</td>
                <td className="py-2 pr-4">{avgCasePrice != null && r.cases > 0 ? fmt$(r.cases * avgCasePrice) : "—"}</td>
                <td className="py-2 pr-4 font-semibold">
                  {(() => {
                    if (r.pay > 0 && avgCasePrice != null && r.cases > 0) {
                      const ratio = (r.cases * avgCasePrice) / r.pay;
                      const color = ratio > 5 ? "text-purple-600 dark:text-purple-400"
                        : ratio > 1 ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400";
                      return <span className={color}>{ratio.toFixed(2)}</span>;
                    }
                    return "—";
                  })()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={15} className="py-6 text-center text-muted-foreground">No employees.</td></tr>
            )}
          </tbody>
        </table>
        {avgCasePrice == null && rows.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3">Production value requires at least one priced order item (set prices in Financials → Orders).</p>
        )}
      </div>
    </Section>
  );
}