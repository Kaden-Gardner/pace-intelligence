import Section from "@/components/bigboy/Section";
import Tile from "@/components/bigboy/Tile";
import InfoButton from "@/components/bigboy/InfoButton";
import { INFO } from "@/components/bigboy/explanations";
import { fmtInt, fmtNum, fmtPct, fmt$ } from "@/components/bigboy/format";

export default function SalesSection({ sales, finances, totalCasesProduced }) {
  const soldPct = totalCasesProduced > 0 ? (finances.casesSold / totalCasesProduced) * 100 : null;
  const topVendor = sales.vendorRows[0];
  const totalRevenue = finances.revenue || 0;

  return (
    <Section title="Sales & Orders — All Time" subtitle="Every order, vendor, and sales-vs-production comparison.">
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Tile label="Total Orders" value={fmtInt(sales.totalOrders)} highlight info={INFO.sales.orders} />
          <Tile label="Priced Orders" value={fmtInt(sales.pricedOrders)} info={INFO.sales.priced} />
          <Tile label="Cases Sold" value={fmtInt(finances.casesSold)} info={INFO.sales.casesSold} />
          <Tile label="Total Revenue" value={fmt$(finances.revenue)} highlight info={INFO.sales.revenue} />
          <Tile label="Avg $ / Order" value={sales.avgOrder != null ? fmt$(sales.avgOrder) : "—"} info={INFO.sales.avgOrder} />
          <Tile label="Avg Cases / Order" value={sales.avgCasesOrder != null ? fmtNum(sales.avgCasesOrder) : "—"} info={INFO.sales.avgCasesOrder} />
          <Tile label="Cases Produced" value={fmtInt(totalCasesProduced)} info={INFO.sales.produced} />
          <Tile label="Sold ÷ Produced" value={fmtPct(soldPct)} info={INFO.sales.soldPct} />
          <Tile label="Unsold Cases" value={soldPct != null ? fmtInt(Math.max(0, totalCasesProduced - finances.casesSold)) : "—"} sub="produced − sold" info={INFO.sales.unsold} />
          <Tile label="Est. Prod. Value" value={finances.prodValue != null ? fmt$(finances.prodValue) : "—"} sub="at avg case price" info={INFO.sales.prodValue} />
          <Tile label="Sales vs Prod. Value" value={finances.prodValue > 0 ? fmtPct((totalRevenue / finances.prodValue) * 100) : "—"} info={INFO.sales.salesVsValue} />
          <Tile label="Top Vendor" value={topVendor ? topVendor.name : "—"} sub={topVendor ? fmt$(topVendor.revenue) : null} info={INFO.sales.topVendor} />
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vendors — Revenue Ranked</p>
          <InfoButton {...INFO.sales.vendorTable} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground text-left border-b border-border">
                <th className="py-2 pr-4 font-medium">Vendor</th>
                <th className="py-2 pr-4 font-medium">Orders</th>
                <th className="py-2 pr-4 font-medium">Cases</th>
                <th className="py-2 pr-4 font-medium">Revenue</th>
                <th className="py-2 pr-4 font-medium">Avg $ / Order</th>
                <th className="py-2 pr-4 font-medium">Avg Cases / Order</th>
                <th className="py-2 pr-4 font-medium">% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sales.vendorRows.map((v) => (
                <tr key={v.name} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{v.name}</td>
                  <td className="py-2 pr-4">{v.orders}</td>
                  <td className="py-2 pr-4">{fmtInt(v.cases)}</td>
                  <td className="py-2 pr-4">{fmt$(v.revenue)}</td>
                  <td className="py-2 pr-4">{v.orders > 0 ? fmt$(v.revenue / v.orders) : "—"}</td>
                  <td className="py-2 pr-4">{v.orders > 0 ? fmtNum(v.cases / v.orders) : "—"}</td>
                  <td className="py-2 pr-4">{totalRevenue > 0 ? fmtPct((v.revenue / totalRevenue) * 100) : "—"}</td>
                </tr>
              ))}
              {sales.vendorRows.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}