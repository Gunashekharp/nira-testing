const { callClaudeJson, getModelConfig } = require("./llmClient");

const NLP_SYSTEM_PROMPT = [
  "You extract structured clinical entities from a patient intake transcript.",
  "Return ONLY valid JSON with this shape:",
  "{",
  '  "symptoms": ["string"],',
  '  "vitals": { "temperature": null, "spo2": null, "bloodPressure": "", "pulse": null },',
  '  "diagnoses": ["string"],',
  '  "medications": ["string"],',
  '  "examFindings": ["string"],',
  '  "chiefComplaint": "string",',
  '  "duration": "string",',
  '  "appointment": { "intent": false, "doctor": "", "time": "", "date": "" }',
  "}",
].join("\n");

const SYMPTOM_RULES = [
  "fever",
  "cough",
  "cold",
  "stomach pain",
  "abdominal pain",
  "constipation",
  "diarrhea",
  "vomiting",
  "nausea",
  "headache",
  "chest pain",
  "shortness of breath",
  "rash",
];

const MEDICATION_RULES = [
  "paracetamol",
  "ibuprofen",
  "aspirin",
  "omeprazole",
  "pantoprazole",
  "cetirizine",
  "amoxicillin",
  "azithromycin",
];

function safeString(value) {
  return String(value || "").trim();
}

function unique(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => safeString(value).toLowerCase())
        .filter(Boolean)
    )
  );
}

function extractDuration(text) {
  const match = safeString(text).match(
    /\b(today|yesterday|since\s+[^.?!,]+|for\s+\d+\s*(hour|hours|day|days|week|weeks|month|months)|\d+\s*(hour|hours|day|days|week|weeks|month|months))\b/i
  );
  return match ? match[0] : "";
}

function extractTemperature(text) {
  const match = safeString(text).match(/\b(\d{2,3}(?:\.\d+)?)\s*(?:f|fahrenheit|c|celsius)\b/i);
  return match ? Number(match[1]) : null;
}

function extractSpO2(text) {
  const match = safeString(text).match(/\bspo2\s*(?:is|of)?\s*(\d{2,3})\b|\boxygen\s*(?:is|of)?\s*(\d{2,3})%?\b/i);
  return match ? Number(match[1] || match[2]) : null;
}

function extractBloodPressure(text) {
  const match = safeString(text).match(/\b(\d{2,3}\s*\/\s*\d{2,3})\b/);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function extractPulse(text) {
  const match = safeString(text).match(/\b(?:pulse|hr|heart rate)\s*(?:is|of)?\s*(\d{2,3})\b/i);
  return match ? Number(match[1]) : null;
}

function buildFallbackExtraction(text) {
  const lower = safeString(text).toLowerCase();
  const symptoms = SYMPTOM_RULES.filter((rule) => lower.includes(rule));
  const medications = MEDICATION_RULES.filter((rule) => lower.includes(rule));
  const chiefComplaint = symptoms[0] || safeString(text).split(/[.?!]/)[0] || "";
  const appointmentIntent = /\b(book|appointment|schedule|doctor|slot)\b/i.test(lower);
  const doctorMatch = safeString(text).match(/\bdr\.?\s+[a-z]+/i);
  const timeMatch = safeString(text).match(/\b\d{1,2}\s*(?:am|pm)\b/i);
  const dateMatch = safeString(text).match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);

  return {
    symptoms: unique(symptoms),
    vitals: {
      temperature: extractTemperature(text),
      spo2: extractSpO2(text),
      bloodPressure: extractBloodPressure(text),
      pulse: extractPulse(text),
    },
    diagnoses: [],
    medications: unique(medications),
    examFindings: [],
    chiefComplaint,
    duration: extractDuration(text),
    appointment: {
      intent: appointmentIntent,
      doctor: doctorMatch ? doctorMatch[0] : "",
      time: timeMatch ? timeMatch[0] : "",
      date: dateMatch ? dateMatch[0] : "",
    },
  };
}

function normalizeExtraction(payload) {
  return {
    symptoms: unique(payload?.symptoms),
    vitals: {
      temperature: Number.isFinite(Number(payload?.vitals?.temperature)) ? Number(payload.vitals.temperature) : null,
      spo2: Number.isFinite(Number(payload?.vitals?.spo2)) ? Number(payload.vitals.spo2) : null,
      bloodPressure: safeString(payload?.vitals?.bloodPressure),
      pulse: Number.isFinite(Number(payload?.vitals?.pulse)) ? Number(payload.vitals.pulse) : null,
    },
    diagnoses: unique(payload?.diagnoses),
    medications: unique(payload?.medications),
    examFindings: unique(payload?.examFindings),
    chiefComplaint: safeString(payload?.chiefComplaint),
    duration: safeString(payload?.duration),
    appointment: {
      intent: Boolean(payload?.appointment?.intent),
      doctor: safeString(payload?.appointment?.doctor),
      time: safeString(payload?.appointment?.time),
      date: safeString(payload?.appointment?.date),
    },
  };
}

async function extractEntitiesForEmrConversion(text) {
  const config = getModelConfig();
  const transcript = safeString(text);
  const fallback = buildFallbackExtraction(transcript);

  try {
    const response = await callClaudeJson({
      system: NLP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
      maxTokens: 700,
      temperature: 0,
    });

    return {
      ...normalizeExtraction(response.json),
      model: response.model || config.model,
      usedFallback: false,
    };
  } catch (_) {
    return {
      ...fallback,
      model: config.model,
      usedFallback: true,
    };
  }
}

module.exports = {
  extractEntitiesForEmrConversion,
};
