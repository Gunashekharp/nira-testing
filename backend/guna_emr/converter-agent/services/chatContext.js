const memoryStore = new Map();
const queueEvents = [];

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function resolveChatContextKey({ contextKey, userId, role, patientPhone } = {}) {
  if (contextKey) {
    return String(contextKey);
  }
  if (role && userId) {
    return `${role}:${userId}`;
  }
  if (patientPhone) {
    return `phone:${normalizePhone(patientPhone)}`;
  }
  return "anonymous";
}

async function loadChatMemory(contextKey) {
  return memoryStore.get(String(contextKey || "")) || null;
}

async function upsertChatMemory(entry = {}) {
  const key = resolveChatContextKey(entry);
  const previous = memoryStore.get(key) || {};
  const next = {
    ...previous,
    ...entry,
    contextKey: key,
    updatedAt: new Date().toISOString(),
  };
  memoryStore.set(key, next);
  return next;
}

async function notifyFallbackChannels({ reason = "" } = {}) {
  return {
    whatsapp: false,
    sms: false,
    reason,
  };
}

async function publishQueueRealtimeEvent(event = {}) {
  const created = {
    id: `chat-event-${Date.now()}-${queueEvents.length + 1}`,
    createdAt: new Date().toISOString(),
    ...event,
  };
  queueEvents.unshift(created);
  return created;
}

async function listQueueRealtimeEvents(contextKey) {
  if (!contextKey) {
    return [...queueEvents];
  }
  return queueEvents.filter((event) => event.contextKey === contextKey);
}

function resetChatContextMemory() {
  memoryStore.clear();
  queueEvents.length = 0;
}

module.exports = {
  listQueueRealtimeEvents,
  loadChatMemory,
  notifyFallbackChannels,
  publishQueueRealtimeEvent,
  resolveChatContextKey,
  resetChatContextMemory,
  upsertChatMemory,
};
