import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { User, IceCream, Hash, Save, CalendarClock, Phone, Trash2, LogOut, Moon, Bell, BellOff, Cake, BarChart2, Loader2, BookOpen, ExternalLink } from "lucide-react";
import { useRateUnit, formatRate } from "@/hooks/useRateUnit";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [flavors, setFlavors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [employeeRecord, setEmployeeRecord] = useState(null);
  const [notifyScheduleOnly, setNotifyScheduleOnly] = useState(false);
  const [notificationsDisabled, setNotificationsDisabled] = useState(false);
  const [notifyShiftPosts, setNotifyShiftPosts] = useState(false);
  const [optOutPostNotifications, setOptOutPostNotifications] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [savingNotify, setSavingNotify] = useState(false);

  // My Stats
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [isPpm, setIsPpm] = useRateUnit();

  // Dark mode state — read from localStorage, fallback to system
  const getInitialDark = () => {
    const stored = localStorage.getItem("darkMode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const [darkMode, setDarkMode] = useState(getInitialDark);

  function toggleDarkMode(val) {
    setDarkMode(val);
    localStorage.setItem("darkMode", val ? "true" : "false");
    document.documentElement.classList.toggle("dark", val);
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    await base44.auth.logout();
  }

  useEffect(() => {
    setFavFlavor(user?.favorite_flavor || "");
    // Load phone number from Employee record
    if (user?.employee_number) {
      base44.entities.Employee.filter({ employee_number: user.employee_number }).then((emps) => {
        if (emps.length > 0) {
          setPhoneNumber(emps[0].phone_number || "");
          setEmployeeRecord(emps[0]);
          setNotifyScheduleOnly(emps[0].notify_schedule_changes_only || false);
          setNotificationsDisabled(emps[0].notifications_disabled || false);
          setNotifyShiftPosts(emps[0].notify_shift_posts || false);
          setOptOutPostNotifications(emps[0].opt_out_post_notifications || false);
          setBirthday(emps[0].birthday || "");
        }
      });
    }
  }, [user]);

  useEffect(() => {
    base44.entities.Flavor.list("name").then(setFlavors);
    base44.entities.FlavorSet.list("name").then(setFlavorSets);
  }, []);

  useEffect(() => {
    if (!user?.employee_number) return;
    const today = new Date().toISOString().split("T")[0];
    async function loadShifts() {
      // Find this user's Employee record to get their ID (Schedule stores IDs)
      const emps = await base44.entities.Employee.filter({ employee_number: user.employee_number });
      if (emps.length === 0) return;
      const empId = emps[0].id;
      const shifts = await base44.entities.ScheduledShift.list("shift_date", 500);
      const mine = shifts.filter((s) =>
        s.shift_date >= today &&
        (
          (s.assigned_employees || []).includes(empId) ||
          (s.on_call_employees || []).includes(empId) ||
          s.mixer_employee === empId
        )
      );
      setUpcomingShifts(mine);
    }
    loadShifts();
  }, [user]);

  async function loadStats() {
    if (statsLoaded) return;
    setStatsLoading(true);
    const res = await base44.functions.invoke("myStats", {});
    setStats(res.data);
    setStatsLoaded(true);
    setStatsLoading(false);
  }

  async function handleStatsToggle(val) {
    setShowStats(val);
    if (val) loadStats();
  }

  async function saveNotificationPrefs(updates) {
    if (!employeeRecord) return;
    setSavingNotify(true);
    const newData = { ...updates };
    await base44.entities.Employee.update(employeeRecord.id, newData);
    setEmployeeRecord((prev) => ({ ...prev, ...newData }));
    setSavingNotify(false);
  }

  // Calculate age from birthday string
  function calcAge(birthdayStr) {
    if (!birthdayStr) return null;
    const today = new Date();
    const bDate = new Date(birthdayStr);
    let age = today.getFullYear() - bDate.getFullYear();
    const m = today.getMonth() - bDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;
    return age;
  }
  const age = calcAge(birthday);
  const isMinor = age !== null && age < 15;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    await base44.auth.updateMe({ favorite_flavor: favFlavor });
    // Also sync to Employee record if linked
    if (user?.employee_number) {
      const emps = await base44.entities.Employee.filter({ employee_number: user.employee_number });
      if (emps.length > 0) {
        await base44.entities.Employee.update(emps[0].id, { favorite_flavor: favFlavor, phone_number: phoneNumber, birthday: birthday || null });
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
                <Phone className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">Phone Number</label>
              </div>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Cake className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">Birthday</label>
              </div>
              <Input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
              {age !== null && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  Age: <span className="font-medium">{age}</span>
                  {isMinor && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: "#7dd3fc" }}>
                      &lt;15
                    </span>
                  )}
                </p>
              )}
            </div>
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

        {/* My Production Stats */}
        {employeeRecord && (
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-semibold text-base">My Production Stats</h2>
              </div>
              <Switch checked={showStats} onCheckedChange={handleStatsToggle} />
            </div>
            {showStats && (
              <div className="mt-4">
                {statsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading stats...
                  </div>
                ) : stats && stats.shiftsWithData > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Averaged across {stats.shiftsWithData} shift{stats.shiftsWithData !== 1 ? "s" : ""}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Cases/hr</span>
                        <Switch checked={isPpm} onCheckedChange={setIsPpm} className="scale-75" />
                        <span>Pops/min</span>
                      </div>
                    </div>
                    <div className="bg-muted rounded-xl p-4 text-center">
                      <p className="text-3xl font-heading font-bold text-primary">
                        {formatRate(stats.avgCasesPerHour, isPpm).value}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{formatRate(stats.avgCasesPerHour, isPpm).label}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-3 italic">No shift data found yet.</p>
                )}
              </div>
            )}
          </div>
        )}

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
                      <p className="text-sm font-medium flex items-center gap-2">
                        {shift.flavorset_id && flavorSets.find(fs => fs.id === shift.flavorset_id)?.color && (
                          <span className="w-3 h-3 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: flavorSets.find(fs => fs.id === shift.flavorset_id).color }} />
                        )}
                        {dayName}, {dateStr}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(shift.shift_time)}
                        {shift.flavorset_id && flavorSets.find(fs => fs.id === shift.flavorset_id) ? ` · ${flavorSets.find(fs => fs.id === shift.flavorset_id).name}` : ""}
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
        {/* App Preferences */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Moon className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-semibold text-base">App Preferences</h2>
          </div>

          {/* Dark mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">Override your device's default theme</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>

          {/* Notification prefs — only if they have an employee record */}
          {employeeRecord && (
            <>
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Post Notifications</p>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 font-medium">
                  💡 We strongly encourage you to stay subscribed — posts contain important announcements and updates you won't want to miss!
                </p>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm">Opt out of post emails</p>
                    <p className="text-xs text-muted-foreground">Stop receiving email notifications when a new post is published</p>
                  </div>
                  <Switch
                    checked={optOutPostNotifications}
                    disabled={savingNotify}
                    onCheckedChange={async (val) => {
                      setOptOutPostNotifications(val);
                      await saveNotificationPrefs({ opt_out_post_notifications: val });
                    }}
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Shift Reminders</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Schedule changes only</p>
                      <p className="text-xs text-muted-foreground">Skip the 4hr/1hr reminders; only get notified when your schedule is updated</p>
                    </div>
                    <Switch
                      checked={notifyScheduleOnly}
                      disabled={notificationsDisabled || savingNotify}
                      onCheckedChange={async (val) => {
                        setNotifyScheduleOnly(val);
                        await saveNotificationPrefs({ notify_schedule_changes_only: val, notifications_disabled: notificationsDisabled });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <BellOff className="w-4 h-4 text-muted-foreground" />
                     <div>
                       <p className="text-sm">Disable all notifications</p>
                       <p className="text-xs text-muted-foreground">Turn off all shift reminder emails</p>
                     </div>
                   </div>
                   <Switch
                     checked={notificationsDisabled}
                     disabled={savingNotify}
                     onCheckedChange={async (val) => {
                       setNotificationsDisabled(val);
                       await saveNotificationPrefs({ notifications_disabled: val, notify_schedule_changes_only: notifyScheduleOnly });
                     }}
                   />
                  </div>

                  {user?.role === "admin" && (
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm">Shift post summaries</p>
                       <p className="text-xs text-muted-foreground">Get an email when a new production shift is posted (flavor, cases, waste, duration)</p>
                     </div>
                     <Switch
                       checked={notifyShiftPosts}
                       disabled={notificationsDisabled || savingNotify}
                       onCheckedChange={async (val) => {
                         setNotifyShiftPosts(val);
                         await saveNotificationPrefs({ notify_shift_posts: val, notify_schedule_changes_only: notifyScheduleOnly, notifications_disabled: notificationsDisabled });
                       }}
                     />
                   </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Employee Handbook */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-semibold text-base">Employee Handbook & SOPs</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">View company policies, procedures, and standard operating guidelines.</p>
          <a
            href="https://docs.google.com/document/d/1fDkayH3FdRnYc42431HV9SNQqq-zDMsomHMjGus4Pf4/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" /> Open Handbook
            </Button>
          </a>
        </div>

        {/* Log Out */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-2">
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-heading font-semibold text-base">Log Out</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Sign out of your account on this device.</p>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => base44.auth.logout()}>
            <LogOut className="w-4 h-4" /> Log Out
          </Button>
        </div>

        {/* Delete Account */}
        <div className="bg-card rounded-2xl border border-destructive/30 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="w-4 h-4 text-destructive" />
            <h2 className="font-heading font-semibold text-base text-destructive">Delete Account</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Permanently remove your account and all associated data. This action cannot be undone.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="select-none gap-2">
                <Trash2 className="w-4 h-4" /> Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete your account? This action is permanent and cannot be undone. You will lose access immediately.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingAccount ? "Deleting..." : "Yes, Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}