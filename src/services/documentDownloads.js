import { formatMedicationTimings } from "./medicationHelpers";

function sanitizeText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildPdfBytes(title, lines) {
  const safeTitle = sanitizeText(title);
  const contentLines = [
    `BT /F1 18 Tf 50 800 Td (${safeTitle}) Tj ET`,
    ...lines.map((line, index) => `BT /F1 11 Tf 50 ${778 - index * 16} Td (${sanitizeText(line)}) Tj ET`)
  ];
  const contentStream = contentLines.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function triggerDownload(bytes, fileName) {
  if (typeof window === "undefined" || !window.URL?.createObjectURL) {
    return false;
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
  return true;
}

function buildPrescriptionLines({ prescription, patient, doctor }) {
  return [
    `Patient: ${patient?.fullName || "-"}`,
    `Doctor: ${doctor?.fullName || "-"}`,
    `Issued: ${prescription.issuedAt}`,
    "",
    "Medications:",
    ...prescription.medicines.flatMap((medicine) => [
      `- ${medicine.name}`,
      `  Dose: ${medicine.dosage}`,
      `  Frequency: ${medicine.frequency}`,
      `  Timing: ${formatMedicationTimings(medicine)}`,
      `  Duration: ${medicine.duration}`,
      `  Notes: ${medicine.instructions}`
    ]),
    "",
    `Important notes: ${prescription.followUpNote || "-"}`
  ];
}

function buildLabReportLines({ order, report, patient, doctor }) {
  return [
    `Patient: ${patient?.fullName || "-"}`,
    `Doctor: ${doctor?.fullName || "-"}`,
    `Order status: ${order.status}`,
    `Ordered: ${order.orderedAt || "-"}`,
    `Completed: ${report.completedAt || "-"}`,
    "",
    "Results:",
    ...report.resultItems.flatMap((item) => [
      `- ${item.name}`,
      `  Result: ${item.result || "-"}`,
      `  Unit: ${item.unit || "-"}`,
      `  Reference: ${item.referenceRange || "-"}`,
      `  Flag: ${item.flag || "normal"}`
    ]),
    "",
    `Summary: ${report.summary || "-"}`
  ];
}

function toFileName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function downloadPrescriptionPdf(payload) {
  const title = `NIRA Prescription - ${payload.patient?.fullName || "patient"}`;
  const bytes = buildPdfBytes(title, buildPrescriptionLines(payload));
  return triggerDownload(bytes, `${toFileName(title)}.pdf`);
}

export function downloadLabReportPdf(payload) {
  const title = `NIRA Lab Report - ${payload.patient?.fullName || "patient"}`;
  const bytes = buildPdfBytes(title, buildLabReportLines(payload));
  return triggerDownload(bytes, `${toFileName(title)}.pdf`);
}
