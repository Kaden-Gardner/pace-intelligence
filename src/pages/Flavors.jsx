import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { IceCreamCone, Plus, Pencil, Trash2, Check, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyState from "../components/EmptyState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Flavors() {
  const [flavors, setFlavors] = useState([]);
  const [flavorSets, setFlavorSets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Flavor form
  const [showFlavorForm, setShowFlavorForm] = useState(false);
  const [editingFlavorId, setEditingFlavorId] = useState(null);
  const [flavorForm, setFlavorForm] = useState({ name: "", color: "#1BABAB" });

  // FlavorSet form
  const [showSetForm, setShowSetForm] = useState(false);
  const [editingSetId, setEditingSetId] = useState(null);
  const [setForm, setSetForm] = useState({ name: "", color: "", flavor_1: "", flavor_2: "", flavor_3: "", flavor_4: "" });

  useEffect(() => {
    async function load() {
      const [f, fs] = await Promise.all([
        base44.entities.Flavor.list("name"),
        base44.entities.FlavorSet.list("name"),
      ]);
      setFlavors(f);
      setFlavorSets(fs);
      setLoading(false);
    }
    load();
  }, []);

  // Flavor handlers
  async function saveFlavor() {
    if (!flavorForm.name) return;
    if (editingFlavorId) {
      await base44.entities.Flavor.update(editingFlavorId, flavorForm);
      setFlavors((prev) => prev.map((f) => (f.id === editingFlavorId ? { ...f, ...flavorForm } : f)));
    } else {
      const created = await base44.entities.Flavor.create(flavorForm);
      setFlavors((prev) => [...prev, created]);
    }
    resetFlavorForm();
  }

  function resetFlavorForm() {
    setFlavorForm({ name: "", color: "#1BABAB" });
    setEditingFlavorId(null);
    setShowFlavorForm(false);
  }

  async function deleteFlavor(id) {
    await base44.entities.Flavor.delete(id);
    setFlavors((prev) => prev.filter((f) => f.id !== id));
  }

  // FlavorSet handlers
  async function saveSet() {
    if (!setForm.name || !setForm.flavor_1) return;
    const payload = { ...setForm };
    if (!payload.flavor_2) delete payload.flavor_2;
    if (!payload.flavor_3) delete payload.flavor_3;
    if (!payload.flavor_4) delete payload.flavor_4;
    if (editingSetId) {
      await base44.entities.FlavorSet.update(editingSetId, setForm);
      setFlavorSets((prev) => prev.map((fs) => (fs.id === editingSetId ? { ...fs, ...setForm } : fs)));
    } else {
      const created = await base44.entities.FlavorSet.create(payload);
      setFlavorSets((prev) => [...prev, created]);
    }
    resetSetForm();
  }

  function resetSetForm() {
    setSetForm({ name: "", color: "", flavor_1: "", flavor_2: "", flavor_3: "", flavor_4: "" });
    setEditingSetId(null);
    setShowSetForm(false);
  }

  async function deleteSet(id) {
    await base44.entities.FlavorSet.delete(id);
    setFlavorSets((prev) => prev.filter((fs) => fs.id !== id));
  }



  const flavorMap = {};
  flavors.forEach((f) => { flavorMap[f.id] = f; });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Flavors & Sets</h1>
        <p className="text-muted-foreground mt-1">Manage flavors and flavorset configurations</p>
      </div>

      <Tabs defaultValue="flavors">
        <TabsList className="mb-6">
          <TabsTrigger value="flavors">Flavors</TabsTrigger>
          <TabsTrigger value="sets">Flavorsets</TabsTrigger>
        </TabsList>

        <TabsContent value="flavors">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => { resetFlavorForm(); setShowFlavorForm(true); }}>
              <Plus className="w-4 h-4" /> Add Flavor
            </Button>
          </div>

          {showFlavorForm && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">{editingFlavorId ? "Edit" : "New"} Flavor</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                  <Input value={flavorForm.name} onChange={(e) => setFlavorForm({ ...flavorForm, name: e.target.value })} placeholder="Strawberry" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
                  <div className="flex gap-2">
                    <input type="color" value={flavorForm.color} onChange={(e) => setFlavorForm({ ...flavorForm, color: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                    <Input value={flavorForm.color} onChange={(e) => setFlavorForm({ ...flavorForm, color: e.target.value })} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveFlavor} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
                <Button variant="ghost" onClick={resetFlavorForm}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {flavors.length === 0 && !showFlavorForm ? (
            <EmptyState icon={IceCreamCone} title="No flavors yet" description="Add your popsicle flavors to use in shifts." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {flavors.map((f) => (
                <div key={f.id} className="bg-card rounded-2xl border border-border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: f.color || "hsl(192 75% 42%)" }} />
                    <p className="font-medium text-sm">{f.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setFlavorForm({ name: f.name, color: f.color || "#1BABAB" }); setEditingFlavorId(f.id); setShowFlavorForm(true); }}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Flavor</AlertDialogTitle>
                          <AlertDialogDescription>Remove "{f.name}"?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteFlavor(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sets">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => { resetSetForm(); setShowSetForm(true); }}>
              <Plus className="w-4 h-4" /> Add Flavorset
            </Button>
          </div>

          {showSetForm && (
            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <h3 className="font-heading font-semibold mb-4">{editingSetId ? "Edit" : "New"} Flavorset</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Set Name</label>
                  <Input value={setForm.name} onChange={(e) => setSetForm({ ...setForm, name: e.target.value })} placeholder="Summer Mix" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Chart Color</label>
                  <div className="flex gap-2">
                    <input type="color" value={setForm.color || "#f59e0b"} onChange={(e) => setSetForm({ ...setForm, color: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                    <Input value={setForm.color} onChange={(e) => setSetForm({ ...setForm, color: e.target.value })} placeholder="#f59e0b" className="flex-1" />
                  </div>
                </div>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Flavor {n} {n === 1 ? "(Required)" : "(Optional)"}
                    </label>
                    <Select value={setForm[`flavor_${n}`]} onValueChange={(v) => setSetForm({ ...setForm, [`flavor_${n}`]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select flavor" /></SelectTrigger>
                      <SelectContent>
                        {flavors.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={saveSet} className="gap-2"><Check className="w-4 h-4" /> Save</Button>
                <Button variant="ghost" onClick={resetSetForm}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {flavorSets.length === 0 && !showSetForm ? (
            <EmptyState icon={Palette} title="No flavorsets yet" description="Create flavorsets to assign to shifts (up to 4 flavors each)." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {flavorSets.map((fs) => (
                <div key={fs.id} className="bg-card rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    {fs.color && <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: fs.color }} />}
                    <h4 className="font-heading font-semibold">{fs.name}</h4>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[fs.flavor_1, fs.flavor_2, fs.flavor_3, fs.flavor_4].filter(Boolean).map((fId, i) => {
                      const fl = flavorMap[fId];
                      return fl ? (
                        <div key={i} className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-sm">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fl.color || "hsl(192 75% 42%)" }} />
                          {fl.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                      setSetForm({ name: fs.name, color: fs.color || "", flavor_1: fs.flavor_1 || "", flavor_2: fs.flavor_2 || "", flavor_3: fs.flavor_3 || "", flavor_4: fs.flavor_4 || "" });
                      setEditingSetId(fs.id);
                      setShowSetForm(true);
                    }}>
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Flavorset</AlertDialogTitle>
                          <AlertDialogDescription>Remove "{fs.name}"?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSet(fs.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}