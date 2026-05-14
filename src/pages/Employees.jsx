import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Users, Plus, Pencil, Trash2, Check, X, Star, UserX, UserCheck, Phone, Shield, ChevronDown } from "lucide-react";
import { getBestPosition, getEmployeePosition, getTotalCases, getCasesPerHour } from "../lib/analyticsHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmptyState from "../components/EmptyState";
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
  const [form, setForm] = useState({ name: "", employee_number: "", phone_number: "", active: true, app_role: "user" });
  const [passwordDialog, setPasswordDialog] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [selectedPosition, setSelectedPosition] = useState({}); // empId -> position string

  useEffect(() => {
    async function load() {
      const [data, prodShifts] = await Promise.all([
        base44.entities.Employee.list("name", 500),
        base44.entities.Shift.list("-shift_date", 500),
      ]);
      setEmployees(data);
      setShifts(prodShifts);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!form.name || !form.employee_number) return;
    if (editingId) {
      await base44.entities.Employee.update(editingId, form);
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...form } : e)));
      // Sync role to User entity if linked
      const users = await base44.entities.User.list();
      const linked = users.find((u) => u.employee_number === form.employee_number);
      if (linked) {
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
      active: emp.active !== false,
      app_role: emp.app_role || "user",
    });
    setEditingId(emp.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({ name: "", employee_number: "", phone_number: "", active: true, app_role: "user" });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleDelete(id) {
    await base44.entities.Employee.delete(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  }

  function openPasswordDialog(emp, action) {
    setPasswordDialog({ emp, action });
    setPasswordInput("");
    setPasswordError("");
  }

  async function handlePasswordConfirm() {
    if (passwordInput !== "ecap") {
      setPasswordError("Incorrect password.");
      return;
    }
    const { emp, action } = passwordDialog;
    setPasswordDialog(null);

    if (action === "add") {
      resetForm();
      setShowForm(true);
    } else if (action === "edit") {
      startEdit(emp);
    } else if (action === "delete") {
      await handleDelete(emp.id);
    } else if (action === "terminate" || action === "reinstate") {
      const isTerminating = action === "terminate";
      await base44.entities.Employee.update(emp.id, { terminated: isTerminating, active: !isTerminating });
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, terminated: isTerminating, active: !isTerminating } : e));
      const users = await base44.entities.User.list();
      const linked = users.find((u) => u.employee_number === emp.employee_number);
      if (linked) {
        await base44.entities.User.update(linked.id, { role: isTerminating ? "terminated" : (emp.app_role || "user") });
      }
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
          <Button className="gap-2" onClick={() => openPasswordDialog(null, "add")}>
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">App Role</label>
              <Select value={form.app_role} onValueChange={(v) => setForm({ ...form, app_role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <span className="text-sm">Active</span>
              </div>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
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
                      if (!positionData[pos]) positionData[pos] = { shifts: 0, totalCases: 0, totalHours: 0 };
                      positionData[pos].shifts += 1;
                      positionData[pos].totalCases += totalCases;
                      positionData[pos].totalHours += duration;
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
                      <div className="flex gap-3">
                        <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-center">
                          <p className="font-heading font-bold text-primary text-sm">{avgCph}</p>
                          <p className="text-xs text-muted-foreground">cases/hr</p>
                        </div>
                        <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-center">
                          <p className="font-heading font-bold text-primary text-sm">{avgCases}</p>
                          <p className="text-xs text-muted-foreground">avg cases/shift</p>
                        </div>
                        <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-center">
                          <p className="font-heading font-bold text-primary text-sm">{pd.shifts}</p>
                          <p className="text-xs text-muted-foreground">shifts</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Admin actions only */}
                {isAdmin && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => openPasswordDialog(emp, "edit")} className="gap-1 text-xs">
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                    {!emp.terminated ? (
                      <Button variant="ghost" size="sm" onClick={() => openPasswordDialog(emp, "terminate")} className="gap-1 text-xs text-red-600 hover:text-red-700">
                        <UserX className="w-3 h-3" /> Terminate
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => openPasswordDialog(emp, "reinstate")} className="gap-1 text-xs text-green-600 hover:text-green-700">
                        <UserCheck className="w-3 h-3" /> Reinstate
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openPasswordDialog(emp, "delete")} className="gap-1 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Password Dialog */}
      {passwordDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="font-heading font-semibold text-lg mb-1">
              {passwordDialog.action === "add" ? "Add Employee" :
               passwordDialog.action === "edit" ? `Edit ${passwordDialog.emp?.name}` :
               passwordDialog.action === "delete" ? `Delete ${passwordDialog.emp?.name}` :
               passwordDialog.action === "terminate" ? `Terminate ${passwordDialog.emp?.name}` :
               `Reinstate ${passwordDialog.emp?.name}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {passwordDialog.action === "add" ? "Enter the admin password to add a new employee." :
               passwordDialog.action === "edit" ? "Enter the admin password to edit this employee." :
               passwordDialog.action === "delete" ? "This will permanently remove the employee. Enter the admin password to confirm." :
               passwordDialog.action === "terminate" ? "This will revoke their access to the app. Enter the admin password to confirm." :
               "This will restore their access to the app. Enter the admin password to confirm."}
            </p>
            <input
              type="password"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mb-2"
              placeholder="Admin password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordConfirm()}
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive mb-2">{passwordError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setPasswordDialog(null)}>Cancel</Button>
              <Button
                size="sm"
                className={passwordDialog.action === "terminate" || passwordDialog.action === "delete" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                onClick={handlePasswordConfirm}
              >
                {passwordDialog.action === "add" ? "Continue" :
                 passwordDialog.action === "edit" ? "Continue" :
                 passwordDialog.action === "delete" ? "Delete" :
                 passwordDialog.action === "terminate" ? "Terminate" : "Reinstate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}