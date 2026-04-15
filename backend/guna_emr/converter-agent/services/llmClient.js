const axios = require("axios");

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

function getModelConfig() {
  return {
    provider: "anthropic",
    apiKey:
      process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY ||
      process.env.LLM_API_KEY ||
      "",
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    baseUrl: (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    anthropicVersion: process.env.ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION,
  };
}

function stripCodeFence(text) {
  let normalized = String(text || "").trim();
  normalized = normalized.replace(/^```json\s*/i, "");
  normalized = normalized.replace(/^```\s*/i, "");
  normalized = normalized.replace(/\s*```$/i, "");
  return normalized.trim();
}

function parseJsonFromText(text) {
  const normalized = stripCodeFence(text);
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch (_) {
    // Fall through and try to recover the first JSON object.
  }

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(normalized.slice(firstBrace, lastBrace + 1));
  } catch (_) {
    return null;
  }
}

async function callClaudeJson({ system, messages, maxTokens = 700, temperature = 0.2 }) {
  const config = getModelConfig();
  if (!config.apiKey) {
    throw new Error("Missing Anthropic API key");
  }

  const payload = {
    model: config.model,
    max_tokens: maxTokens,
    temperature,
    system: String(system || ""),
    messages: (Array.isArray(messages) ? messages : [])
      .map((message) => ({
        role: message?.role === "assistant" ? "assistant" : "user",
        content: [
          {
            type: "text",
            text: String(message?.content || message?.text || "").trim(),
          },
        ],
      }))
      .filter((message) => message.content[0].text),
  };

  const response = await axios.post(`${config.baseUrl}/messages`, payload, {
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": config.anthropicVersion,
    },
    timeout: 20000,
  });

  const text = Array.isArray(response?.data?.content)
    ? response.data.content
        .filter((entry) => entry?.type === "text" && entry?.text)
        .map((entry) => entry.text)
        .join("\n")
    : "";
  const json = parseJsonFromText(text);

  if (!json) {
    throw new Error("Claude response was not valid JSON");
  }

  return {
    json,
    text,
    model: response?.data?.model || config.model,
    payload,
    raw: response?.data,
  };
}

module.exports = {
  callClaudeJson,
  getModelConfig,
  parseJsonFromText,
};
