import { afterEach, expect, test, vi } from "vitest";
import { generateAdaptivePrecheckTurn, generatePrecheckQuestions } from "../services/precheckQuestions";

const bridgeMocks = vi.hoisted(() => ({
  generateAdaptivePrecheckTurnViaGunaEmr: vi.fn(),
  generateCdssPrecheck: vi.fn(),
  generatePrecheckQuestionsViaGunaEmr: vi.fn()
}));

vi.mock("../services/gunaEmrBridge", () => ({
  generateAdaptivePrecheckTurnViaGunaEmr: bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr,
  generateCdssPrecheck: bridgeMocks.generateCdssPrecheck,
  generatePrecheckQuestionsViaGunaEmr: bridgeMocks.generatePrecheckQuestionsViaGunaEmr
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

test("precheck generation prefers the Claude-backed AI flow before CDSS", async () => {
  bridgeMocks.generatePrecheckQuestionsViaGunaEmr.mockResolvedValue({
    questions: [
      {
        id: "q1",
        question: "How many days has the constipation been going on?",
        type: "text",
        required: true,
        category: "timeline"
      }
    ]
  });

  const result = await generatePrecheckQuestions("enc-1", {
    patientId: "patient-1",
    chiefComplaint: "constipation",
    latestSymptoms: ["constipation"]
  });

  expect(result).toHaveLength(1);
  expect(result[0].question).toMatch(/constipation/i);
  expect(bridgeMocks.generatePrecheckQuestionsViaGunaEmr).toHaveBeenCalledTimes(1);
  expect(bridgeMocks.generateCdssPrecheck).not.toHaveBeenCalled();
});

test("precheck generation falls back to CDSS only when the primary AI flow fails", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  bridgeMocks.generatePrecheckQuestionsViaGunaEmr.mockRejectedValue(new Error("Missing Anthropic API key"));
  bridgeMocks.generateCdssPrecheck.mockResolvedValue({
    questions: [
      {
        id: "q1",
        question: "When did the constipation start?",
        type: "text",
        required: true,
        category: "timeline"
      }
    ]
  });

  const result = await generatePrecheckQuestions("enc-2", {
    patientId: "patient-2",
    chiefComplaint: "constipation"
  });

  expect(result).toHaveLength(1);
  expect(result[0].question).toMatch(/constipation/i);
  expect(bridgeMocks.generatePrecheckQuestionsViaGunaEmr).toHaveBeenCalledTimes(1);
  expect(bridgeMocks.generateCdssPrecheck).toHaveBeenCalledTimes(1);
});

test("precheck generation strips placeholder intake text before building the AI prompt", async () => {
  bridgeMocks.generatePrecheckQuestionsViaGunaEmr.mockResolvedValue({
    questions: [
      {
        id: "q1",
        question: "Are you passing hard stools or needing to strain?",
        type: "text",
        required: true,
        category: "symptoms"
      }
    ]
  });

  await generatePrecheckQuestions("enc-3", {
    patientId: "patient-3",
    chiefComplaint: "Pending symptom interview",
    transcript: "Pending symptom interview",
    patientNotes: "Pending symptom interview",
    latestSymptoms: ["Pending symptom interview", "constipation"],
    currentMedications: ["lactulose"],
    knownAllergies: ["No known drug allergies"],
    specialty: "General Medicine"
  });

  expect(bridgeMocks.generatePrecheckQuestionsViaGunaEmr).toHaveBeenCalledTimes(1);
  const payload = bridgeMocks.generatePrecheckQuestionsViaGunaEmr.mock.calls[0][0];

  expect(payload.chiefComplaint).toBe("");
  expect(payload.latestSymptoms).toEqual(["constipation"]);
  expect(payload.knownAllergies).toEqual(["No known drug allergies"]);
  expect(payload.patientNotes).not.toMatch(/pending symptom interview/i);
  expect(payload.patientNotes).toMatch(/recent symptoms: constipation/i);
  expect(payload.patientNotes).toMatch(/current medications: lactulose/i);
  expect(payload.patientNotes).toMatch(/known allergies: no known drug allergies/i);
});

test("adaptive precheck turn returns the next question and target count", async () => {
  bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr.mockResolvedValue({
    question: {
      id: "adaptive-q2",
      question: "Are you straining to pass stool or feeling incomplete evacuation?",
      type: "text",
      required: true,
      category: "bowel_pattern"
    },
    isComplete: false,
    targetQuestionCount: 8
  });

  const result = await generateAdaptivePrecheckTurn(
    "enc-4",
    {
      patientId: "patient-4",
      chiefComplaint: "constipation",
      latestSymptoms: ["constipation", "bloating"]
    },
    {
      askedQuestions: [
        { id: "adaptive-q1", question: "How long have you had constipation?", type: "text", category: "timeline" }
      ],
      answeredEntries: [
        { id: "adaptive-q1", question: "How long have you had constipation?", answer: "3 days", type: "text", category: "timeline" }
      ],
      targetQuestionCount: 8
    }
  );

  expect(result.isComplete).toBe(false);
  expect(result.targetQuestionCount).toBe(8);
  expect(result.question?.question).toMatch(/straining/i);
  expect(bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr).toHaveBeenCalledTimes(1);
});

test("adaptive precheck turn falls back to a local answer-driven follow-up when the next-turn endpoint fails", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr.mockRejectedValue(new Error("adaptive endpoint unavailable"));

  const result = await generateAdaptivePrecheckTurn(
    "enc-5",
    {
      patientId: "patient-5",
      chiefComplaint: "constipation"
    },
    {
      askedQuestions: [
        { id: "adaptive-q1", question: "How long have you had constipation?", type: "text", category: "timeline" }
      ],
      answeredEntries: [
        { id: "adaptive-q1", question: "How long have you had constipation?", answer: "4 days", type: "text", category: "timeline" }
      ],
      targetQuestionCount: 8
    }
  );

  expect(result.isComplete).toBe(false);
  expect(result.question?.question).toMatch(/what it feels like|where in the body/i);
  expect(result.question?.category).toBe("symptom_details");
  expect(bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr).toHaveBeenCalledTimes(1);
  expect(bridgeMocks.generatePrecheckQuestionsViaGunaEmr).not.toHaveBeenCalled();
});

test("adaptive fallback uses the patient's first answer to choose the next question", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});

  bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr.mockRejectedValue(new Error("adaptive endpoint unavailable"));

  const result = await generateAdaptivePrecheckTurn(
    "enc-5b",
    {
      patientId: "patient-5b",
      chiefComplaint: "",
      latestSymptoms: []
    },
    {
      askedQuestions: [
        {
          id: "adaptive-q1",
          question: "What health problem, symptom, or concern would you like help with today?",
          type: "text",
          category: "primary_concern"
        }
      ],
      answeredEntries: [
        {
          id: "adaptive-q1",
          question: "What health problem, symptom, or concern would you like help with today?",
          answer: "Headache and fever",
          type: "text",
          category: "primary_concern"
        }
      ],
      targetQuestionCount: 8
    }
  );

  expect(result.isComplete).toBe(false);
  expect(result.question?.question).toMatch(/when did this start/i);
  expect(result.question?.category).toBe("timeline");
  expect(bridgeMocks.generatePrecheckQuestionsViaGunaEmr).not.toHaveBeenCalled();
});

test("adaptive precheck normalizes mixed description-plus-severity prompts to text instead of numeric-only rating", async () => {
  bridgeMocks.generateAdaptivePrecheckTurnViaGunaEmr.mockResolvedValue({
    question: {
      id: "adaptive-q3",
      question: "Can you describe where the abdominal pain is located and rate it from 1 to 10?",
      type: "rating",
      required: true,
      category: "severity"
    },
    isComplete: false,
    targetQuestionCount: 8
  });

  const result = await generateAdaptivePrecheckTurn(
    "enc-6",
    {
      patientId: "patient-6",
      chiefComplaint: "abdominal pain"
    },
    {
      askedQuestions: [],
      answeredEntries: [],
      targetQuestionCount: 8
    }
  );

  expect(result.isComplete).toBe(false);
  expect(result.question?.type).toBe("text");
  expect(result.question?.question).toMatch(/located and rate/i);
});
