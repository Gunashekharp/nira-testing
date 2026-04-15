const DEFAULT_GUNA_EMR_BASE_URL = "http://localhost:3001";
const DEFAULT_CDSS_BASE_URL = "http://localhost:3001";
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const CHAT_REQUEST_TIMEOUT_MS = 15000;
const CDSS_REQUEST_TIMEOUT_MS = 12000;

function canUseLocalhostFallback() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function getBrowserOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return String(window.location.origin || "").replace(/\/$/, "");
}

function resolveServiceBaseUrl(configuredBaseUrl, defaultBaseUrl) {
  const trimmedBaseUrl = String(configuredBaseUrl || "").trim();
  if (trimmedBaseUrl) {
    return trimmedBaseUrl.replace(/\/$/, "");
  }

  if (canUseLocalhostFallback()) {
    return String(defaultBaseUrl || "").replace(/\/$/, "");
  }

  return getBrowserOrigin();
}

function getBaseUrl() {
  return resolveServiceBaseUrl(import.meta.env.VITE_GUNA_EMR_BASE_URL, DEFAULT_GUNA_EMR_BASE_URL);
}

function getCdssBaseUrl() {
  return resolveServiceBaseUrl(import.meta.env.VITE_CDSS_BASE_URL, DEFAULT_CDSS_BASE_URL);
}

function requireConfiguredBaseUrl(baseUrl, serviceName) {
  if (baseUrl) {
    return baseUrl;
  }

  throw new Error(`${serviceName} base URL is not configured for this deployment.`);
}

function buildRequestUrl(baseUrl, path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;

  if (/^https?:\/\//i.test(baseUrl)) {
    return `${baseUrl}${normalizedPath}`;
  }

  if (typeof window !== "undefined") {
    return new URL(`${baseUrl}${normalizedPath}`, window.location.origin).toString();
  }

  return `${baseUrl}${normalizedPath}`;
}

async function getJson(path, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const baseUrl = requireConfiguredBaseUrl(getBaseUrl(), "EMR");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildRequestUrl(baseUrl, path), {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EMR request failed (${response.status}): ${text || response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(path, body, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const baseUrl = requireConfiguredBaseUrl(getBaseUrl(), "EMR");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildRequestUrl(baseUrl, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EMR request failed (${response.status}): ${text || response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function postCdssJson(path, body) {
  const baseUrl = requireConfiguredBaseUrl(getCdssBaseUrl(), "CDSS");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CDSS_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildRequestUrl(baseUrl, path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CDSS request failed (${response.status}): ${text || response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractBloodPressure(value) {
  if (!value) return { systolic: undefined, diastolic: undefined };
  const match = String(value).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return { systolic: undefined, diastolic: undefined };
  return {
    systolic: parseNumber(match[1]),
    diastolic: parseNumber(match[2])
  };
}

function pickPatientId(patient, emrSync) {
  return emrSync?.patientId || patient.id;
}

function pickEncounterId(appointment, emrSync) {
  return emrSync?.encounterId || `encounter-${appointment.id}`;
}

export async function syncBookingToGunaEmr({ appointment, patient, doctor }) {
  const payload = {
    appointmentId: appointment.id,
    patientId: patient.id,
    patientName: patient.fullName,
    phone: patient.phone || patient.emergencyContactPhone || "",
    doctorId: doctor.id,
    doctor: doctor.fullName,
    clinic: doctor.clinic || "NIRA Pilot Clinic",
    specialty: doctor.specialty || "General Practice",
    time: appointment.startAt,
    token: appointment.token,
    type: appointment.visitType || "booked"
  };

  return postJson("/api/convert/booking", payload);
}

export async function chatWithGunaEmr({ messages, patientPhone }) {
  return postJson("/api/convert/symptom-chat", {
    messages,
    patientPhone
  }, CHAT_REQUEST_TIMEOUT_MS);
}

export async function generatePrecheckQuestionsViaGunaEmr(payload) {
  return postJson("/api/convert/precheck-questions", payload, CHAT_REQUEST_TIMEOUT_MS);
}

export async function generateAdaptivePrecheckTurnViaGunaEmr(payload) {
  return postJson("/api/convert/precheck-question-turn", payload, CHAT_REQUEST_TIMEOUT_MS);
}

export async function generateCdssPrecheck({ patientId, encounterId, chiefComplaint = "", transcript = "" }) {
  return postCdssJson("/cdss/precheck", {
    patient_id: patientId,
    encounter_id: encounterId,
    chief_complaint: chiefComplaint,
    transcript
  });
}

export async function generateDynamicPrecheckQuestions({
  patientId,
  encounterId,
  chiefComplaint,
  duration,
  specialty,
  patientContext = ""
}) {
  const enrichedTranscript = [
    `Patient chief complaint: ${chiefComplaint}`,
    `Duration of symptoms: ${duration}`,
    patientContext
  ].filter(Boolean).join(". ");

  try {
    const response = await postCdssJson("/cdss/precheck", {
      patient_id: patientId,
      encounter_id: encounterId,
      chief_complaint: chiefComplaint,
      transcript: enrichedTranscript
    });
    if (Array.isArray(response?.questions) && response.questions.length > 0) {
      return response.questions;
    }
  } catch (_) {
    // CDSS unavailable, try converter
  }

  try {
    const response = await postJson("/api/convert/precheck-questions", {
      patientId,
      encounterId,
      chiefComplaint,
      specialty,
      patientNotes: enrichedTranscript
    });
    if (Array.isArray(response?.questions) && response.questions.length > 0) {
      return response.questions;
    }
  } catch (_) {
    // Converter unavailable
  }

  return [];
}

export async function analyzeCdssEncounter({ patientId, encounterId, transcript, precheckAnswers = [] }) {
  return postCdssJson("/cdss/analyze", {
    transcript,
    patient_id: patientId,
    encounter_id: encounterId,
    precheck_answers: precheckAnswers
  });
}

export async function fetchQueueForDoctor(doctorName) {
  if (!doctorName) {
    return { queue: [] };
  }
  return getJson(`/api/queue/doctor/${encodeURIComponent(doctorName)}`);
}

export async function fetchPatientFhirEverything(patientId) {
  if (!patientId) {
    return null;
  }
  return getJson(`/api/fhir/patient/${encodeURIComponent(patientId)}/everything`);
}

export async function syncPatientAbhaToGunaEmr({ patientId, abhaNumber, localPatientId, linkedBy }) {
  if (!patientId) {
    throw new Error("Missing EMR patient id for ABHA sync");
  }

  return postJson(`/api/fhir/patient/${encodeURIComponent(patientId)}/abha`, {
    abhaNumber: abhaNumber || "",
    localPatientId,
    linkedBy
  });
}

export async function chatWithContextGunaEmr({
  messages,
  patientPhone,
  userId,
  role,
  language,
  contextKey
}) {
  return postJson("/api/convert/symptom-chat", {
    messages,
    patientPhone,
    userId,
    role,
    language: "en",
    contextKey
  }, CHAT_REQUEST_TIMEOUT_MS);
}

export async function submitSymptomChatToEmr({
  messages,
  patientPhone,
  patientName,
  userId,
  role,
  language,
  contextKey
}) {
  return postJson("/api/convert/symptom-chat/submit", {
    messages,
    patientPhone,
    patientName,
    userId,
    role,
    language: "en",
    contextKey
  }, CHAT_REQUEST_TIMEOUT_MS);
}

export async function fetchSymptomChatMemory({ contextKey, userId, role, patientPhone }) {
  const baseUrl = requireConfiguredBaseUrl(getBaseUrl(), "EMR");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(buildRequestUrl(baseUrl, "/api/convert/symptom-chat/memory"));
    if (contextKey) url.searchParams.set("contextKey", contextKey);
    if (userId) url.searchParams.set("userId", userId);
    if (role) url.searchParams.set("role", role);
    if (patientPhone) url.searchParams.set("patientPhone", patientPhone);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EMR request failed (${response.status}): ${text || response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncInterviewToGunaEmr({ appointment, patient, doctor, answers, emrSync }) {
  const symptomText = [
    `Primary concern: ${answers.primaryConcern || "N/A"}`,
    `Duration: ${answers.duration || "N/A"}`,
    `Severity: ${answers.severity || "N/A"}`,
    `Associated symptoms: ${answers.associatedSymptoms || "None"}`,
    `Current medications: ${answers.medications || "None"}`,
    `Allergies: ${answers.allergies || "None"}`
  ].join(". ");

  const payload = {
    appointmentId: appointment.id,
    patientId: pickPatientId(patient, emrSync),
    patientPhone: patient.phone || patient.emergencyContactPhone || "",
    patientName: patient.fullName,
    doctorId: doctor.id,
    doctor: doctor.fullName,
    language: "en",
    text: symptomText
  };

  return postJson("/api/convert/symptoms", payload);
}

export async function syncNurseVitalsToGunaEmr({ appointment, patient, vitals, emrSync }) {
  const bp = extractBloodPressure(vitals?.bloodPressure);

  const payload = {
    appointmentId: appointment.id,
    encounterId: pickEncounterId(appointment, emrSync),
    patientId: pickPatientId(patient, emrSync),
    systolic: bp.systolic,
    diastolic: bp.diastolic,
    heartRate: parseNumber(vitals?.pulse),
    temperature: parseNumber(vitals?.temperature),
    spo2: parseNumber(vitals?.spo2),
    painScore: parseNumber(vitals?.painScore)
  };

  return postJson("/api/convert/vitals", payload);
}

export async function syncDoctorApprovalToGunaEmr({ appointment, patient, doctor, draft, note, followUpNote, emrSync }) {
  const notesText = [
    `Chief complaint: ${draft?.soap?.chiefComplaint || "N/A"}`,
    `Subjective: ${draft?.soap?.subjective || "N/A"}`,
    `Objective: ${draft?.soap?.objective || "N/A"}`,
    `Assessment: ${draft?.soap?.assessment || "N/A"}`,
    `Plan: ${draft?.soap?.plan || "N/A"}`,
    `Doctor note: ${note || "None"}`,
    `Follow up: ${followUpNote || "Review if symptoms persist"}`
  ].join("\n");

  const doctorPayload = {
    appointmentId: appointment.id,
    encounterId: pickEncounterId(appointment, emrSync),
    patientId: pickPatientId(patient, emrSync),
    patientName: patient.fullName,
    doctorId: doctor.id,
    doctorName: doctor.fullName,
    text: notesText,
    medications: draft?.medicationSuggestions || []
  };

  const bp = extractBloodPressure(draft?.vitals?.bloodPressure);
  const vitalsPayload = {
    appointmentId: appointment.id,
    encounterId: pickEncounterId(appointment, emrSync),
    patientId: pickPatientId(patient, emrSync),
    systolic: bp.systolic,
    diastolic: bp.diastolic,
    heartRate: parseNumber(draft?.vitals?.pulse),
    temperature: parseNumber(draft?.vitals?.temperature),
    spo2: parseNumber(draft?.vitals?.spo2),
    weight: parseNumber(draft?.vitals?.weight),
    respiratoryRate: parseNumber(draft?.vitals?.respiratory)
  };

  const hasVitals = [
    vitalsPayload.systolic,
    vitalsPayload.diastolic,
    vitalsPayload.heartRate,
    vitalsPayload.temperature,
    vitalsPayload.spo2,
    vitalsPayload.weight,
    vitalsPayload.respiratoryRate
  ].some((value) => value !== undefined);

  const [doctorResult, vitalsResult] = await Promise.allSettled(
    hasVitals
      ? [postJson("/api/convert/doctor-notes", doctorPayload), postJson("/api/convert/vitals", vitalsPayload)]
      : [postJson("/api/convert/doctor-notes", doctorPayload), Promise.resolve({ skipped: true })]
  );

  return {
    doctorResult,
    vitalsResult
  };
}
