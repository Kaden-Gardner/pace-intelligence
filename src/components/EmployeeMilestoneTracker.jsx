import { Trophy, CheckCircle2 } from "lucide-react";

// 1M, 5M, 10M, 50M, 100M, 500M, 1B ... up to 1 Trillion (×5, ×2 alternating).
const MILESTONES = (() => {
  const arr = [];
  let v = 1_000_000;
  let mult = 5;
  while (v <= 1_000_000_000_000) {
    arr.push(v);
    if (v === 1_000_000_000_000) break;
    v *= mult;
    mult = mult === 5 ? 2 : 5;
  }
  return arr;
})();

const TRILLION = 1_000_000_000_000;

function formatMilestone(v) {
  if (v >= 1e12) return `${v / 1e12}T`;
  if (v >= 1e9) return `${v / 1e9}B`;
  return `${v / 1e6}M`;
}

function formatPops(n) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export default function EmployeeMilestoneTracker({ lifetimePops = 0, compact = false }) {
  const pops = Math.max(0, lifetimePops);
  const reached = MILESTONES.filter((m) => pops >= m);
  const lastReached = reached.length > 0 ? reached[reached.length - 1] : 0;
  const nextMilestone = MILESTONES.find((m) => pops < m);
  const allDone = !nextMilestone;
  const progress = nextMilestone
    ? Math.min(100, ((pops - lastReached) / (nextMilestone - lastReached)) * 100)
    : 100;
  const toNext = nextMilestone ? nextMilestone - pops : 0;

  if (compact) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Trophy className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Popsicle Milestones</span>
        </div>
        <div className="flex items-baseline justify-between">
          <p className="font-heading font-bold text-primary text-sm">
            {formatPops(pops)} <span className="text-xs font-normal text-muted-foreground">pops</span>
          </p>
          {reached.length > 0 && (
            <span className="text-[11px] inline-flex items-center gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 rounded-full px-2 py-0.5 font-medium">
              <Trophy className="w-3 h-3" /> {formatMilestone(lastReached)}
            </span>
          )}
        </div>
        {!allDone ? (
          <>
            <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{formatPops(toNext)} pops to {formatMilestone(nextMilestone)}</p>
          </>
        ) : (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">🏆 Max milestone reached!</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-base">Popsicle Milestones</h2>
      </div>
      <div className="text-center mb-5">
        <p className="text-4xl font-heading font-bold text-primary">{formatPops(pops)}</p>
        <p className="text-xs text-muted-foreground mt-1">lifetime pops produced</p>
      </div>
      {!allDone ? (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Next milestone: {formatMilestone(nextMilestone)}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{formatPops(toNext)} pops to go</p>
        </div>
      ) : (
        <div className="text-center mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium text-sm">
          🏆 You've reached the ultimate 1 Trillion milestone!
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {MILESTONES.map((m) => {
          const done = pops >= m;
          const isUltimate = m === TRILLION;
          return (
            <span
              key={m}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                done
                  ? isUltimate
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    : "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 inline-block rounded-full border border-current opacity-40" />}
              {formatMilestone(m)}
            </span>
          );
        })}
      </div>
    </div>
  );
}