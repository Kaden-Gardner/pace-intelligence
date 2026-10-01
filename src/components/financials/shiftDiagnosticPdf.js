import { jsPDF } from "jspdf";

const LOGO_URL = "https://media.base44.com/images/public/69daba0a36b037ad40a9ae2d/4ee4e771c_PaceL-removebg-preview.png";

function fmt$(n) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function fmtHours(h) {
  if (!h) return "0h";
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

// Loads the Pace logo image so it can be embedded at the top of the PDF.
function loadLogo() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = LOGO_URL;
  });
}

export async function exportShiftDiagnosticPdf({ summaries, totals, monthlySales, monthLabel, financialMode }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  // Logo
  try {
    const logo = await loadLogo();
    const logoH = 12;
    const logoW = logo.width ? (logo.width / logo.height) * logoH : 36;
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 3;
  } catch {
    // logo unavailable — continue without it
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text("Shift Diagnostic Report", margin, y + 4);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(monthLabel, margin, y);
  y += 7;

  // Summary stats (two columns)
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const stats = [
    financialMode ? `Total Labor: ${fmt$(totals.totalLabor)}` : null,
    financialMode ? `Total Supply: ${fmt$(totals.totalSupply)}` : null,
    financialMode ? `Total Combined: ${fmt$(totals.totalCombined)}` : null,
    financialMode ? `Avg Cost/Shift: ${fmt$(totals.avgShiftCost)}` : null,
    financialMode ? `Avg Cost/Case: ${totals.avgCostPerCase != null ? fmt$(totals.avgCostPerCase) : "—"}` : null,
    financialMode ? `Predicted Revenue: ${fmt$(totals.totalPredictedRev)}` : null,
    financialMode ? `Avg Profit Ratio: ${totals.avgProfitRatio != null ? `${totals.avgProfitRatio.toFixed(2)}x` : "—"}` : null,
    financialMode ? `Total Waste Cost: ${fmt$(totals.totalWasteCost)}` : null,
    `Total Cases: ${totals.totalCases.toLocaleString()}`,
    `Avg Cases/Hour: ${totals.avgCasesPerHour.toFixed(1)}`,
    `Waste (gal): ${totals.totalWasteGallons.toFixed(1)}`,
    `Total Downtime: ${fmtHours(totals.totalDowntime)}`,
    `Avg Crew Size: ${totals.avgEmpCount.toFixed(1)}`,
  ].filter(Boolean);
  const colW = (pageW - margin * 2) / 2;
  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.text(s, margin + col * colW, y + row * 5);
  });
  y += Math.ceil(stats.length / 2) * 5 + 4;

  // Sales vs. Production Value
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Sales vs. Production Value", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Sold from orders: ${fmt$(monthlySales.revenue)}  (${monthlySales.casesSold.toLocaleString()} cases, ${monthlySales.orderCount} orders)`, margin, y);
  y += 5;
  doc.text(`Value of product made: ${fmt$(monthlySales.madeValue)}  (${monthlySales.casesProduced.toLocaleString()} cases)`, margin, y);
  y += 8;

  // Per-shift breakdown table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Per-Shift Breakdown", margin, y);
  y += 4;

  const cols = [
    { key: "label", label: "Date", w: 26 },
    { key: "type", label: "Type", w: 20 },
    ...(financialMode ? [
      { key: "labor", label: "Labor", w: 22, align: "right" },
      { key: "supply", label: "Supplies", w: 22, align: "right" },
      { key: "total", label: "Total", w: 22, align: "right" },
    ] : []),
    { key: "cases", label: "Cases", w: 16, align: "right" },
    { key: "cph", label: "C/Hr", w: 16, align: "right" },
    ...(financialMode ? [
      { key: "rev", label: "Pred.Rev", w: 24, align: "right" },
      { key: "ratio", label: "Ratio", w: 16, align: "right" },
    ] : []),
    { key: "waste", label: "Waste", w: 16, align: "right" },
    { key: "down", label: "Down", w: 16, align: "right" },
    { key: "crew", label: "Crew", w: 14, align: "right" },
  ];
  const rowH = 6;
  const tableW = pageW - margin * 2;

  // Header row
  let x = margin;
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, tableW, rowH, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  cols.forEach((c) => {
    const tx = c.align === "right" ? x + c.w - 1 : x + 1;
    doc.text(c.label, tx, y + 4, { align: c.align === "right" ? "right" : "left" });
    x += c.w;
  });
  y += rowH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  // Body rows
  summaries.forEach((s) => {
    if (y > pageH - margin - rowH) {
      doc.addPage();
      y = margin;
    }
    const row = {
      label: s.label,
      type: s.isBaseMix ? "Base Mix" : "Production",
      labor: fmt$(s.laborCost),
      supply: fmt$(s.supplyCost),
      total: fmt$(s.totalCost),
      cases: s.cases != null ? String(s.cases) : "—",
      cph: s.casesPerHour != null ? s.casesPerHour.toFixed(1) : "—",
      rev: s.predictedRevenue != null ? fmt$(s.predictedRevenue) : "—",
      ratio: s.profitRatio != null ? `${s.profitRatio.toFixed(2)}x` : "—",
      waste: s.wasteGallons > 0 ? String(s.wasteGallons) : "—",
      down: s.downtimeHours > 0 ? fmtHours(s.downtimeHours) : "—",
      crew: String(s.empCount),
    };
    x = margin;
    cols.forEach((c) => {
      const tx = c.align === "right" ? x + c.w - 1 : x + 1;
      doc.text(row[c.key], tx, y + 4, { align: c.align === "right" ? "right" : "left" });
      x += c.w;
    });
    y += rowH;
  });

  // Footer page numbers on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pageCount} · Pace Intelligence`, pageW - margin, pageH - 4, { align: "right" });
  }

  doc.save(`Shift-Diagnostic-${monthLabel.replace(/\s+/g, "-")}.pdf`);
}