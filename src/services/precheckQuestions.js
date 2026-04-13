import { generateCdssPrecheck, generatePrecheckQuestionsViaGunaEmr } from "./gunaEmrBridge";

/**
 * AI Pre-Check Question Generation Service
 * Generates contextual pre-check-up questions based on appointment details
 */

export async function generatePrecheckQuestions(encounterId, appointmentContext) {
  /**
   * Generates AI pre-check questions based on:
   * - Chief complaint
   * - Patient medical history
   * - Appointment type
   * - Doctor's specialty
   */
  try {
    const patientId = appointmentContext.patientId || appointmentContext.patient_id;

    if (patientId && encounterId) {
      try {
        const cdssResponse = await generateCdssPrecheck({
          patientId,
          encounterId,
          chiefComplaint: appointmentContext.chiefComplaint || "",
          transcript: appointmentContext.transcript || appointmentContext.patientNotes || ""
        });

        const normalizedCdssQuestions = parseAIQuestions(cdssResponse?.questions, appointmentContext);
        if (normalizedCdssQuestions.length) {
          return normalizedCdssQuestions;
        }
      } catch (cdssError) {
        console.warn("CDSS precheck unavailable, falling back to converter Gemini flow:", cdssError);
      }
    }

    const response = await generatePrecheckQuestionsViaGunaEmr({
      patientId,
      encounterId,
      chiefComplaint: appointmentContext.chiefComplaint,
      patientName: appointmentContext.patientName,
      patientAge: appointmentContext.patientAge,
      patientGender: appointmentContext.patientGender,
      patientNotes: appointmentContext.patientNotes,
      specialty: appointmentContext.doctorSpecialty,
      appointmentType: appointmentContext.appointmentType,
      existingConditions: appointmentContext.existingConditions || [],
      latestSymptoms: appointmentContext.latestSymptoms || [],
      currentMedications: appointmentContext.currentMedications || []
    });

    return parseAIQuestions(response?.questions, appointmentContext);
  } catch (error) {
    console.error("Error generating pre-check questions:", error);
    // Fallback to default generic questions
    return generateDefaultQuestions(appointmentContext);
  }
}

function parseAIQuestions(questions, context) {
  /**
   * Structure AI questions into consistent format
   * [{ id, question, type, options?, required, category }]
   */
  if (!Array.isArray(questions) || questions.length === 0) {
    return generateDefaultQuestions(context);
  }

  const normalized = questions.map((q, idx) => ({
    id: `q_${idx}`,
    question: q.question || q.text,
    type: detectQuestionType(q), // 'text', 'yesno', 'multiple_choice', 'rating'
    options: q.options || [],
    required: q.required !== false,
    category: q.category || "general", // vital_history, symptoms, medications, etc
    priority: q.priority || 5 // 1-10, higher = more important
  }));

  return enhanceQuestionsWithContext(normalized, context);
}

function detectQuestionType(q) {
  if (q.type) return q.type;
  if (q.answer_type) {
    if (q.answer_type === "boolean") return "yesno";
    if (q.answer_type === "choice") return "multiple_choice";
    if (q.answer_type === "number") return "rating";
    return "text";
  }
  if (q.options) return q.options.length > 2 ? "multiple_choice" : "yesno";
  if (q.scale) return "rating";
  return "text";
}

function generateDefaultQuestions(context) {
  /**
   * Fallback generic questions if AI generation fails
   */
  const questions = [
    {
      id: "q_vital_symptoms",
      question: "Do you have any current symptoms or complaints?",
      type: "text",
      required: true,
      category: "symptoms",
      priority: 8
    },
    {
      id: "q_medications",
      question: "Are you currently taking any medications?",
      type: "yesno",
      required: true,
      category: "medications",
      priority: 7
    },
    {
      id: "q_allergies",
      question: "Do you have any known allergies?",
      type: "yesno",
      required: true,
      category: "vital_history",
      priority: 8
    },
    {
      id: "q_surgical_history",
      question: "Have you had any recent surgeries or hospitalizations?",
      type: "yesno",
      required: false,
      category: "vital_history",
      priority: 5
    }
  ];

  // Add specialty-specific questions
  if (context.doctorSpecialty === "cardiac") {
    questions.push({
      id: "q_cardiac_symptoms",
      question: "Do you experience chest pain, shortness of breath, or palpitations?",
      type: "yesno",
      required: true,
      category: "symptoms",
      priority: 9
    });
  }

  if (context.doctorSpecialty === "orthopedic") {
    questions.push({
      id: "q_injury_location",
      question: "Which body part is causing you concern?",
      type: "text",
      required: true,
      category: "symptoms",
      priority: 9
    });
  }

  return enhanceQuestionsWithContext(questions, context);
}

function enhanceQuestionsWithContext(questions, context = {}) {
  const knownMeds = (context.currentMedications || []).filter(Boolean);
  const knownConditions = (context.existingConditions || []).filter(Boolean);
  const chiefComplaint = String(context.chiefComplaint || "").trim();
  const latestSymptoms = (context.latestSymptoms || []).filter(Boolean);
  const gender = String(context.patientGender || "").toLowerCase();
  const age = Number(context.patientAge || 0);

  const enhanced = questions.map((question) => {
    const category = String(question.category || "").toLowerCase();
    const text = String(question.question || "");

    if (category.includes("symptom") && chiefComplaint && /main concern|current symptoms|complaint/i.test(text)) {
      return {
        ...question,
        question: `What is your main concern right now (currently noted: ${chiefComplaint})?`
      };
    }

    if (category.includes("medication") && knownMeds.length) {
      return {
        ...question,
        question: `We already have these medicines on file: ${knownMeds.join(", ")}. Are you still taking them, and have you started anything new?`
      };
    }

    return question;
  });

  const byText = new Set(enhanced.map((item) => String(item.question || "").trim().toLowerCase()));
  const append = [];

  const pushUnique = (item) => {
    const key = String(item.question || "").trim().toLowerCase();
    if (!key || byText.has(key)) return;
    byText.add(key);
    append.push(item);
  };

  if (knownConditions.length) {
    pushUnique({
      id: `ctx_cond_${append.length}`,
      question: `Do your current symptoms feel related to any known condition (${knownConditions.join(", ")})? If yes, how?`,
      type: "text",
      required: true,
      category: "history",
      priority: 7
    });
  }

  if (latestSymptoms.length) {
    pushUnique({
      id: `ctx_symptom_${append.length}`,
      question: `Among these recent symptoms (${latestSymptoms.join(", ")}), which one is worst right now and why?`,
      type: "text",
      required: true,
      category: "symptoms",
      priority: 8
    });
  }

  if (gender.startsWith("f") && age >= 12 && age <= 50 && /gastro|abdominal|pain|vomit|nausea|fever/i.test(`${chiefComplaint} ${latestSymptoms.join(" ")}`)) {
    pushUnique({
      id: `ctx_preg_${append.length}`,
      question: "Could you be pregnant, or is there a chance of missed periods?",
      type: "yesno",
      required: false,
      category: "safety",
      priority: 8
    });
  }

  pushUnique({
    id: `ctx_timeline_${append.length}`,
    question: "When did this start, and is it improving, worsening, or unchanged?",
    type: "text",
    required: true,
    category: "timeline",
    priority: 9
  });

  pushUnique({
    id: `ctx_severity_${append.length}`,
    question: "How severe is your main symptom right now on a scale from 1 to 10?",
    type: "rating",
    required: true,
    category: "severity",
    priority: 9
  });

  return [...enhanced, ...append].slice(0, 10).map((item, index) => ({
    ...item,
    id: item.id || `q_${index}`
  }));
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
