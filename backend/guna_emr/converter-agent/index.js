const fs = require("node:fs");
const path = require("node:path");
const cors = require("cors");
const express = require("express");
const { generateSymptomChatReply } = require("./services/aiChat");
const {
  listQueueRealtimeEvents,
  loadChatMemory,
  publishQueueRealtimeEvent,
  resolveChatContextKey,
  upsertChatMemory,
} = require("./services/chatContext");
const { generateAdaptiveAiPrecheckTurn, generateAiPrecheckQuestions } = require("./services/precheckAi");
const { analyzeCdssTranscript, buildLocalCdssQuestions } = require("./services/cdssAnalysis");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadEnvFiles() {
  const repoRoot = path.resolve(__dirname, "../../..");
  const files = [
    path.join(repoRoot, ".env"),
    path.join(__dirname, ".env"),
    path.join(__dirname, ".env.local"),
    path.join(repoRoot, ".env.local"),
  ];

  for (const file of files) {
    loadEnvFile(file);
  }
}

loadEnvFiles();

let queueCounter = 40;

function safeString(value) {
  return String(value || "").trim();
}

function normalizeToken(value, fallback = "item") {
  return String(value || fallback)
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || fallback;
}

function buildEncounterSyncPayload(body, chat = {}) {
  const contextKey = resolveChatContextKey(body);
  const patientToken = normalizeToken(body?.patientId || body?.userId || body?.patientPhone || contextKey, "patient");
  const appointmentToken = normalizeToken(body?.appointmentId || body?.encounterId || Date.now(), "appointment");
  const patientId = String(body?.patientId || "").startsWith("fhir-")
    ? String(body.patientId)
    : `fhir-${patientToken}`;
  const encounterId = body?.encounterId || `fhir-enc-${appointmentToken}`;
  const queueToken = body?.queueToken ?? body?.token ?? (queueCounter += 1);

  return {
    success: true,
    patientId,
    encounterId,
    queueToken,
    chat: {
      summary: chat.summary || "",
      triageLevel: chat.triageLevel || "routine",
      escalationBand: chat.escalationBand || "green",
      detectedFocus: chat.detectedFocus || "",
      redFlags: Array.isArray(chat.redFlags) ? chat.redFlags : [],
      suggestedVitals: Array.isArray(chat.suggestedVitals) ? chat.suggestedVitals : [],
    },
    cdss: null,
  };
}

function buildSubmissionPayload(body, chat) {
  return buildEncounterSyncPayload(body, chat);
}

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({
      ok: true,
      provider: "anthropic",
      model: process.env.LLM_MODEL || "claude-haiku-4-5",
    });
  });

  app.post("/api/convert/booking", (request, response) => {
    const body = request.body || {};
    const submission = buildEncounterSyncPayload(body, {
      summary: `Booking synced for ${body?.patientName || "patient"}.`,
      triageLevel: "routine",
      escalationBand: "green",
      redFlags: [],
      suggestedVitals: [],
    });
    response.json(submission);
  });

  app.post("/api/convert/symptom-chat", async (request, response) => {
    try {
      const result = await generateSymptomChatReply(request.body || {});
      response.json(result);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to generate symptom chat reply",
      });
    }
  });

  app.post("/api/convert/symptom-chat/submit", async (request, response) => {
    try {
      const body = request.body || {};
      const chat = await generateSymptomChatReply(body);
      const submission = buildSubmissionPayload(body, chat);

      await upsertChatMemory({
        contextKey: resolveChatContextKey(body),
        patientPhone: body?.patientPhone,
        userId: body?.userId,
        role: body?.role || "patient",
        summary: chat.summary,
        triageLevel: chat.triageLevel,
        detectedFocus: chat.detectedFocus,
        submission,
      });

      await publishQueueRealtimeEvent({
        contextKey: resolveChatContextKey(body),
        doctorName: body?.doctor || body?.doctorName || "",
        encounter_fhir_id: submission.encounterId,
        message: chat.summary,
        alerts: chat.redFlags || [],
        triage_level: chat.triageLevel || "routine",
        escalation_band: chat.escalationBand || "green",
      });

      response.json(submission);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to submit symptom chat",
      });
    }
  });

  app.get("/api/convert/symptom-chat/memory", async (request, response) => {
    try {
      const contextKey = resolveChatContextKey({
        contextKey: request.query?.contextKey,
        userId: request.query?.userId,
        role: request.query?.role,
        patientPhone: request.query?.patientPhone,
      });
      const memory = await loadChatMemory(contextKey);
      response.json({
        contextKey,
        memory: memory || {},
      });
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to load chat memory",
      });
    }
  });

  app.post("/api/convert/symptoms", async (request, response) => {
    try {
      const body = request.body || {};
      const summary = String(body?.text || "Patient symptoms synced to EMR.").trim();
      const submission = buildEncounterSyncPayload(body, {
        summary,
        triageLevel: "routine",
        escalationBand: "green",
        redFlags: [],
        suggestedVitals: [],
      });

      await upsertChatMemory({
        contextKey: resolveChatContextKey(body),
        patientPhone: body?.patientPhone,
        userId: body?.userId,
        role: body?.role || "patient",
        summary,
        submission,
      });

      await publishQueueRealtimeEvent({
        contextKey: resolveChatContextKey(body),
        doctorName: body?.doctor || body?.doctorName || "",
        encounter_fhir_id: submission.encounterId,
        message: summary,
        alerts: [],
        triage_level: "routine",
        escalation_band: "green",
      });

      response.json(submission);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to sync symptoms",
      });
    }
  });

  app.post("/api/convert/precheck-questions", async (request, response) => {
    try {
      const result = await generateAiPrecheckQuestions(request.body || {});
      response.json(result);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to generate precheck questions",
      });
    }
  });

  app.post("/api/convert/precheck-question-turn", async (request, response) => {
    try {
      const result = await generateAdaptiveAiPrecheckTurn(request.body || {});
      response.json(result);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to generate adaptive precheck question",
      });
    }
  });

  app.post("/api/convert/vitals", (request, response) => {
    const body = request.body || {};
    const submission = buildEncounterSyncPayload(body, {
      summary: "Vitals synced to EMR.",
      triageLevel: "routine",
      escalationBand: "green",
      redFlags: [],
      suggestedVitals: [],
    });

    response.json({
      ...submission,
      vitals: {
        systolic: body?.systolic ?? null,
        diastolic: body?.diastolic ?? null,
        heartRate: body?.heartRate ?? null,
        temperature: body?.temperature ?? null,
        spo2: body?.spo2 ?? null,
        painScore: body?.painScore ?? null,
      },
    });
  });

  app.post("/api/convert/doctor-notes", (request, response) => {
    const body = request.body || {};
    const submission = buildEncounterSyncPayload(body, {
      summary: safeString(body?.text) || "Doctor notes synced to EMR.",
      triageLevel: "routine",
      escalationBand: "green",
      redFlags: [],
      suggestedVitals: [],
    });

    response.json({
      ...submission,
      doctorNoteAccepted: true,
      medications: Array.isArray(body?.medications) ? body.medications : [],
    });
  });

  app.post("/cdss/precheck", async (request, response) => {
    try {
      const body = request.body || {};
      const analysis = await analyzeCdssTranscript({
        transcript: body?.transcript,
        precheckAnswers: body?.precheck_answers || body?.precheckAnswers || [],
      });

      const result = buildLocalCdssQuestions({
        chiefComplaint: body?.chief_complaint || body?.chiefComplaint,
        transcript: body?.transcript,
        extraction: analysis?.extracted_entities || null,
      });

      response.json(result);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to generate CDSS precheck questions",
      });
    }
  });

  app.post("/cdss/analyze", async (request, response) => {
    try {
      const result = await analyzeCdssTranscript({
        transcript: request.body?.transcript,
        precheckAnswers: request.body?.precheck_answers || request.body?.precheckAnswers || [],
      });
      response.json(result);
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to analyze transcript with CDSS fallback",
      });
    }
  });

  app.get("/api/queue/doctor/:doctorName", async (request, response) => {
    try {
      const requestedDoctor = String(request.params?.doctorName || "").toLowerCase();
      const queue = (await listQueueRealtimeEvents())
        .filter((event) => {
          const doctorName = String(event?.doctorName || "").toLowerCase();
          return !requestedDoctor || !doctorName || doctorName.includes(requestedDoctor);
        })
        .map((event) => ({
          encounter_fhir_id: event?.encounter_fhir_id || event?.encounterId || null,
          alerts: Array.isArray(event?.alerts) ? event.alerts : [],
          message: event?.message || "",
          triage_level: event?.triage_level || "routine",
          escalation_band: event?.escalation_band || "green",
        }));

      response.json({ queue });
    } catch (error) {
      response.status(500).json({
        error: error?.message || "Unable to load doctor queue",
      });
    }
  });

  app.get("/api/fhir/patient/:patientId/everything", (request, response) => {
    const patientId = String(request.params?.patientId || "").trim();
    response.json({
      resourceType: "Bundle",
      type: "collection",
      patientId,
      total: 0,
      entry: [],
    });
  });

  app.post("/api/fhir/patient/:patientId/abha", (request, response) => {
    const patientId = String(request.params?.patientId || "").trim();
    const body = request.body || {};
    response.json({
      success: true,
      patientId,
      abhaNumber: body?.abhaNumber || "",
      localPatientId: body?.localPatientId || null,
      linkedBy: body?.linkedBy || null,
      linkedAt: new Date().toISOString(),
    });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => {
    console.log(`NIRA Claude converter-agent listening on http://localhost:${port}`);
  });
}

module.exports = {
  createApp,
};
