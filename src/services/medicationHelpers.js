export const MEDICATION_TIMING_OPTIONS = [
  { id: "before_food", label: "Before food" },
  { id: "after_food", label: "After food" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "night", label: "Night" }
];

function includesText(value, pattern) {
  return value.includes(pattern);
}

export function inferMedicationTimings(medicine = {}) {
  const text = `${medicine.frequency || ""} ${medicine.instructions || ""} ${medicine.rationale || ""}`.toLowerCase();
  const inferred = [];

  if (includesText(text, "before")) {
    inferred.push("before_food");
  }

  if (includesText(text, "after")) {
    inferred.push("after_food");
  }

  if (includesText(text, "morning") || includesText(text, "breakfast")) {
    inferred.push("morning");
  }

  if (includesText(text, "afternoon") || includesText(text, "lunch")) {
    inferred.push("afternoon");
  }

  if (
    includesText(text, "night") ||
    includesText(text, "evening") ||
    includesText(text, "bedtime") ||
    includesText(text, "dinner")
  ) {
    inferred.push("night");
  }

  return Array.from(new Set(inferred));
}

export function getMedicationTimings(medicine = {}) {
  return medicine.timings?.length ? medicine.timings : inferMedicationTimings(medicine);
}

export function formatMedicationTimings(medicine = {}) {
  const timings = getMedicationTimings(medicine);

  if (!timings.length) {
    return "Doctor will confirm tablet timing";
  }

  return timings
    .map((timing) => MEDICATION_TIMING_OPTIONS.find((option) => option.id === timing)?.label || timing)
    .join(" | ");
}
