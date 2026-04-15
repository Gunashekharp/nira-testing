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
  chatContext: require.resolve("../../backend/guna_emr/converter-agent/services/chatContext.js"),
  medSafety: require.resolve("../../backend/guna_emr/converter-agent/services/medSafety.js"),
  aiChat: require.resolve("../../backend/guna_emr/converter-agent/services/aiChat.js"),
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

test("symptom chat service returns a structured Claude reply", async () => {
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
            assistantMessage: "Please tell me whether you have any vomiting or black stools.",
            clinicalSummary: "Stomach pain and burning for two days.",
            detectedFocus: "GI",
            readyForSubmission: true,
            triageLevel: "urgent",
            redFlags: ["black stools"],
            suggestedVitals: ["temperature", "SpO2"],
          }),
        },
      ],
    },
  });

  const chatContextMocks = {
    resolveChatContextKey: vi.fn(() => "patient:u1"),
    loadChatMemory: vi.fn(async () => null),
    notifyFallbackChannels: vi.fn(async () => ({ whatsapp: false, sms: false, reason: "" })),
    upsertChatMemory: vi.fn(async () => {}),
    publishQueueRealtimeEvent: vi.fn(async () => {}),
  };

  const medSafetyMocks = {
    extractMedicationSignals: vi.fn(() => []),
    getDdiWarnings: vi.fn(() => []),
    getAdherenceTips: vi.fn(() => []),
  };

  registerCachedModule(modulePaths.axios, { post: postMock });
  registerCachedModule(modulePaths.chatContext, chatContextMocks);
  registerCachedModule(modulePaths.medSafety, medSafetyMocks);

  delete require.cache[modulePaths.aiChat];
  const { generateSymptomChatReply } = require(modulePaths.aiChat);

  const result = await generateSymptomChatReply({
    messages: [{ role: "user", content: "I have stomach pain and burning for two days." }],
    patientPhone: "+91 98765 43210",
    userId: "u1",
    role: "patient",
    language: "en",
    contextKey: "patient:u1",
  });

  expect(result.reply).toContain("vomiting or black stools");
  expect(result.summary).toBe("Stomach pain and burning for two days.");
  expect(result.readyForSubmission).toBe(true);
  expect(result.triageLevel).toBe("urgent");
  expect(result.escalationBand).toBe("yellow");
  expect(result.usedFallback).toBe(false);
  expect(result.model).toBe("claude-haiku-4-5");
  expect(result.detectedFocus).toBe("GI");
  expect(result.redFlags).toEqual(["black stools"]);
  expect(result.suggestedVitals).toEqual(["temperature", "SpO2"]);
  expect(chatContextMocks.upsertChatMemory).toHaveBeenCalledWith(
    expect.objectContaining({
      contextKey: "patient:u1",
      summary: "Stomach pain and burning for two days.",
      triageLevel: "urgent",
    })
  );
  expect(postMock).toHaveBeenCalledTimes(1);
  expect(String(postMock.mock.calls[0][0])).toContain("/messages");
  const anthropicPayload = postMock.mock.calls[0][1];
  expect(Array.isArray(anthropicPayload.messages)).toBe(true);
  expect(String(anthropicPayload.system).toLowerCase()).toContain("focus selection must be inferred dynamically");
});

test("fallback intake does not repeat duration question after user gives 'X days ago'", async () => {
  process.env.ANTHROPIC_API_KEY = "";
  process.env.CLAUDE_API_KEY = "";
  process.env.LLM_MODEL = "claude-haiku-4-5";
  process.env.LLM_BASE_URL = "https://api.anthropic.com/v1";

  const chatContextMocks = {
    resolveChatContextKey: vi.fn(() => "patient:u1"),
    loadChatMemory: vi.fn(async () => null),
    notifyFallbackChannels: vi.fn(async () => ({ whatsapp: false, sms: false, reason: "" })),
    upsertChatMemory: vi.fn(async () => {}),
    publishQueueRealtimeEvent: vi.fn(async () => {}),
  };

  const medSafetyMocks = {
    extractMedicationSignals: vi.fn(() => []),
    getDdiWarnings: vi.fn(() => []),
    getAdherenceTips: vi.fn(() => []),
  };

  registerCachedModule(modulePaths.chatContext, chatContextMocks);
  registerCachedModule(modulePaths.medSafety, medSafetyMocks);

  delete require.cache[modulePaths.aiChat];
  const { generateSymptomChatReply } = require(modulePaths.aiChat);

  const result = await generateSymptomChatReply({
    messages: [
      { role: "user", content: "constipation" },
      { role: "assistant", content: "I've noted constipation. When did this start? For example: today, 2 days ago, or last week." },
      { role: "user", content: "4 days ago" },
    ],
    patientPhone: "+91 98765 43210",
    userId: "u1",
    role: "patient",
    language: "en",
    contextKey: "patient:u1",
  });

  expect(result.usedFallback).toBe(true);
  expect(result.model).toBe("claude-haiku-4-5");
  expect(result.summary.toLowerCase()).toContain("duration: 4 days ago");
  expect(result.reply.toLowerCase()).not.toContain("when did this start");
});