import { jsPDF } from "jspdf";

// Platform bookkeeping fields that mean nothing in a printed export
const HIDDEN_KEYS = new Set(["app_id", "_app_role", "created_by_id"]);
const LABEL_KEYS = ["name", "full_name", "lot_number", "material", "ingredient", "position", "email", "shift_date"];

function fmtValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  const json = JSON.stringify(value);
  return json === "{}" || json === "[]" ? "" : json;
}

function labelOf(record, index) {
  for (const key of LABEL_KEYS) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  if (typeof record.id === "string") return record.id;
  return `Record ${index + 1}`;
}

function bodyOf(record) {
  return Object.keys(record)
    .filter((key) => !HIDDEN_KEYS.has(key))
    .map((key) => {
      const value = fmtValue(record[key]);
      return value ? `${key}: ${value}` : null;
    })
    .filter(Boolean)
    .join("   \u2022   ");
}

export function buildAllDataPdf(data, appName = "Pace Intelligence") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageW - margin * 2;
  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };

  const drawSectionHeader = (text) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(text, margin, y + 5);
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 7, pageW - margin, y + 7);
    y += 11;
  };

  // Cover / summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(`${appName} - Full Data Export`, margin, y + 6);
  y += 13;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const exportedAt = data.exported_at ? new Date(data.exported_at).toLocaleString() : new Date().toLocaleString();
  doc.text(`Exported ${exportedAt}${data.exported_by ? ` by ${data.exported_by}` : ""}`, margin, y);
  y += 5;
  const tableNames = Object.keys(data.tables || {});
  doc.text(`${data.total_records ?? 0} records across ${tableNames.length} tables`, margin, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text("Contents", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60);
  tableNames.forEach((name) => {
    if (y > pageH - 15) newPage();
    doc.text(name, margin + 2, y);
    doc.text(String((data.tables[name] || []).length), margin + 80, y, { align: "right" });
    y += 4;
  });

  // One section per table
  tableNames.forEach((name) => {
    const rows = data.tables[name] || [];
    newPage();
    drawSectionHeader(`${name}   (${rows.length} records)`);

    if (!rows.length) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("No records.", margin + 2, y);
      return;
    }

    rows.forEach((record, index) => {
      const label = `${index + 1}. ${labelOf(record, index)}`.slice(0, 220);
      const lines = doc.splitTextToSize(bodyOf(record), maxW - 4);
      const blockH = 3.8 + lines.length * 2.7 + 1.8;

      if (y + blockH > pageH - 12) {
        newPage();
        drawSectionHeader(`${name} (continued)`);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.6);
      doc.setTextColor(20);
      doc.text(label, margin + 2, y);
      y += 3.8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(70);
      lines.forEach((line) => {
        doc.text(line, margin + 2, y);
        y += 2.7;
      });
      y += 1.8;
    });
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`${appName} - Full Data Export`, margin, pageH - 5);
    doc.text(`Page ${page} of ${totalPages}`, pageW - margin, pageH - 5, { align: "right" });
  }

  return doc;
}