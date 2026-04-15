const {
  loadChatMemory,
  notifyFallbackChannels,
  publishQueueRealtimeEvent,
  resolveChatContextKey,
  upsertChatMemory,
} = require("./chatContext");
const { extractMedicationSignals, getAdherenceTips, getDdiWarnings } = require("./medSafety");
const { callClaudeJson, getModelConfig } = require("./llmClient");

const CHAT_SYSTEM_PROMPT = [
  "You are NIRA's patient-portal clinical intake assistant.",
  "focus selection must be inferred dynamically from the complaint, timeline, severity, red flags, and medication context.",
  "Ask exactly one focused follow-up question unless the intake is already complete enough to summarize for the doctor.",
  "Do not repeat an answered question.",
  "If the user mentions dangerous red flags, triage as emergency and advise urgent in-person care.",
  "Return ONLY valid JSON with this exact shape:",
  "{",
  '  "assistantMessage": "string",',
  '  "clinicalSummary": "string",',
  '  "detectedFocus": "General | GI | Respiratory | Cardiac | Neurology | Musculoskeletal | Skin | Urology",',
  '  "readyForSubmission": true,',
  '  "appointmentBookingOffered": false,',
  '  "triageLevel": "routine | urgent | emergency",',
  '  "redFlags": ["string"],',
  '  "suggestedVitals": ["string"]',
  "}",
].join("\n");

const DURATION_REGEX =
  /\b(today|yesterday|tonight|this morning|this evening|since\s+[^.?!,]+|for\s+\d+\s*(hour|hours|day|days|week|weeks|month|months)|\d+\s*(hour|hours|day|days|week|weeks|month|months)\s+ago)\b/i;
const SEVERITY_REGEX = /\b(mild|moderate|severe|worse|worst|pain\s*(score)?\s*\d{1,2}|[1-9]|10)\/10\b|\b(mild|moderate|severe)\b/i;
const IMPACT_REGEX = /\b(better|worse|worsens|relieves|relieved|trigger|after eating|while walking|while resting|lying down)\b/i;
const BOOKING_REGEX = /\b(book|schedule|appointment|availability|available|doctor|slot)\b/i;

const FOCUS_RULES = [
  { focus: "GI", pattern: /\b(stomach|abdomen|abdominal|constipation|diarrhea|diarrhoea|vomit|vomiting|nausea|acidity|reflux|heartburn|bloating|black stools?)\b/i },
  { focus: "Respiratory", pattern: /\b(cough|cold|breath|breathing|breathless|wheeze|asthma|sore throat)\b/i },
  { focus: "Cardiac", pattern: /\b(chest pain|palpitations|heart|pressure|bp|blood pressure)\b/i },
  { focus: "Neurology", pattern: /\b(headache|migraine|dizzy|dizziness|faint|fainting|slurred speech|numb)\b/i },
  { focus: "Musculoskeletal", pattern: /\b(back pain|joint pain|sprain|swelling|muscle|neck pain)\b/i },
  { focus: "Skin", pattern: /\b(rash|itching|itchy|skin|allergy|hives)\b/i },
  { focus: "Urology", pattern: /\b(urine|urinary|burning urine|burning while urinating|uti)\b/i },
];

const RED_FLAG_RULES = [
  "chest pain",
  "shortness of breath",
  "unable to breathe",
  "black stools",
  "blood in stool",
  "confusion",
  "fainting",
  "unconscious",
  "severe bleeding",
  "slurred speech",
  "face droop",
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

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: safeString(message?.content || message?.text),
    }))
    .filter((message) => message.content);
}

function getUserMessages(messages) {
  return normalizeMessages(messages)
    .filter((message) => message.role === "user")
    .map((message) => message.content);
}

function getLatestUserMessage(messages) {
  const userMessages = getUserMessages(messages);
  return userMessages[userMessages.length - 1] || "";
}

function detectFocus(text) {
  const input = safeString(text);
  const match = FOCUS_RULES.find((rule) => rule.pattern.test(input));
  return match ? match.focus : "General";
}

function detectDuration(text) {
  const match = safeString(text).match(DURATION_REGEX);
  return match ? match[0] : "";
}

function detectSeverity(text) {
  const normalized = safeString(text);
  const scoreMatch = normalized.match(/\b([1-9]|10)\/10\b/i);
  if (scoreMatch) {
    return `${scoreMatch[1]}/10`;
  }

  const descriptorMatch = normalized.match(/\b(mild|moderate|severe)\b/i);
  return descriptorMatch ? descriptorMatch[1].toLowerCase() : "";
}

function detectRedFlags(text) {
  const lower = safeString(text).toLowerCase();
  return RED_FLAG_RULES.filter((flag) => lower.includes(flag));
}

function suggestedVitalsForFocus(focus, redFlags = []) {
  const vitals = new Set();

  if (focus === "GI") {
    vitals.add("temperature");
    vitals.add("blood pressure");
  }
  if (focus === "Respiratory") {
    vitals.add("temperature");
    vitals.add("SpO2");
    vitals.add("respiratory rate");
  }
  if (focus === "Cardiac") {
    vitals.add("blood pressure");
    vitals.add("pulse");
    vitals.add("SpO2");
  }
  if (redFlags.some((flag) => /bleeding|black stools|blood/.test(flag))) {
    vitals.add("blood pressure");
    vitals.add("pulse");
  }

  return [...vitals];
}

function normalizeTriage(level, redFlags) {
  const normalized = safeString(level).toLowerCase();
  if (normalized === "emergency" || redFlags.some((flag) => /chest pain|shortness of breath|slurred speech|face droop|unconscious|severe bleeding/.test(flag))) {
    return "emergency";
  }
  if (normalized === "urgent" || redFlags.length > 0) {
    return "urgent";
  }
  return "routine";
}

function toEscalationBand(triageLevel) {
  if (triageLevel === "emergency") return "red";
  if (triageLevel === "urgent") return "yellow";
  return "green";
}

function buildClinicalSummary({ chiefComplaint, duration, severity, focus, redFlags }) {
  const parts = [];
  if (chiefComplaint) parts.push(`Chief Complaint: ${chiefComplaint}`);
  if (duration) parts.push(`Duration: ${duration}`);
  if (severity) parts.push(`Severity: ${severity}`);
  if (focus) parts.push(`Focus: ${focus}`);
  if (redFlags.length) parts.push(`Red Flags: ${redFlags.join(", ")}`);
  return parts.join(" | ");
}

function buildFallbackChatResult(messages, memorySummary) {
  const transcript = getUserMessages(messages).join(". ");
  const latestUserMessage = getLatestUserMessage(messages);
  const chiefComplaint = latestUserMessage || transcript || memorySummary || "Patient concern shared";
  const duration = detectDuration(transcript);
  const severity = detectSeverity(transcript);
  const redFlags = detectRedFlags(transcript);
  const focus = detectFocus(transcript);
  const triageLevel = normalizeTriage("", redFlags);
  const summary = buildClinicalSummary({
    chiefComplaint,
    duration,
    severity,
    focus,
    redFlags,
  });

  const hasImpactDetail = IMPACT_REGEX.test(transcript);
  const readyForSubmission = Boolean(chiefComplaint && duration && (severity || hasImpactDetail || redFlags.length > 0));
  const wantsBooking = BOOKING_REGEX.test(latestUserMessage);
  let reply;

  if (triageLevel === "emergency") {
    reply =
      "Your symptoms may need urgent in-person care. Please go to the nearest emergency department now or call local emergency services immediately.";
  } else if (!duration) {
    reply = "I’ve noted your main concern. When did this start, and has it been getting better, worse, or staying the same?";
  } else if (!severity) {
    reply = "Thanks. On a scale of 1 to 10, how severe is it right now?";
  } else if (!hasImpactDetail) {
    reply = "What makes it better or worse, and have you noticed any related symptoms?";
  } else if (wantsBooking) {
    reply = "I have enough to prepare this for your doctor and move you toward booking. I can guide doctor availability next.";
  } else {
    reply = "Thanks. I have enough detail to summarize this for your doctor. If you want, I can help you move to the next booking step.";
  }

  return {
    reply,
    summary,
    detectedFocus: focus,
    readyForSubmission,
    appointmentBookingOffered: wantsBooking && readyForSubmission,
    triageLevel,
    escalationBand: toEscalationBand(triageLevel),
    redFlags,
    suggestedVitals: suggestedVitalsForFocus(focus, redFlags),
  };
}

function normalizeClaudeResult(result, fallback) {
  const redFlags = uniqueStrings(result?.redFlags || fallback.redFlags);
  const triageLevel = normalizeTriage(result?.triageLevel, redFlags);
  const focus = safeString(result?.detectedFocus) || fallback.detectedFocus;
  return {
    reply: safeString(result?.assistantMessage || result?.reply) || fallback.reply,
    summary: safeString(result?.clinicalSummary || result?.summary) || fallback.summary,
    detectedFocus: focus,
    readyForSubmission: Boolean(result?.readyForSubmission),
    appointmentBookingOffered: Boolean(result?.appointmentBookingOffered),
    triageLevel,
    escalationBand: toEscalationBand(triageLevel),
    redFlags,
    suggestedVitals: uniqueStrings(result?.suggestedVitals || fallback.suggestedVitals),
  };
}

async function generateSymptomChatReply({
  messages,
  patientPhone,
  userId,
  role = "patient",
  language = "en",
  contextKey,
} = {}) {
  const config = getModelConfig();
  const resolvedContextKey = resolveChatContextKey({ contextKey, patientPhone, role, userId });
  const memory = await loadChatMemory(resolvedContextKey);
  const memorySummary = safeString(memory?.summary);
  const normalizedMessages = normalizeMessages(messages);
  const medicationSignals = extractMedicationSignals(normalizedMessages);
  const ddiWarnings = getDdiWarnings(medicationSignals);
  const adherenceTips = getAdherenceTips(medicationSignals);
  const fallback = buildFallbackChatResult(normalizedMessages, memorySummary);

  try {
    const memoryNote = memorySummary
      ? `Previous clinical memory summary: ${memorySummary}\nUse it only as context and do not overwrite new symptoms with old ones.`
      : "No stored memory summary is available.";
    const languageNote = safeString(language) || "en";
    const response = await callClaudeJson({
      system: `${CHAT_SYSTEM_PROMPT}\n${memoryNote}\nRespond in language code: ${languageNote}.`,
      messages: normalizedMessages,
      maxTokens: 700,
      temperature: 0.2,
    });

    const normalized = normalizeClaudeResult(response.json, fallback);
    const result = {
      ...normalized,
      ddiWarnings,
      adherenceTips,
      fallbackChannels: { whatsapp: false, sms: false, reason: "" },
      usedFallback: false,
      model: response.model || config.model,
    };

    await upsertChatMemory({
      contextKey: resolvedContextKey,
      patientPhone,
      userId,
      role,
      summary: result.summary,
      triageLevel: result.triageLevel,
      detectedFocus: result.detectedFocus,
    });

    if (result.readyForSubmission || result.triageLevel !== "routine") {
      await publishQueueRealtimeEvent({
        contextKey: resolvedContextKey,
        message: result.summary || result.reply,
        triage_level: result.triageLevel,
        escalation_band: result.escalationBand,
      });
    }

    return result;
  } catch (error) {
    const fallbackChannels = await notifyFallbackChannels({
      reason: "Claude service unavailable, using local intake logic.",
      contextKey: resolvedContextKey,
      patientPhone,
    });
    const result = {
      ...fallback,
      ddiWarnings,
      adherenceTips,
      fallbackChannels,
      usedFallback: true,
      model: config.model,
      error: error?.message || "Claude fallback activated",
    };

    await upsertChatMemory({
      contextKey: resolvedContextKey,
      patientPhone,
      userId,
      role,
      summary: result.summary,
      triageLevel: result.triageLevel,
      detectedFocus: result.detectedFocus,
    });

    return result;
  }
}

module.exports = {
  generateSymptomChatReply,
};
