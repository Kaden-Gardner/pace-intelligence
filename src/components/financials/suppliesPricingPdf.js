import { jsPDF } from "jspdf";

const LOGO_URL = "https://media.base44.com/images/public/69daba0a36b037ad40a9ae2d/4ee4e771c_PaceL-removebg-preview.png";

function fmt$(n) {
  if (n == null || isNaN(n)) return "Not set";
  return `$${Number(n).toFixed(2)}`;
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

// sections: [{ name, rows: [{ label, sublabel, price }] }]
// Only supply prices are exported — facility cost per shift and savings goal
// accrual are intentionally excluded.
export async function exportSuppliesPricingPdf({ sections }) {
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
  doc.text("Supplies Pricing", margin, y + 4);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, y);
  y += 7;

  const tableW = pageW - margin * 2;
  const labelW = 90;
  const subW = 80;
  const priceW = tableW - labelW - subW;
  const rowH = 6;
  const headerH = 6;

  sections.forEach((section) => {
    // Page break if needed
    if (y > pageH - margin - headerH - rowH) {
      doc.addPage();
      y = margin;
    }

    // Section header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(section.name, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    // Table header
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y, tableW, headerH, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60);
    doc.text("Item", margin + 1, y + 4);
    doc.text("Details", margin + labelW + 1, y + 4);
    doc.text("Price / Unit", margin + labelW + subW + priceW - 1, y + 4, { align: "right" });
    y += headerH;

    // Rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    section.rows.forEach((row) => {
      if (y > pageH - margin - rowH) {
        doc.addPage();
        y = margin;
      }
      doc.setTextColor(30);
      const label = row.label.length > 40 ? row.label.slice(0, 39) + "…" : row.label;
      doc.text(label, margin + 1, y + 4);

      const sub = (row.sublabel || "").length > 40 ? (row.sublabel || "").slice(0, 39) + "…" : (row.sublabel || "");
      doc.setTextColor(110);
      doc.text(sub, margin + labelW + 1, y + 4);

      doc.setTextColor(30);
      doc.setFont("helvetica", "bold");
      doc.text(fmt$(row.price), margin + labelW + subW + priceW - 1, y + 4, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += rowH;
    });

    y += 4;
  });

  // Footer page numbers on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pageCount} · Pace Intelligence`, pageW - margin, pageH - 4, { align: "right" });
  }

  doc.save(`Supplies-Pricing-${new Date().toISOString().slice(0, 10)}.pdf`);
}