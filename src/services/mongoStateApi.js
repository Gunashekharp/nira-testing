const mongoStateApiBase = (import.meta.env.VITE_MONGO_STATE_API_URL || "").trim();

export const mongoStateConfigured = Boolean(mongoStateApiBase);

function buildUrl(pathname) {
  return `${mongoStateApiBase}${pathname}`;
}

export async function fetchMongoState() {
  if (!mongoStateConfigured) {
    return null;
  }

  const response = await fetch(buildUrl("/api/state"));
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Mongo state fetch failed (${response.status})`);
  }

  const payload = await response.json();
  return payload?.state || null;
}

export async function persistMongoState(state) {
  if (!mongoStateConfigured) {
    return { synced: false, skipped: true, reason: "mongo_state_not_configured" };
  }

  const response = await fetch(buildUrl("/api/state"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ state })
  });

  if (!response.ok) {
    throw new Error(`Mongo state write failed (${response.status})`);
  }

  return response.json();
}