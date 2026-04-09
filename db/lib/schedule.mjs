const CLINIC_UTC_OFFSET = "+05:30";
const CLINIC_TIME_ZONE = "Asia/Kolkata";

function getParts(date, timeZone, options) {
  return new Intl.DateTimeFormat("en", {
    timeZone,
    hour12: false,
    ...options
  }).formatToParts(date);
}

export function getDayKey(date = new Date(), timeZone = CLINIC_TIME_ZONE) {
  const parts = getParts(date, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    date.getUTCDay()
  ];
}

export function combineDayAndTime(dayKey, time) {
  return new Date(`${dayKey}T${time}:00${CLINIC_UTC_OFFSET}`);
}

export function formatTime(date, timeZone = CLINIC_TIME_ZONE) {
  const parts = getParts(date, timeZone, {
    hour: "2-digit",
    minute: "2-digit"
  });

  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export function minutesBetween(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

export function createSlotsForWindows(dayKey, windows, slotDurationMinutes, bufferMinutes = 0) {
  const slots = [];

  for (const window of windows) {
    let cursor = combineDayAndTime(dayKey, window.startTime);
    const end = combineDayAndTime(dayKey, window.endTime);

    while (cursor < end) {
      const nextEnd = new Date(cursor.getTime() + slotDurationMinutes * 60 * 1000);
      if (nextEnd > end) {
        break;
      }

      const slotLabel = `${formatTime(cursor)}-${formatTime(nextEnd)}`;
      slots.push({
        slotId: `${dayKey}-${slotLabel}`,
        startAt: cursor,
        endAt: nextEnd,
        status: "available",
        appointmentId: null,
        patientId: null,
        bookedAt: null,
        closedReason: null
      });

      cursor = new Date(nextEnd.getTime() + bufferMinutes * 60 * 1000);
    }
  }

  return slots;
}

export function buildSlotSummary(slots = []) {
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
