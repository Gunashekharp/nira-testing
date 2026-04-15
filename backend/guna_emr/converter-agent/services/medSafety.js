const KNOWN_MEDICATIONS = [
  "paracetamol",
  "acetaminophen",
  "ibuprofen",
  "aspirin",
  "warfarin",
  "metformin",
  "insulin",
  "omeprazole",
  "pantoprazole",
  "amoxicillin",
  "azithromycin",
  "cetirizine",
];

function normalizeMedicationName(name) {
  return String(name || "").trim().toLowerCase();
}

function extractMedicationSignals(messages) {
  const transcript = (Array.isArray(messages) ? messages : [])
    .map((message) => String(message?.content || message?.text || ""))
    .join(" ")
    .toLowerCase();

  return KNOWN_MEDICATIONS.filter((name) => transcript.includes(name));
}

function getDdiWarnings(medications) {
  const meds = Array.from(new Set((Array.isArray(medications) ? medications : []).map(normalizeMedicationName)));
  const warnings = [];

  if (meds.includes("warfarin") && meds.includes("ibuprofen")) {
    warnings.push({
      severity: "high",
      medications: ["warfarin", "ibuprofen"],
      warning: "This combination can raise bleeding risk. Please confirm with a clinician before taking both.",
    });
  }

  if (meds.includes("aspirin") && meds.includes("ibuprofen")) {
    warnings.push({
      severity: "moderate",
      medications: ["aspirin", "ibuprofen"],
      warning: "Taking both together may increase stomach irritation and bleeding risk.",
    });
  }

  return warnings;
}

function getAdherenceTips(medications) {
  const meds = Array.from(new Set((Array.isArray(medications) ? medications : []).map(normalizeMedicationName)));
  if (!meds.length) {
    return [];
  }

  const tips = [
    "Use the same medicine names and doses when you speak to the doctor so your record stays accurate.",
  ];

  if (meds.some((name) => ["omeprazole", "pantoprazole"].includes(name))) {
    tips.push("Acid-reducing medicines are usually most effective when taken consistently before meals, unless your clinician advised otherwise.");
  }

  if (meds.some((name) => ["paracetamol", "acetaminophen", "ibuprofen", "aspirin"].includes(name))) {
    tips.push("Avoid doubling up pain relievers from different strips or brands without checking the ingredient labels.");
  }

  return tips;
}

module.exports = {
  extractMedicationSignals,
  getAdherenceTips,
  getDdiWarnings,
};
