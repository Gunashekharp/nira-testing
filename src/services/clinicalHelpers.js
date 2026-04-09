import { uid } from "../lib/utils";
import { getMedicationTimings } from "./medicationHelpers";

const interviewBlueprints = {
  fever: {
    diagnosis: { label: "Acute viral fever", code: "B34.9", confidence: 0.86 },
    plan: "Supportive therapy, hydration, temperature monitoring, and review if fever persists beyond 72 hours.",
    meds: [
      {
        name: "Paracetamol",
        dosage: "650 mg",
        frequency: "Every 8 hours if fever",
        duration: "3 days",
        rationale: "Fever symptom relief",
        timings: ["morning", "afternoon", "night", "after_food"]
      }
    ],
    differentials: ["Upper respiratory viral illness", "Influenza-like illness", "Early bacterial infection"],
    alerts: ["Check for red flags such as breathlessness, dehydration, or persistent high fever."],
    labSuggestions: [
      { testId: "lab-cbc", reason: "Check infection burden if fever persists or looks more than self-limiting." }
    ]
  },
  cough: {
    diagnosis: { label: "Upper respiratory tract infection", code: "J06.9", confidence: 0.82 },
    plan: "Steam inhalation, oral fluids, supportive medications, and red-flag advice for breathlessness.",
    meds: [
      {
        name: "Cetirizine",
        dosage: "10 mg",
        frequency: "At night",
        duration: "5 days",
        rationale: "Reduce allergy and cold symptoms",
        timings: ["night"]
      },
      {
        name: "Warm saline gargles",
        dosage: "As needed",
        frequency: "Three times daily",
        duration: "5 days",
        rationale: "Supportive throat care",
        timings: ["morning", "afternoon", "night"]
      }
    ],
    differentials: ["Allergic rhinitis", "Pharyngitis", "Viral URI"],
    alerts: ["Escalate if cough is associated with chest pain or shortness of breath."],
    labSuggestions: [{ testId: "lab-cbc", reason: "Consider CBC if symptoms are persistent or worsening." }]
  },
  stomach: {
    diagnosis: { label: "Acute gastritis", code: "K29.00", confidence: 0.88 },
    plan: "Acid suppression, food trigger avoidance, and hydration counseling.",
    meds: [
      {
        name: "Pantoprazole",
        dosage: "40 mg",
        frequency: "Before breakfast",
        duration: "5 days",
        rationale: "Reduce acidity",
        timings: ["morning", "before_food"]
      }
    ],
    differentials: ["GERD", "Dyspepsia", "Food intolerance"],
    alerts: ["Review NSAID use and food triggers before confirming the plan."],
    labSuggestions: [
      { testId: "lab-cbc", reason: "Rule out anemia or inflammatory response if pain is persistent." },
      { testId: "lab-lft", reason: "Consider LFT if symptoms suggest upper abdominal or hepatobiliary overlap." }
    ]
  },
  headache: {
    diagnosis: { label: "Migraine without aura", code: "G43.0", confidence: 0.78 },
    plan: "Identify triggers, hydration, acute symptom relief, and rest in a low-light room.",
    meds: [
      {
        name: "Naproxen",
        dosage: "250 mg",
        frequency: "Twice daily after food",
        duration: "3 days",
        rationale: "Short-course symptom relief",
        timings: ["morning", "night", "after_food"]
      }
    ],
    differentials: ["Tension headache", "Migraine", "Sinus headache"],
    alerts: ["Confirm there are no neurological red flags before closing the visit."],
    labSuggestions: [{ testId: "lab-cbc", reason: "Consider CBC if fatigue, weakness, or infection symptoms coexist." }]
  },
  fatigue: {
    diagnosis: { label: "Fatigue, unspecified", code: "R53.83", confidence: 0.74 },
    plan: "Review medications, sleep quality, hydration, and consider clinician workup if fatigue persists.",
    meds: [
      {
        name: "Supportive care",
        dosage: "As advised",
        frequency: "Daily",
        duration: "5 days",
        rationale: "Placeholder until clinician completes assessment",
        timings: ["morning"]
      }
    ],
    differentials: ["Sleep deprivation", "Metabolic fatigue", "Diabetes-related fatigue"],
    alerts: ["Review chronic disease medication adherence and sleep routine."],
    labSuggestions: [
      { testId: "lab-cbc", reason: "Screen for anemia or infection as a fatigue contributor." },
      { testId: "lab-thyroid", reason: "Check thyroid dysfunction in persistent fatigue." },
      { testId: "lab-fbs", reason: "Screen glycemic status in unexplained low energy." },
      { testId: "lab-b12", reason: "Assess nutritional causes of fatigue or neuropathic symptoms." }
    ]
  }
};

export function emptyEncounterDraft(chiefComplaint = "Pending symptom interview") {
  return {
    id: uid("draft"),
    soap: {
      chiefComplaint,
      subjective: "Interview not completed yet.",
      objective: "Vitals and examination pending.",
      assessment: "Awaiting interview before APCI can propose a strong assessment.",
      plan: "Prompt patient to complete AI interview before consultation."
    },
    vitals: {
      temperature: "Pending",
      pulse: "Pending",
      bloodPressure: "Pending",
      spo2: "Pending"
    },
    diagnoses: [{ label: "Interview pending", code: "R69", confidence: 0.2 }],
    confidenceMap: {
      subjective: 0.1,
      objective: 0.1,
      assessment: 0.1,
      plan: 0.15
    },
    alerts: ["Interview incomplete. Doctor should gather history directly."],
    medicationSuggestions: [],
    differentials: ["Needs clinician review"],
    labSuggestions: []
  };
}

export function mapInterviewToBlueprint(answers) {
  const complaint = answers.primaryConcern?.toLowerCase() ?? "";

  if (complaint.includes("fever") || complaint.includes("बुखार")) return interviewBlueprints.fever;
  if (
    complaint.includes("cough") ||
    complaint.includes("cold") ||
    complaint.includes("खांसी") ||
    complaint.includes("जुकाम")
  ) {
    return interviewBlueprints.cough;
  }
  if (
    complaint.includes("stomach") ||
    complaint.includes("acidity") ||
    complaint.includes("पेट") ||
    complaint.includes("जलन")
  ) {
    return interviewBlueprints.stomach;
  }
  if (
    complaint.includes("headache") ||
    complaint.includes("migraine") ||
    complaint.includes("सिरदर्द") ||
    complaint.includes("माइग्रेन")
  ) {
    return interviewBlueprints.headache;
  }
  if (complaint.includes("fatigue") || complaint.includes("weakness") || complaint.includes("थकान")) {
    return interviewBlueprints.fatigue;
  }

  return {
    diagnosis: { label: "General OPD review", code: "R69", confidence: 0.68 },
    plan: "Clinician review required with supportive care and follow-up as needed.",
    meds: [
      {
        name: "Supportive care",
        dosage: "As advised",
        frequency: "As needed",
        duration: "3 days",
        rationale: "Placeholder APCI plan",
        timings: ["morning"]
      }
    ],
    differentials: ["Functional complaint", "Self-limiting illness", "Needs examination"],
    alerts: ["Review allergies and current medicines before approval."],
    labSuggestions: []
  };
}

export function buildDraftFromAnswers(appointment, patient, answers, existingId = uid("draft")) {
  const blueprint = mapInterviewToBlueprint(answers);
  const chiefComplaint = `${answers.primaryConcern} for ${answers.duration}`;

  return {
    id: existingId,
    appointmentId: appointment.id,
    soap: {
      chiefComplaint,
      subjective: `${patient.fullName} reports ${answers.primaryConcern}. Severity noted as ${answers.severity}. Associated notes: ${answers.associatedSymptoms}.`,
      objective: "Pre-visit interview complete; in-person vitals and examination pending.",
      assessment: `${blueprint.diagnosis.label} is the leading APCI suggestion.`,
      plan: blueprint.plan
    },
    vitals: {
      temperature: answers.primaryConcern.toLowerCase().includes("fever") ? "100.4 F" : "98.6 F",
      pulse: "82 bpm",
      bloodPressure: "122/80 mmHg",
      spo2: "99%"
    },
    diagnoses: [
      blueprint.diagnosis,
      { label: "Clinician review required", code: "Z71.1", confidence: 0.52 }
    ],
    confidenceMap: {
      subjective: 0.89,
      objective: 0.5,
      assessment: 0.77,
      plan: 0.75
    },
    medicationSuggestions: blueprint.meds,
    labSuggestions: blueprint.labSuggestions || [],
    alerts: [
      ...(answers.medications ? [`Review concurrent medications: ${answers.medications}.`] : ["No current medications reported."]),
      answers.allergies ? `Allergy caution: ${answers.allergies}.` : "No known allergies reported.",
      ...blueprint.alerts
    ],
    differentials: blueprint.differentials
  };
}

export function buildPrescriptionFromDraft(appointment, draft, note = "") {
  return {
    id: `rx-${appointment.id}`,
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    medicines: draft.medicationSuggestions.map((item) => ({
      name: item.name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.rationale,
      timings: getMedicationTimings(item)
    })),
    warnings: draft.alerts,
    followUpNote: note || "Review again if symptoms persist beyond 5 days.",
    issuedAt: new Date().toISOString()
  };
}
