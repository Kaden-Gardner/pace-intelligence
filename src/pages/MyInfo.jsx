import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, IceCream, Hash, Save } from "lucide-react";

export default function MyInfo() {
  const { user } = useAuth();
  const [favFlavor, setFavFlavor] = useState(user?.favorite_flavor || "");
  const [flavors, setFlavors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFavFlavor(user?.favorite_flavor || "");
  }, [user]);

  useEffect(() => {
    base44.entities.Flavor.list("name").then(setFlavors);
  }, []);

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
      </div>
    </div>
  );
}