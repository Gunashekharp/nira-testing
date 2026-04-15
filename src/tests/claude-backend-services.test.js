import { createRequire } from "node:module";
import { afterEach, expect, test, vi } from "vitest";

const originalEnv = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  LLM_MODEL: process.env.LLM_MODEL,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
};

const require = createRequire(import.meta.url);
const modulePaths = {
  axios: require.resolve("axios"),
  llmClient: require.resolve("../../backend/guna_emr/converter-agent/services/llmClient.js"),
  precheckAi: require.resolve("../../backend/guna_emr/converter-agent/services/precheckAi.js"),
  nlpExtractor: require.resolve("../../backend/guna_emr/converter-agent/services/nlpExtractor.js"),
  converterIndex: require.resolve("../../backend/guna_emr/converter-agent/index.js"),
};

function registerCachedModule(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

afterEach(() => {
  vi.clearAllMocks();
  for (const modulePath of Object.values(modulePaths)) {
    delete require.cache[modulePath];
  }
  process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
  process.env.CLAUDE_API_KEY = originalEnv.CLAUDE_API_KEY;
  process.env.LLM_MODEL = originalEnv.LLM_MODEL;
  process.env.LLM_BASE_URL = originalEnv.LLM_BASE_URL;
});

test("precheck generator uses Claude messages API", async () => {
  process.env.ANTHROPIC_API_KEY = "test-api-key";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  const postMock = vi.fn().mockResolvedValue({
    data: {
      model: "claude-haiku-4-5",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            questions: [
              {
                question: "Are you having vomiting or black stools?",
                type: "text",
                required: true,
                category: "red_flags",
                options: [],
              },
            ],
          }),
        },
      ],
    },
  });

  registerCachedModule(modulePaths.axios, { post: postMock });
  delete require.cache[modulePaths.precheckAi];
  const { generateAiPrecheckQuestions } = require(modulePaths.precheckAi);

  const result = await generateAiPrecheckQuestions({
    chiefComplaint: "stomach pain and burning",
    latestSymptoms: ["stomach pain"],
    currentMedications: ["omeprazole"],
    knownAllergies: ["penicillin rash"],
  });

  expect(result.usedFallback).toBe(false);
  expect(result.model).toBe("claude-haiku-4-5");
  expect(result.questions).toHaveLength(1);
  expect(result.questions[0].question).toContain("vomiting or black stools");
  expect(postMock).toHaveBeenCalledTimes(1);
  const [url, body] = postMock.mock.calls[0];
  expect(String(url)).toContain("/messages");
  expect(body.model).toBe("claude-haiku-4-5");
  expect(typeof body.system).toBe("string");
  expect(body.system).toContain("not like a disease template or stock intake checklist");
  expect(body.system).toContain("responsive to the patient's own words");
  expect(body.system).toContain("Generate 7 to 9 questions.");
  expect(body.system).toContain("Use background history, chronic conditions, medications, allergies, specialty, and notes only as supporting context");
  expect(body.system).toContain("Never invent a disease, organ system, or symptom cluster");
  expect(body.messages[0].role).toBe("user");
  expect(body.messages[0].content[0].text).toContain("Reliable patient intake complaint/symptom input:");
  expect(body.messages[0].content[0].text).toContain("Known allergies: penicillin rash");
});

test("adaptive precheck turn generator returns one answer-driven next question", async () => {
  process.env.ANTHROPIC_API_KEY = "test-api-key";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  const postMock = vi.fn().mockResolvedValue({
    data: {
      model: "claude-haiku-4-5",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            question: {
              question: "Have you passed any stool at all in the last 3 days, and are you straining more than usual?",
              type: "text",
              required: true,
              category: "bowel_pattern"
            },
            isComplete: false,
            targetQuestionCount: 8
          }),
        },
      ],
    },
  });

  registerCachedModule(modulePaths.axios, { post: postMock });
  delete require.cache[modulePaths.precheckAi];
  const { generateAdaptiveAiPrecheckTurn } = require(modulePaths.precheckAi);

  const result = await generateAdaptiveAiPrecheckTurn({
    chiefComplaint: "constipation",
    latestSymptoms: ["constipation", "bloating"],
    askedQuestions: [
      { question: "How many days have you had constipation?", type: "text", category: "timeline" }
    ],
    answeredEntries: [
      { question: "How many days have you had constipation?", answer: "3 days", type: "text", category: "timeline" }
    ],
    targetQuestionCount: 8
  });

  expect(result.usedFallback).toBe(false);
  expect(result.model).toBe("claude-haiku-4-5");
  expect(result.isComplete).toBe(false);
  expect(result.targetQuestionCount).toBe(8);
  expect(result.question?.question).toContain("straining");
  expect(result.question?.id).toBeTruthy();
  const [url, body] = postMock.mock.calls[0];
  expect(String(url)).toContain("/messages");
  expect(body.system).toContain("Ask EXACTLY ONE next best question.");
  expect(body.system).toContain("This must behave like a live conversation");
  expect(body.system).toContain("Choose the next question mainly from what the patient just said");
  expect(body.system).toContain("Use type='rating' only for a standalone numeric question.");
  expect(body.system).toContain("After the patient answers that first broad intake question");
  expect(body.messages[0].content[0].text).toContain("Answered entries (1):");
  expect(body.messages[0].content[0].text).toContain("Reliable patient intake complaint/symptom input: constipation, bloating");
});

test("adaptive precheck uses a neutral opening question before any complaint is known", async () => {
  process.env.ANTHROPIC_API_KEY = "";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  const postMock = vi.fn();

  registerCachedModule(modulePaths.axios, { post: postMock });
  delete require.cache[modulePaths.precheckAi];
  const { generateAdaptiveAiPrecheckTurn } = require(modulePaths.precheckAi);

  const result = await generateAdaptiveAiPrecheckTurn({
    chiefComplaint: "",
    latestSymptoms: [],
    askedQuestions: [],
    answeredEntries: [],
    targetQuestionCount: 8,
  });

  expect(result.usedFallback).toBe(false);
  expect(result.isComplete).toBe(false);
  expect(result.targetQuestionCount).toBe(8);
  expect(result.question).toMatchObject({
    question: "What health problem, symptom, or concern would you like help with today?",
    type: "text",
    category: "primary_concern",
    required: true,
  });
  expect(postMock).not.toHaveBeenCalled();
});

test("precheck generator replaces a guessed disease opener when the patient has not shared symptoms yet", async () => {
  process.env.ANTHROPIC_API_KEY = "test-api-key";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  const postMock = vi.fn().mockResolvedValue({
    data: {
      model: "claude-haiku-4-5",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            questions: [
              {
                question: "Are you experiencing any stomach pain, discomfort, or burning sensation right now or in the past few days?",
                type: "yesno",
                required: true,
                category: "symptoms",
              },
              {
                question: "When did this start?",
                type: "text",
                required: true,
                category: "timeline",
              },
            ],
          }),
        },
      ],
    },
  });

  registerCachedModule(modulePaths.axios, { post: postMock });
  delete require.cache[modulePaths.precheckAi];
  const { generateAiPrecheckQuestions } = require(modulePaths.precheckAi);

  const result = await generateAiPrecheckQuestions({
    chiefComplaint: "",
    latestSymptoms: [],
  });

  expect(result.questions[0].question).toBe("What health problem, symptom, or concern would you like help with today?");
  expect(result.questions[1].question).toBe("When did this start?");
  const [, body] = postMock.mock.calls[0];
  expect(body.messages[0].content[0].text).toContain("Reliable patient intake complaint/symptom input: none yet");
});

test("precheck generator throws instead of returning hardcoded fallback questions", async () => {
  process.env.ANTHROPIC_API_KEY = "";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  delete require.cache[modulePaths.precheckAi];
  const { generateAiPrecheckQuestions } = require(modulePaths.precheckAi);

  await expect(
    generateAiPrecheckQuestions({
      chiefComplaint: "stomach pain",
      latestSymptoms: ["burning"]
    })
  ).rejects.toThrow(/missing anthropic api key/i);
});

test("NLP extractor uses Claude and merges AI entities", async () => {
  process.env.ANTHROPIC_API_KEY = "test-api-key";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  const postMock = vi.fn().mockResolvedValue({
    data: {
      model: "claude-haiku-4-5",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            symptoms: ["fever", "cough"],
            vitals: {
              temperature: 101,
              spo2: 96,
            },
            diagnoses: ["viral URTI"],
            medications: ["paracetamol"],
            examFindings: ["throat redness"],
            chiefComplaint: "Fever and cough",
            duration: "2 days",
            appointment: {
              intent: true,
              doctor: "Dr. Mehta",
              time: "10 am",
              date: "tomorrow",
            },
          }),
        },
      ],
    },
  });

  registerCachedModule(modulePaths.axios, { post: postMock });
  delete require.cache[modulePaths.nlpExtractor];
  const { extractEntitiesForEmrConversion } = require(modulePaths.nlpExtractor);

  const result = await extractEntitiesForEmrConversion(
    "Patient has fever 101 F and cough for 2 days and wants appointment tomorrow at 10 am."
  );

  expect(result.symptoms).toEqual(["fever", "cough"]);
  expect(result.vitals.temperature).toBe(101);
  expect(result.vitals.spo2).toBe(96);
  expect(result.diagnoses).toEqual(["viral urti"]);
  expect(result.medications).toEqual(["paracetamol"]);
  expect(result.examFindings).toEqual(["throat redness"]);
  expect(result.chiefComplaint).toBe("Fever and cough");
  expect(result.duration).toBe("2 days");
  expect(result.appointment.intent).toBe(true);
  expect(result.appointment.doctor).toBe("Dr. Mehta");
  expect(result.appointment.time).toBe("10 am");
  expect(result.appointment.date).toBe("tomorrow");
  expect(result.model).toBe("claude-haiku-4-5");
  expect(postMock).toHaveBeenCalledTimes(1);
  const [url, body] = postMock.mock.calls[0];
  expect(String(url)).toContain("/messages");
  expect(body.model).toBe("claude-haiku-4-5");
  expect(typeof body.system).toBe("string");
});

test("converter agent exposes EMR and CDSS compatibility routes", async () => {
  const precheckRouteMock = vi.fn().mockResolvedValue({
    questions: [
      {
        id: "ai-precheck-1",
        question: "Are you having vomiting or black stools?",
        type: "text",
        required: true,
        category: "red_flags",
        options: [],
      },
    ],
    model: "claude-haiku-4-5",
    usedFallback: false,
  });

  registerCachedModule(modulePaths.precheckAi, {
    generateAiPrecheckQuestions: precheckRouteMock,
    generateAdaptiveAiPrecheckTurn: vi.fn().mockResolvedValue({
      question: null,
      isComplete: true,
      targetQuestionCount: 7,
    }),
  });
  registerCachedModule(modulePaths.nlpExtractor, {
    extractEntitiesForEmrConversion: vi.fn().mockResolvedValue({
      symptoms: ["fever", "cough"],
      vitals: {
        temperature: 101,
        spo2: 96,
        bloodPressure: "120/80",
        pulse: 88,
      },
      diagnoses: ["viral urti"],
      medications: ["paracetamol"],
      examFindings: ["throat redness"],
      chiefComplaint: "Fever and cough",
      duration: "2 days",
      appointment: {
        intent: false,
        doctor: "",
        time: "",
        date: "",
      },
      model: "local-cdss",
      usedFallback: true,
    }),
  });

  delete require.cache[modulePaths.converterIndex];
  const { createApp } = require(modulePaths.converterIndex);
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    let response = await fetch(`${baseUrl}/api/convert/precheck-questions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chiefComplaint: "fever" }),
    });
    expect(response.ok).toBe(true);
    const aiPrecheck = await response.json();
    expect(aiPrecheck.questions[0].question).toContain("vomiting or black stools");
    expect(precheckRouteMock).toHaveBeenCalledTimes(1);

    response = await fetch(`${baseUrl}/cdss/precheck`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patient_id: "patient-1",
        encounter_id: "encounter-1",
        chief_complaint: "fever",
        transcript: "Fever and cough for 2 days. Took paracetamol.",
      }),
    });
    expect(response.ok).toBe(true);
    const cdssPrecheck = await response.json();
    expect(cdssPrecheck.questions.length).toBeGreaterThanOrEqual(7);
    expect(cdssPrecheck.questions[0].question).toMatch(/fever/i);

    response = await fetch(`${baseUrl}/cdss/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patient_id: "patient-1",
        encounter_id: "encounter-1",
        transcript: "Fever and cough for 2 days. Took paracetamol.",
        precheck_answers: [{ question_id: "q1", answer: "Feels worse at night" }],
      }),
    });
    expect(response.ok).toBe(true);
    const analysis = await response.json();
    expect(analysis.soap.subjective).toContain("Fever and cough");
    expect(analysis.soap.objective).toContain("Temperature 101");
    expect(analysis.diagnoses[0].name).toBe("viral urti");

    response = await fetch(`${baseUrl}/api/convert/vitals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appointmentId: "appointment-1",
        encounterId: "encounter-1",
        patientId: "fhir-patient-1",
        systolic: 120,
        diastolic: 80,
      }),
    });
    expect(response.ok).toBe(true);
    const vitalsSync = await response.json();
    expect(vitalsSync.patientId).toBe("fhir-patient-1");
    expect(vitalsSync.encounterId).toBe("encounter-1");

    response = await fetch(`${baseUrl}/api/convert/doctor-notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appointmentId: "appointment-1",
        encounterId: "encounter-1",
        patientId: "fhir-patient-1",
        text: "Doctor review completed.",
      }),
    });
    expect(response.ok).toBe(true);
    const doctorSync = await response.json();
    expect(doctorSync.patientId).toBe("fhir-patient-1");
    expect(doctorSync.encounterId).toBe("encounter-1");

    response = await fetch(`${baseUrl}/api/fhir/patient/fhir-patient-1/everything`);
    expect(response.ok).toBe(true);
    const bundle = await response.json();
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.patientId).toBe("fhir-patient-1");

    response = await fetch(`${baseUrl}/api/fhir/patient/fhir-patient-1/abha`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        abhaNumber: "91-1234-5678-9000",
        localPatientId: "patient-1",
        linkedBy: "patient-portal",
      }),
    });
    expect(response.ok).toBe(true);
    const abhaSync = await response.json();
    expect(abhaSync.success).toBe(true);
    expect(abhaSync.patientId).toBe("fhir-patient-1");
    expect(abhaSync.abhaNumber).toBe("91-1234-5678-9000");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});
