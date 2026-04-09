export function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatDayKey(dayKey) {
  return formatDate(`${dayKey}T00:00:00+05:30`);
}

export function formatTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatConfidence(value) {
  return `${Math.round(value * 100)}%`;
}

export function formatStatus(status) {
  return status
    .split(/[-_]/)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
