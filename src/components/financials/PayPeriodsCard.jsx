import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Pencil, Wallet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseISO, differenceInMinutes } from "date-fns";
import InfoButton from "@/components/bigboy/InfoButton";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LENGTH_OPTIONS = [
  { value: "7", label: "Weekly (7 days)" },
  { value: "14", label: "Biweekly (14 days)" },
];

function fmt$(n) { return `$${Number(n).toFixed(2)}`; }
function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// First date on or after `from` that falls on the target weekday
function nextWeekday(from, targetDay) {
  const d = new Date(from);
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function PayPeriodsCard({ employees, rates, timeEntries, taxRate, info }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ period_days: "14", start_date: "", pay_day: "5" });

  useEffect(() => { load(); }, []);

  async function load() {
    const list = await base44.entities.PayPeriodSettings.list().catch(() => []);
    setSettings(list.length > 0 ? list[0] : null);
    setLoading(false);
  }

  async function save() {
    if (!form.start_date) return;
    const payload = {
      period_days: parseInt(form.period_days, 10) || 14,
      start_date: form.start_date,
      pay_day: parseInt(form.pay_day, 10) || 0,
    };
    if (settings) {
      setSettings(await base44.entities.PayPeriodSettings.update(settings.id, payload));
    } else {
      setSettings(await base44.entities.PayPeriodSettings.create(payload));
    }
    setEditing(false);
  }

  function startEditing() {
    setForm({
      period_days: String(settings?.period_days || 14),
      start_date: settings?.start_date || "",
      pay_day: String(settings?.pay_day ?? 5),
    });
    setEditing(true);
  }

  // Generate every pay period from the first start date through today
  const periods = useMemo(() => {
    if (!settings || !settings.start_date) return [];
    const periodDays = settings.period_days || 14;
    const start = new Date(settings.start_date + "T12:00:00");
    if (isNaN(start)) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const list = [];
    let s = new Date(start);
    let guard = 0;
    while (s <= today && guard < 2000) {
      guard++;
      const end = new Date(s);
      end.setDate(end.getDate() + periodDays - 1);
      list.push({
        start: new Date(s),
        end,
        payday: nextWeekday(end, settings.pay_day ?? 5),
        pay: 0,
        hours: 0,
        inProgress: end >= today,
      });
      s = new Date(s);
      s.setDate(s.getDate() + periodDays);
    }
    return list;
  }, [settings]);

  // Sum paid hours × hourly rate per period, from time tracking entries
  const computed = useMemo(() => {
    if (periods.length === 0) return { list: periods, unpricedHours: 0 };
    const rateById = {};
    rates.forEach((r) => { rateById[r.employee_id] = r.hourly_rate || 0; });
    const rateByNumber = {};
    employees.forEach((e) => {
      if (e.employee_number && rateById[e.id] != null) rateByNumber[e.employee_number] = rateById[e.id];
    });

    // Map each calendar day to its period index
    const dayPeriod = {};
    periods.forEach((p, i) => {
      let d = new Date(p.start);
      while (d <= p.end) {
        dayPeriod[dateKey(d)] = i;
        d = new Date(d);
        d.setDate(d.getDate() + 1);
      }
    });

    const out = periods.map((p) => ({ ...p, pay: 0, hours: 0 }));
    let unpricedHours = 0;
    timeEntries.forEach((te) => {
      if (!te.clock_in || !te.clock_out) return;
      const inD = parseISO(te.clock_in);
      const outD = parseISO(te.clock_out);
      const hours = te.total_hours != null ? te.total_hours : Math.max(0, differenceInMinutes(outD, inD) / 60);
      if (!hours) return;
      const idx = dayPeriod[dateKey(inD)];
      if (idx == null) return;
      const rate = te.employee_id in rateById ? rateById[te.employee_id] : (rateByNumber[te.employee_number] ?? 0);
      if (!rate) unpricedHours += hours;
      out[idx].hours += hours;
      out[idx].pay += hours * rate;
    });
    return { list: out, unpricedHours };
  }, [periods, rates, employees, timeEntries]);

  if (loading) return (
    <div className="bg-card rounded-2xl border border-border p-5 mt-8 flex justify-center py-10">
      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const totalPaid = computed.list.reduce((s, p) => s + p.pay, 0);
  const totalTax = totalPaid * ((taxRate || 0) / 100);

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mt-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium">Pay Periods — Total Paid</p>
            <p className="text-xs text-muted-foreground">Every pay period since your start date, using clocked hours × each employee's hourly rate.</p>
          </div>
          {info && <InfoButton {...info} />}
        </div>
        {settings && !editing && (
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={startEditing}>
            <Pencil className="w-3 h-3" /> Edit Pay Period Settings
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 bg-muted/40 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Pay period length</p>
              <Select value={form.period_days} onValueChange={(v) => setForm((f) => ({ ...f, period_days: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LENGTH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">First pay period start date</p>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Pay day</p>
              <Select value={form.pay_day} onValueChange={(v) => setForm((f) => ({ ...f, pay_day: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1" onClick={save} disabled={!form.start_date}><Check className="w-3 h-3" /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3 h-3" /></Button>
          </div>
        </div>
      ) : !settings ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-3">Set up your pay period to see total labor paid each period.</p>
          <Button size="sm" className="gap-1" onClick={startEditing}><Pencil className="w-3 h-3" /> Set Up Pay Period</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-6 mb-4 bg-muted/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground">Total paid (all periods)</p>
              <p className="font-heading font-bold text-xl text-primary">{fmt$(totalPaid)}</p>
            </div>
            {taxRate > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Employer tax ({taxRate}%)</p>
                <p className="font-heading font-bold text-xl">{fmt$(totalTax)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Period</p>
              <p className="text-sm font-medium">{settings.period_days === 7 ? "Weekly" : `Every ${settings.period_days} days`} · paid {DAY_NAMES[settings.pay_day] ?? ""}</p>
            </div>
          </div>

          {computed.list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pay periods yet.</p>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {[...computed.list].reverse().map((p) => {
                const rangeStr = `${p.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${p.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                const paydayStr = p.payday.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={p.start.toISOString()} className="flex items-center justify-between gap-3 flex-wrap bg-muted/30 rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{rangeStr}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.inProgress ? "In progress" : `Paid ${paydayStr}`} · {p.hours.toFixed(1)} hrs
                      </p>
                    </div>
                    <p className="font-heading font-bold text-primary">{fmt$(p.pay)}{p.inProgress ? " so far" : ""}</p>
                  </div>
                );
              })}
            </div>
          )}

          {computed.unpricedHours > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-3">
              {computed.unpricedHours.toFixed(1)} clocked hours have no hourly rate set and aren't included. Set rates above for those employees.
            </p>
          )}
        </>
      )}
    </div>
  );
}