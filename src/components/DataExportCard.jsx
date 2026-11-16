import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Database, Download, Loader2 } from "lucide-react";
import { buildAllDataPdf } from "@/lib/allDataPdf";

export default function DataExportCard() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setError("");
    setSummary("");
    try {
      const res = await base44.functions.invoke("exportAllData", {});
      const data = res.data;
      if (!data || data.error) throw new Error(data?.error || "Export failed");

      const doc = buildAllDataPdf(data);
      doc.save(`pace-intelligence-data-${new Date().toISOString().slice(0, 10)}.pdf`);

      setSummary(`Exported ${data.total_records ?? 0} records from ${Object.keys(data.tables || {}).length} tables (${doc.getNumberOfPages()} pages).`);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-4 h-4 text-primary" />
        <h2 className="font-heading font-semibold text-base">Export All Data</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Download every record in the app — shifts, base mixing, employees, schedules, time tracking, flavors, inventory, materials, ingredients, order pickups, pallets, posts, and settings — as one PDF, grouped by table with a contents page. Admin only.
      </p>
      <Button size="sm" className="gap-2" onClick={handleExport} disabled={exporting}>
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {exporting ? "Gathering data..." : "Export All Data"}
      </Button>
      {summary && <p className="text-xs text-green-600 mt-3">{summary}</p>}
      {error && <p className="text-xs text-destructive mt-3">{error}</p>}
    </div>
  );
}