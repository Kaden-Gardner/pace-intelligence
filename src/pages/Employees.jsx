import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Users, Plus, Pencil, Trash2, Check, X, Star, UserX, UserCheck, Phone, Shield, ChevronDown, IceCream, Cake, Briefcase, Trophy } from "lucide-react";
import { getBestPosition, getEmployeePosition, getShiftEmployees, getTotalCases, getCasesPerHour, POSITION_PRODUCTION, getPositionProduction, resolvePackConstants } from "../lib/analyticsHelpers";
import { POSITIONS, positionLabel } from "@/lib/positions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "../components/EmptyState";
import EmployeeMilestoneTracker from "@/components/EmployeeMilestoneTracker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Employees() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", employee_number: "", phone_number: "", birthday: "", favorite_flavor: "", active: true, app_role: "user", hired_for: "", cross_trained_positions: [] });
  const [flavors, setFlavors] = useState([]);

  const [selectedPosition, setSelectedPosition] = useState({}); // empId -> position string
  const [showMilestones, setShowMilestones] = useState({}); // empId -> milestone visible (non-admins)
  const [packConstants, setPackConstants] = useState({});

  async function load() {
    const [data, prodShifts, flavorList, matDef] = await Promise.all([
      base44.entities.Employee.list("name", 500),
      base44.entities.Shift.list("-shift_date", 500),
      base44.entities.Flavor.list("name"),
      base44.entities.MaterialDefaults.list(),
    ]);
    const matMap = {};
    matDef.forEach((d) => { matMap[d.material_key] = d; });
    setPackConstants(resolvePackConstants(matMap));
    setEmployees(data);
    setShifts(prodShifts);
    setFlavors(flavorList);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  // Per-employee lifetime pops (each shift counted once per crew member).
  const lifetimePopsByEmp = useMemo(() => {
    const casesByEmp = {};
    shifts.forEach((shift) => {
      const totalCases = getTotalCases(shift);
      if (totalCases <= 0) return;
      getShiftEmployees(shift).forEach((id) => {
        if (!id) return;
        casesByEmp[id] = (casesByEmp[id] || 0) + totalCases;
      });
    });
    const popsPerCase = packConstants.popsPerCase || 144;
    const out = {};
    Object.keys(casesByEmp).forEach((id) => { out[id] = casesByEmp[id] * popsPerCase; });
    return out;
  }, [shifts, packConstants]);

  async function handleSave() {
    if (!form.name || !form.employee_number) return;
    if (editingId) {
      await base44.entities.Employee.update(editingId, form);
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...form } : e)));
      // Sync role to User entity if linked — always use app_role regardless of active status
      // (inactive admins, e.g. owners, retain their admin privileges)
      const users = await base44.entities.User.list();
      const linked = users.find((u) => u.employee_number === form.employee_number);
      if (linked && linked.role !== "terminated") {
        await base44.entities.User.update(linked.id, { role: form.app_role });
      }
    } else {
      const created = await base44.entities.Employee.create(form);
      setEmployees((prev) => [...prev, created]);
    }
    resetForm();
  }

  function startEdit(emp) {
    setForm({
      name: emp.name,
      employee_number: emp.employee_number,
      phone_number: emp.phone_number || "",
      birthday: emp.birthday || "",
      favorite_flavor: emp.favorite_flavor || "",
      active: emp.active !== false,
      app_role: emp.app_role || "user",
      hired_for: emp.hired_for || "",
      cross_trained_positions: emp.cross_trained_positions || [],
    });
    setEditingId(emp.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({ name: "", employee_number: "", phone_number: "", birthday: "", favorite_flavor: "", active: true, app_role: "user", hired_for: "", cross_trained_positions: [] });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleDelete(id) {
    await base44.entities.Employee.delete(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleTerminateReinstate(emp, action) {
    const isTerminating = action === "terminate";
    // On reinstate, restore to their previous active state; on terminate, mark inactive+terminated
    const updates = isTerminating
      ? { terminated: true, active: false }
      : { terminated: false }; // keep active as-is when reinstating
    await base44.entities.Employee.update(emp.id, updates);
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, ...updates } : e));
    const users = await base44.entities.User.list();
    const linked = users.find((u) => u.employee_number === emp.employee_number);
    if (linked) {
      await base44.entities.User.update(linked.id, { role: isTerminating ? "terminated" : (emp.app_role || "user") });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? "Manage your workforce" : "Team contact directory"}</p>
        </div>
        {isAdmin && (
          <Button className="gap-2" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h3 className="font-heading font-semibold mb-4">{editingId ? "Edit" : "New"} Employee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee Number</label>
              <Input value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} placeholder="EMP001" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
              <Input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="(555) 123-4567" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Cake className="w-3 h-3" /> Birthday</label>
              <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} max={new Date().toISOString().split("T")[0]} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><IceCream className="w-3 h-3" /> Favorite Flavor</label>
              <Select value={form.favorite_flavor} onValueChange={(v) => setForm({ ...form, favorite_flavor: v })}>
                <SelectTrigger><SelectValue placeholder="Select flavor..." /></SelectTrigger>
                <SelectContent>
                  {flavors.map((f) => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">App Role</label>
              <Select value={form.app_role} onValueChange={(v) => setForm({ ...form, app_role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Briefcase className="w-3 h-3" /> Hired For</label>
              <Select value={form.hired_for || "none"} onValueChange={(v) => setForm({ ...form, hired_for: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select position..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {POSITIONS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-sm">Active</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Cross Trained Positions</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => {
                const isSelected = (form.cross_trained_positions || []).includes(p.key);
                return (
                  <button key={p.key} type="button"
                    onClick={() => setForm((f) => ({ ...f, cross_trained_positions: isSelected ? (f.cross_trained_positions || []).filter((k) => k !== p.key) : [...(f.cross_trained_positions || []), p.key] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} className="gap-2">
              <Check className="w-4 h-4" /> {editingId ? "Update" : "Create"}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {employees.length === 0 && !showForm ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Add employees to assign them to shifts."
        />
      ) : (() => {
        const activeEmps = employees.filter((e) => e.active !== false && !e.terminated);
        const inactiveEmps = isAdmin ? employees.filter((e) => e.active === false && !e.terminated) : [];
        const terminatedEmps = isAdmin ? employees.filter((e) => e.terminated) : [];

        const renderCard = (emp) => {
          const bestPos = getBestPosition(shifts, emp.id);
          return (
            <div
              key={emp.id}
              className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow"
            >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-heading font-bold text-primary">
                      {emp.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-1.5">
                        {emp.name}
                        {(() => {
                          if (!emp.birthday) return null;
                          const today = new Date();
                          const bDate = new Date(emp.birthday);
                          let age = today.getFullYear() - bDate.getFullYear();
                          const m = today.getMonth() - bDate.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) age--;
                          if (age < 15) return (
                            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: "#7dd3fc" }}>
                              &lt;15
                            </span>
                          );
                          return null;
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">#{emp.employee_number}</p>
                      {emp.hired_for && (
                        <p className="text-xs text-accent flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3 h-3" />{positionLabel(emp.hired_for)}
                        </p>
                      )}
                      {emp.cross_trained_positions?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">↔ {emp.cross_trained_positions.map(positionLabel).join(", ")}</p>
                      )}
                      {bestPos && (
                        <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
                          <Star className="w-3 h-3" />{bestPos}
                        </p>
                      )}
                      {emp.favorite_flavor && (
                        <p className="text-xs text-muted-foreground mt-0.5">🍦 {emp.favorite_flavor}</p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col items-end gap-1">
                      <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        emp.terminated ? "bg-red-100 text-red-700" :
                        emp.active !== false ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {emp.terminated ? "Terminated" : emp.active !== false ? "Active" : "Inactive"}
                      </div>
                      {emp.app_role === "admin" && (
                        <div className="flex items-center gap-1 text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full font-medium">
                          <Shield className="w-3 h-3" /> Admin
                        </div>
                      )}
                      {(() => {
                        const es = shifts.flatMap((s) => s.employee_scores || []).filter((s) => s.employee_id === emp.id && typeof s.score === "number" && !isNaN(s.score));
                        const avg = es.length > 0 ? es.reduce((sum, s) => sum + s.score, 0) / es.length : null;
                        if (avg === null) return null;
                        const scoreClass =
                          avg > 9 ? "bg-purple-100 text-purple-700" :
                          avg > 8 ? "bg-green-100 text-green-700" :
                          avg > 6 ? "bg-yellow-100 text-yellow-700" :
                          avg > 4 ? "bg-orange-100 text-orange-700" :
                          "bg-red-100 text-red-700";
                        return (
                          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${scoreClass}`}>
                            <Star className="w-3 h-3" /> {avg.toFixed(1)}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Phone number — visible to all */}
                {emp.phone_number && (
                  <div className="flex items-center gap-1.5 mt-3 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <a href={`tel:${emp.phone_number}`} className="hover:text-foreground transition-colors">{emp.phone_number}</a>
                  </div>
                )}

                {/* Position stats — admin only */}
                {isAdmin && (() => {
                  // Compute positions this employee has worked
                  const positionData = {};
                  shifts.forEach((shift) => {
                    const positions = getEmployeePosition(shift, emp.id);
                    if (positions.length === 0) return;
                    const totalCases = getTotalCases(shift);
                    const duration = shift.shift_duration || 0;
                    positions.forEach((pos) => {
                      if (!positionData[pos]) positionData[pos] = { shifts: 0, totalCases: 0, totalHours: 0, totalProduction: 0 };
                      positionData[pos].shifts += 1;
                      positionData[pos].totalCases += totalCases;
                      positionData[pos].totalHours += duration;
                      const prod = getPositionProduction(shift, pos, packConstants);
                      if (prod != null) positionData[pos].totalProduction += prod;
                    });
                  });
                  const positionList = Object.keys(positionData).sort();
                  if (positionList.length === 0) return null;
                  const chosenPos = selectedPosition[emp.id] || positionList[0];
                  const pd = positionData[chosenPos];
                  const avgCph = pd.totalHours > 0 ? (pd.totalCases / pd.totalHours).toFixed(1) : "—";
                  const avgCases = pd.shifts > 0 ? (pd.totalCases / pd.shifts).toFixed(0) : "—";
                  return (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Position Stats</span>
                        <select
                          value={chosenPos}
                          onChange={(e) => setSelectedPosition((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                          className="text-xs rounded-lg border border-input bg-transparent px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {positionList.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-muted rounded-xl px-3 py-2 text-center">
                          <p className="font-heading font-bold text-primary text-sm">{avgCph}</p>
                          <p className="text-xs text-muted-foreground">cases/hr</p>
                        </div>
                        <div className="bg-muted rounded-xl px-3 py-2 text-center">
                          <p className="font-heading font-bold text-primary text-sm">{avgCases}</p>
                          <p className="text-xs text-muted-foreground">avg cases/shift</p>
                        </div>
                        <div className="bg-muted rounded-xl px-3 py-2 text-center">
                          <p className="font-heading font-bold text-primary text-sm">{pd.shifts}</p>
                          <p className="text-xs text-muted-foreground">shifts</p>
                        </div>
                        {POSITION_PRODUCTION[chosenPos.toLowerCase()] && (
                          <div className="bg-muted rounded-xl px-3 py-2 text-center">
                            <p className="font-heading font-bold text-primary text-sm">{Math.round(pd.totalProduction || 0).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{POSITION_PRODUCTION[chosenPos.toLowerCase()].label}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Popsicle milestone — always shown for admins; non-admins toggle it per employee */}
                {isAdmin ? (
                  <EmployeeMilestoneTracker lifetimePops={lifetimePopsByEmp[emp.id] || 0} compact />
                ) : (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Trophy className="w-3.5 h-3.5 text-primary" /> Popsicle Milestones
                      </span>
                      <Switch
                        checked={!!showMilestones[emp.id]}
                        onCheckedChange={(v) => setShowMilestones((prev) => ({ ...prev, [emp.id]: v }))}
                      />
                    </div>
                    {showMilestones[emp.id] && (
                      <EmployeeMilestoneTracker lifetimePops={lifetimePopsByEmp[emp.id] || 0} compact />
                    )}
                  </div>
                )}

                {/* Admin actions only */}
                {isAdmin && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(emp)} className="gap-1 text-xs">
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                    {!emp.terminated ? (
                      <Button variant="ghost" size="sm" onClick={() => handleTerminateReinstate(emp, "terminate")} className="gap-1 text-xs text-red-600 hover:text-red-700">
                        <UserX className="w-3 h-3" /> Terminate
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleTerminateReinstate(emp, "reinstate")} className="gap-1 text-xs text-green-600 hover:text-green-700">
                        <UserCheck className="w-3 h-3" /> Reinstate
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(emp.id)} className="gap-1 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            );
        };

        return (
          <div className="space-y-8">
            {/* Active employees */}
            {activeEmps.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeEmps.map(renderCard)}
              </div>
            )}

            {/* Inactive employees — admin only */}
            {isAdmin && inactiveEmps.length > 0 && (
              <div>
                <h2 className="font-heading font-semibold text-lg mb-3 text-muted-foreground">Inactive Employees</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
                  {inactiveEmps.map(renderCard)}
                </div>
              </div>
            )}

            {/* Terminated employees — admin only */}
            {isAdmin && terminatedEmps.length > 0 && (
              <div>
                <h2 className="font-heading font-semibold text-lg mb-3 text-destructive">Terminated Employees</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                  {terminatedEmps.map(renderCard)}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}