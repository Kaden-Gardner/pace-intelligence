import Section from "@/components/bigboy/Section";
import Tile from "@/components/bigboy/Tile";
import InfoButton from "@/components/bigboy/InfoButton";
import { INFO } from "@/components/bigboy/explanations";
import { fmtInt, fmtPct, fmt$ } from "@/components/bigboy/format";
import FlavorBreakdownCard from "@/components/dashboard/FlavorBreakdownCard";

const CASES_PER_PALLET = 66;

function FlavorDot({ color }) {
  return color ? <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} /> : null;
}

export default function FlavorSection({ flavorStats, palletsOnHand, singlesOnHand, flavorSets, avgCasePrice, casesProduced }) {
  const { fsRows, flRows, flavorCasesMap, flavorColorMap } = flavorStats;
  const fsProdTotal = fsRows.reduce((s, r) => s + r.prod, 0);
  const flProdTotal = flRows.reduce((s, r) => s + r.prod, 0);
  const totalPallets = palletsOnHand.reduce((s, i) => s + Math.floor((i.cases || 0) / CASES_PER_PALLET), 0);
  const totalSingles = singlesOnHand.reduce((s, i) => s + (i.cases || 0), 0);

  return (
    <Section title="Flavors, Flavorsets & Stock on Hand" subtitle="Production and sales by flavorset and individual flavor, plus everything currently in stock.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label="Pallets on Hand" value={fmtInt(totalPallets)} sub={`${palletsOnHand.length} flavorsets stocked`} info={INFO.flavors.palletsOnHand} />
        <Tile label="Individual Cases on Hand" value={fmtInt(totalSingles)} sub={`${singlesOnHand.length} flavors stocked`} info={INFO.flavors.singlesOnHand} />
        <Tile label="Flavorset Cases Produced" value={fmtInt(fsProdTotal)} sub="all time" info={INFO.flavors.fsProduced} />
        <Tile label="Individual Cases Produced" value={fmtInt(flProdTotal)} sub="all time" info={INFO.flavors.flProduced} />
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 mb-6 overflow-x-auto">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Flavorsets — Production vs Sales</p>
          <InfoButton {...INFO.flavors.fsTable} />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left border-b border-border">
              <th className="py-2 pr-4 font-medium">Flavorset</th>
              <th className="py-2 pr-4 font-medium">Cases Produced</th>
              <th className="py-2 pr-4 font-medium">% of Prod.</th>
              <th className="py-2 pr-4 font-medium">Est. Value</th>
              <th className="py-2 pr-4 font-medium">Cases Sold</th>
              <th className="py-2 pr-4 font-medium">On Hand (pallets)</th>
            </tr>
          </thead>
          <tbody>
            {fsRows.map((r) => {
              const onHand = palletsOnHand.find((i) => i.flavorset_id === r.id);
              return (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1.5"><FlavorDot color={r.color} />{r.name}</span>
                  </td>
                  <td className="py-2 pr-4">{fmtInt(r.prod)}</td>
                  <td className="py-2 pr-4">{fsProdTotal > 0 ? fmtPct((r.prod / fsProdTotal) * 100) : "—"}</td>
                  <td className="py-2 pr-4">{avgCasePrice != null && r.prod > 0 ? fmt$(r.prod * avgCasePrice) : "—"}</td>
                  <td className="py-2 pr-4">{fmtInt(r.sales)}</td>
                  <td className="py-2 pr-4">{onHand ? `${Math.floor((onHand.cases || 0) / CASES_PER_PALLET)} (${onHand.cases || 0} cases)` : "—"}</td>
                </tr>
              );
            })}
            {fsRows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No flavorsets.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 mb-6 overflow-x-auto">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Individual Flavors — Production vs Sales</p>
          <InfoButton {...INFO.flavors.flTable} />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left border-b border-border">
              <th className="py-2 pr-4 font-medium">Flavor</th>
              <th className="py-2 pr-4 font-medium">Cases Produced</th>
              <th className="py-2 pr-4 font-medium">% of Prod.</th>
              <th className="py-2 pr-4 font-medium">Est. Value</th>
              <th className="py-2 pr-4 font-medium">Cases Sold</th>
              <th className="py-2 pr-4 font-medium">On Hand (cases)</th>
            </tr>
          </thead>
          <tbody>
            {flRows.map((r) => {
              const onHand = singlesOnHand.find((i) => i.flavor_id === r.id);
              return (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1.5"><FlavorDot color={r.color} />{r.name}</span>
                  </td>
                  <td className="py-2 pr-4">{fmtInt(r.prod)}</td>
                  <td className="py-2 pr-4">{flProdTotal > 0 ? fmtPct((r.prod / flProdTotal) * 100) : "—"}</td>
                  <td className="py-2 pr-4">{avgCasePrice != null && r.prod > 0 ? fmt$(r.prod * avgCasePrice) : "—"}</td>
                  <td className="py-2 pr-4">{fmtInt(r.sales)}</td>
                  <td className="py-2 pr-4">{onHand ? fmtInt(onHand.cases || 0) : "—"}</td>
                </tr>
              );
            })}
            {flRows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No flavors.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Individual Flavor Production Share</p>
          <InfoButton {...INFO.flavors.shareChart} />
        </div>
        <FlavorBreakdownCard flavorCases={flavorCasesMap} flavorColorMap={flavorColorMap} />
      </div>
    </Section>
  );
}