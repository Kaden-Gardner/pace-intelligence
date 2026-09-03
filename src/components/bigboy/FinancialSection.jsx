import Section from "@/components/bigboy/Section";
import Tile from "@/components/bigboy/Tile";
import { fmtInt, fmtNum, fmtPct, fmt$ } from "@/components/bigboy/format";

// Month-over-month delta vs the previous (older) month. `invert` treats an increase as bad (costs).
function Delta({ cur, prev, invert = false }) {
  if (prev == null || prev === 0 || cur == null) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (!isFinite(pct)) return null;
  const good = invert ? pct < 0 : pct > 0;
  const cls = pct === 0 ? "text-muted-foreground" : good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return <span className={`text-[10px] ml-1 font-medium ${cls}`}>{pct > 0 ? "▲" : pct < 0 ? "▼" : "•"}{Math.abs(pct) >= 1000 ? "999+" : `${Math.abs(pct).toFixed(0)}%`}</span>;
}

export default function FinancialSection({ finances, monthlyRows, taxRate }) {
  const taxPortion = taxRate > 0 ? finances.labor * (taxRate / (100 + taxRate)) : 0;
  return (
    <Section title="Financials — All Time" subtitle="Every money metric: labor (incl. facility + employer tax), supplies, revenue, and profit.">
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Tile label="Total Revenue" value={fmt$(finances.revenue)} sub={`${fmtInt(finances.casesSold)} cases sold`} highlight />
          <Tile label="Total Labor Cost" value={fmt$(finances.labor)} sub="clocked hours × rates + facility + tax" />
          <Tile label="Total Supply Cost" value={fmt$(finances.supply)} sub="ingredients, flavoring, materials" />
          <Tile label="Total Profit" value={fmt$(finances.profit)} sub="revenue − labor − supplies" highlight />
          <Tile label="Avg Sale Price / Case" value={finances.avgSalePrice != null ? fmt$(finances.avgSalePrice) : "—"} />
          <Tile label="Employer Tax in Labor" value={fmt$(taxPortion)} sub={`${taxRate || 0}% payroll tax`} />
          <Tile label="Labor / Case" value={finances.laborPerCase != null ? fmt$(finances.laborPerCase) : "—"} sub="produced" />
          <Tile label="Total Cost / Case" value={finances.costPerCase != null ? fmt$(finances.costPerCase) : "—"} sub="labor + supplies" />
          <Tile label="Profit / Case Sold" value={finances.profitPerCase != null ? fmt$(finances.profitPerCase) : "—"} />
          <Tile label="Revenue / Prod. Hour" value={finances.revenuePerHour != null ? fmt$(finances.revenuePerHour) : "—"} />
          <Tile label="ROI (Rev ÷ Labor)" value={finances.roi != null ? `${fmtNum(finances.roi, 2)}×` : "—"} />
          <Tile label="Est. Prod. Value" value={finances.prodValue != null ? fmt$(finances.prodValue) : "—"} sub="cases produced × avg price" />
        </div>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Month-by-Month Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium">Prod Shifts</th>
                <th className="py-2 pr-4 font-medium">BM Shifts</th>
                <th className="py-2 pr-4 font-medium">Hours</th>
                <th className="py-2 pr-4 font-medium">Cases</th>
                <th className="py-2 pr-4 font-medium">Labor $</th>
                <th className="py-2 pr-4 font-medium">Supplies $</th>
                <th className="py-2 pr-4 font-medium">Revenue $</th>
                <th className="py-2 pr-4 font-medium">Profit $</th>
                <th className="py-2 pr-4 font-medium">Margin</th>
                <th className="py-2 pr-4 font-medium">Orders</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.map((m, i) => {
                const prev = monthlyRows[i + 1] || null;
                return (
                <tr key={m.month} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-semibold">{m.month}</td>
                  <td className="py-2 pr-4">{m.prodShifts}</td>
                  <td className="py-2 pr-4">{m.basemixShifts}</td>
                  <td className="py-2 pr-4">{fmtNum(m.hours)}</td>
                  <td className="py-2 pr-4">{fmtInt(m.cases)}<Delta cur={m.cases} prev={prev?.cases} /></td>
                  <td className="py-2 pr-4">{fmt$(m.labor)}<Delta cur={m.labor} prev={prev?.labor} invert /></td>
                  <td className="py-2 pr-4">{fmt$(m.supply)}<Delta cur={m.supply} prev={prev?.supply} invert /></td>
                  <td className="py-2 pr-4">{fmt$(m.revenue)}<Delta cur={m.revenue} prev={prev?.revenue} /></td>
                  <td className={`py-2 pr-4 font-semibold ${m.profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>{fmt$(m.profit)}<Delta cur={m.profit} prev={prev?.profit} /></td>
                  <td className="py-2 pr-4">{fmtPct(m.margin)}</td>
                  <td className="py-2 pr-4">{m.orders}</td>
                </tr>
                );
              })}
              {monthlyRows.length === 0 && (
                <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}