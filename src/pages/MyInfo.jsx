import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, IceCream, Hash, Save, CalendarClock } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function MyInfo() {
  const { user } = useAuth();
  const [favFlavor, setFavFlavor] = useState(user?.favorite_flavor || "");
  const [flavors, setFlavors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [upcomingShifts, setUpcomingShifts] = useState([]);

  useEffect(() => {
    setFavFlavor(user?.favorite_flavor || "");
  }, [user]);

  useEffect(() => {
    base44.entities.Flavor.list("name").then(setFlavors);
  }, []);

  useEffect(() => {
    if (!user?.employee_number) return;
    const today = new Date().toISOString().split("T")[0];
    base44.entities.ScheduledShift.list("shift_date", 100).then((shifts) => {
      const mine = shifts.filter((s) => {
        const emp = user.employee_number;
        return (
          s.shift_date >= today &&
          (
            (s.assigned_employees || []).includes(emp) ||
            (s.on_call_employees || []).includes(emp) ||
            s.mixer_employee === emp
          )
        );
      });
      setUpcomingShifts(mine);
    });
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await base44.auth.updateMe({ favorite_flavor: favFlavor });
    // Also sync to Employee record if linked
    if (user?.employee_number) {
      const emps = await base44.entities.Employee.filter({ employee_number: user.employee_number });
      if (emps.length > 0) {
        await base44.entities.Employee.update(emps[0].id, { favorite_flavor: favFlavor });
      }
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">My Info</h1>
        <p className="text-muted-foreground mt-1">Your profile and preferences</p>
      </div>

      <div className="max-w-md space-y-4">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary text-xl">
              {user?.full_name?.charAt(0) || "?"}
            </div>
            <div>
              <p className="font-heading font-semibold text-lg">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Hash className="w-3 h-3" /> Employee Number
            </div>
            <p className="text-sm font-medium">{user?.employee_number || <span className="text-muted-foreground italic">Not set</span>}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <User className="w-3 h-3" /> Role
            </div>
            <p className="text-sm font-medium capitalize">{user?.role || "user"}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <IceCream className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">Favorite Popsicle Flavor</label>
              </div>
              <Select value={favFlavor} onValueChange={setFavFlavor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a flavor..." />
                </SelectTrigger>
                <SelectContent>
                  {flavors.map((f) => (
                    <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saved ? "Saved!" : saving ? "Saving..." : "Save"}
            </Button>
          </form>
        </div>

        {/* When Do I Work? */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-semibold text-base">When Do I Work?</h2>
          </div>
          {!user?.employee_number ? (
            <p className="text-sm text-muted-foreground italic">Set your employee number to see your upcoming shifts.</p>
          ) : upcomingShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No upcoming shifts scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcomingShifts.map((shift) => {
                const date = new Date(shift.shift_date + "T00:00:00");
                const dayName = DAYS[date.getDay()];
                const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                const isOnCall = (shift.on_call_employees || []).includes(user.employee_number);
                const isMixer = shift.mixer_employee === user.employee_number;
                return (
                  <div key={shift.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{dayName}, {dateStr}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(shift.shift_time)}
                        {isMixer ? " · Mixer" : isOnCall ? " · On Call" : ""}
                      </p>
                    </div>
                    {isOnCall && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 font-medium">On Call</span>
                    )}
                    {isMixer && (
                      <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">Mixer</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}