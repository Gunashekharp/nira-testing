const { callClaudeJson, getModelConfig } = require("./llmClient");

const PRECHECK_SYSTEM_PROMPT = [
  "You create concise, clinically useful pre-appointment symptom interviews for a patient portal.",
  "This must feel responsive to the patient's own words, not like a disease template or stock intake checklist.",
  "Never invent a disease, organ system, or symptom cluster that is not explicitly supported by the patient intake data or previous answers.",
  "Use background history, chronic conditions, medications, allergies, specialty, and notes only as supporting context or safety checks.",
  "Do not let old notes or chronic conditions decide the current complaint unless the patient clearly confirms that same issue.",
  "Return ONLY valid JSON with the shape:",
  "{",
  '  "questions": [',
  '    { "question": "string", "type": "text | yesno | multiple_choice | rating", "required": true, "category": "string", "options": ["optional"] }',
  "  ]",
  "}",
  "Generate the full fallback question plan that the patient should answer next.",
  "If key intake facts such as chief complaint or duration are already known, do not repeat them.",
  "If those facts are missing, ask for them in the questionnaire.",
  "If the chief complaint is already known, do not ask the patient to restate it as an opening question.",
  "If reliable current complaint or symptom input is missing, question 1 must be a neutral broad intake question that asks the patient for their main symptom or concern in their own words.",
  "Avoid generic opener questions such as 'What is the main reason for your visit today?', 'When did this problem start?', 'Are you taking medications?', or 'Do you have allergies?' unless there is truly no disease context available.",
  "Prefer broad symptom clarification first, then narrow only after the patient gives enough detail.",
  "If medications or allergies are already known, avoid re-asking them unless clarification is clinically necessary.",
  "Do not ask medication or allergy questions before at least one symptom question unless the likely problem is a drug reaction, medication adverse effect, or safety issue.",
  "Ask pregnancy or menstrual questions only when clinically relevant to the complaint, age/sex context, or medication/safety decisions.",
  "When the patient has already provided complaint text in the intake form, preserve and reuse that wording instead of swapping in a guessed disease or organ system.",
  "Generate 7 to 9 questions.",
  "Prioritize duration, severity, symptom details, associated symptoms, triggers, relieving factors, impact on daily life, prior episodes, medications, allergies, and safety risks.",
  "Keep each question patient-friendly, specific, and non-duplicative.",
].join("\n");

const ADAPTIVE_PRECHECK_SYSTEM_PROMPT = [
  "You generate one responsive pre-appointment symptom question at a time for a patient portal.",
  "This must behave like a live conversation: ask one question, wait for the patient's answer, then choose the next best question from that answer.",
  "Never invent a disease, organ system, or symptom cluster that is not explicitly supported by the patient intake data or previous answers.",
  "Do not assume a diagnosis, disease, or organ system from old notes, chronic conditions, medications, allergies, or doctor specialty alone.",
  "Use background history, chronic conditions, medications, allergies, specialty, and notes only as supporting context or safety checks.",
  "Ask EXACTLY ONE next best question.",
  "This must feel responsive to the patient's last answer, not like a prewritten script.",
  "Choose the next question mainly from what the patient just said and what key intake detail is still missing.",
  "If no reliable complaint or symptom has been provided yet, the first question must be a neutral broad intake question that asks for the patient's main symptom or concern.",
  "After the patient answers that first broad intake question, use the patient's own words to choose the next best follow-up question.",
  "Never assume stomach pain or any other organ-specific symptom unless the form input or earlier answers already mention it.",
  "For the first 2 to 3 questions, prefer broad symptom clarification, timeline, severity/pattern, associated symptoms, and red flags before narrowing further.",
  "If the previous patient answer is vague, uncertain, or low-information, ask a more guided clarification question instead of assuming a disease pattern.",
  "If the previous patient answer already includes duration, severity, location, triggers, or related symptoms, do not ask the same thing again.",
  "Do not repeat a previous question or ask for information that is already clearly answered.",
  "Do not ask medication or allergy questions before at least one symptom question unless the likely problem is a medication reaction or safety issue.",
  "Use type='rating' only for a standalone numeric question. If the patient must also describe location, character, or other details, use type='text'.",
  "Keep the overall intake within 7 to 9 total answered questions.",
  "Do not mark the intake complete before at least 7 answered questions.",
  "Return ONLY valid JSON with the shape:",
  "{",
  '  "question": { "question": "string", "type": "text | yesno | multiple_choice | rating", "required": true, "category": "string", "options": ["optional"] } | null,',
  '  "isComplete": false,',
  '  "targetQuestionCount": 8',
  "}",
  "If enough information has been gathered after 7 to 9 answered questions, set question to null and isComplete to true.",
  "targetQuestionCount must be an integer between 7 and 9.",
  "Prefer symptom clarification, timeline, severity, symptom pattern, associated symptoms, triggers, relieving factors, impact on daily life, medication risks, allergies, and relevant history."
].join("\n");

const GENERIC_PRECHECK_OPENING_QUESTION = "What health problem, symptom, or concern would you like help with today?";
const GENERIC_PRECHECK_OPENING_PATTERNS = [
  /\bmain (health problem|symptom|concern)\b/i,
  /\breason for (your|this) (visit|appointment)\b/i,
  /\bwhat(?:'s| is) bothering you\b/i,
];
const NON_SPECIFIC_INTAKE_PATTERNS = [
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

function sanitizeList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => safeString(value))
    .filter(Boolean);
}

function dedupeStrings(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter((value) => {
    const normalized = safeString(value).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function hasSpecificIntakeSignal(value) {
  const normalized = safeString(value).toLowerCase();
  if (!normalized) {
    return false;
  }
  return !NON_SPECIFIC_INTAKE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function extractPrimaryConcernFromAnswers(answeredEntries = []) {
  const candidate = (Array.isArray(answeredEntries) ? answeredEntries : []).find((entry) => {
    const category = safeString(entry?.category).toLowerCase();
    const question = safeString(entry?.question || entry?.text).toLowerCase();
    return category.includes("primary")
      || category.includes("chief")
      || /\b(main|primary)\s+(health problem|symptom|concern)\b/.test(question)
      || /\breason for (your|this) (visit|appointment)\b/.test(question)
      || /\bwhat(?:'s| is) bothering you\b/.test(question);
  });

  return safeString(candidate?.answer);
}

function collectReliableIntakeSignals({ chiefComplaint = "", latestSymptoms = [], answeredEntries = [] } = {}) {
  const patientStatedConcern = extractPrimaryConcernFromAnswers(answeredEntries);
  return dedupeStrings([
    hasSpecificIntakeSignal(chiefComplaint) ? chiefComplaint : "",
    ...sanitizeList(latestSymptoms).filter(hasSpecificIntakeSignal),
    hasSpecificIntakeSignal(patientStatedConcern) ? patientStatedConcern : "",
  ]);
}

function buildOpeningContextInstruction({ chiefComplaint = "", latestSymptoms = [], answeredEntries = [] } = {}) {
  const reliableSignals = collectReliableIntakeSignals({ chiefComplaint, latestSymptoms, answeredEntries });
  if (!reliableSignals.length) {
    return "Reliable patient intake complaint/symptom input: none yet. Start with a neutral broad question that asks the patient to describe their main symptom or concern. Do not assume stomach pain or any other organ-specific problem. Background history is only for safety and must not replace the patient's current complaint.";
  }

  return `Reliable patient intake complaint/symptom input: ${reliableSignals.join(", ")}. Reuse the patient's own wording when choosing the next question. Background history is only supporting context and must not override the patient's current complaint.`;
}

function shouldForceGenericOpeningQuestion({ chiefComplaint = "", latestSymptoms = [], askedQuestions = [], answeredEntries = [] } = {}) {
  return (Array.isArray(askedQuestions) ? askedQuestions : []).length === 0
    && (Array.isArray(answeredEntries) ? answeredEntries : []).length === 0
    && collectReliableIntakeSignals({ chiefComplaint, latestSymptoms, answeredEntries }).length === 0;
}

function buildGenericOpeningQuestion(id = "adaptive-precheck-1") {
  return {
    id: safeString(id) || "adaptive-precheck-1",
    question: GENERIC_PRECHECK_OPENING_QUESTION,
    type: "text",
    required: true,
    category: "primary_concern",
    options: [],
  };
}

function isGenericOpeningQuestion(questionText) {
  return GENERIC_PRECHECK_OPENING_PATTERNS.some((pattern) => pattern.test(safeString(questionText)));
}

function ensureGenericOpeningQuestion(questions = [], fallbackId = "precheck-1") {
  const genericQuestion = buildGenericOpeningQuestion(safeString(questions?.[0]?.id) || fallbackId);
  if (!Array.isArray(questions) || !questions.length) {
    return [genericQuestion];
  }
  if (isGenericOpeningQuestion(questions[0]?.question)) {
    return questions;
  }

  return [genericQuestion, ...questions.slice(1)]
    .filter((question, index, list) => index === 0 || safeString(question?.question).toLowerCase() !== safeString(list[0]?.question).toLowerCase())
    .slice(0, questions.length);
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

function normalizeQuestions(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => ({
      question: safeString(question?.question || question?.text),
      type: normalizeQuestionType(question?.type || question?.answer_type),
      required: question?.required !== false,
      category: safeString(question?.category) || "general",
      options: sanitizeList(question?.options),
      id: safeString(question?.id || question?.question_id) || `precheck-${index + 1}`,
    }))
    .filter((question) => question.question);
}

function clampTargetQuestionCount(value, fallback = 8) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(9, Math.max(7, Math.round(numeric)));
}

async function generateAiPrecheckQuestions(input = {}) {
  const config = getModelConfig();
  const complaint = safeString(input?.chiefComplaint);
  const duration = safeString(input?.duration);
  const latestSymptoms = sanitizeList(input?.latestSymptoms);
  const currentMedications = sanitizeList(input?.currentMedications);
  const existingConditions = sanitizeList(input?.existingConditions);
  const knownAllergies = sanitizeList(input?.knownAllergies);
  const specialty = safeString(input?.specialty);
  const appointmentType = safeString(input?.appointmentType);
  const patientNotes = safeString(input?.patientNotes);
  const patientName = safeString(input?.patientName);
  const patientAge = safeString(input?.patientAge);
  const patientGender = safeString(input?.patientGender);
  const openingContextInstruction = buildOpeningContextInstruction({
    chiefComplaint: complaint,
    latestSymptoms,
  });

  const response = await callClaudeJson({
    system: PRECHECK_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Chief complaint: ${complaint || "Unknown"}`,
          `Duration: ${duration || "Unknown"}`,
          openingContextInstruction,
          latestSymptoms.length ? `Latest symptoms: ${latestSymptoms.join(", ")}` : "",
          existingConditions.length ? `Known conditions: ${existingConditions.join(", ")}` : "",
          currentMedications.length ? `Current medications: ${currentMedications.join(", ")}` : "",
          knownAllergies.length ? `Known allergies: ${knownAllergies.join(", ")}` : "",
          specialty ? `Doctor specialty: ${specialty}` : "",
          appointmentType ? `Appointment type: ${appointmentType}` : "",
          patientName ? `Patient name: ${patientName}` : "",
          patientAge ? `Patient age: ${patientAge}` : "",
          patientGender ? `Patient gender: ${patientGender}` : "",
          patientNotes ? `Patient notes/context: ${patientNotes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    maxTokens: 700,
    temperature: 0.1,
  });

  const normalizedQuestions = normalizeQuestions(response?.json?.questions);
  if (!normalizedQuestions.length) {
    throw new Error("Claude returned no precheck questions");
  }

  const questions = shouldForceGenericOpeningQuestion({
    chiefComplaint: complaint,
    latestSymptoms,
  })
    ? ensureGenericOpeningQuestion(normalizedQuestions, "precheck-1")
    : normalizedQuestions;

  return {
    usedFallback: false,
    model: response.model || config.model,
    questions,
  };
}

async function generateAdaptiveAiPrecheckTurn(input = {}) {
  const config = getModelConfig();
  const complaint = safeString(input?.chiefComplaint);
  const duration = safeString(input?.duration);
  const latestSymptoms = sanitizeList(input?.latestSymptoms);
  const currentMedications = sanitizeList(input?.currentMedications);
  const existingConditions = sanitizeList(input?.existingConditions);
  const knownAllergies = sanitizeList(input?.knownAllergies);
  const specialty = safeString(input?.specialty);
  const appointmentType = safeString(input?.appointmentType);
  const patientNotes = safeString(input?.patientNotes);
  const patientName = safeString(input?.patientName);
  const patientAge = safeString(input?.patientAge);
  const patientGender = safeString(input?.patientGender);
  const askedQuestions = Array.isArray(input?.askedQuestions) ? input.askedQuestions : [];
  const answeredEntries = Array.isArray(input?.answeredEntries) ? input.answeredEntries : [];
  const answeredCount = answeredEntries.length;
  const targetQuestionCount = clampTargetQuestionCount(input?.targetQuestionCount, 8);
  const openingContextInstruction = buildOpeningContextInstruction({
    chiefComplaint: complaint,
    latestSymptoms,
    answeredEntries,
  });
  const patientStatedConcern = extractPrimaryConcernFromAnswers(answeredEntries);

  if (shouldForceGenericOpeningQuestion({
    chiefComplaint: complaint,
    latestSymptoms,
    askedQuestions,
    answeredEntries,
  })) {
    return {
      usedFallback: false,
      model: config.model,
      targetQuestionCount,
      isComplete: false,
      question: buildGenericOpeningQuestion(`adaptive-precheck-${askedQuestions.length + 1}`)
    };
  }

  const response = await callClaudeJson({
    system: ADAPTIVE_PRECHECK_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Chief complaint: ${complaint || "Unknown"}`,
          `Duration: ${duration || "Unknown"}`,
          openingContextInstruction,
          latestSymptoms.length ? `Latest symptoms: ${latestSymptoms.join(", ")}` : "",
          existingConditions.length ? `Known conditions: ${existingConditions.join(", ")}` : "",
          currentMedications.length ? `Current medications: ${currentMedications.join(", ")}` : "",
          knownAllergies.length ? `Known allergies: ${knownAllergies.join(", ")}` : "",
          specialty ? `Doctor specialty: ${specialty}` : "",
          appointmentType ? `Appointment type: ${appointmentType}` : "",
          patientName ? `Patient name: ${patientName}` : "",
          patientAge ? `Patient age: ${patientAge}` : "",
          patientGender ? `Patient gender: ${patientGender}` : "",
          patientNotes ? `Patient notes/context: ${patientNotes}` : "",
          patientStatedConcern ? `Patient-stated main concern so far: ${patientStatedConcern}` : "",
          `Already asked questions (${askedQuestions.length}):`,
          ...(askedQuestions.length
            ? askedQuestions.map((entry, index) => {
                const prompt = safeString(entry?.question || entry?.text);
                return `${index + 1}. ${prompt || "Unknown question"}`;
              })
            : ["None"]),
          `Answered entries (${answeredCount}):`,
          ...(answeredEntries.length
            ? answeredEntries.map((entry, index) => {
                const prompt = safeString(entry?.question || entry?.text);
                const answer = safeString(entry?.answer);
                return `${index + 1}. Q: ${prompt || "Unknown question"} | A: ${answer || "No answer"}`;
              })
            : ["None"]),
          `Preferred total question count: ${targetQuestionCount}`,
          `Do not complete before at least 7 answered questions. Current answered count: ${answeredCount}.`
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    maxTokens: 500,
    temperature: 0.1,
  });

  const nextTargetQuestionCount = clampTargetQuestionCount(response?.json?.targetQuestionCount, targetQuestionCount);
  const isComplete = Boolean(response?.json?.isComplete) && answeredCount >= 7;
  const normalizedQuestion = normalizeQuestions(response?.json?.question ? [response.json.question] : []);
  const question = isComplete
    ? null
    : normalizedQuestion[0]
      ? {
          ...normalizedQuestion[0],
          id: safeString(response?.json?.question?.id || response?.json?.question?.question_id) || `adaptive-precheck-${askedQuestions.length + 1}`
        }
      : null;

  if (!isComplete && !question) {
    throw new Error("Claude returned no adaptive precheck question");
  }

  return {
    usedFallback: false,
    model: response.model || config.model,
    targetQuestionCount: nextTargetQuestionCount,
    isComplete,
    question
  };
}

module.exports = {
  generateAiPrecheckQuestions,
  generateAdaptiveAiPrecheckTurn,
};
