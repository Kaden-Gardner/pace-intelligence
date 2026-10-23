import { jsPDF } from "jspdf";

const LOGO_URL = "https://media.base44.com/images/public/69daba0a36b037ad40a9ae2d/4ee4e771c_PaceL-removebg-preview.png";

// Loads the Pace logo so it can be embedded at the top of the PDF.
function loadLogo() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = LOGO_URL;
  });
}

// Renders a portrait table report: logo, title, subtitle, a main table and an
// optional second table (breakdown) underneath it.
// columns: [{ key, label, w, align }] — widths are mm and should add up to the
// printable width (A4 portrait is 210mm, minus 12mm margins on each side).
// breakdown: { title, columns, rows, totalsRow } — rendered below the main table.
export async function exportTimeTrackingPdf({ title, subtitle, columns, rows, totalsRow, breakdown, filename }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const rowH = 6.5;
  let y = margin;

  try {
    const logo = await loadLogo();
    const logoH = 12;
    const logoW = logo.width ? (logo.width / logo.height) * logoH : 36;
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 3;
  } catch {
    // logo unavailable — continue without it
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(title, margin, y + 4);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(subtitle, margin, y);
  y += 7;

  function drawHeaderRow(cols, width) {
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y, width, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(20);
    let x = margin;
    cols.forEach((c) => {
      const tx = c.align === "right" ? x + c.w - 1.5 : x + 1.5;
      doc.text(c.label, tx, y + 4.2, { align: c.align === "right" ? "right" : "left" });
      x += c.w;
    });
    y += rowH;
  }

  function drawRow(row, cols, bold) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(20);
    let x = margin;
    cols.forEach((c) => {
      const value = row[c.key] == null ? "" : String(row[c.key]);
      const tx = c.align === "right" ? x + c.w - 1.5 : x + 1.5;
      const text = c.align === "right" ? value : doc.splitTextToSize(value, c.w - 3)[0] || "";
      doc.text(text, tx, y + 4.2, { align: c.align === "right" ? "right" : "left" });
      x += c.w;
    });
    y += rowH;
  }

  function drawTable(cols, tableRows, totalRow) {
    const width = cols.reduce((s, c) => s + c.w, 0);
    drawHeaderRow(cols, width);
    tableRows.forEach((r) => {
      if (y > pageH - margin - rowH) {
        doc.addPage();
        y = margin;
        drawHeaderRow(cols, width);
      }
      drawRow(r, cols, false);
    });
    if (totalRow) {
      if (y > pageH - margin - rowH * 2) {
        doc.addPage();
        y = margin;
        drawHeaderRow(cols, width);
      }
      doc.setDrawColor(180);
      doc.line(margin, y, margin + width, y);
      y += 0.5;
      drawRow(totalRow, cols, true);
    }
  }

  drawTable(columns, rows, totalsRow);

  if (breakdown) {
    y += 6;
    if (y > pageH - margin - 14) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(breakdown.title, margin, y);
    y += 5;
    drawTable(breakdown.columns, breakdown.rows, breakdown.totalsRow);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pageCount} · Pace Intelligence`, pageW - margin, pageH - 5, { align: "right" });
  }

  doc.save(filename);
}