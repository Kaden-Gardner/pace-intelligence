import { Award } from "lucide-react";

export default function DreamTeamCard({ dreamTeam }) {
  if (!dreamTeam || dreamTeam.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-semibold text-lg">Dream Team</h3>
        </div>
        <p className="text-sm text-muted-foreground">Need more shift data to determine the dream team.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Award className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold text-lg">Dream Team</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Highest labor-only ROI crew</p>
      <div className="space-y-3">
        {dreamTeam.map((emp, i) => (
          <div key={emp.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {i + 1}
            </div>
            <div>
              <p className="font-medium text-sm">{emp.name}</p>
              <p className="text-xs text-muted-foreground">#{emp.employee_number}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}