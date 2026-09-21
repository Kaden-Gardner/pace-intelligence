import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { empFirstName } from "@/lib/employeeName";

const TRAINING_POSITIONS = [
  "Filling", "Pulling", "Sorting", "Bagging", "Boxing", "Shift Lead", "General"
];

function EmployeeSelect({ label, value, onChange, employees, required }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>{empFirstName(e)} (#{e.employee_number})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// training_employees stored as "empId|position" strings for backward compat
function parseTrainee(str) {
  if (!str) return { empId: str, position: "" };
  const idx = str.indexOf("|");
  if (idx === -1) return { empId: str, position: "" };
  return { empId: str.substring(0, idx), position: str.substring(idx + 1) };
}
function encodeTrainee(empId, position) {
  return `${empId}|${position}`;
}

export default function ShiftPositionsSection({ form, updateForm, employees }) {
  const trainees = (form.training_employees || []).map(parseTrainee);

  function addTrainee() {
    updateForm("training_employees", [...(form.training_employees || []), encodeTrainee("", "")]);
  }

  function updateTrainee(index, empId, position) {
    const updated = (form.training_employees || []).map((t, i) => {
      if (i !== index) return t;
      const parsed = parseTrainee(t);
      return encodeTrainee(empId ?? parsed.empId, position ?? parsed.position);
    });
    updateForm("training_employees", updated);
  }

  function removeTrainee(index) {
    updateForm("training_employees", (form.training_employees || []).filter((_, i) => i !== index));
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
        <div className="space-y-2">
          {trainees.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={t.empId || undefined} onValueChange={(v) => updateTrainee(i, v, undefined)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{empFirstName(e)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={t.position || undefined} onValueChange={(v) => updateTrainee(i, undefined, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Training on..." /></SelectTrigger>
                  <SelectContent>
                    {TRAINING_POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0" onClick={() => removeTrainee(i)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1 text-xs mt-1" onClick={addTrainee}>
            <Plus className="w-3 h-3" /> Add Trainee
          </Button>
        </div>
      </div>
    </section>
  );
}