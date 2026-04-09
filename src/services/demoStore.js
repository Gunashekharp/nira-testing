import { buildDraftFromAnswers, buildPrescriptionFromDraft, emptyEncounterDraft } from "./clinicalHelpers";
import { createFirstAdminSeedState, createSeedState } from "../data/seed";
import { clone, uid, wait } from "../lib/utils";
import { getTodayDayKey } from "../lib/schedule";
import {
  buildOverrideId,
  createWeeklyRules,
  getRoleCollectionKey,
  listCollection,
  normalizePhone,
  syncDoctorDaySchedules,
  upsertEntity
} from "./stateHelpers";

const STORAGE_KEY = "nira-demo-state-v2";

function readRaw() {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seed = createSeedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  return JSON.parse(stored);
}

function writeRaw(nextState) {
  const payload = {
    ...nextState,
    meta: {
      ...nextState.meta,
      lastSyncedAt: new Date().toISOString()
    }
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function updateState(updater) {
  const current = clone(readRaw());
  const next = updater(current) ?? current;
  writeRaw(next);
  return clone(next);
}

function resetToSeed(mode = "default") {
  const seed = mode === "first-admin" ? createFirstAdminSeedState() : createSeedState();
  writeRaw(seed);
  return clone(seed);
}

function getUserById(state, userId) {
  return state.users.byId[userId] || null;
}

function normalizeIdentifier(value = "") {
  return value.trim().toLowerCase();
}

function matchesIdentifier(user, identifier) {
  if (!identifier) {
    return false;
  }

  if (identifier.includes("@")) {
    return user.email.toLowerCase() === identifier;
  }

  return normalizePhone(user.phone) === normalizePhone(identifier);
}

function findUserForLogin(state, role, identifier) {
  return listCollection(state.users).find(
    (user) => user.role === role && matchesIdentifier(user, normalizeIdentifier(identifier))
  );
}

function setSession(state, user, identifier) {
  state.session = {
    userId: user.id,
    role: user.role,
    isAuthenticated: true,
    activeProfileId: user.profileId,
    identifier
  };
  state.users.byId[user.id].lastLoginAt = new Date().toISOString();
}

function clearSession(state) {
  state.session = {
    userId: null,
    role: null,
    isAuthenticated: false,
    activeProfileId: null,
    identifier: ""
  };
}

function getAdminExists(state) {
  return state.admins.allIds.length > 0;
}

function createUserAccount(role, profileId, form, status = "active") {
  return {
    id: uid("user"),
    role,
    status,
    phone: form.phone || "",
    email: form.email || "",
    password: form.password,
    profileId,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  };
}

function createPatientProfile(user, form) {
  return {
    id: user.profileId,
    userId: user.id,
    fullName: form.fullName,
    preferredLanguage: form.preferredLanguage || "en",
    age: form.age ? Number(form.age) : null,
    gender: form.gender || "",
    city: form.city || "",
    phone: form.phone || "",
    email: form.email || "",
    abhaNumber: form.abhaNumber || "",
    emergencyContactName: form.emergencyContactName || "",
    emergencyContactPhone: form.emergencyContactPhone || "",
    notes: form.notes || ""
  };
}

function createDoctorProfile(user, form, status = "active") {
  return {
    id: user.profileId,
    userId: user.id,
    fullName: form.fullName,
    specialty: form.specialty,
    clinic: form.clinic || "NIRA Pilot Clinic",
    licenseNumber: form.licenseNumber,
    status,
    acceptingAppointments: status === "active" ? form.acceptingAppointments !== false : false,
    slotDurationMinutes: Number(form.slotDurationMinutes || 15),
    phone: form.phone || "",
    email: form.email || "",
    bio: form.bio || "",
    gender: form.gender || ""
  };
}

function createAdminProfile(user, form) {
  return {
    id: user.profileId,
    userId: user.id,
    fullName: form.fullName,
    clinicName: form.clinicName || "NIRA Pilot Clinic",
    phone: form.phone || "",
    email: form.email || ""
  };
}

function createScheduleTemplate(doctorId, slotDurationMinutes = 15, weeklyRules = createWeeklyRules()) {
  return {
    id: doctorId,
    doctorId,
    defaultSlotDurationMinutes: Number(slotDurationMinutes),
    weeklyRules
  };
}

function getScheduleForSlot(state, doctorId, date) {
  return state.daySchedules.byId[`schedule-${doctorId}-${date}`] || null;
}

function ensureBookableSlot(state, doctorId, date, slotId) {
  const schedule = getScheduleForSlot(state, doctorId, date);
  if (!schedule) {
    throw new Error("No schedule found for this doctor and date.");
  }

  const slot = schedule.slots.find((entry) => entry.id === slotId);
  if (!slot || slot.status !== "available") {
    throw new Error("That slot is no longer available.");
  }

  return slot;
}

function buildToken(doctorId) {
  const prefixes = {
    "doctor-mehra": "A",
    "doctor-raman": "B",
    "doctor-khan": "C",
    "doctor-ali": "D"
  };

  return `${prefixes[doctorId] || "N"}${Math.floor(10 + Math.random() * 80)}`;
}

function upsertInterview(state, interview) {
  upsertEntity(state.interviews, interview);
}

function upsertEncounter(state, encounter) {
  upsertEntity(state.encounters, encounter);
}

function upsertAppointment(state, appointment) {
  upsertEntity(state.appointments, appointment);
}

function upsertPrescription(state, prescription) {
  upsertEntity(state.prescriptions, prescription);
}

function createPendingInterview(appointmentId, language) {
  return {
    id: `interview-${appointmentId}`,
    appointmentId,
    language,
    transcript: [],
    extractedFindings: [],
    completionStatus: "pending"
  };
}

function createPendingEncounter(appointment, interview) {
  const draft = emptyEncounterDraft("Pending symptom interview");

  return {
    id: `encounter-${appointment.id}`,
    appointmentId: appointment.id,
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    interviewId: interview.id,
    status: "awaiting_interview",
    apciDraft: {
      ...draft,
      appointmentId: appointment.id,
      id: `draft-${appointment.id}`
    },
    doctorReview: {
      draftId: `draft-${appointment.id}`,
      editedFields: [],
      note: "",
      reviewedAt: null,
      approved: false
    },
    finalClinicalNote: "",
    alerts: draft.alerts,
    confidenceMap: draft.confidenceMap,
    prescriptionId: null,
    approvedAt: null
  };
}

function syncDoctorAndMaybeOriginal(state, doctorIds) {
  const start = state.meta.today || getTodayDayKey();
  Array.from(new Set(doctorIds)).forEach((doctorId) => {
    syncDoctorDaySchedules(state, doctorId, start, 30);
  });
}

export const demoStore = {
  async getState() {
    await wait();
    return clone(readRaw());
  },

  reset(mode = "default") {
    return resetToSeed(mode);
  },

  async login(payload) {
    await wait(120);
    return updateState((state) => {
      const user = findUserForLogin(state, payload.role, payload.identifier);

      if (!user || user.password !== payload.password) {
        throw new Error("Invalid credentials for this role.");
      }

      if (user.status === "archived") {
        throw new Error("This account is archived.");
      }

      setSession(state, user, payload.identifier);
      return state;
    });
  },

  async logout() {
    await wait();
    return updateState((state) => {
      clearSession(state);
      return state;
    });
  },

  async signupPatient(form) {
    await wait(140);
    return updateState((state) => {
      const duplicate = listCollection(state.users).find(
        (user) =>
          user.role === "patient" &&
          (normalizePhone(user.phone) === normalizePhone(form.phone) ||
            (form.email && user.email.toLowerCase() === form.email.toLowerCase()))
      );

      if (duplicate) {
        throw new Error("A patient account already exists with that phone or email.");
      }

      const profileId = uid("patient");
      const user = createUserAccount("patient", profileId, form, "active");
      const profile = createPatientProfile(user, form);

      upsertEntity(state.users, user);
      upsertEntity(state.patients, profile);
      setSession(state, user, form.email || form.phone);
      return state;
    });
  },

  async signupDoctor(form) {
    await wait(160);
    return updateState((state) => {
      const duplicate = listCollection(state.users).find(
        (user) =>
          user.role === "doctor" &&
          (normalizePhone(user.phone) === normalizePhone(form.phone) ||
            user.email.toLowerCase() === form.email.toLowerCase())
      );

      if (duplicate) {
        throw new Error("A doctor account already exists with that phone or email.");
      }

      const profileId = uid("doctor");
      const user = createUserAccount("doctor", profileId, form, "pending_approval");
      const profile = createDoctorProfile(user, form, "pending_approval");

      upsertEntity(state.users, user);
      upsertEntity(state.doctors, profile);
      upsertEntity(
        state.scheduleTemplates,
        createScheduleTemplate(profile.id, profile.slotDurationMinutes, createWeeklyRules())
      );
      syncDoctorDaySchedules(state, profile.id, state.meta.today, 30);
      setSession(state, user, form.email || form.phone);
      return state;
    });
  },

  async signupAdmin(form) {
    await wait(160);
    return updateState((state) => {
      if (getAdminExists(state)) {
        throw new Error("Admin signup is disabled after the first clinic admin is created.");
      }

      const profileId = uid("admin");
      const user = createUserAccount("admin", profileId, form, "active");
      const profile = createAdminProfile(user, form);

      upsertEntity(state.users, user);
      upsertEntity(state.admins, profile);
      setSession(state, user, form.email || form.phone);
      return state;
    });
  },

  async updateCurrentProfile(payload) {
    await wait();
    return updateState((state) => {
      const user = getUserById(state, state.session.userId);
      if (!user) {
        throw new Error("No active session.");
      }

      const collectionKey = getRoleCollectionKey(user.role);
      const profile = state[collectionKey].byId[user.profileId];
      const nextProfile = { ...profile, ...payload };

      if (collectionKey === "patients" && payload.age === "") {
        nextProfile.age = null;
      } else if (collectionKey === "patients" && payload.age !== undefined) {
        nextProfile.age = payload.age ? Number(payload.age) : null;
      }

      state[collectionKey].byId[user.profileId] = nextProfile;

      if (payload.phone !== undefined || payload.email !== undefined) {
        state.users.byId[user.id] = {
          ...user,
          phone: payload.phone !== undefined ? payload.phone : user.phone,
          email: payload.email !== undefined ? payload.email : user.email
        };

        state.session.identifier =
          payload.email !== undefined && payload.email ? payload.email : payload.phone || state.session.identifier;
      }

      if (collectionKey === "doctors") {
        syncDoctorDaySchedules(state, profile.id, state.meta.today, 30);
      }

      return state;
    });
  },

  async addDoctor(form) {
    await wait(140);
    return updateState((state) => {
      const duplicate = listCollection(state.users).find(
        (user) =>
          user.role === "doctor" &&
          (normalizePhone(user.phone) === normalizePhone(form.phone) ||
            user.email.toLowerCase() === form.email.toLowerCase())
      );

      if (duplicate) {
        throw new Error("A doctor account already exists with that phone or email.");
      }

      const profileId = uid("doctor");
      const status = form.status || "active";
      const user = createUserAccount("doctor", profileId, form, status);
      const profile = createDoctorProfile(user, form, status);

      upsertEntity(state.users, user);
      upsertEntity(state.doctors, profile);
      upsertEntity(
        state.scheduleTemplates,
        createScheduleTemplate(profile.id, profile.slotDurationMinutes, createWeeklyRules())
      );
      syncDoctorDaySchedules(state, profile.id, state.meta.today, 30);
      return state;
    });
  },

  async updateDoctor(doctorId, payload) {
    await wait();
    return updateState((state) => {
      const doctor = state.doctors.byId[doctorId];
      if (!doctor) {
        throw new Error("Doctor not found.");
      }

      const user = state.users.byId[doctor.userId];
      state.doctors.byId[doctorId] = { ...doctor, ...payload };
      state.users.byId[user.id] = {
        ...user,
        phone: payload.phone !== undefined ? payload.phone : user.phone,
        email: payload.email !== undefined ? payload.email : user.email,
        status: payload.status || user.status
      };

      if (payload.slotDurationMinutes) {
        state.scheduleTemplates.byId[doctorId] = {
          ...state.scheduleTemplates.byId[doctorId],
          defaultSlotDurationMinutes: Number(payload.slotDurationMinutes)
        };
      }

      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async approveDoctor(doctorId) {
    await wait();
    return updateState((state) => {
      const doctor = state.doctors.byId[doctorId];
      if (!doctor) {
        throw new Error("Doctor not found.");
      }

      state.doctors.byId[doctorId] = {
        ...doctor,
        status: "active",
        acceptingAppointments: true
      };
      state.users.byId[doctor.userId] = {
        ...state.users.byId[doctor.userId],
        status: "active"
      };
      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async rejectDoctor(doctorId) {
    await wait();
    return updateState((state) => {
      const doctor = state.doctors.byId[doctorId];
      state.doctors.byId[doctorId] = {
        ...doctor,
        status: "inactive",
        acceptingAppointments: false
      };
      state.users.byId[doctor.userId] = {
        ...state.users.byId[doctor.userId],
        status: "inactive"
      };
      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async deactivateDoctor(doctorId) {
    return demoStore.rejectDoctor(doctorId);
  },

  async archiveDoctor(doctorId) {
    await wait();
    return updateState((state) => {
      const doctor = state.doctors.byId[doctorId];
      state.doctors.byId[doctorId] = {
        ...doctor,
        status: "archived",
        acceptingAppointments: false
      };
      state.users.byId[doctor.userId] = {
        ...state.users.byId[doctor.userId],
        status: "archived"
      };
      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async updateDoctorAvailability(doctorId, payload) {
    await wait();
    return updateState((state) => {
      const doctor = state.doctors.byId[doctorId];
      if (!doctor) {
        throw new Error("Doctor not found.");
      }

      state.doctors.byId[doctorId] = {
        ...doctor,
        slotDurationMinutes: Number(payload.slotDurationMinutes || doctor.slotDurationMinutes)
      };
      state.scheduleTemplates.byId[doctorId] = {
        ...state.scheduleTemplates.byId[doctorId],
        defaultSlotDurationMinutes: Number(payload.slotDurationMinutes || doctor.slotDurationMinutes),
        weeklyRules: payload.weeklyRules || state.scheduleTemplates.byId[doctorId].weeklyRules
      };
      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async updateScheduleOverride(doctorId, payload) {
    await wait();
    return updateState((state) => {
      const overrideId = buildOverrideId(doctorId, payload.date);
      const existing = state.scheduleOverrides.byId[overrideId] || {
        id: overrideId,
        doctorId,
        date: payload.date,
        mode: "closed",
        closedReason: "",
        customRule: null,
        slotStatuses: {}
      };

      upsertEntity(state.scheduleOverrides, {
        ...existing,
        ...payload,
        slotStatuses: payload.slotStatuses
          ? { ...existing.slotStatuses, ...payload.slotStatuses }
          : existing.slotStatuses
      });
      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async toggleSlotAvailability(doctorId, date, slotId, nextStatus) {
    await wait();
    return updateState((state) => {
      const overrideId = buildOverrideId(doctorId, date);
      const existing = state.scheduleOverrides.byId[overrideId] || {
        id: overrideId,
        doctorId,
        date,
        mode: "custom",
        closedReason: "",
        customRule: null,
        slotStatuses: {}
      };

      upsertEntity(state.scheduleOverrides, {
        ...existing,
        mode: existing.mode === "closed" ? "custom" : existing.mode || "custom",
        slotStatuses: {
          ...existing.slotStatuses,
          [slotId]: nextStatus
        }
      });
      syncDoctorDaySchedules(state, doctorId, state.meta.today, 30);
      return state;
    });
  },

  async bookAppointment(payload) {
    await wait(160);
    return updateState((state) => {
      const slot = ensureBookableSlot(state, payload.doctorId, payload.date, payload.slotId);
      const appointmentId = uid("appointment");
      const appointment = {
        id: appointmentId,
        slotId: payload.slotId,
        doctorId: payload.doctorId,
        patientId: payload.patientId,
        bookedByUserId: payload.bookedByUserId,
        visitType: payload.visitType || "booked",
        bookingStatus: "scheduled",
        rescheduleHistory: [],
        token: buildToken(payload.doctorId),
        startAt: slot.startAt,
        endAt: slot.endAt
      };
      const interview = createPendingInterview(appointmentId, payload.language || "en");
      const encounter = createPendingEncounter(appointment, interview);

      upsertAppointment(state, appointment);
      upsertInterview(state, interview);
      upsertEncounter(state, encounter);
      state.ui.lastViewedAppointmentId = appointmentId;
      syncDoctorDaySchedules(state, payload.doctorId, state.meta.today, 30);
      return state;
    });
  },

  async cancelAppointment(appointmentId) {
    await wait();
    return updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      state.appointments.byId[appointmentId] = {
        ...appointment,
        bookingStatus: "cancelled"
      };

      const encounter = state.encounters.byId[`encounter-${appointmentId}`];
      if (encounter) {
        state.encounters.byId[encounter.id] = {
          ...encounter,
          status: "closed"
        };
      }

      syncDoctorDaySchedules(state, appointment.doctorId, state.meta.today, 30);
      return state;
    });
  },

  async rescheduleAppointment(appointmentId, payload) {
    await wait(160);
    return updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const nextSlot = ensureBookableSlot(state, payload.doctorId, payload.date, payload.slotId);
      const originalDoctorId = appointment.doctorId;

      state.appointments.byId[appointmentId] = {
        ...appointment,
        doctorId: payload.doctorId,
        slotId: payload.slotId,
        startAt: nextSlot.startAt,
        endAt: nextSlot.endAt,
        bookingStatus: "rescheduled",
        rescheduleHistory: [
          ...(appointment.rescheduleHistory || []),
          {
            fromSlotId: appointment.slotId,
            toSlotId: payload.slotId,
            changedAt: new Date().toISOString()
          }
        ]
      };

      const encounter = state.encounters.byId[`encounter-${appointmentId}`];
      if (encounter) {
        state.encounters.byId[encounter.id] = {
          ...encounter,
          doctorId: payload.doctorId
        };
      }

      syncDoctorAndMaybeOriginal(state, [originalDoctorId, payload.doctorId]);
      return state;
    });
  },

  async submitInterview(appointmentId, answers) {
    await wait(200);
    return updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const patient = state.patients.byId[appointment.patientId];
      const draft = buildDraftFromAnswers(appointment, patient, answers, `draft-${appointmentId}`);
      const interview = {
        id: `interview-${appointmentId}`,
        appointmentId,
        language: answers.language,
        transcript: [
          { role: "ai", text: "What brings you in today?" },
          { role: "patient", text: answers.primaryConcern },
          { role: "ai", text: "How long have you had this issue?" },
          { role: "patient", text: answers.duration },
          { role: "ai", text: "Any other symptoms or medicines I should note?" },
          {
            role: "patient",
            text: `${answers.associatedSymptoms}. Medicines: ${answers.medications || "None"}. Allergies: ${answers.allergies || "None"}.`
          }
        ],
        extractedFindings: [
          answers.primaryConcern,
          answers.duration,
          answers.associatedSymptoms,
          answers.severity
        ],
        completionStatus: "complete"
      };

      upsertInterview(state, interview);
      state.encounters.byId[`encounter-${appointmentId}`] = {
        ...state.encounters.byId[`encounter-${appointmentId}`],
        status: "ai_ready",
        apciDraft: draft,
        alerts: draft.alerts,
        confidenceMap: draft.confidenceMap
      };
      state.ui.lastViewedAppointmentId = appointmentId;
      return state;
    });
  },

  async saveDoctorReview(appointmentId, payload) {
    await wait();
    return updateState((state) => {
      const encounter = state.encounters.byId[`encounter-${appointmentId}`];
      if (!encounter) {
        throw new Error("Encounter not found.");
      }

      state.encounters.byId[encounter.id] = {
        ...encounter,
        status: "in_consult",
        apciDraft: payload.draft,
        alerts: payload.draft.alerts,
        confidenceMap: payload.draft.confidenceMap,
        doctorReview: {
          draftId: payload.draft.id,
          editedFields: payload.editedFields,
          note: payload.note,
          reviewedAt: new Date().toISOString(),
          approved: false
        }
      };

      const appointment = state.appointments.byId[appointmentId];
      state.appointments.byId[appointmentId] = {
        ...appointment,
        bookingStatus: appointment.bookingStatus === "scheduled" ? "checked_in" : appointment.bookingStatus
      };
      return state;
    });
  },

  async approveEncounter(appointmentId, payload) {
    await wait(220);
    return updateState((state) => {
      const encounter = state.encounters.byId[`encounter-${appointmentId}`];
      const appointment = state.appointments.byId[appointmentId];
      if (!encounter || !appointment) {
        throw new Error("Encounter not found.");
      }

      const prescription = buildPrescriptionFromDraft(appointment, payload.draft, payload.followUpNote);
      upsertPrescription(state, prescription);
      state.encounters.byId[encounter.id] = {
        ...encounter,
        status: "approved",
        apciDraft: payload.draft,
        alerts: payload.draft.alerts,
        confidenceMap: payload.draft.confidenceMap,
        doctorReview: {
          draftId: payload.draft.id,
          editedFields: payload.editedFields,
          note: payload.note,
          reviewedAt: new Date().toISOString(),
          approved: true
        },
        finalClinicalNote: payload.draft.soap.assessment,
        prescriptionId: prescription.id,
        approvedAt: new Date().toISOString()
      };
      state.appointments.byId[appointmentId] = {
        ...appointment,
        bookingStatus: "completed"
      };
      state.ui.lastViewedAppointmentId = appointmentId;
      return state;
    });
  }
};
