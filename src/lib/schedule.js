const CLINIC_OFFSET = "+05:30";
const CLINIC_TIME_ZONE = "Asia/Kolkata";

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

function getParts(date, options = {}) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    hour12: false,
    ...options
  }).formatToParts(date);
}

function getPartsMap(date, options = {}) {
  return Object.fromEntries(
    getParts(date, options)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function getTodayDayKey(reference = new Date()) {
  const parts = getPartsMap(reference, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(dayKey, days) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function getWeekdayKey(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return WEEKDAY_KEYS[date.getUTCDay()];
}

export function toIsoDateTime(dayKey, time) {
  return `${dayKey}T${time}:00${CLINIC_OFFSET}`;
}

export function getTimeLabel(value) {
  const parts = getPartsMap(new Date(value), {
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${parts.hour}:${parts.minute}`;
}

export function getDateRange(startDayKey, length) {
  return Array.from({ length }, (_, index) => addDays(startDayKey, index));
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function overlapsBreak(startMinutes, endMinutes, rule) {
  return (rule.breaks || []).some((entry) => {
    const breakStart = timeToMinutes(entry.startTime);
    const breakEnd = timeToMinutes(entry.endTime);
    return startMinutes < breakEnd && endMinutes > breakStart;
  });
}

export function createSlotsForRule(doctorId, dayKey, rule, slotDurationMinutes) {
  if (!rule?.enabled) {
    return [];
  }

  const startMinutes = timeToMinutes(rule.startTime);
  const endMinutes = timeToMinutes(rule.endTime);
  const slots = [];

  for (let cursor = startMinutes; cursor + slotDurationMinutes <= endMinutes; cursor += slotDurationMinutes) {
    const slotEnd = cursor + slotDurationMinutes;
    if (overlapsBreak(cursor, slotEnd, rule)) {
      continue;
    }

    const startHour = String(Math.floor(cursor / 60)).padStart(2, "0");
    const startMinute = String(cursor % 60).padStart(2, "0");
    const endHour = String(Math.floor(slotEnd / 60)).padStart(2, "0");
    const endMinute = String(slotEnd % 60).padStart(2, "0");
    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    slots.push({
      id: `slot-${doctorId}-${dayKey}-${startTime}`,
      doctorId,
      date: dayKey,
      startAt: toIsoDateTime(dayKey, startTime),
      endAt: toIsoDateTime(dayKey, endTime),
      status: "available",
      appointmentId: null,
      closedReason: null
    });
  }

  return slots;
}

export function summarizeSlots(slots = []) {
  return slots.reduce(
    (summary, slot) => {
      summary.total += 1;
      if (slot.status === "available") summary.available += 1;
      if (slot.status === "booked") summary.booked += 1;
      if (slot.status === "unavailable") summary.unavailable += 1;
      return summary;
    },
    { total: 0, available: 0, booked: 0, unavailable: 0 }
  );
}
