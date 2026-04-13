export async function shareDirectoryRecord({ title, text }) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    await navigator.share({ title, text });
    return "Record shared successfully.";
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "Record details copied to clipboard.";
  }

  throw new Error("Sharing is not available in this browser.");
}

export function matchesDirectoryQuery(query, values) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
}
