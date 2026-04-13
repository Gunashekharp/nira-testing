import { addDays, createSlotsForRule, getDateRange, getTimeLabel, getTodayDayKey, getWeekdayKey, summarizeSlots } from "../lib/schedule";

export function indexCollection(items) {
  return {
    byId: Object.fromEntries(items.map((item) => [item.id, item])),
    allIds: items.map((item) => item.id)
  };
}

export function listCollection(collection) {
  return collection.allIds.map((id) => collection.byId[id]);
}

export function upsertEntity(collection, item) {
  collection.byId[item.id] = item;
  if (!collection.allIds.includes(item.id)) {
    collection.allIds.push(item.id);
  }
}

export function removeEntity(collection, id) {
  delete collection.byId[id];
  collection.allIds = collection.allIds.filter((itemId) => itemId !== id);
}

export function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

export function createDayRule(enabled, startTime = "09:00", endTime = "13:00", breaks = []) {
  return {
    enabled,
    startTime,
    endTime,
    breaks
  };
}

export function createWeeklyRules(overrides = {}) {
  return {
    monday: createDayRule(true, "09:00", "13:00", [{ startTime: "11:00", endTime: "11:15" }]),
    tuesday: createDayRule(true, "09:00", "13:00", [{ startTime: "11:00", endTime: "11:15" }]),
    wednesday: createDayRule(true, "09:00", "13:00", [{ startTime: "11:00", endTime: "11:15" }]),
    thursday: createDayRule(true, "09:00", "13:00", [{ startTime: "11:00", endTime: "11:15" }]),
    friday: createDayRule(true, "09:00", "13:00", [{ startTime: "11:00", endTime: "11:15" }]),
    saturday: createDayRule(true, "10:00", "12:00", []),
    sunday: createDayRule(false, "09:00", "13:00", []),
    ...overrides
  };
}

export function buildScheduleId(doctorId, date) {
  return `schedule-${doctorId}-${date}`;
}

export function buildOverrideId(doctorId, date) {
  return `override-${doctorId}-${date}`;
}

export function getAppointmentDayKey(appointment) {
  return appointment.startAt.slice(0, 10);
}

export function isAppointmentBlocking(appointment) {
  return appointment.bookingStatus !== "cancelled";
}

export function getScheduleOverride(state, doctorId, date) {
  return state.scheduleOverrides.byId[buildOverrideId(doctorId, date)] || null;
}

export function getRoleCollectionKey(role) {
  if (role === "patient") return "patients";
  if (role === "doctor") return "doctors";
  if (role === "nurse") return "nurses";
  return "admins";
}

function resolveRule(template, override, date) {
  const weekdayKey = getWeekdayKey(date);
  const baseRule = template?.weeklyRules?.[weekdayKey] || createDayRule(false);

  if (!override) {
    return {
      rule: baseRule,
      isClosed: !baseRule.enabled,
      overrideReason: !baseRule.enabled ? "Non-working day" : ""
    };
  }

  if (override.mode === "closed") {
    return {
      rule: createDayRule(false),
      isClosed: true,
      overrideReason: override.closedReason || "Closed"
    };
  }

  if (override.mode === "custom") {
    return {
      rule: override.customRule || createDayRule(false),
      isClosed: !(override.customRule?.enabled),
      overrideReason: ""
    };
  }

  if (override.mode === "open") {
    return {
      rule: override.customRule || { ...baseRule, enabled: true },
      isClosed: false,
      overrideReason: ""
    };
  }

  return {
    rule: baseRule,
    isClosed: !baseRule.enabled,
    overrideReason: !baseRule.enabled ? "Non-working day" : ""
  };
}

function mergeBookedAppointments(state, doctorId, date, slots) {
  const appointments = listCollection(state.appointments).filter(
    (appointment) =>
      appointment.doctorId === doctorId &&
      getAppointmentDayKey(appointment) === date &&
      isAppointmentBlocking(appointment)
  );

  const merged = [...slots];

  appointments.forEach((appointment) => {
    const found = merged.find((slot) => slot.id === appointment.slotId);
    if (found) {
      found.status = "booked";
      found.appointmentId = appointment.id;
      found.closedReason = "";
      return;
    }

    merged.push({
      id: appointment.slotId,
      doctorId,
      date,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: "booked",
      appointmentId: appointment.id,
      closedReason: ""
    });
  });

  merged.sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
  return merged;
}

function applySlotOverrides(slots, override) {
  if (!override?.slotStatuses) {
    return slots;
  }

  return slots.map((slot) => {
    const nextStatus = override.slotStatuses[slot.id];
    if (!nextStatus || slot.status === "booked") {
      return slot;
    }

    return {
      ...slot,
      status: nextStatus,
      closedReason: nextStatus === "unavailable" ? override.closedReason || "Blocked slot" : ""
    };
  });
}

export function syncDoctorDaySchedules(state, doctorId, startDayKey = getTodayDayKey(), horizon = 30) {
  const doctor = state.doctors.byId[doctorId];
  const template = state.scheduleTemplates.byId[doctorId];
  const activeDates = getDateRange(startDayKey, horizon);

  activeDates.forEach((date) => {
    const override = getScheduleOverride(state, doctorId, date);
    const scheduleId = buildScheduleId(doctorId, date);
    const doctorActive = doctor?.status === "active" && doctor?.acceptingAppointments;
    const { rule, isClosed, overrideReason } = resolveRule(template, override, date);
    let slots = doctorActive
      ? createSlotsForRule(doctorId, date, rule, doctor.slotDurationMinutes || template.defaultSlotDurationMinutes || 15)
      : [];

    slots = applySlotOverrides(slots, override);
    slots = mergeBookedAppointments(state, doctorId, date, slots);

    upsertEntity(state.daySchedules, {
      id: scheduleId,
      doctorId,
      date,
      isClosed: !doctorActive || isClosed,
      slotSummary: summarizeSlots(slots),
      overrideReason: !doctorActive ? "Doctor unavailable" : overrideReason,
      slots
    });
  });
}

export function syncAllDoctorDaySchedules(state, startDayKey = getTodayDayKey(), horizon = 30) {
  state.doctors.allIds.forEach((doctorId) => {
    syncDoctorDaySchedules(state, doctorId, startDayKey, horizon);
  });
}

export function getNextAvailableSlot(schedule) {
  if (!schedule) {
    return null;
  }

  return schedule.slots.find((slot) => slot.status === "available") || null;
}

export function getScheduleLabel(schedule) {
  if (!schedule) {
    return "No schedule";
  }

  if (schedule.slotSummary.available > 0) {
    return `${schedule.slotSummary.available} slots open`;
  }

  if (schedule.slotSummary.booked > 0 && schedule.slotSummary.total > 0) {
    return "Fully booked";
  }

  return schedule.overrideReason || "Unavailable";
}

export function getSlotDisplay(slot) {
  return `${getTimeLabel(slot.startAt)} - ${getTimeLabel(slot.endAt)}`;
}
