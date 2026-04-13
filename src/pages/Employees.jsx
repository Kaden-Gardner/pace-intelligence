import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Plus, Pencil, Trash2, Check, X, Star } from "lucide-react";
import { getBestPosition } from "../lib/analyticsHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", employee_number: "", active: true });

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
      setEmployees((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, ...form } : e))
      );
    } else {
      const created = await base44.entities.Employee.create(form);
      setEmployees((prev) => [...prev, created]);
    }
    resetForm();
  }

  function startEdit(emp) {
    setForm({ name: emp.name, employee_number: emp.employee_number, active: emp.active !== false });
    setEditingId(emp.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({ name: "", employee_number: "", active: true });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleDelete(id) {
    await base44.entities.Employee.delete(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
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
          <p className="text-muted-foreground mt-1">Manage your workforce</p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add Employee
        </Button>
      </div>

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h3 className="font-heading font-semibold mb-4">{editingId ? "Edit" : "New"} Employee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee Number</label>
              <Input value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} placeholder="EMP001" />
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
          actionLabel="Add Employee"
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
                      <p className="font-medium">{emp.name}</p>
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
                  <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.active !== false ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {emp.active !== false ? "Active" : "Inactive"}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(emp)} className="gap-1 text-xs">
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive">
                        <Trash2 className="w-3 h-3" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                        <AlertDialogDescription>Remove {emp.name} from the system? Past shift data will retain their ID.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(emp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}