const { extractEntitiesForEmrConversion } = require("./nlpExtractor");

const GENERIC_PRECHECK_OPENING_QUESTION = "What health problem, symptom, or concern would you like help with today?";
const NON_SPECIFIC_FOCUS_PATTERNS = [
  /\bunknown\b/i,
  /^\s*n\/?a\s*$/i,
  /^\s*none\s*$/i,
  /\bpending symptom interview\b/i,
  /\bawaiting symptom interview\b/i,
  /\bchatbot symptom intake\b/i,
  /\bgeneral consultation\b/i,
  /\bclinical review\b/i,
  /^\s*(appointment|visit|booked|consultation|checkup|check-up)\s*$/i,
];

function safeString(value) {
  return String(value || "").trim();
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => safeString(value))
        .filter(Boolean)
    )
  );
}

function hasSpecificFocus(value) {
  const normalized = safeString(value);
  if (!normalized) {
    return false;
  }

  return !NON_SPECIFIC_FOCUS_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildAnalysisTranscript({ transcript = "", precheckAnswers = [] } = {}) {
  const transcriptText = safeString(transcript);
  const answerLines = (Array.isArray(precheckAnswers) ? precheckAnswers : [])
    .map((item) => {
      const questionId = safeString(item?.question_id || item?.questionId);
      const answer = safeString(item?.answer);
      if (!questionId || !answer) {
        return "";
      }
      return `${questionId}: ${answer}`;
    })
    .filter(Boolean);

  return [transcriptText, ...answerLines].filter(Boolean).join(". ");
}

function deriveFocusLabel(chiefComplaint, extraction) {
  if (hasSpecificFocus(chiefComplaint)) {
    return safeString(chiefComplaint);
  }

  if (hasSpecificFocus(extraction?.chiefComplaint)) {
    return safeString(extraction.chiefComplaint);
  }

  const firstSymptom = uniqueStrings(extraction?.symptoms)[0] || "";
  if (hasSpecificFocus(firstSymptom)) {
    return firstSymptom;
  }

  return "";
}

function buildRedFlagQuestion(focusLabel, symptoms = []) {
  const lowerFocus = safeString(focusLabel).toLowerCase();
  const lowerSymptoms = uniqueStrings(symptoms).map((item) => item.toLowerCase()).join(" ");

  if (/chest|heart|breath|asthma|lung/.test(lowerFocus) || /chest pain|shortness of breath/.test(lowerSymptoms)) {
    return "Have you had chest tightness, worsening shortness of breath, fainting, or lips turning blue?";
  }

  if (/stomach|abdomen|abdominal|constipation|diarrhea|vomit|nausea/.test(lowerFocus) || /stomach pain|abdominal pain|vomiting|black stools/.test(lowerSymptoms)) {
    return "Have you had repeated vomiting, black stools, blood in stool, severe swelling, or inability to pass stool or gas?";
  }

  if (/head|migraine|dizz|vision/.test(lowerFocus) || /headache|dizziness/.test(lowerSymptoms)) {
    return "Have you had fainting, confusion, new weakness, trouble speaking, or the worst headache of your life?";
  }

  if (/fever|infection|cough|cold|rash/.test(lowerFocus) || /fever|cough|rash/.test(lowerSymptoms)) {
    return "Have you had high fever, trouble breathing, dehydration, spreading rash, or worsening weakness?";
  }

  return "Have you had any warning signs such as fainting, bleeding, severe breathing trouble, chest pain, or severe worsening of symptoms?";
}

function buildLocalCdssQuestions({ chiefComplaint = "", transcript = "", extraction = null } = {}) {
  const focusLabel = deriveFocusLabel(chiefComplaint, extraction);
  const symptoms = uniqueStrings(extraction?.symptoms);
  const duration = safeString(extraction?.duration);
  const questions = [
    focusLabel
      ? {
          id: "cdss-precheck-1",
          question: `Can you describe your ${focusLabel} in more detail and where you feel it most?`,
          type: "text",
          required: true,
          category: "symptom_details",
          options: [],
        }
      : {
          id: "cdss-precheck-1",
          question: GENERIC_PRECHECK_OPENING_QUESTION,
          type: "text",
          required: true,
          category: "primary_concern",
          options: [],
        },
    {
      id: "cdss-precheck-2",
      question: duration
        ? `You mentioned it has been going on for ${duration}. Has it been getting better, worse, or staying about the same?`
        : "When did this start, and has it been getting better, worse, or staying about the same?",
      type: "text",
      required: true,
      category: "timeline",
      options: [],
    },
    {
      id: "cdss-precheck-3",
      question: "How bad is it right now on a scale of 1 to 10?",
      type: "rating",
      required: true,
      category: "severity",
      options: [],
    },
    {
      id: "cdss-precheck-4",
      question: buildRedFlagQuestion(focusLabel, symptoms),
      type: "text",
      required: true,
      category: "red_flags",
      options: [],
    },
    {
      id: "cdss-precheck-5",
      question: "What other symptoms are happening with it, and what makes it better or worse?",
      type: "text",
      required: true,
      category: "associated_symptoms",
      options: [],
    },
    {
      id: "cdss-precheck-6",
      question: "Have you tried any medicines or home remedies for it, and did they help?",
      type: "text",
      required: true,
      category: "medications",
      options: [],
    },
    {
      id: "cdss-precheck-7",
      question: "Has this happened before, and do you have any medical conditions or allergies related to it?",
      type: "text",
      required: true,
      category: "history",
      options: [],
    },
  ];

  return {
    questions,
    usedFallback: true,
    model: "local-cdss",
    transcriptSummary: safeString(transcript).slice(0, 240),
  };
}

function buildObjectiveSummary(extraction) {
  const vitals = extraction?.vitals || {};
  const objectiveParts = [];

  if (Number.isFinite(Number(vitals.temperature))) {
    objectiveParts.push(`Temperature ${Number(vitals.temperature)}`);
  }
  if (Number.isFinite(Number(vitals.spo2))) {
    objectiveParts.push(`SpO2 ${Number(vitals.spo2)}%`);
  }
  if (safeString(vitals.bloodPressure)) {
    objectiveParts.push(`Blood pressure ${safeString(vitals.bloodPressure)}`);
  }
  if (Number.isFinite(Number(vitals.pulse))) {
    objectiveParts.push(`Pulse ${Number(vitals.pulse)}`);
  }

  const findings = uniqueStrings(extraction?.examFindings);
  if (findings.length) {
    objectiveParts.push(`Exam findings: ${findings.join(", ")}`);
  }

  return objectiveParts.join(". ");
}

function detectAlerts(transcript, extraction) {
  const lowerTranscript = safeString(transcript).toLowerCase();
  const alerts = [];

  if (/\bchest pain\b|\bshortness of breath\b|\bbreathing difficulty\b|\bblack stools?\b|\bblood in stool\b|\bfaint(ed|ing)?\b|\bseizure\b|\bconfusion\b/.test(lowerTranscript)) {
    alerts.push({
      code: "red_flag_symptoms",
      severity: "high",
      message: "Red-flag symptoms were mentioned and should be reviewed urgently."
    });
  }

  if (Number(extraction?.vitals?.spo2) > 0 && Number(extraction.vitals.spo2) < 94) {
    alerts.push({
      code: "low_spo2",
      severity: "high",
      message: `Reported SpO2 is ${Number(extraction.vitals.spo2)}%, which needs urgent review.`
    });
  }

  if (Number(extraction?.vitals?.temperature) >= 101) {
    alerts.push({
      code: "fever_reported",
      severity: "medium",
      message: `Reported temperature is ${Number(extraction.vitals.temperature)}, suggesting fever.`
    });
  }

  return alerts;
}

function buildSubjectiveSummary(transcript, extraction, precheckAnswers = []) {
  const symptoms = uniqueStrings(extraction?.symptoms);
  const chiefComplaint = safeString(extraction?.chiefComplaint);
  const duration = safeString(extraction?.duration);
  const answeredCount = Array.isArray(precheckAnswers) ? precheckAnswers.filter((item) => safeString(item?.answer)).length : 0;

  const parts = [];
  if (chiefComplaint) {
    parts.push(`Primary concern: ${chiefComplaint}`);
  }
  if (symptoms.length) {
    parts.push(`Symptoms: ${symptoms.join(", ")}`);
  }
  if (duration) {
    parts.push(`Duration: ${duration}`);
  }
  if (answeredCount) {
    parts.push(`Pre-check answers captured: ${answeredCount}`);
  }
  if (!parts.length && safeString(transcript)) {
    parts.push(safeString(transcript));
  }

  return parts.join(". ");
}

function buildAssessmentSummary(extraction) {
  const diagnoses = uniqueStrings(extraction?.diagnoses);
  if (diagnoses.length) {
    return `Likely clinical focus: ${diagnoses.join(", ")}. Requires doctor confirmation.`;
  }

  const chiefComplaint = safeString(extraction?.chiefComplaint);
  const symptoms = uniqueStrings(extraction?.symptoms);
  if (chiefComplaint) {
    return `Symptom-driven assessment centered on ${chiefComplaint}. Requires doctor confirmation.`;
  }
  if (symptoms.length) {
    return `Symptom-driven assessment based on ${symptoms.join(", ")}. Requires doctor confirmation.`;
  }

  return "Symptom-driven assessment pending doctor confirmation.";
}

function buildPlanSummary(extraction, alerts) {
  const parts = [
    "Doctor to review symptoms, confirm diagnosis, and finalize treatment plan."
  ];

  if (alerts.length) {
    parts.unshift("Prioritize review of the red-flag signals before finalizing the encounter.");
  }

  if (uniqueStrings(extraction?.medications).length) {
    parts.push("Review the patient's current medicines for interactions or duplication.");
  }

  return parts.join(" ");
}

async function analyzeCdssTranscript(input = {}) {
  const transcript = buildAnalysisTranscript(input);
  const extraction = await extractEntitiesForEmrConversion(transcript);
  const alerts = detectAlerts(transcript, extraction);
  const diagnoses = uniqueStrings(extraction?.diagnoses).map((name) => ({
    name,
    icd10_code: "",
    confidence: extraction?.usedFallback ? 0.62 : 0.86
  }));
  const medications = uniqueStrings(extraction?.medications).map((name) => ({
    name,
    dose: "",
    unit: "",
    frequency_per_day: null,
    duration_days: null
  }));

  return {
    soap: {
      subjective: buildSubjectiveSummary(transcript, extraction, input?.precheckAnswers),
      objective: buildObjectiveSummary(extraction),
      assessment: buildAssessmentSummary(extraction),
      plan: buildPlanSummary(extraction, alerts)
    },
    diagnoses,
    medications,
    alerts,
    confidence_scores: {
      subjective: extraction?.usedFallback ? 0.68 : 0.9,
      objective: extraction?.usedFallback ? 0.64 : 0.84,
      assessment: extraction?.usedFallback ? 0.6 : 0.82,
      plan: extraction?.usedFallback ? 0.58 : 0.78
    },
    differential_diagnoses: diagnoses.map((item) => ({ name: item.name })),
    extracted_entities: extraction,
    model: extraction?.model || "local-cdss",
    usedFallback: Boolean(extraction?.usedFallback)
  };
}

module.exports = {
  analyzeCdssTranscript,
  buildLocalCdssQuestions
};
