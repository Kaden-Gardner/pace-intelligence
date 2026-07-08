import { Input } from "@/components/ui/input";

export default function ShiftScoresSection({ form, updateForm, employees }) {
  const assignedIds = [
    form.filling_employee,
    form.pulling_employee_1,
    form.pulling_employee_2,
    form.pulling_employee_3,
    form.sorting_employee,
    form.bagging_employee,
    form.boxing_employee,
    form.shift_lead,
    ...(form.training_employees || []).map((t) => {
      const idx = t.indexOf("|");
      return idx === -1 ? t : t.substring(0, idx);
    }),
  ].filter(Boolean);

  const uniqueIds = [...new Set(assignedIds)];
  const scores = form.employee_scores || [];

  function getScore(empId) {
    const entry = scores.find((s) => s.employee_id === empId);
    return entry ? entry.score : "";
  }

  function setScore(empId, value) {
    const num = value === "" ? "" : Math.max(0, Math.min(10, Number(value)));
    const existing = scores.find((s) => s.employee_id === empId);
    let newScores;
    if (existing) {
      newScores = scores.map((s) => (s.employee_id === empId ? { ...s, score: num } : s));
    } else {
      newScores = [...scores, { employee_id: empId, score: num }];
    }
    updateForm("employee_scores", newScores);
  }

  if (uniqueIds.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl border border-border p-6">
      <h2 className="font-heading font-semibold text-lg mb-1">Employee Scores</h2>
      <p className="text-xs text-muted-foreground mb-4">Rate each employee 0–10 for this shift. Leave blank to skip.</p>
      <div className="space-y-3">
        {uniqueIds.map((empId) => {
          const emp = employees.find((e) => e.id === empId);
          return (
            <div key={empId} className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">{emp?.name || "Unknown"}</span>
              <Input
                type="number"
                min={0}
                max={10}
                step={1}
                value={getScore(empId)}
                onChange={(e) => setScore(empId, e.target.value)}
                className="w-20 text-center"
                placeholder="—"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}