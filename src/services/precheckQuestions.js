import {
  generateAdaptivePrecheckTurnViaGunaEmr,
  generateCdssPrecheck,
  generatePrecheckQuestionsViaGunaEmr
} from "./gunaEmrBridge";

const MAX_PRECHECK_QUESTIONS = 9;
const ADAPTIVE_PRECHECK_MIN_QUESTIONS = 7;
const ADAPTIVE_PRECHECK_MAX_QUESTIONS = 9;
const ADAPTIVE_PRECHECK_DEFAULT_TARGET = 8;
const LOCAL_ADAPTIVE_PRIMARY_CONCERN_QUESTION = "What health problem, symptom, or concern would you like help with today?";
const DURATION_SIGNAL_PATTERN = /\b(today|yesterday|tonight|since|for\s+\d+|\d+\s*(hour|hr|day|week|month|year)s?)\b/i;
const SEVERITY_SIGNAL_PATTERN = /\b([1-9]|10)\s*(?:\/\s*10)?\b|\b(mild|moderate|severe|very bad|unbearable|worst)\b/i;
const PATTERN_SIGNAL_PATTERN = /\b(constant|comes?\s+and\s+goes?|on and off|intermittent|sudden|gradual)\b/i;
const LOCATION_QUALITY_SIGNAL_PATTERN = /\b(left|right|center|middle|upper|lower|front|back|head|chest|throat|abdomen|abdominal|stomach|pelvis|arm|leg|eye|ear|skin|sharp|dull|burning|pressure|tight|throbbing|itchy|tingling)\b/i;
const ASSOCIATED_SYMPTOM_SIGNAL_PATTERN = /\b(fever|cough|cold|vomit|vomiting|nausea|diarrhea|constipation|breath|breathing|bleeding|blood|dizziness|weakness|rash|swelling|fatigue|chills)\b/i;
const TRIGGER_SIGNAL_PATTERN = /\b(better|worse|after|before|when|while|trigger|relieve|rest|movement|walking|eating|drinking|lying|sitting)\b/i;
const IMPACT_SIGNAL_PATTERN = /\b(sleep|work|school|walk|walking|eat|eating|drink|daily activity|routine|unable to)\b/i;
const MEDICATION_SIGNAL_PATTERN = /\b(took|taking|tablet|capsule|medicine|medication|paracetamol|ibuprofen|acetaminophen|antibiotic|home remed|ointment|inhaler)\b/i;
const HISTORY_SIGNAL_PATTERN = /\b(before|previous|again|similar|chronic|history of|usually)\b/i;
const CARE_HISTORY_SIGNAL_PATTERN = /\b(test|scan|x-ray|ultrasound|blood test|doctor|clinic|hospital|emergency|ER|prescribed|advised)\b/i;
const ALLERGY_SIGNAL_PATTERN = /\b(allerg|reaction|rash from|bad reaction|intolerance)\b/i;
const PRECHECK_PLACEHOLDER_PATTERNS = [
  /\bpending symptom interview\b/i,
  /\bawaiting symptom interview\b/i,
  /\bchatbot symptom intake\b/i,
  /\bgeneral consultation\b/i,
  /\bclinical review\b/i,
  /^\s*(booked|visit|appointment)\s*$/i
];

export async function generatePrecheckQuestions(encounterId, appointmentContext = {}) {
  const patientId = appointmentContext.patientId || appointmentContext.patient_id;
  const contextTranscript = buildPrecheckContextTranscript(appointmentContext);
  const requestPayload = {
    patientId,
    encounterId,
    chiefComplaint: sanitizeClinicalContextValue(appointmentContext.chiefComplaint),
    patientName: safeString(appointmentContext.patientName),
    patientAge: appointmentContext.patientAge,
    patientGender: safeString(appointmentContext.patientGender),
    patientNotes: contextTranscript,
    specialty: safeString(appointmentContext.doctorSpecialty || appointmentContext.specialty),
    appointmentType: safeString(appointmentContext.appointmentType),
    existingConditions: sanitizeClinicalList(appointmentContext.existingConditions),
    latestSymptoms: sanitizeClinicalList(appointmentContext.latestSymptoms),
    currentMedications: sanitizeClinicalList(appointmentContext.currentMedications),
    knownAllergies: sanitizeClinicalList(appointmentContext.knownAllergies)
  };

  try {
    const response = await generatePrecheckQuestionsViaGunaEmr(requestPayload);
    const normalizedQuestions = normalizeAiQuestions(response?.questions);
    if (normalizedQuestions.length) {
      return normalizedQuestions;
    }
    console.warn("Primary AI pre-check returned no questions, trying CDSS fallback.");
  } catch (aiError) {
    console.warn("Primary AI pre-check unavailable, trying CDSS fallback:", aiError);
  }

  if (patientId && encounterId) {
    try {
      const cdssResponse = await generateCdssPrecheck({
        patientId,
        encounterId,
        chiefComplaint: requestPayload.chiefComplaint,
        transcript: contextTranscript
      });
      const normalizedCdssQuestions = normalizeAiQuestions(cdssResponse?.questions);
      if (normalizedCdssQuestions.length) {
        return normalizedCdssQuestions;
      }
    } catch (cdssError) {
      console.warn("CDSS precheck fallback unavailable:", cdssError);
    }
  }

  throw new Error("AI pre-check question generation returned no questions.");
}

export async function generateAdaptivePrecheckTurn(encounterId, appointmentContext = {}, sessionState = {}) {
  const patientId = appointmentContext.patientId || appointmentContext.patient_id;
  const contextTranscript = buildPrecheckContextTranscript(appointmentContext);
  const askedQuestions = normalizeAdaptiveAskedQuestions(sessionState?.askedQuestions || sessionState?.questions);
  const answeredEntries = normalizeAdaptiveAnsweredEntries(sessionState?.answeredEntries);
  const targetQuestionCount = clampTargetQuestionCount(sessionState?.targetQuestionCount);
  const requestPayload = {
    patientId,
    encounterId,
    chiefComplaint: sanitizeClinicalContextValue(appointmentContext.chiefComplaint),
    patientName: safeString(appointmentContext.patientName),
    patientAge: appointmentContext.patientAge,
    patientGender: safeString(appointmentContext.patientGender),
    patientNotes: contextTranscript,
    specialty: safeString(appointmentContext.doctorSpecialty || appointmentContext.specialty),
    appointmentType: safeString(appointmentContext.appointmentType),
    existingConditions: sanitizeClinicalList(appointmentContext.existingConditions),
    latestSymptoms: sanitizeClinicalList(appointmentContext.latestSymptoms),
    currentMedications: sanitizeClinicalList(appointmentContext.currentMedications),
    knownAllergies: sanitizeClinicalList(appointmentContext.knownAllergies),
    askedQuestions,
    answeredEntries,
    targetQuestionCount
  };

  try {
    const response = await generateAdaptivePrecheckTurnViaGunaEmr(requestPayload);
    return normalizeAdaptiveTurnResponse(response, askedQuestions, answeredEntries, targetQuestionCount);
  } catch (adaptiveError) {
    console.warn("Adaptive AI pre-check unavailable, using answer-driven local fallback:", adaptiveError);
  }

  const fallbackContext = buildAdaptiveFallbackAppointmentContext(appointmentContext, answeredEntries);
  return buildLocalAdaptiveFallbackTurn(fallbackContext, askedQuestions, answeredEntries, targetQuestionCount);
}

function safeString(value) {
  return String(value || "").trim();
}

function sanitizeList(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => safeString(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function sanitizeClinicalContextValue(value) {
  const normalized = safeString(value);
  if (!normalized) {
    return "";
  }

  return PRECHECK_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
    ? ""
    : normalized;
}

function sanitizeClinicalList(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => sanitizeClinicalContextValue(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function normalizeAdaptiveAskedQuestions(questions) {
  return normalizeAiQuestions(questions).map((question) => ({
    id: question.id,
    question: question.question,
    type: question.type,
    category: question.category,
    options: question.options
  }));
}

function normalizeAdaptiveAnsweredEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      id: safeString(entry?.id),
      question: safeString(entry?.question || entry?.text),
      answer: safeString(entry?.answer),
      type: normalizeQuestionType(entry?.type),
      category: safeString(entry?.category) || "general"
    }))
    .filter((entry) => entry.question && entry.answer);
}

function extractPrimaryConcernFromAnsweredEntries(entries) {
  const candidate = (Array.isArray(entries) ? entries : []).find((entry) => {
    const category = safeString(entry?.category).toLowerCase();
    const question = safeString(entry?.question || entry?.text).toLowerCase();
    return category.includes("primary")
      || category.includes("chief")
      || /\b(main|primary)\s+(health problem|symptom|concern)\b/.test(question)
      || /\breason for (your|this) (visit|appointment)\b/.test(question)
      || /\bwhat(?:'s| is) bothering you\b/.test(question);
  });

  return sanitizeClinicalContextValue(candidate?.answer);
}

function hasSignal(values, pattern) {
  const text = (Array.isArray(values) ? values : [values])
    .map((value) => safeString(value))
    .filter(Boolean)
    .join(" ");
  return Boolean(text) && pattern.test(text);
}

function hasAnsweredCategory(answeredEntries, category) {
  return (Array.isArray(answeredEntries) ? answeredEntries : []).some(
    (entry) => safeString(entry?.category).toLowerCase() === safeString(category).toLowerCase()
  );
}

function extractActiveConcern(appointmentContext = {}, answeredEntries = []) {
  return extractPrimaryConcernFromAnsweredEntries(answeredEntries)
    || sanitizeClinicalContextValue(appointmentContext?.chiefComplaint)
    || "";
}

function buildLocalAdaptiveQuestion(id, question, category, type = "text") {
  return {
    id,
    question,
    type,
    required: true,
    category,
    options: []
  };
}

function buildLocalAdaptiveFallbackTurn(appointmentContext = {}, askedQuestions = [], answeredEntries = [], fallbackTargetQuestionCount = ADAPTIVE_PRECHECK_DEFAULT_TARGET) {
  const currentConcern = extractActiveConcern(appointmentContext, answeredEntries);
  const answeredTexts = answeredEntries.map((entry) => entry.answer);
  const askedCategories = new Set(
    (Array.isArray(askedQuestions) ? askedQuestions : [])
      .map((entry) => safeString(entry?.category).toLowerCase())
      .filter(Boolean)
  );
  const knownAllergies = sanitizeClinicalList(appointmentContext?.knownAllergies);
  const knownMedications = sanitizeClinicalList(appointmentContext?.currentMedications);
  const knownConditions = sanitizeClinicalList(appointmentContext?.existingConditions);

  const hasPrimaryConcern = Boolean(currentConcern);
  const hasTimeline = hasAnsweredCategory(answeredEntries, "timeline") || hasSignal([currentConcern, ...answeredTexts], DURATION_SIGNAL_PATTERN);
  const hasSeverityPattern =
    hasAnsweredCategory(answeredEntries, "severity_pattern")
    || hasSignal(answeredTexts, SEVERITY_SIGNAL_PATTERN)
    || hasSignal(answeredTexts, PATTERN_SIGNAL_PATTERN);
  const hasSymptomDetails =
    hasAnsweredCategory(answeredEntries, "symptom_details")
    || hasSignal([currentConcern, ...answeredTexts], LOCATION_QUALITY_SIGNAL_PATTERN);
  const hasAssociatedSymptoms =
    hasAnsweredCategory(answeredEntries, "associated_symptoms")
    || hasSignal([currentConcern, ...answeredTexts], ASSOCIATED_SYMPTOM_SIGNAL_PATTERN);
  const hasTriggersRelief =
    hasAnsweredCategory(answeredEntries, "triggers_relief")
    || hasSignal(answeredTexts, TRIGGER_SIGNAL_PATTERN);
  const hasDailyImpact =
    hasAnsweredCategory(answeredEntries, "daily_impact")
    || hasSignal(answeredTexts, IMPACT_SIGNAL_PATTERN);
  const hasMedicationContext =
    hasAnsweredCategory(answeredEntries, "medications")
    || Boolean(knownMedications.length)
    || hasSignal(answeredTexts, MEDICATION_SIGNAL_PATTERN);
  const hasHistoryContext =
    hasAnsweredCategory(answeredEntries, "history")
    || Boolean(knownConditions.length)
    || hasSignal(answeredTexts, HISTORY_SIGNAL_PATTERN);
  const hasCareHistory =
    hasAnsweredCategory(answeredEntries, "care_history")
    || hasSignal(answeredTexts, CARE_HISTORY_SIGNAL_PATTERN);
  const hasAllergyContext =
    hasAnsweredCategory(answeredEntries, "allergies")
    || Boolean(knownAllergies.length)
    || hasSignal(answeredTexts, ALLERGY_SIGNAL_PATTERN);

  const questionPlan = [
    !hasPrimaryConcern && !askedCategories.has("primary_concern")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          LOCAL_ADAPTIVE_PRIMARY_CONCERN_QUESTION,
          "primary_concern"
        )
      : null,
    !hasTimeline && !askedCategories.has("timeline")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "When did this start, and is it getting better, worse, or staying about the same?",
          "timeline"
        )
      : null,
    !hasSeverityPattern && !askedCategories.has("severity_pattern")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "How bad is it right now on a scale of 1 to 10, and is it constant or does it come and go?",
          "severity_pattern"
        )
      : null,
    !hasSymptomDetails && !askedCategories.has("symptom_details")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "Can you describe what it feels like and where in the body it is affecting you?",
          "symptom_details"
        )
      : null,
    !hasAssociatedSymptoms && !askedCategories.has("associated_symptoms")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "What other symptoms are happening with it, such as fever, vomiting, cough, breathing trouble, bleeding, weakness, or dizziness?",
          "associated_symptoms"
        )
      : null,
    !hasTriggersRelief && !askedCategories.has("triggers_relief")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "What makes it better or worse?",
          "triggers_relief"
        )
      : null,
    !hasDailyImpact && !askedCategories.has("daily_impact")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "How is this affecting your normal activities, sleep, eating, or work?",
          "daily_impact"
        )
      : null,
    !hasMedicationContext && !askedCategories.has("medications")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "Have you tried any medicines or home remedies for it, and did they help?",
          "medications"
        )
      : null,
    !hasHistoryContext && !askedCategories.has("history")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "Has this happened before, and do you have any medical conditions related to it?",
          "history"
        )
      : null,
    !hasCareHistory && !askedCategories.has("care_history")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "Have you already seen a doctor, had any tests, or received treatment for this problem?",
          "care_history"
        )
      : null,
    !hasAllergyContext && !askedCategories.has("allergies")
      ? buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "Do you have any medication allergies or past bad reactions I should note?",
          "allergies"
        )
      : null
  ].filter(Boolean);

  const remainingQuestionCount = questionPlan.length;
  const targetQuestionCount = clampTargetQuestionCount(
    Math.max(fallbackTargetQuestionCount, answeredEntries.length + remainingQuestionCount)
  );
  const nextQuestion = questionPlan[0] || null;

  if (!nextQuestion) {
    if (answeredEntries.length < ADAPTIVE_PRECHECK_MIN_QUESTIONS) {
      return {
        question: buildLocalAdaptiveQuestion(
          `adaptive-precheck-${askedQuestions.length + 1}`,
          "What else about this problem do you think your doctor should know?",
          "additional_details"
        ),
        isComplete: false,
        targetQuestionCount
      };
    }

    return {
      question: null,
      isComplete: true,
      targetQuestionCount
    };
  }

  return {
    question: nextQuestion,
    isComplete: false,
    targetQuestionCount
  };
}

function buildAdaptiveFallbackAppointmentContext(appointmentContext = {}, answeredEntries = []) {
  if (!Array.isArray(answeredEntries) || !answeredEntries.length) {
    return appointmentContext;
  }

  const primaryConcern = extractPrimaryConcernFromAnsweredEntries(answeredEntries);
  const answerTranscript = answeredEntries
    .map((entry) => `${entry.question}: ${entry.answer}`)
    .join(". ");

  return {
    ...appointmentContext,
    chiefComplaint: sanitizeClinicalContextValue(appointmentContext?.chiefComplaint) || primaryConcern,
    transcript: [
      safeString(appointmentContext?.transcript),
      answerTranscript ? `Patient pre-check answers so far: ${answerTranscript}` : "",
    ].filter(Boolean).join(". "),
    latestSymptoms: sanitizeClinicalList([
      ...(Array.isArray(appointmentContext?.latestSymptoms) ? appointmentContext.latestSymptoms : []),
      ...(primaryConcern ? [primaryConcern] : []),
    ]),
  };
}

function clampTargetQuestionCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return ADAPTIVE_PRECHECK_DEFAULT_TARGET;
  }
  return Math.min(ADAPTIVE_PRECHECK_MAX_QUESTIONS, Math.max(ADAPTIVE_PRECHECK_MIN_QUESTIONS, Math.round(numeric)));
}

function normalizeAdaptiveTurnResponse(response, askedQuestions, answeredEntries, fallbackTargetQuestionCount) {
  const targetQuestionCount = clampTargetQuestionCount(response?.targetQuestionCount ?? fallbackTargetQuestionCount);
  const isComplete = Boolean(response?.isComplete) && answeredEntries.length >= ADAPTIVE_PRECHECK_MIN_QUESTIONS;
  const question = isComplete
    ? null
    : normalizeAiQuestions(response?.question ? [response.question] : [])[0] || null;

  if (question) {
    const promptKey = question.question.toLowerCase();
    const alreadyAsked = askedQuestions.some((askedQuestion) => askedQuestion.question.toLowerCase() === promptKey);
    if (alreadyAsked) {
      throw new Error("Adaptive AI repeated an existing question.");
    }
  }

  if (!isComplete && !question) {
    throw new Error("Adaptive AI pre-check returned no usable question.");
  }

  return {
    question,
    isComplete,
    targetQuestionCount
  };
}

function buildPrecheckContextTranscript(context = {}) {
  const sections = [
    sanitizeClinicalContextValue(context.transcript)
      ? `Conversation context: ${sanitizeClinicalContextValue(context.transcript)}`
      : "",
    sanitizeClinicalContextValue(context.patientNotes)
      ? `Patient notes: ${sanitizeClinicalContextValue(context.patientNotes)}`
      : "",
    sanitizeClinicalContextValue(context.chiefComplaint)
      ? `Known chief complaint: ${sanitizeClinicalContextValue(context.chiefComplaint)}`
      : "",
    safeString(context.duration) ? `Known duration: ${safeString(context.duration)}` : "",
    sanitizeClinicalList(context.existingConditions).length
      ? `Known conditions: ${sanitizeClinicalList(context.existingConditions).join(", ")}`
      : "",
    sanitizeClinicalList(context.latestSymptoms).length
      ? `Recent symptoms: ${sanitizeClinicalList(context.latestSymptoms).join(", ")}`
      : "",
    sanitizeClinicalList(context.currentMedications).length
      ? `Current medications: ${sanitizeClinicalList(context.currentMedications).join(", ")}`
      : "",
    sanitizeClinicalList(context.knownAllergies).length
      ? `Known allergies: ${sanitizeClinicalList(context.knownAllergies).join(", ")}`
      : "",
    safeString(context.appointmentType) ? `Appointment type: ${safeString(context.appointmentType)}` : "",
    safeString(context.doctorSpecialty || context.specialty)
      ? `Doctor specialty: ${safeString(context.doctorSpecialty || context.specialty)}`
      : "",
    safeString(context.patientAge) ? `Patient age: ${safeString(context.patientAge)}` : "",
    safeString(context.patientGender) ? `Patient gender: ${safeString(context.patientGender)}` : ""
  ];

  return sections.filter(Boolean).join(". ");
}

function normalizeQuestionType(value) {
  const normalized = safeString(value).toLowerCase().replace(/\s+/g, "_");
  if (["yesno", "yes_no", "yes/no", "boolean"].includes(normalized)) {
    return "yesno";
  }
  if (["multiple_choice", "multiple-choice", "choice", "radio", "select"].includes(normalized)) {
    return "multiple_choice";
  }
  if (["rating", "number", "numeric", "scale"].includes(normalized)) {
    return "rating";
  }
  return "text";
}

function detectQuestionType(question) {
  const explicitType = normalizeQuestionType(question?.type || question?.answer_type);
  const prompt = safeString(question?.question || question?.text).toLowerCase();

  if (
    explicitType === "rating"
    && /\b(describe|where|located|location|what kind|which part|character|how does it feel)\b/.test(prompt)
  ) {
    return "text";
  }

  if (explicitType !== "text") {
    return explicitType;
  }

  const options = sanitizeList(question?.options);
  if (options.length >= 2) {
    return options.length === 2 ? "yesno" : "multiple_choice";
  }

  if (question?.scale || question?.min !== undefined || question?.max !== undefined) {
    return "rating";
  }

  return "text";
}

function normalizeAiQuestions(questions) {
  const seen = new Set();

  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => {
      const prompt = safeString(question?.question || question?.text);
      const options = sanitizeList(question?.options);
      const type = detectQuestionType(question);
      return {
        id: safeString(question?.id || question?.question_id) || `q_${index + 1}`,
        question: prompt,
        type: type === "multiple_choice" && options.length < 2 ? "text" : type,
        options,
        required: question?.required !== false,
        category: safeString(question?.category) || "general",
        priority: Number.isFinite(Number(question?.priority)) ? Number(question.priority) : 5
      };
    })
    .filter((question) => {
      const key = question.question.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, MAX_PRECHECK_QUESTIONS);
}

/**
 * Validates patient responses against question schema
 */
export function validatePrecheckResponses(responses, questions) {
  const errors = [];

  questions.forEach((question) => {
    if (question.required && !responses[question.id]) {
      errors.push({
        questionId: question.id,
        message: `${question.question} is required`
      });
    }

    if (responses[question.id]) {
      // Type-specific validation
      if (question.type === "yesno" && !["yes", "no", true, false].includes(responses[question.id])) {
        errors.push({
          questionId: question.id,
          message: "Please select Yes or No"
        });
      }

      if (question.type === "multiple_choice" && question.options && !question.options.includes(responses[question.id])) {
        errors.push({
          questionId: question.id,
          message: "Invalid selection"
        });
      }

      if (question.type === "rating" && (responses[question.id] < 1 || responses[question.id] > 10)) {
        errors.push({
          questionId: question.id,
          message: "Rating must be between 1 and 10"
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Formats pre-check responses for EMR integration
 */
export function formatPrecheckForEMR(questionnaire, encounterContext) {
  return {
    encounterId: encounterContext.encounterId,
    preCheckQuestions: questionnaire.edited_questions || questionnaire.ai_questions,
    patientResponses: questionnaire.patient_responses,
    completedAt: questionnaire.patient_completed_at,
    summary: generatePrecheckSummary(questionnaire)
  };
}

function generatePrecheckSummary(questionnaire) {
  /**
   * Creates human-readable summary of pre-check responses
   * Doctor uses this for quick context before appointment
   */
  const questions = questionnaire.edited_questions || questionnaire.ai_questions;
  const responses = questionnaire.patient_responses || {};

  const summary = {};
  questions.forEach((q) => {
    summary[q.question] = responses[q.id] || "Not answered";
  });

  return summary;
}
