import { useMemo } from "react";
import { Flame, DollarSign } from "lucide-react";

const POP_MILESTONES = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 100_000_000];
const DOLLAR_MILESTONES = [1_000_000, 5_000_000, 10_000_000, 25_000_000, 100_000_000];

function fmtCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`;
  return n.toLocaleString();
}

function fmtDollars(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function milestoneLabel(n, isMoney) {
  const prefix = isMoney ? "$" : "";
  return `${prefix}${fmtCount(n)}${isMoney ? "" : " pops"}`;
}

function CountdownCell({ icon: Icon, title, current, milestone, year, fmtValue, isMoney }) {
  const remaining = milestone - current;
  const pct = milestone > 0 ? Math.min(100, (current / milestone) * 100) : 0;
  const achieved = remaining <= 0;

  return (
    <div className="bg-muted/40 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-[11px] text-muted-foreground">{year} goal · resets yearly</p>
        </div>
      </div>
      {achieved ? (
        <div className="text-center py-2">
          <p className="font-heading font-bold text-lg text-primary">🎉 {milestoneLabel(milestone, isMoney)} reached!</p>
          <p className="text-xs text-muted-foreground mt-0.5">Onward to the next milestone next year.</p>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-heading font-bold leading-none">{fmtValue(remaining)}</p>
              <p className="text-xs text-muted-foreground mt-1">to go</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-heading font-semibold">{milestoneLabel(milestone, isMoney)}</p>
              <p className="text-[11px] text-muted-foreground">{fmtValue(current)} done</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">{pct.toFixed(1)}% of the way there</p>
        </>
      )}
    </div>
  );
}

export default function MilestoneCountdown({ year, yearPops, yearDollars }) {
  const nextPop = useMemo(() => POP_MILESTONES.find((m) => yearPops < m), [yearPops]);
  const nextDollar = useMemo(
    () => (yearDollars != null ? DOLLAR_MILESTONES.find((m) => yearDollars < m) : null),
    [yearDollars]
  );

  const allPopsDone = !nextPop;
  const allDollarDone = yearDollars == null || !nextDollar;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {allPopsDone ? (
        <div className="bg-muted/40 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Flame className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Popsicle Milestones</p>
            <p className="font-heading font-semibold text-sm">All {year} milestones reached 🎉</p>
          </div>
        </div>
      ) : (
        <CountdownCell
          icon={Flame}
          title="Next Popsicle Milestone"
          current={yearPops}
          milestone={nextPop}
          year={year}
          fmtValue={fmtCount}
          isMoney={false}
        />
      )}
      {allDollarDone ? (
        <div className="bg-muted/40 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue Milestones</p>
            <p className="font-heading font-semibold text-sm">
              {yearDollars == null ? "Set case prices to track" : `All ${year} milestones reached 🎉`}
            </p>
          </div>
        </div>
      ) : (
        <CountdownCell
          icon={DollarSign}
          title="Next Revenue Milestone"
          current={yearDollars}
          milestone={nextDollar}
          year={year}
          fmtValue={fmtDollars}
          isMoney
        />
      )}
    </div>
  );
}