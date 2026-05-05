import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCheck } from "lucide-react";

export default function EmployeeNumberSetup({ user, onComplete }) {
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [employees, setEmployees] = useState([]);
  const [matched, setMatched] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.Employee.list().then(setEmployees);
  }, []);

  useEffect(() => {
    if (employeeNumber) {
      const found = employees.find((e) => e.employee_number === employeeNumber.trim());
      setMatched(found || null);
      setError(employeeNumber.trim() && !found ? "No employee found with that number." : "");
    } else {
      setMatched(null);
      setError("");
    }
  }, [employeeNumber, employees]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!matched) return;
    setSaving(true);
    await base44.auth.updateMe({ employee_number: employeeNumber.trim() });
    setSaving(false);
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-xl">Welcome!</h2>
            <p className="text-sm text-muted-foreground">Link your employee account to get started</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Please enter your employee number. This links your login to your employee profile so managers can view your availability.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee Number</label>
            <Input
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="e.g. 1042"
              autoFocus
            />
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            {matched && (
              <p className="text-xs text-green-600 mt-1 font-medium">✓ Found: {matched.name}</p>
            )}
          </div>

          <Button type="submit" disabled={!matched || saving} className="w-full">
            {saving ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}