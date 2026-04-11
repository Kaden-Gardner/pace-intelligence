import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

function EmployeeSelect({ label, value, onChange, employees, required }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.name} (#{e.employee_number})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function ShiftPositionsSection({ form, updateForm, employees }) {
  function toggleTraining(empId) {
    const current = form.training_employees || [];
    const updated = current.includes(empId)
      ? current.filter((id) => id !== empId)
      : [...current, empId];
    updateForm("training_employees", updated);
  }

  return (
    <section className="bg-card rounded-2xl border border-border p-6">
      <h2 className="font-heading font-semibold text-lg mb-4">Positions</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <EmployeeSelect label="Filling" value={form.filling_employee} onChange={(v) => updateForm("filling_employee", v)} employees={employees} />
        <EmployeeSelect label="Pulling 1" value={form.pulling_employee_1} onChange={(v) => updateForm("pulling_employee_1", v)} employees={employees} required />
        <EmployeeSelect label="Pulling 2" value={form.pulling_employee_2} onChange={(v) => updateForm("pulling_employee_2", v)} employees={employees} />
        <EmployeeSelect label="Pulling 3" value={form.pulling_employee_3} onChange={(v) => updateForm("pulling_employee_3", v)} employees={employees} />
        <EmployeeSelect label="Sorting" value={form.sorting_employee} onChange={(v) => updateForm("sorting_employee", v)} employees={employees} />
        <EmployeeSelect label="Bagging" value={form.bagging_employee} onChange={(v) => updateForm("bagging_employee", v)} employees={employees} />
        <EmployeeSelect label="Boxing" value={form.boxing_employee} onChange={(v) => updateForm("boxing_employee", v)} employees={employees} />
        <EmployeeSelect label="Shift Lead" value={form.shift_lead} onChange={(v) => updateForm("shift_lead", v)} employees={employees} />
      </div>

      {/* Training positions */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Training Positions (optional)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors">
              <Checkbox
                checked={(form.training_employees || []).includes(emp.id)}
                onCheckedChange={() => toggleTraining(emp.id)}
              />
              {emp.name}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}