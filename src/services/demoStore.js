import { buildDraftFromAnswers, buildPrescriptionFromDraft, emptyEncounterDraft } from "./clinicalHelpers";
import { createFirstAdminSeedState, createSeedState } from "../data/seed";
import { clone, uid, wait } from "../lib/utils";
import { getTodayDayKey } from "../lib/schedule";
import {
  analyzeCdssEncounter,
  syncBookingToGunaEmr,
  syncDoctorApprovalToGunaEmr,
  syncInterviewToGunaEmr,
  syncNurseVitalsToGunaEmr,
  syncPatientAbhaToGunaEmr
} from "./gunaEmrBridge";
import {
  appStateSnapshotConfigured,
  approvePrescription,
  createNotification as createDbNotification,
  createEncounter,
  createInterview,
  createPrecheckQuestionnaire as upsertDbPrecheckQuestionnaire,
  createPrescription,
  fetchAppStateSnapshot,
  persistAppStateSnapshot,
  syncSignupToDatabase,
  updateInterview,
  upsertEncounterSnapshot,
  upsertLabReport as upsertDbLabReport,
  upsertTestOrder as upsertDbTestOrder
} from "./supabaseApi";
import { formatDate, formatTime } from "../lib/format";
import {
  buildOverrideId,
  createWeeklyRules,
  getRoleCollectionKey,
  listCollection,
  normalizePhone,
  removeEntity,
  syncDoctorDaySchedules,
  upsertEntity
} from "./stateHelpers";
import { generateAdaptivePrecheckTurn, generatePrecheckQuestions } from "./precheckQuestions";

export const STORAGE_KEY = "nira-demo-state-v2";
const APPOINTMENT_REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;
const DISEASE_SPECIFIC_PRECHECK_MODE = "adaptive_disease_specific_ai";
const DISEASE_SPECIFIC_PRECHECK_VERSION = "adaptive-symptom-ai-v2";
const PRECHECK_PRIMARY_CONCERN_PATTERNS = [
  /\bwhat health problem, symptom, or concern would you like help with today\??$/i,
  /\bwhat symptoms are bothering you most right now\??$/i,
  /\bwhat is your main concern right now\??$/i,
  /\bwhat is your main concern for this appointment\??$/i,
  /\bwhat(?:'s| is) bothering you\b/i,
];
const DISEASE_SPECIFIC_PRECHECK_MIN_QUESTIONS = 7;
const DISEASE_SPECIFIC_PRECHECK_MAX_QUESTIONS = 9;
const DISEASE_SPECIFIC_PRECHECK_DEFAULT_TARGET = 8;
let appStateSnapshotHydrated = false;
let appStateSnapshotPersistQueue = Promise.resolve();

function queueAppStateSnapshotPersist(snapshot) {
  if (!appStateSnapshotConfigured || typeof window === "undefined") {
    return;
  }

  appStateSnapshotPersistQueue = appStateSnapshotPersistQueue
    .then(() => persistAppStateSnapshot(snapshot))
    .catch((error) => {
      console.warn("[NIRA] Supabase state snapshot persistence skipped.", error);
    });
}

async function hydrateStateFromSnapshot() {
  if (!appStateSnapshotConfigured || typeof window === "undefined" || appStateSnapshotHydrated) {
    return;
  }

  appStateSnapshotHydrated = true;

  try {
    const remoteState = await fetchAppStateSnapshot();

    if (!remoteState) {
      queueAppStateSnapshotPersist(readRaw());
      return;
    }

    normalizeStateShape(remoteState);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
  } catch (error) {
    console.warn("[NIRA] Failed to hydrate state from Supabase snapshot.", error);
  }
}

function ensureCollection(state, key) {
  if (!state[key] || !Array.isArray(state[key].allIds) || typeof state[key].byId !== "object") {
    state[key] = { allIds: [], byId: {} };
    return true;
  }
  return false;
}

function ensureDefaultNurseAccount(state) {
  let changed = false;
  ensureCollection(state, "users");
  ensureCollection(state, "nurses");

  const existingNurseUser = listCollection(state.users).find((user) => user.role === "nurse");
  if (existingNurseUser) {
    if (!state.nurses.byId[existingNurseUser.profileId]) {
      upsertEntity(state.nurses, {
        id: existingNurseUser.profileId,
        userId: existingNurseUser.id,
        fullName: "Nurse",
        profilePhoto: "",
        shift: "day",
        assignedWard: "OPD-A",
        nursingLicenseNumber: "",
        yearsExperience: null,
        phone: existingNurseUser.phone || "",
        email: existingNurseUser.email || "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        notes: ""
      });
      changed = true;
    }
    return changed;
  }

  const nurseUserId = "user-nurse-primary";
  const nurseProfileId = "nurse-primary";

  upsertEntity(state.users, {
    id: nurseUserId,
    role: "nurse",
    status: "active",
    phone: "+91 95555 22110",
    email: "nurse@nira.local",
    password: "Nurse@123",
    profileId: nurseProfileId,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  });

  upsertEntity(state.nurses, {
    id: nurseProfileId,
    userId: nurseUserId,
    fullName: "Sister Priya Nair",
    profilePhoto: "",
    clinic: "NIRA Pilot Clinic",
    department: "General OPD",
    shift: "day",
    assignedWard: "OPD-A",
    nursingLicenseNumber: "KNC-RN-77821",
    yearsExperience: 6,
    phone: "+91 95555 22110",
    email: "nurse@nira.local",
    emergencyContactName: "Suresh Nair",
    emergencyContactPhone: "+91 95555 22111",
    notes: "Leads vitals capture, triage prep, and discharge education handoff."
  });
  changed = true;
  return changed;
}

function normalizeStateShape(state) {
  let changed = false;
  changed = ensureCollection(state, "nurses") || changed;
  changed = ensureCollection(state, "labReports") || changed;
  changed = ensureCollection(state, "precheckQuestionnaires") || changed;
  changed = ensureCollection(state, "notifications") || changed;
  changed = ensureCollection(state, "testOrders") || changed;
  changed = ensureCollection(state, "emrSync") || changed;
  changed = ensureCollection(state, "dbSync") || changed;
  changed = ensureDefaultNurseAccount(state) || changed;
  changed = syncDerivedNotifications(state) || changed;
  return changed;
}

function readRaw() {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seed = createSeedState();
    normalizeStateShape(seed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  const parsed = JSON.parse(stored);
  const changed = normalizeStateShape(parsed);
  if (changed) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  }
  return parsed;
}

function writeRaw(nextState) {
  const payload = {
    ...nextState,
    meta: {
      ...nextState.meta,
      lastSyncedAt: new Date().toISOString()
    }
  };
  normalizeStateShape(payload);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("nira-demo-state-updated"));
    queueAppStateSnapshotPersist(payload);
  }
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
    profilePhoto: form.profilePhoto || "",
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
    profilePhoto: form.profilePhoto || "",
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
    profilePhoto: form.profilePhoto || "",
    clinicName: form.clinicName || "NIRA Pilot Clinic",
    phone: form.phone || "",
    email: form.email || ""
  };
}

function findDuplicateRoleUser(state, role, form, ignoreUserId = null) {
  const normalizedPhone = normalizePhone(form.phone || "");
  const normalizedEmail = String(form.email || "").trim().toLowerCase();

  return listCollection(state.users).find((user) => {
    if (user.role !== role || user.id === ignoreUserId) {
      return false;
    }

    const samePhone = normalizedPhone && normalizePhone(user.phone) === normalizedPhone;
    const sameEmail = normalizedEmail && String(user.email || "").trim().toLowerCase() === normalizedEmail;
    return samePhone || sameEmail;
  });
}

function removeMatchingEntities(collection, predicate) {
  listCollection(collection)
    .filter(predicate)
    .forEach((item) => removeEntity(collection, item.id));
}

function removePatientCascade(state, patientId) {
  const patient = state.patients.byId[patientId];
  if (!patient) {
    throw new Error("Patient not found.");
  }

  const patientUserId = patient.userId;
  const relatedAppointments = listCollection(state.appointments).filter((appointment) => appointment.patientId === patientId);
  const appointmentIds = new Set(relatedAppointments.map((appointment) => appointment.id));
  const affectedDoctorIds = relatedAppointments.map((appointment) => appointment.doctorId);

  removeMatchingEntities(state.appointments, (appointment) => appointment.patientId === patientId);
  removeMatchingEntities(
    state.encounters,
    (encounter) => encounter.patientId === patientId || appointmentIds.has(encounter.appointmentId)
  );
  removeMatchingEntities(state.interviews, (interview) => appointmentIds.has(interview.appointmentId));
  removeMatchingEntities(
    state.prescriptions,
    (prescription) => prescription.patientId === patientId || appointmentIds.has(prescription.appointmentId)
  );
  removeMatchingEntities(
    state.labReports,
    (report) => report.patientId === patientId || appointmentIds.has(report.appointmentId)
  );
  removeMatchingEntities(
    state.precheckQuestionnaires,
    (questionnaire) => questionnaire.patientId === patientId || appointmentIds.has(questionnaire.appointmentId)
  );
  removeMatchingEntities(
    state.notifications,
    (notification) => notification.userId === patientUserId || appointmentIds.has(notification.appointmentId)
  );
  removeMatchingEntities(
    state.testOrders,
    (testOrder) => testOrder.patientId === patientId || appointmentIds.has(testOrder.appointmentId)
  );
  removeMatchingEntities(state.emrSync, (item) => appointmentIds.has(item.appointmentId));
  removeMatchingEntities(
    state.dbSync,
    (item) => appointmentIds.has(item.appointmentId) || item.patientId === patientId || item.userId === patientUserId
  );

  removeEntity(state.patients, patientId);
  removeEntity(state.users, patientUserId);

  if (state.session.userId === patientUserId) {
    clearSession(state);
  }

  if (state.ui?.lastViewedAppointmentId && appointmentIds.has(state.ui.lastViewedAppointmentId)) {
    state.ui.lastViewedAppointmentId = null;
  }

  syncDoctorAndMaybeOriginal(state, affectedDoctorIds);
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

function upsertLabReportEntity(state, report) {
  upsertEntity(state.labReports, report);
}

function upsertTestOrderEntity(state, order) {
  upsertEntity(state.testOrders, order);
}

function extractOrderedTestsFromDraft(draft) {
  const raw = draft?.unifiedEmr?.investigations?.selected || draft?.investigations?.selected || [];
  const seen = new Set();
  return raw
    .map((t) => String(t || "").trim())
    .filter((t) => {
      const key = t.toLowerCase();
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function extractPatientTestNoteFromDraft(draft) {
  return String(draft?.unifiedEmr?.investigations?.patientNote || "").trim();
}

function upsertPrecheckQuestionnaireEntity(state, questionnaire) {
  upsertEntity(state.precheckQuestionnaires, questionnaire);
}

function upsertNotificationEntity(state, notification) {
  upsertEntity(state.notifications, notification);
}

function toLowerText(value) {
  return String(value || "").toLowerCase();
}

function splitListText(value) {
  return String(value || "")
    .split(/[,;|\n/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeList(values) {
  const seen = new Set();
  return values.filter((item) => {
    const normalized = toLowerText(item).trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function extractClinicalLists(state, appointment, patient) {
  const encounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
  const interview = state.interviews.byId[`interview-${appointment.id}`] || null;

  const medsFromDraft = (encounter?.apciDraft?.medicationSuggestions || [])
    .map((item) => item?.name)
    .filter(Boolean);
  const medsFromPrescriptions = listCollection(state.prescriptions)
    .filter((item) => item?.patientId === patient?.id)
    .flatMap((item) => (item?.medicines || []).map((med) => med?.name))
    .filter(Boolean);
  const medsFromText = splitListText(
    [
      patient?.notes,
      encounter?.apciDraft?.soap?.plan,
      encounter?.apciDraft?.soap?.subjective,
      ...(interview?.transcript || []).map((entry) => entry?.text)
    ]
      .filter(Boolean)
      .join("\n")
  ).filter((item) => /mg|tablet|capsule|syrup|inhaler|insulin|metformin|amlodipine|telmisartan|atorvastatin|aspirin/i.test(item));

  const allergiesFromText = splitListText(
    [
      patient?.notes,
      encounter?.apciDraft?.soap?.subjective,
      ...(interview?.transcript || []).map((entry) => entry?.text)
    ]
      .filter(Boolean)
      .join("\n")
  ).filter((item) => /allerg|rash|reaction|anaphyl|intoleran/i.test(item));

  const conditionsFromText = splitListText(
    [
      patient?.notes,
      encounter?.apciDraft?.soap?.assessment,
      encounter?.apciDraft?.soap?.subjective,
      ...(interview?.extractedFindings || [])
    ]
      .filter(Boolean)
      .join("\n")
  ).filter((item) => /hypertension|diabetes|asthma|copd|thyroid|renal|kidney|cardiac|heart|stroke|epilep|pregnan/i.test(item));

  return {
    knownMedications: dedupeList([...medsFromDraft, ...medsFromPrescriptions, ...medsFromText]).slice(0, 5),
    knownAllergies: dedupeList(allergiesFromText).slice(0, 4),
    knownConditions: dedupeList(conditionsFromText).slice(0, 5)
  };
}

const PRECHECK_CONTEXT_PLACEHOLDER_PATTERNS = [
  /\bpending symptom interview\b/i,
  /\bawaiting symptom interview\b/i,
  /\bchatbot symptom intake\b/i,
  /\bgeneral consultation\b/i,
  /\bclinical review\b/i,
  /^\s*(booked|visit|appointment)\s*$/i
];

function sanitizePrecheckContextValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return PRECHECK_CONTEXT_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
    ? ""
    : normalized;
}

function sanitizePrecheckContextList(values) {
  return dedupeList(
    (Array.isArray(values) ? values : [])
      .map((value) => sanitizePrecheckContextValue(value))
      .filter(Boolean)
  );
}

function buildDiseaseSpecificPrecheckMetadata(questions = [], existingMetadata = {}, overrides = {}) {
  return {
    ...(existingMetadata || {}),
    generationMode: DISEASE_SPECIFIC_PRECHECK_MODE,
    generationVersion: DISEASE_SPECIFIC_PRECHECK_VERSION,
    questionCount: Array.isArray(questions) ? questions.length : 0,
    targetQuestionCount: Number.isFinite(Number(overrides?.targetQuestionCount ?? existingMetadata?.targetQuestionCount))
      ? Math.min(
          DISEASE_SPECIFIC_PRECHECK_MAX_QUESTIONS,
          Math.max(
            DISEASE_SPECIFIC_PRECHECK_MIN_QUESTIONS,
            Math.round(Number(overrides?.targetQuestionCount ?? existingMetadata?.targetQuestionCount))
          )
        )
      : DISEASE_SPECIFIC_PRECHECK_DEFAULT_TARGET,
    adaptiveComplete: Boolean(overrides?.adaptiveComplete ?? existingMetadata?.adaptiveComplete),
    chiefComplaint: String(overrides?.chiefComplaint ?? existingMetadata?.chiefComplaint ?? "").trim(),
    diseaseSpecific: true,
    adaptive: true
  };
}

function shouldRefreshDiseaseSpecificPrecheck(questionnaire) {
  if (!questionnaire) {
    return true;
  }

  if (Array.isArray(questionnaire?.editedQuestions) && questionnaire.editedQuestions.length > 0) {
    return false;
  }

  const questions = Array.isArray(questionnaire?.aiQuestions) ? questionnaire.aiQuestions : [];
  const metadata = questionnaire?.metadata || {};

  if (!questions.length && !metadata.adaptive) {
    return true;
  }

  if (shouldRefreshMissingComplaintPrecheck(questionnaire)) {
    return true;
  }

  return !(
    metadata.generationMode === DISEASE_SPECIFIC_PRECHECK_MODE
    && metadata.generationVersion === DISEASE_SPECIFIC_PRECHECK_VERSION
  );
}

function shouldRefreshMissingComplaintPrecheck(questionnaire) {
  const firstQuestion = String(questionnaire?.aiQuestions?.[0]?.question || "").trim();
  if (!firstQuestion) {
    return false;
  }

  if (countAnsweredPrecheckResponses(questionnaire) > 0) {
    return false;
  }

  const chiefComplaint = sanitizePrecheckContextValue(questionnaire?.metadata?.chiefComplaint || "");
  if (chiefComplaint) {
    return false;
  }

  return !PRECHECK_PRIMARY_CONCERN_PATTERNS.some((pattern) => pattern.test(firstQuestion));
}

function shouldUseAdaptivePrecheck(questionnaire) {
  return !Array.isArray(questionnaire?.editedQuestions) || questionnaire.editedQuestions.length === 0;
}

function countAnsweredPrecheckResponses(questionnaire) {
  const responses = questionnaire?.patientResponses || {};
  return Object.values(responses).filter((value) => String(value || "").trim()).length;
}

function getAdaptivePrecheckTargetQuestionCount(questionnaire) {
  return buildDiseaseSpecificPrecheckMetadata([], questionnaire?.metadata || {}).targetQuestionCount;
}

function getCurrentAdaptivePrecheckQuestion(questionnaire) {
  const questions = Array.isArray(questionnaire?.aiQuestions) ? questionnaire.aiQuestions : [];
  const answeredCount = countAnsweredPrecheckResponses(questionnaire);
  return questions[answeredCount] || null;
}

function buildAdaptivePrecheckContext(snapshot, appointment, patient, doctor, questionnaire) {
  const baseContext = buildAiPrecheckContextForAppointment(snapshot, appointment, patient, doctor);
  return {
    ...baseContext,
    chiefComplaint: baseContext.chiefComplaint || String(questionnaire?.metadata?.chiefComplaint || "").trim(),
  };
}

function inferProfileSignals(state, appointment, patient, doctor) {
  const specialty = String(doctor?.specialty || "general").toLowerCase();
  const encounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
  const interview = state.interviews.byId[`interview-${appointment.id}`] || null;
  const visitType = String(appointment?.visitType || "visit").toLowerCase();
  const patientNotes = String(patient?.notes || "").toLowerCase();
  const chiefComplaint = sanitizePrecheckContextValue(encounter?.apciDraft?.soap?.chiefComplaint || "");

  const profileBlob = [
    specialty,
    visitType,
    patientNotes,
    String(encounter?.apciDraft?.soap?.subjective || "").toLowerCase(),
    String(encounter?.apciDraft?.soap?.assessment || "").toLowerCase(),
    ...(interview?.extractedFindings || []).map((entry) => String(entry || "").toLowerCase())
  ].join(" ");

  const hasKeyword = (pattern) => pattern.test(profileBlob);
  const clinicalLists = extractClinicalLists(state, appointment, patient);

  return {
    specialty,
    chiefComplaint,
    knownConditions: clinicalLists.knownConditions,
    knownMedications: clinicalLists.knownMedications,
    knownAllergies: clinicalLists.knownAllergies,
    isFollowUp: hasKeyword(/follow[-\s]?up|review|revisit|chronic/),
    hasHypertension: hasKeyword(/hypertension|high\s*blood\s*pressure|\bbp\b/),
    hasDiabetes: hasKeyword(/diabetes|diabetic|blood\s*sugar|hba1c|glucose/),
    hasRespiratoryConcern: hasKeyword(/cough|breath|wheez|asthma|spo2|oxygen|chest\s*tight/),
    hasCardiacConcern: hasKeyword(/chest\s*pain|angina|palpit|cardiac|heart/),
    hasFeverConcern: hasKeyword(/fever|temperature|chills|viral|infection/),
    hasGastroConcern: hasKeyword(/gastr|acid|reflux|abdomen|abdominal|nausea|vomit|dyspeps/),
    hasSleepOrFatigue: hasKeyword(/fatigue|tired|sleep|insomnia|low\s*energy/),
    hasMedicationRisk: hasKeyword(/allerg|reaction|side\s*effect|intolerance/),
    isPediatric: Number(patient?.age || 0) > 0 && Number(patient?.age || 0) < 12,
    isSenior: Number(patient?.age || 0) >= 60,
    mayNeedPregnancyScreen:
      String(patient?.gender || "").toLowerCase().startsWith("f") && Number(patient?.age || 0) >= 12 && Number(patient?.age || 0) <= 50
  };
}

function normalizePrecheckQuestionsForStorage(questions, appointmentId) {
  const seen = new Set();

  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => ({
      id: question?.id || `precheck-${appointmentId}-${index + 1}`,
      question: String(question?.question || question?.text || "").trim(),
      type: String(question?.type || "text").toLowerCase(),
      options: Array.isArray(question?.options) ? question.options.filter(Boolean) : [],
      required: question?.required !== false,
      category: String(question?.category || "ai_precheck").trim() || "ai_precheck",
      rationale: String(question?.rationale || "").trim(),
      confidence: Number(question?.confidence || 0)
    }))
    .filter((question) => {
      const key = question.question.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function buildAiPrecheckContextForAppointment(state, appointment, patient, doctor) {
  const encounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
  const interview = state.interviews.byId[`interview-${appointment.id}`] || null;
  const signals = inferProfileSignals(state, appointment, patient, doctor);
  const latestSymptoms = sanitizePrecheckContextList([
    ...(encounter?.apciDraft?.soap?.chiefComplaint ? [encounter.apciDraft.soap.chiefComplaint] : []),
    ...(encounter?.apciDraft?.soap?.subjective ? splitListText(encounter.apciDraft.soap.subjective) : []),
    ...(encounter?.interviewSummary ? splitListText(encounter.interviewSummary) : []),
    ...(interview?.extractedFindings || []),
    ...(signals.chiefComplaint ? [signals.chiefComplaint] : [])
  ]).slice(0, 8);
  const transcriptContext = sanitizePrecheckContextList([
    ...(encounter?.apciDraft?.soap?.subjective ? splitListText(encounter.apciDraft.soap.subjective) : []),
    ...(encounter?.apciDraft?.soap?.assessment ? splitListText(encounter.apciDraft.soap.assessment) : []),
    ...(encounter?.interviewSummary ? splitListText(encounter.interviewSummary) : []),
    ...((interview?.transcript || []).map((entry) => String(entry?.text || "").trim()).filter(Boolean)),
    ...(patient?.notes ? splitListText(patient.notes) : [])
  ]).slice(0, 12);
  const patientNotes = sanitizePrecheckContextValue(patient?.notes || "");

  return {
    patientId: patient?.id || "",
    chiefComplaint: signals.chiefComplaint || "",
    patientName: patient?.fullName || "",
    patientAge: patient?.age,
    patientGender: patient?.gender || "",
    patientNotes,
    transcript: transcriptContext.join(". "),
    doctorSpecialty: doctor?.specialty || "",
    appointmentType: appointment?.visitType || "",
    existingConditions: signals.knownConditions || [],
    latestSymptoms,
    currentMedications: signals.knownMedications || [],
    knownAllergies: signals.knownAllergies || []
  };
}

function createPrecheckQuestionnaire(
  state,
  appointment,
  {
    status = "sent_to_patient",
    sendToPatient = true,
    forceRegenerate = false,
    aiQuestions = [],
    metadata = {}
  } = {}
) {
  if (!appointment) {
    return null;
  }

  const existing = listCollection(state.precheckQuestionnaires).find((item) => item.appointmentId === appointment.id) || null;
  if (existing && !forceRegenerate) {
    return existing;
  }

  const doctor = state.doctors.byId[appointment.doctorId];
  const questions = normalizePrecheckQuestionsForStorage(aiQuestions, appointment.id);

  if (existing && forceRegenerate) {
    const refreshed = {
      ...existing,
      status,
      aiQuestions: questions,
      editedQuestions: [],
      patientResponses: {},
      patientCompletedAt: null,
      doctorConfirmedAt: null,
      sentToPatientAt: null,
      precheckSummary: null,
      metadata: {
        ...(existing?.metadata || {}),
        ...(metadata || {})
      },
      updatedAt: new Date().toISOString()
    };
    upsertPrecheckQuestionnaireEntity(state, refreshed);
    return refreshed;
  }

  const questionnaire = {
    id: `precheck-${appointment.id}`,
    appointmentId: appointment.id,
    encounterId: `encounter-${appointment.id}`,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    clinicId: doctor?.clinic || "NIRA Pilot Clinic",
    status,
    aiQuestions: questions,
    editedQuestions: [],
    patientResponses: {},
    patientCompletedAt: null,
    doctorConfirmedAt: null,
    sentToPatientAt: sendToPatient ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    precheckSummary: null,
    metadata: { ...(metadata || {}) }
  };

  upsertPrecheckQuestionnaireEntity(state, questionnaire);
  state.encounters.byId[`encounter-${appointment.id}`] = {
    ...(state.encounters.byId[`encounter-${appointment.id}`] || {}),
    precheckQuestionnaireId: questionnaire.id,
    precheckStatus: questionnaire.status
  };
  return questionnaire;
}

function getPrecheckQuestionnaireByAppointment(snapshot, appointmentId) {
  return listCollection(snapshot.precheckQuestionnaires).find((item) => item.appointmentId === appointmentId) || null;
}

async function ensureAiPrecheckQuestionnaire(
  appointmentId,
  {
    forceRegenerate = false,
    status = "sent_to_patient",
    notifyPatient = false,
    notificationTitle = "Pre-check questions ready",
    notificationMessage = "Your AI pre-check is ready. Please answer before the appointment."
  } = {}
) {
  const snapshot = readRaw();
  const appointment = snapshot.appointments.byId[appointmentId];
  if (!appointment) {
    throw new Error("Appointment not found.");
  }

  const existing = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
  if (!forceRegenerate && existing && !shouldRefreshDiseaseSpecificPrecheck(existing)) {
    return snapshot;
  }

  const patient = snapshot.patients.byId[appointment.patientId] || {};
  const doctor = snapshot.doctors.byId[appointment.doctorId] || {};
  const adaptiveContext = buildAiPrecheckContextForAppointment(snapshot, appointment, patient, doctor);
  const generationMetadata = buildDiseaseSpecificPrecheckMetadata([], existing?.metadata, {
    targetQuestionCount: existing?.metadata?.targetQuestionCount,
    chiefComplaint: adaptiveContext.chiefComplaint,
    adaptiveComplete: false
  });

  const timestamp = new Date().toISOString();
  return updateState((state) => {
    const currentAppointment = state.appointments.byId[appointmentId];
    if (!currentAppointment) {
      throw new Error("Appointment not found.");
    }

    const currentQuestionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
    const questionnaire = createPrecheckQuestionnaire(state, currentAppointment, {
      status,
      sendToPatient: status === "sent_to_patient",
      forceRegenerate: Boolean(currentQuestionnaire),
      aiQuestions: [],
      metadata: generationMetadata
    });
    const updatedQuestionnaire = {
      ...questionnaire,
      status,
      aiQuestions: [],
      editedQuestions: [],
      patientResponses: {},
      patientCompletedAt: null,
      doctorConfirmedAt: questionnaire?.doctorConfirmedAt || null,
      sentToPatientAt: status === "sent_to_patient" ? (questionnaire?.sentToPatientAt || timestamp) : null,
      precheckSummary: null,
      metadata: buildDiseaseSpecificPrecheckMetadata([], questionnaire?.metadata, {
        targetQuestionCount: generationMetadata.targetQuestionCount,
        chiefComplaint: generationMetadata.chiefComplaint,
        adaptiveComplete: false
      }),
      updatedAt: timestamp
    };

    upsertPrecheckQuestionnaireEntity(state, updatedQuestionnaire);
    state.encounters.byId[`encounter-${appointmentId}`] = {
      ...(state.encounters.byId[`encounter-${appointmentId}`] || {}),
      precheckQuestionnaireId: updatedQuestionnaire.id,
      precheckStatus: updatedQuestionnaire.status
    };

    if (notifyPatient) {
      upsertNotificationEntity(
        state,
        createDemoNotification({
          userId: currentAppointment.patientId,
          type: "precheck_sent",
          title: notificationTitle,
          message: notificationMessage,
          encounterId: `encounter-${appointmentId}`,
          questionnaireId: updatedQuestionnaire.id
        })
      );
    }

    return state;
  });
}

function createDemoNotification({
  userId,
  type,
  title,
  message,
  encounterId,
  questionnaireId,
  prescriptionId = null,
  appointmentId = null,
  testOrderId = null
}) {
  return {
    id: uid("notification"),
    userId,
    type,
    title,
    message,
    encounterId,
    questionnaireId,
    prescriptionId,
    appointmentId,
    testOrderId,
    is_read: false,
    created_at: new Date().toISOString(),
    read_at: null
  };
}

function createStableNotification({
  id,
  userId,
  type,
  title,
  message,
  encounterId = null,
  questionnaireId = null,
  prescriptionId = null,
  appointmentId = null,
  testOrderId = null
}) {
  return {
    id,
    userId,
    type,
    title,
    message,
    encounterId,
    questionnaireId,
    prescriptionId,
    appointmentId,
    testOrderId,
    is_read: false,
    created_at: new Date().toISOString(),
    read_at: null
  };
}

function upsertNotificationWithHistory(state, notification) {
  const existing = state.notifications.byId[notification.id];
  if (!existing) {
    upsertNotificationEntity(state, notification);
    return true;
  }

  const nextNotification = {
    ...existing,
    ...notification,
    created_at: existing.created_at || notification.created_at,
    is_read: existing.is_read,
    read_at: existing.read_at
  };

  const changed =
    existing.type !== nextNotification.type ||
    existing.title !== nextNotification.title ||
    existing.message !== nextNotification.message ||
    existing.userId !== nextNotification.userId ||
    existing.encounterId !== nextNotification.encounterId ||
    existing.questionnaireId !== nextNotification.questionnaireId ||
    existing.prescriptionId !== nextNotification.prescriptionId ||
    existing.appointmentId !== nextNotification.appointmentId ||
    existing.testOrderId !== nextNotification.testOrderId;

  if (changed) {
    state.notifications.byId[notification.id] = nextNotification;
  }

  return changed;
}

function getAppointmentEndAtMs(appointment, defaultDurationMinutes = 15) {
  const endAtMs = new Date(appointment?.endAt || "").getTime();
  if (Number.isFinite(endAtMs)) {
    return endAtMs;
  }

  const startAtMs = new Date(appointment?.startAt || "").getTime();
  if (!Number.isFinite(startAtMs)) {
    return Number.NaN;
  }

  const durationMinutes = Number(appointment?.slotDurationMinutes || defaultDurationMinutes);
  const safeDurationMinutes = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 15;

  return startAtMs + safeDurationMinutes * 60 * 1000;
}

function isMissedAppointment(appointment, encounter, doctor, reference = new Date()) {
  if (!appointment || ["completed", "cancelled"].includes(appointment.bookingStatus)) {
    return false;
  }

  if (!["scheduled", "rescheduled"].includes(appointment.bookingStatus)) {
    return false;
  }

  if (encounter?.status === "approved") {
    return false;
  }

  const endAtMs = getAppointmentEndAtMs(appointment, doctor?.slotDurationMinutes);
  if (!Number.isFinite(endAtMs)) {
    return false;
  }

  return endAtMs < reference.getTime();
}

function syncDerivedNotifications(state, reference = new Date()) {
  let changed = false;
  const nowMs = reference.getTime();

  listCollection(state.appointments).forEach((appointment) => {
    const patient = state.patients.byId[appointment.patientId];
    const doctor = state.doctors.byId[appointment.doctorId];
    const encounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
    const startAtMs = new Date(appointment.startAt).getTime();
    const isActiveAppointment = !["completed", "cancelled"].includes(appointment.bookingStatus);
    const inReminderWindow =
      isActiveAppointment &&
      Number.isFinite(startAtMs) &&
      startAtMs >= nowMs &&
      startAtMs - nowMs <= APPOINTMENT_REMINDER_WINDOW_MS;

    if (inReminderWindow && patient?.userId) {
      changed =
        upsertNotificationWithHistory(
          state,
          createStableNotification({
            id: `notification-reminder-patient-${appointment.id}`,
            userId: patient.userId,
            type: "appointment_reminder",
            title: "Appointment coming up soon",
            message: `Your visit with ${doctor?.fullName || "your doctor"} starts at ${formatTime(appointment.startAt)} on ${formatDate(appointment.startAt)}.`,
            encounterId: `encounter-${appointment.id}`,
            appointmentId: appointment.id
          })
        ) || changed;
    }

    if (inReminderWindow && doctor?.userId) {
      changed =
        upsertNotificationWithHistory(
          state,
          createStableNotification({
            id: `notification-reminder-doctor-${appointment.id}`,
            userId: doctor.userId,
            type: "appointment_reminder",
            title: "Upcoming slot in under 2 hours",
            message: `${patient?.fullName || "Patient"} is booked for ${formatTime(appointment.startAt)} on ${formatDate(appointment.startAt)}.`,
            encounterId: `encounter-${appointment.id}`,
            appointmentId: appointment.id
          })
        ) || changed;
    }

    if (isMissedAppointment(appointment, encounter, doctor, reference) && patient?.userId) {
      changed =
        upsertNotificationWithHistory(
          state,
          createStableNotification({
            id: `notification-missed-${appointment.id}`,
            userId: patient.userId,
            type: "appointment_missed",
            title: "You missed this appointment",
            message: `The slot on ${formatDate(appointment.startAt)} at ${formatTime(appointment.startAt)} has passed. Open My Appointments to reschedule.`,
            encounterId: `encounter-${appointment.id}`,
            appointmentId: appointment.id
          })
        ) || changed;
    }
  });

  listCollection(state.labReports).forEach((report) => {
    if (report.status !== "final") {
      return;
    }

    const patient = state.patients.byId[report.patientId];
    if (!patient?.userId) {
      return;
    }

    changed =
      upsertNotificationWithHistory(
        state,
        createStableNotification({
          id: `notification-report-ready-${report.id}`,
          userId: patient.userId,
          type: "lab_report_ready",
          title: "Report ready",
          message: `${report.title || "Your lab report"} is ready to view in Lab Reports.`,
          encounterId: `encounter-${report.appointmentId}`,
          appointmentId: report.appointmentId
        })
      ) || changed;
  });

  return changed;
}

function upsertEmrSyncEntity(state, record) {
  upsertEntity(state.emrSync, record);
}

function getEmrSyncRecord(snapshot, appointmentId) {
  return snapshot?.emrSync?.byId?.[`emr-${appointmentId}`] || null;
}

function upsertDbSyncEntity(state, record) {
  upsertEntity(state.dbSync, record);
}

function getDbSyncRecord(snapshot, appointmentId) {
  return snapshot?.dbSync?.byId?.[`db-${appointmentId}`] || null;
}

function resolveLatestEmrPatientId(snapshot, localPatientId) {
  if (!snapshot?.emrSync || !localPatientId) {
    return null;
  }

  const records = listCollection(snapshot.emrSync)
    .filter((record) => record?.localPatientId === localPatientId && record?.patientId)
    .sort((left, right) => {
      const leftTs = left.approvalSyncedAt || left.interviewSyncedAt || left.bookingSyncedAt || "";
      const rightTs = right.approvalSyncedAt || right.interviewSyncedAt || right.bookingSyncedAt || "";
      return new Date(rightTs).getTime() - new Date(leftTs).getTime();
    });

  return records[0]?.patientId || null;
}

function buildDbMedicationPayload(draft) {
  return (draft?.medicationSuggestions || [])
    .filter((item) => item?.name)
    .map((item) => ({
      name: item.name,
      dosage: item.dosage || null,
      frequency: item.frequency || null,
      duration: item.duration || null,
      instructions: item.rationale || null
    }));
}

function buildDbDiagnosisPayload(draft) {
  const diagnosisLabels = (draft?.diagnoses || []).map((item) => item?.label).filter(Boolean);
  if (diagnosisLabels.length > 0) {
    return diagnosisLabels.join(", ");
  }
  return draft?.soap?.assessment || "Clinical review";
}

function extractTokenNumber(token) {
  const match = String(token || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function buildLocalPrecheckContextKey(state, appointmentId) {
  const baseContextKey = `${state?.session?.role || "patient"}:${state?.session?.userId || state?.session?.activeProfileId || "anonymous"}`;
  return appointmentId ? `${baseContextKey}:precheck:${appointmentId}` : baseContextKey;
}

function buildPrecheckSessionMetadata(state, appointment, metadata = {}) {
  const appointmentId = appointment?.id || metadata?.appointmentId || null;
  return {
    source: "patient_precheck",
    workflow: "patient_precheck",
    sessionType: "precheck_chat",
    chatContextKey: metadata?.chatContextKey || buildLocalPrecheckContextKey(state, appointmentId),
    submittedFrom: metadata?.submittedFrom || "patient_chatbot",
    ...metadata
  };
}

function normalizePrecheckSubmissionPayload(payload) {
  if (
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && ("patientResponses" in payload || "metadata" in payload)
  ) {
    return {
      patientResponses:
        payload.patientResponses && typeof payload.patientResponses === "object" && !Array.isArray(payload.patientResponses)
          ? payload.patientResponses
          : {},
      metadata:
        payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
          ? payload.metadata
          : {}
    };
  }

  return {
    patientResponses:
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : {},
    metadata: {}
  };
}

function normalizeRawPrecheckResponsesMap(rawResponses) {
  if (!rawResponses || typeof rawResponses !== "object" || Array.isArray(rawResponses)) {
    return {};
  }

  return Object.entries(rawResponses).reduce((acc, [questionId, responseText]) => {
    const normalizedQuestionId = String(questionId || "").trim();
    const normalizedResponseText = String(responseText || "").trim();
    if (!normalizedQuestionId || !normalizedResponseText) {
      return acc;
    }
    acc[normalizedQuestionId] = normalizedResponseText;
    return acc;
  }, {});
}

function buildDbEncounterSyncPayload(snapshot, appointmentId, overrides = {}) {
  const appointment = snapshot?.appointments?.byId?.[appointmentId] || null;
  const encounter = snapshot?.encounters?.byId?.[`encounter-${appointmentId}`] || null;
  const patient = appointment ? snapshot?.patients?.byId?.[appointment.patientId] || null : null;
  const doctor = appointment ? snapshot?.doctors?.byId?.[appointment.doctorId] || null : null;
  const dbSync = getDbSyncRecord(snapshot, appointmentId);
  const draft = overrides.draft ?? encounter?.apciDraft ?? null;

  return {
    encounterId: overrides.encounterId ?? dbSync?.encounterId ?? null,
    appointmentId,
    patientId: patient?.id || appointment?.patientId || null,
    doctorId: doctor?.id || appointment?.doctorId || null,
    clinicId: doctor?.clinic || "NIRA Pilot Clinic",
    scheduledTime: overrides.scheduledTime ?? appointment?.startAt ?? null,
    checkInTime: overrides.checkInTime ?? null,
    completedTime: overrides.completedTime ?? encounter?.approvedAt ?? null,
    type: overrides.type ?? appointment?.visitType ?? "opd",
    status: overrides.status ?? encounter?.status ?? "planned",
    localStatus: overrides.localStatus ?? encounter?.status ?? "planned",
    bookingStatus: overrides.bookingStatus ?? appointment?.bookingStatus ?? null,
    chiefComplaint: overrides.chiefComplaint ?? draft?.soap?.chiefComplaint ?? appointment?.visitType ?? "Clinical review",
    aiPrechart: overrides.aiPrechart ?? draft ?? null,
    doctorNotes: overrides.doctorNotes ?? {
      note: encounter?.doctorReview?.note || "",
      reviewedAt: encounter?.doctorReview?.reviewedAt || null,
      approved: Boolean(encounter?.doctorReview?.approved),
      finalClinicalNote: encounter?.finalClinicalNote || ""
    },
    vitals: overrides.vitals ?? draft?.vitals ?? null,
    tokenNumber: overrides.tokenNumber ?? extractTokenNumber(appointment?.token),
    priority: overrides.priority ?? null,
    metadata: {
      appointmentToken: appointment?.token || null,
      visitType: appointment?.visitType || null,
      ...(encounter?.metadata || {}),
      ...overrides.metadata
    }
  };
}

function buildDbInterviewSyncPayload(snapshot, appointmentId, overrides = {}) {
  const interview = overrides.interview || snapshot?.interviews?.byId?.[`interview-${appointmentId}`] || null;
  const encounter = snapshot?.encounters?.byId?.[`encounter-${appointmentId}`] || null;
  const appointment = snapshot?.appointments?.byId?.[appointmentId] || null;
  const patient = appointment ? snapshot?.patients?.byId?.[appointment.patientId] || null : null;
  const dbSync = getDbSyncRecord(snapshot, appointmentId);

  return {
    interviewId: overrides.interviewId ?? dbSync?.interviewId ?? interview?.id ?? null,
    appointmentId,
    encounterId: overrides.encounterId ?? dbSync?.encounterId ?? null,
    patientId: overrides.patientId ?? patient?.id ?? appointment?.patientId ?? null,
    language: overrides.language ?? interview?.language ?? "en",
    status: overrides.status ?? interview?.completionStatus ?? "in-progress",
    transcript: overrides.transcript ?? interview?.transcript ?? [],
    aiSummary: overrides.aiSummary ?? {
      chiefComplaint: encounter?.apciDraft?.soap?.chiefComplaint || "",
      assessment: encounter?.apciDraft?.soap?.assessment || "",
      extractedFindings: interview?.extractedFindings || []
    },
    completedAt: overrides.completedAt ?? (String(interview?.completionStatus || "").toLowerCase() === "complete" ? new Date().toISOString() : null),
    metadata: {
      localInterviewId: interview?.id || null,
      ...(interview?.metadata || {}),
      ...overrides.metadata
    }
  };
}

function buildDbPrecheckSyncPayload(snapshot, appointmentId, questionnaire, overrides = {}) {
  const appointment = snapshot?.appointments?.byId?.[appointmentId] || null;
  const doctor = appointment ? snapshot?.doctors?.byId?.[appointment.doctorId] || null : null;
  const dbSync = getDbSyncRecord(snapshot, appointmentId);

  return {
    questionnaireId: overrides.questionnaireId ?? dbSync?.precheckQuestionnaireId ?? questionnaire?.id ?? null,
    appointmentId,
    encounterId: overrides.encounterId ?? dbSync?.encounterId ?? null,
    patientId: overrides.patientId ?? appointment?.patientId ?? questionnaire?.patientId ?? null,
    doctorId: overrides.doctorId ?? appointment?.doctorId ?? questionnaire?.doctorId ?? null,
    clinicId: overrides.clinicId ?? doctor?.clinic ?? questionnaire?.clinicId ?? "NIRA Pilot Clinic",
    aiQuestions: overrides.aiQuestions ?? questionnaire?.aiQuestions ?? [],
    editedQuestions: overrides.editedQuestions ?? questionnaire?.editedQuestions ?? [],
    patientResponses: overrides.patientResponses ?? questionnaire?.patientResponses ?? {},
    status: overrides.status ?? questionnaire?.status ?? "ai_generated",
    doctorConfirmedAt: overrides.doctorConfirmedAt ?? questionnaire?.doctorConfirmedAt ?? null,
    sentToPatientAt: overrides.sentToPatientAt ?? questionnaire?.sentToPatientAt ?? null,
    patientCompletedAt: overrides.patientCompletedAt ?? questionnaire?.patientCompletedAt ?? null,
    metadata: {
      localQuestionnaireId: questionnaire?.id || null,
      ...(questionnaire?.metadata || {}),
      ...overrides.metadata
    }
  };
}

function buildDbLabReportSyncPayload(snapshot, appointmentId, report, overrides = {}) {
  const appointment = snapshot?.appointments?.byId?.[appointmentId] || null;
  const doctor = appointment ? snapshot?.doctors?.byId?.[appointment.doctorId] || null : null;
  const dbSync = getDbSyncRecord(snapshot, appointmentId);

  return {
    reportId: overrides.reportId ?? report?.id ?? `lab-${appointmentId}`,
    appointmentId,
    encounterId: overrides.encounterId ?? dbSync?.encounterId ?? null,
    patientId: overrides.patientId ?? appointment?.patientId ?? report?.patientId ?? null,
    doctorId: overrides.doctorId ?? appointment?.doctorId ?? report?.doctorId ?? null,
    clinicId: overrides.clinicId ?? doctor?.clinic ?? "NIRA Pilot Clinic",
    title: overrides.title ?? report?.title ?? "Clinical lab summary",
    category: overrides.category ?? report?.category ?? "General panel",
    findings: overrides.findings ?? report?.findings ?? "",
    resultSummary: overrides.resultSummary ?? report?.resultSummary ?? "",
    status: overrides.status ?? report?.status ?? "draft",
    metadata: {
      localReportId: report?.id || null,
      ...overrides.metadata
    }
  };
}

function buildDbTestOrderSyncPayload(snapshot, appointmentId, order, overrides = {}) {
  const appointment = snapshot?.appointments?.byId?.[appointmentId] || null;
  const doctor = appointment ? snapshot?.doctors?.byId?.[appointment.doctorId] || null : null;
  const dbSync = getDbSyncRecord(snapshot, appointmentId);

  return {
    orderId: overrides.orderId ?? order?.id ?? `tests-${appointmentId}`,
    appointmentId,
    encounterId: overrides.encounterId ?? dbSync?.encounterId ?? null,
    patientId: overrides.patientId ?? appointment?.patientId ?? order?.patientId ?? null,
    doctorId: overrides.doctorId ?? appointment?.doctorId ?? order?.doctorId ?? null,
    clinicId: overrides.clinicId ?? doctor?.clinic ?? "NIRA Pilot Clinic",
    doctorName: overrides.doctorName ?? order?.doctorName ?? doctor?.fullName ?? "Your doctor",
    tests: overrides.tests ?? order?.tests ?? [],
    patientNote: overrides.patientNote ?? order?.patientNote ?? null,
    status: overrides.status ?? order?.status ?? "ordered",
    orderedAt: overrides.orderedAt ?? order?.orderedAt ?? new Date().toISOString(),
    metadata: {
      localOrderId: order?.id || null,
      ...overrides.metadata
    }
  };
}

function resolveNotificationAppointmentId(notification) {
  if (notification?.appointmentId) {
    return notification.appointmentId;
  }
  const encounterId = String(notification?.encounterId || "");
  return encounterId.startsWith("encounter-") ? encounterId.slice("encounter-".length) : null;
}

function buildDbNotificationSyncPayload(snapshot, notification, overrides = {}) {
  const appointmentId = overrides.appointmentId ?? resolveNotificationAppointmentId(notification);
  const dbSync = appointmentId ? getDbSyncRecord(snapshot, appointmentId) : null;

  return {
    notificationId: overrides.notificationId ?? notification?.id ?? null,
    userId: overrides.userId ?? notification?.userId ?? null,
    type: overrides.type ?? notification?.type ?? "emr_updated",
    title: overrides.title ?? notification?.title ?? "NIRA update",
    message: overrides.message ?? notification?.message ?? "",
    encounterId: overrides.encounterId ?? dbSync?.encounterId ?? null,
    questionnaireId: overrides.questionnaireId ?? dbSync?.precheckQuestionnaireId ?? null,
    prescriptionId: overrides.prescriptionId ?? dbSync?.prescriptionId ?? null,
    appointmentId,
    metadata: {
      localEncounterId: notification?.encounterId || null,
      localQuestionnaireId: notification?.questionnaireId || null,
      localPrescriptionId: notification?.prescriptionId || null,
      localTestOrderId: notification?.testOrderId || null,
      ...overrides.metadata
    }
  };
}

function createOrUpdateLabReport(state, appointmentId, payload = {}, nextStatus = "draft") {
  const appointment = state.appointments.byId[appointmentId];
  if (!appointment) {
    return null;
  }

  const encounter = state.encounters.byId[`encounter-${appointmentId}`];
  const existing = listCollection(state.labReports)
    .filter((item) => item.appointmentId === appointmentId)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;

  const report = {
    id: existing?.id || `lab-${appointmentId}`,
    appointmentId,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    title: payload.title || existing?.title || "Clinical lab summary",
    category: payload.category || existing?.category || "General panel",
    findings:
      payload.findings ||
      existing?.findings ||
      encounter?.apciDraft?.soap?.objective ||
      "Awaiting detailed lab observations.",
    resultSummary:
      payload.resultSummary ||
      existing?.resultSummary ||
      encounter?.apciDraft?.soap?.assessment ||
      "Clinical review pending.",
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };

  upsertLabReportEntity(state, report);
  return report;
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

function buildInterviewFromChatMessages(appointmentId, messages = [], language = "en") {
  const transcript = (Array.isArray(messages) ? messages : [])
    .filter((message) => String(message?.content || "").trim())
    .map((message) => ({
      role: message?.role === "assistant" ? "ai" : "patient",
      text: String(message.content || "").trim()
    }));

  const extractedFindings = transcript
    .filter((entry) => entry.role === "patient")
    .map((entry) => entry.text)
    .filter(Boolean)
    .slice(0, 6);

  return {
    id: `interview-${appointmentId}`,
    appointmentId,
    language,
    transcript,
    extractedFindings,
    completionStatus: transcript.length > 0 ? "complete" : "pending"
  };
}

function buildChatbotMetadata(chat = {}) {
  const clinicalSnapshot = String(chat?.summary || "").trim();
  const detectedFocus = String(chat?.detectedFocus || "").trim();
  const triageLevel = String(chat?.triageLevel || "").trim();
  const escalationBand = String(chat?.escalationBand || "").trim();
  const redFlags = Array.isArray(chat?.redFlags)
    ? chat.redFlags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const suggestedVitals = Array.isArray(chat?.suggestedVitals)
    ? chat.suggestedVitals.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!clinicalSnapshot && !detectedFocus && !triageLevel && !escalationBand && !redFlags.length && !suggestedVitals.length) {
    return null;
  }

  return {
    clinicalSnapshot,
    detectedFocus,
    triageLevel,
    escalationBand,
    redFlags,
    suggestedVitals
  };
}

function getQuestionnaireQuestions(questionnaire) {
  return questionnaire?.editedQuestions?.length ? questionnaire.editedQuestions : questionnaire?.aiQuestions || [];
}

function buildAnsweredPrecheckEntries(questionnaire) {
  const responses = questionnaire?.patientResponses || {};
  const rawResponses = normalizeRawPrecheckResponsesMap(questionnaire?.metadata?.rawPatientResponses);
  return getQuestionnaireQuestions(questionnaire)
    .map((question) => {
      const answer = String(responses?.[question.id] || "").trim();
      if (!answer) return null;
      const rawAnswer = String(rawResponses?.[question.id] || answer).trim() || answer;
      return {
        id: question.id,
        question: String(question.question || "").trim(),
        answer,
        rawAnswer,
        type: String(question.type || "text").toLowerCase(),
        category: String(question.category || "").toLowerCase()
      };
    })
    .filter(Boolean);
}

function buildAdaptivePrecheckTurnInput(snapshot, appointment, patient, doctor, questionnaire) {
  return {
    encounterId: `encounter-${appointment.id}`,
    appointmentContext: buildAdaptivePrecheckContext(snapshot, appointment, patient, doctor, questionnaire),
    sessionState: {
      askedQuestions: questionnaire?.aiQuestions || [],
      answeredEntries: buildAnsweredPrecheckEntries(questionnaire),
      targetQuestionCount: getAdaptivePrecheckTargetQuestionCount(questionnaire)
    }
  };
}

function appendAdaptivePrecheckQuestion(questionnaire, appointmentId, nextQuestion) {
  return normalizePrecheckQuestionsForStorage(
    [...(Array.isArray(questionnaire?.aiQuestions) ? questionnaire.aiQuestions : []), nextQuestion],
    appointmentId
  );
}

function buildInterviewFromPrecheckQuestionnaire(appointmentId, questionnaire, language = "en") {
  const answeredEntries = buildAnsweredPrecheckEntries(questionnaire);
  const transcript = answeredEntries.flatMap((entry) => ([
    { role: "ai", text: entry.question },
    { role: "patient", text: entry.rawAnswer || entry.answer }
  ]));
  const extractedFindings = dedupeList(
    answeredEntries.map((entry) => `${entry.question}: ${entry.rawAnswer || entry.answer}`)
  ).slice(0, 8);

  return {
    id: `interview-${appointmentId}`,
    appointmentId,
    language,
    transcript,
    extractedFindings,
    completionStatus: transcript.length > 0 ? "complete" : "pending",
    metadata: {
      ...(questionnaire?.metadata || {})
    }
  };
}

function deriveAnswersFromPrecheckQuestionnaire(questionnaire) {
  const answeredEntries = buildAnsweredPrecheckEntries(questionnaire);
  const associatedDetails = [];
  let primaryConcern = "";
  let duration = "";
  let severity = "";
  let medications = "";
  let allergies = "";

  answeredEntries.forEach((entry) => {
    const question = toLowerText(entry.question);
    const category = entry.category;

    if (
      !primaryConcern &&
      (
        category.includes("symptom")
        || category.includes("reason")
        || /what.*(problem|concern|complaint|brings you)|main concern|main symptom|chief complaint/.test(question)
      )
    ) {
      primaryConcern = entry.answer;
      return;
    }

    if (
      !duration &&
      (
        category.includes("timeline")
        || /how long|when did.*start|duration|since when/.test(question)
      )
    ) {
      duration = entry.answer;
      return;
    }

    if (
      !severity &&
      (
        category.includes("severity")
        || entry.type === "rating"
        || /severity|scale of 1|1 to 10|pain score/.test(question)
      )
    ) {
      severity = entry.answer;
      return;
    }

    if (
      !medications &&
      (
        category.includes("medication")
        || /medicine|medication|supplement|home remed/.test(question)
      )
    ) {
      medications = entry.answer;
      return;
    }

    if (
      !allergies &&
      (
        category.includes("allerg")
        || /allerg/.test(question)
      )
    ) {
      allergies = entry.answer;
      return;
    }

    associatedDetails.push(`${entry.question}: ${entry.answer}`);
  });

  const fallbackAnswers = answeredEntries.map((entry) => entry.answer).filter(Boolean);

  return {
    primaryConcern: primaryConcern || String(questionnaire?.metadata?.chiefComplaint || "").trim() || fallbackAnswers[0] || "Pre-check responses captured",
    duration,
    severity: severity || "Not stated",
    associatedSymptoms: dedupeList(associatedDetails).join(" | ") || fallbackAnswers.slice(1, 4).join(" | ") || "Additional symptoms not stated",
    medications: medications || "None reported",
    allergies: allergies || "None reported",
    language: "en"
  };
}

function resolveChatDoctor(state, preferredDoctorLabel = "") {
  const normalizedPreference = String(preferredDoctorLabel || "").toLowerCase().trim();
  const activeDoctors = listCollection(state.doctors).filter((doctor) => doctor.status === "active" && doctor.acceptingAppointments);

  if (normalizedPreference) {
    const matched = activeDoctors.find((doctor) =>
      String(doctor.fullName || "").toLowerCase().includes(normalizedPreference)
      || String(doctor.specialty || "").toLowerCase().includes(normalizedPreference)
    );
    if (matched) {
      return matched;
    }
  }

  return activeDoctors[0] || null;
}

function findBestSlotForDoctor(state, doctorId) {
  const schedules = listCollection(state.daySchedules)
    .filter((schedule) => schedule.doctorId === doctorId && !schedule.isClosed)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  for (const schedule of schedules) {
    const slot = (schedule.slots || []).find((candidate) => candidate.status === "available");
    if (slot) {
      return {
        slot,
        date: schedule.date
      };
    }
  }

  return null;
}

function toCdssPrecheckAnswers(questionnaire) {
  const responses = questionnaire?.patientResponses || {};
  return Object.entries(responses)
    .filter(([_, answer]) => answer !== null && answer !== undefined && String(answer).trim() !== "")
    .map(([questionId, answer]) => ({ question_id: questionId, answer: String(answer) }));
}

function applyCdssOutputToDraft(existingDraft, cdssOutput) {
  if (!cdssOutput) return existingDraft;

  const soap = cdssOutput.soap || {};
  const diagnoses = (cdssOutput.diagnoses || []).map((item) => ({
    label: item.name || "",
    code: item.icd10_code || "",
    confidence: Number(item.confidence || 0)
  }));
  const medications = (cdssOutput.medications || []).map((item) => ({
    name: item.name || "",
    dosage: item.dose ? `${item.dose}${item.unit || ""}` : "",
    frequency: item.frequency_per_day ? `${item.frequency_per_day} times/day` : "",
    duration: item.duration_days ? `${item.duration_days} days` : "",
    rationale: "AI suggestive draft — doctor validation required"
  }));

  return {
    ...existingDraft,
    soap: {
      ...(existingDraft?.soap || {}),
      chiefComplaint: soap.subjective || existingDraft?.soap?.chiefComplaint || "",
      subjective: soap.subjective || existingDraft?.soap?.subjective || "",
      objective: soap.objective || existingDraft?.soap?.objective || "",
      assessment: soap.assessment || existingDraft?.soap?.assessment || "",
      plan: soap.plan || existingDraft?.soap?.plan || ""
    },
    diagnoses: diagnoses.length ? diagnoses : existingDraft?.diagnoses || [],
    medicationSuggestions: medications.length ? medications : existingDraft?.medicationSuggestions || [],
    alerts: (cdssOutput.alerts || []).map((item) => item.message).filter(Boolean),
    confidenceMap: {
      ...(existingDraft?.confidenceMap || {}),
      ...(cdssOutput.confidence_scores || {})
    },
    differentials: (cdssOutput.differential_diagnoses || []).map((item) => item.name).filter(Boolean)
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
    await hydrateStateFromSnapshot();
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
    const snapshot = updateState((state) => {
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

    let syncStatus = { synced: false, skipped: true, reason: "not_attempted" };
    try {
      syncStatus = await syncSignupToDatabase({
        role: "patient",
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        gender: form.gender,
        city: form.city,
        age: form.age,
        abhaNumber: form.abhaNumber,
        emergencyContactName: form.emergencyContactName,
        emergencyContactPhone: form.emergencyContactPhone,
        preferredLanguage: form.preferredLanguage
      });
    } catch (error) {
      console.warn("[NIRA] Patient signup saved locally; DB sync skipped.", error);
      syncStatus = {
        synced: false,
        skipped: false,
        reason: "db_sync_failed",
        error: String(error?.message || error)
      };
    }

    return { snapshot, syncStatus };
  },

  async signupDoctor(form) {
    await wait(160);
    const snapshot = updateState((state) => {
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

    let syncStatus = { synced: false, skipped: true, reason: "not_attempted" };
    try {
      syncStatus = await syncSignupToDatabase({
        role: "doctor",
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        specialty: form.specialty,
        licenseNumber: form.licenseNumber,
        gender: form.gender
      });
    } catch (error) {
      console.warn("[NIRA] Doctor signup saved locally; DB sync skipped.", error);
      syncStatus = {
        synced: false,
        skipped: false,
        reason: "db_sync_failed",
        error: String(error?.message || error)
      };
    }

    return { snapshot, syncStatus };
  },

  async signupAdmin(form) {
    await wait(160);
    const snapshot = updateState((state) => {
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

    let syncStatus = { synced: false, skipped: true, reason: "not_attempted" };
    try {
      syncStatus = await syncSignupToDatabase({
        role: "admin",
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone
      });
    } catch (error) {
      console.warn("[NIRA] Admin signup saved locally; DB sync skipped.", error);
      syncStatus = {
        synced: false,
        skipped: false,
        reason: "db_sync_failed",
        error: String(error?.message || error)
      };
    }

    return { snapshot, syncStatus };
  },

  async updateCurrentProfile(payload) {
    await wait();
    const previousSnapshot = clone(readRaw());
    const previousUser = getUserById(previousSnapshot, previousSnapshot.session.userId);
    const previousCollectionKey = previousUser ? getRoleCollectionKey(previousUser.role) : null;
    const previousProfile =
      previousCollectionKey && previousUser
        ? previousSnapshot[previousCollectionKey]?.byId?.[previousUser.profileId] || null
        : null;

    let snapshot = updateState((state) => {
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

    if (!previousUser || previousUser.role !== "patient") {
      return snapshot;
    }

    const nextPatientProfile = snapshot.patients?.byId?.[previousUser.profileId];
    const previousAbha = (previousProfile?.abhaNumber || "").trim();
    const nextAbha = (nextPatientProfile?.abhaNumber || "").trim();
    const abhaChanged = previousAbha !== nextAbha;

    if (!abhaChanged || !nextPatientProfile) {
      return snapshot;
    }

    const emrPatientId = resolveLatestEmrPatientId(snapshot, nextPatientProfile.id);
    if (!emrPatientId) {
      snapshot = updateState((state) => {
        const patient = state.patients.byId[nextPatientProfile.id];
        if (patient) {
          state.patients.byId[nextPatientProfile.id] = {
            ...patient,
            abhaSyncStatus: "pending",
            abhaSyncError: "No mapped EMR patient found yet. Book or sync an appointment first.",
          };
        }
        return state;
      });
      return snapshot;
    }

    try {
      await syncPatientAbhaToGunaEmr({
        patientId: emrPatientId,
        abhaNumber: nextAbha || null,
        localPatientId: nextPatientProfile.id,
        linkedBy: previousUser.id,
      });

      snapshot = updateState((state) => {
        const patient = state.patients.byId[nextPatientProfile.id];
        if (patient) {
          state.patients.byId[nextPatientProfile.id] = {
            ...patient,
            abhaSyncStatus: "synced",
            abhaSyncedAt: new Date().toISOString(),
            abhaSyncError: null,
          };
        }
        return state;
      });
    } catch (error) {
      snapshot = updateState((state) => {
        const patient = state.patients.byId[nextPatientProfile.id];
        if (patient) {
          state.patients.byId[nextPatientProfile.id] = {
            ...patient,
            abhaSyncStatus: "failed",
            abhaSyncError: String(error?.message || error),
          };
        }
        return state;
      });
    }

    return snapshot;
  },

  async addPatient(form) {
    await wait(140);
    return updateState((state) => {
      const duplicate = findDuplicateRoleUser(state, "patient", form);

      if (duplicate) {
        throw new Error("A patient account already exists with that phone or email.");
      }

      const profileId = uid("patient");
      const user = createUserAccount("patient", profileId, form, "active");
      const profile = createPatientProfile(user, form);

      upsertEntity(state.users, user);
      upsertEntity(state.patients, profile);
      return state;
    });
  },

  async addDoctor(form) {
    await wait(140);
    return updateState((state) => {
      const duplicate = findDuplicateRoleUser(state, "doctor", form);

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

  async addAdmin(form) {
    await wait(140);
    return updateState((state) => {
      const duplicate = findDuplicateRoleUser(state, "admin", form);

      if (duplicate) {
        throw new Error("An admin account already exists with that phone or email.");
      }

      const profileId = uid("admin");
      const user = createUserAccount("admin", profileId, form, "active");
      const profile = createAdminProfile(user, form);

      upsertEntity(state.users, user);
      upsertEntity(state.admins, profile);
      return state;
    });
  },

  async updatePatient(patientId, payload) {
    await wait();
    return updateState((state) => {
      const patient = state.patients.byId[patientId];
      if (!patient) {
        throw new Error("Patient not found.");
      }

      const user = state.users.byId[patient.userId];
      const duplicate = findDuplicateRoleUser(state, "patient", payload, user.id);

      if (duplicate) {
        throw new Error("Another patient already uses that phone or email.");
      }

      const nextPatient = {
        ...patient,
        ...payload,
        age:
          payload.age === ""
            ? null
            : payload.age !== undefined
              ? Number(payload.age)
              : patient.age
      };

      state.patients.byId[patientId] = nextPatient;
      state.users.byId[user.id] = {
        ...user,
        phone: payload.phone !== undefined ? payload.phone : user.phone,
        email: payload.email !== undefined ? payload.email : user.email
      };
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
      const duplicate = findDuplicateRoleUser(state, "doctor", payload, user.id);

      if (duplicate) {
        throw new Error("Another doctor already uses that phone or email.");
      }

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

  async deletePatient(patientId) {
    await wait(120);
    return updateState((state) => {
      removePatientCascade(state, patientId);
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
    let snapshot = updateState((state) => {
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

    const appointment = snapshot.appointments.byId[snapshot.ui.lastViewedAppointmentId];
    const patient = snapshot.patients.byId[appointment.patientId];
    const doctor = snapshot.doctors.byId[appointment.doctorId];

    try {
      snapshot = await ensureAiPrecheckQuestionnaire(appointment.id, {
        status: "sent_to_patient",
        notifyPatient: true,
        notificationTitle: "Pre-check questions ready",
        notificationMessage: "Your AI pre-check is ready. Please answer before the appointment."
      });
    } catch (error) {
      console.warn("[NIRA] AI precheck unavailable during booking; questionnaire not created yet.", error);
    }

    try {
      const emrResponse = await syncBookingToGunaEmr({ appointment, patient, doctor });

      snapshot = updateState((state) => {
        upsertEmrSyncEntity(state, {
          id: `emr-${appointment.id}`,
          appointmentId: appointment.id,
          localPatientId: patient.id,
          localDoctorId: doctor.id,
          patientId: emrResponse?.patientId || null,
          encounterId: emrResponse?.encounterId || null,
          queueToken: emrResponse?.queueToken ?? null,
          bookingSyncedAt: new Date().toISOString(),
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Booking synced locally; EMR sync skipped.", error);

      snapshot = updateState((state) => {
        upsertEmrSyncEntity(state, {
          id: `emr-${appointment.id}`,
          appointmentId: appointment.id,
          localPatientId: patient.id,
          localDoctorId: doctor.id,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    try {
      const dbEncounter = await createEncounter({
        patientId: patient.id,
        doctorId: doctor.id,
        clinicId: doctor.clinic || "NIRA Pilot Clinic",
        appointmentId: appointment.id,
        scheduledTime: appointment.startAt,
        type: appointment.visitType || "opd",
        chiefComplaint: "Pending symptom interview",
        tokenNumber: extractTokenNumber(appointment.token),
        status: "planned",
        metadata: {
          bookingStatus: appointment.bookingStatus,
          token: appointment.token
        }
      });

      const dbInterview = await createInterview({
        interviewId: `interview-${appointment.id}`,
        appointmentId: appointment.id,
        encounterId: dbEncounter.id,
        patientId: patient.id,
        language: payload.language || "en",
        transcript: [],
        status: "in-progress",
        metadata: {
          source: "booking"
        }
      });

      const questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointment.id);
      const dbQuestionnaire = questionnaire
        ? await upsertDbPrecheckQuestionnaire(
          buildDbPrecheckSyncPayload(snapshot, appointment.id, questionnaire, {
            encounterId: dbEncounter.id,
            metadata: {
              source: "booking"
            }
          })
        )
        : null;

      const dbPrecheckNotification = questionnaire
        ? listCollection(snapshot.notifications).find(
          (item) => item.type === "precheck_sent" && item.questionnaireId === questionnaire.id
        ) || null
        : null;

      if (dbPrecheckNotification) {
        await createDbNotification(
          buildDbNotificationSyncPayload(snapshot, dbPrecheckNotification, {
            encounterId: dbEncounter.id,
            questionnaireId: dbQuestionnaire?.id || null
          })
        );
      }

      snapshot = updateState((state) => {
        upsertDbSyncEntity(state, {
          id: `db-${appointment.id}`,
          appointmentId: appointment.id,
          encounterId: dbEncounter.id,
          interviewId: dbInterview.id,
          precheckQuestionnaireId: dbQuestionnaire?.id || null,
          prescriptionId: null,
          labReportId: null,
          testOrderId: null,
          bookingSyncedAt: new Date().toISOString(),
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Booking saved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        upsertDbSyncEntity(state, {
          id: `db-${appointment.id}`,
          appointmentId: appointment.id,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async cancelAppointment(appointmentId) {
    await wait();
    let snapshot = updateState((state) => {
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

    try {
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      if (dbSync?.encounterId) {
        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: "cancelled",
            metadata: {
              source: "appointment_cancelled"
            }
          })
        );

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Appointment cancelled locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async rescheduleAppointment(appointmentId, payload) {
    await wait(160);
    let snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const finalizeChatbotBooking = Boolean(payload?.finalizeChatbotBooking);
      const sameExistingSelection =
        appointment.doctorId === payload.doctorId
        && appointment.slotId === payload.slotId
        && String(appointment.startAt || "").slice(0, 10) === payload.date;
      const nextSlot = sameExistingSelection
        ? {
          id: appointment.slotId,
          startAt: appointment.startAt,
          endAt: appointment.endAt
        }
        : ensureBookableSlot(state, payload.doctorId, payload.date, payload.slotId);
      const originalDoctorId = appointment.doctorId;
      const nextRescheduleHistory = sameExistingSelection
        ? [...(appointment.rescheduleHistory || [])]
        : [
          ...(appointment.rescheduleHistory || []),
          {
            fromSlotId: appointment.slotId,
            toSlotId: payload.slotId,
            changedAt: new Date().toISOString()
          }
        ];
      const nextToken = finalizeChatbotBooking && appointment.visitType === "chatbot_intake"
        ? buildToken(payload.doctorId)
        : appointment.token;

      state.appointments.byId[appointmentId] = {
        ...appointment,
        doctorId: payload.doctorId,
        slotId: payload.slotId,
        startAt: nextSlot.startAt,
        endAt: nextSlot.endAt,
        token: nextToken,
        visitType: payload.visitType || appointment.visitType,
        bookingStatus: finalizeChatbotBooking ? "scheduled" : "rescheduled",
        rescheduleHistory: nextRescheduleHistory
      };

      const encounter = state.encounters.byId[`encounter-${appointmentId}`];
      if (encounter) {
        state.encounters.byId[encounter.id] = {
          ...encounter,
          doctorId: payload.doctorId
        };
      }

      const emrSync = state.emrSync.byId[`emr-${appointmentId}`];
      if (emrSync) {
        state.emrSync.byId[emrSync.id] = {
          ...emrSync,
          localDoctorId: payload.doctorId
        };
      }

      syncDoctorAndMaybeOriginal(state, [originalDoctorId, payload.doctorId]);
      return state;
    });

    try {
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      if (dbSync?.encounterId) {
        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            scheduledTime: snapshot.appointments.byId[appointmentId]?.startAt || null,
            doctorId: snapshot.appointments.byId[appointmentId]?.doctorId || null,
            metadata: {
              source: "appointment_rescheduled"
            }
          })
        );

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Appointment rescheduled locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async submitInterview(appointmentId, answers) {
    await wait(200);
    let snapshot = updateState((state) => {
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

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const patient = snapshot.patients.byId[appointment.patientId];
      const questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
      const precheckAnswers = toCdssPrecheckAnswers(questionnaire);
      const encounterId = getEmrSyncRecord(snapshot, appointmentId)?.encounterId || `encounter-${appointmentId}`;

      const transcript = [
        answers.primaryConcern,
        answers.duration,
        answers.severity,
        answers.associatedSymptoms,
        `Medications: ${answers.medications || "None"}`,
        `Allergies: ${answers.allergies || "None"}`
      ].filter(Boolean).join(". ");

      const cdssOutput = await analyzeCdssEncounter({
        patientId: patient.id,
        encounterId,
        transcript,
        precheckAnswers
      });

      snapshot = updateState((state) => {
        const encounter = state.encounters.byId[`encounter-${appointmentId}`];
        if (!encounter) return state;
        const currentDraft = encounter.apciDraft || emptyEncounterDraft("AI pre-chart");

        state.encounters.byId[`encounter-${appointmentId}`] = {
          ...encounter,
          status: "ai_ready",
          apciDraft: applyCdssOutputToDraft(currentDraft, cdssOutput),
          alerts: (cdssOutput?.alerts || []).map((item) => item.message).filter(Boolean),
          confidenceMap: {
            ...(encounter.confidenceMap || {}),
            ...(cdssOutput?.confidence_scores || {})
          }
        };
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] CDSS analyze unavailable; using local interview draft.", error);
    }

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const patient = snapshot.patients.byId[appointment.patientId];
      const doctor = snapshot.doctors.byId[appointment.doctorId];
      const emrSync = getEmrSyncRecord(snapshot, appointmentId);
      const emrResponse = await syncInterviewToGunaEmr({ appointment, patient, doctor, answers, emrSync });

      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: patient.id,
          localDoctorId: doctor.id,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };

        upsertEmrSyncEntity(state, {
          ...existing,
          patientId: emrResponse?.patientId || existing.patientId,
          encounterId: emrResponse?.encounterId || existing.encounterId,
          queueToken: emrResponse?.queueToken ?? existing.queueToken,
          interviewSyncedAt: new Date().toISOString(),
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Interview saved locally; EMR sync skipped.", error);

      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: state.appointments.byId[appointmentId]?.patientId || null,
          localDoctorId: state.appointments.byId[appointmentId]?.doctorId || null,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertEmrSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      const interviewPayload = buildDbInterviewSyncPayload(snapshot, appointmentId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        metadata: {
          source: "patient_interview"
        }
      });

      if (dbSync?.interviewId) {
        await updateInterview(dbSync.interviewId, interviewPayload);

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: null,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            interviewSyncedAt: new Date().toISOString(),
            lastError: null
          });
          return state;
        });
      } else if (dbSync?.encounterId) {
        const dbInterview = await createInterview(interviewPayload);

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            interviewId: dbInterview.id,
            interviewSyncedAt: new Date().toISOString(),
            lastError: null
          });
          return state;
        });
      }

      if (dbSync?.encounterId) {
        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: "ai_ready",
            aiPrechart: snapshot.encounters.byId[`encounter-${appointmentId}`]?.apciDraft || null,
            metadata: {
              source: "patient_interview"
            }
          })
        );
      }
    } catch (error) {
      console.warn("[NIRA] Interview stored locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async syncChatbotSubmission(payload) {
    await wait(40);
    let snapshot = updateState((state) => {
      const patientId = payload?.patientId;
      if (!patientId || !state.patients.byId[patientId]) {
        throw new Error("Patient profile not found for chatbot submission.");
      }

      const existingUpcoming = listCollection(state.appointments)
        .filter((appointment) => appointment.patientId === patientId && !["completed", "cancelled"].includes(appointment.bookingStatus))
        .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())[0] || null;

      const preferredDoctorLabel = payload?.submission?.chat?.appointmentDetails?.doctor || "";
      const selectedDoctor = resolveChatDoctor(state, preferredDoctorLabel);
      if (!selectedDoctor) {
        throw new Error("No active doctor available to route chatbot intake.");
      }

      let appointment = existingUpcoming;
      if (!appointment) {
        const picked = findBestSlotForDoctor(state, selectedDoctor.id);
        const now = new Date();
        const fallbackStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        const fallbackEnd = new Date(now.getTime() + 75 * 60 * 1000).toISOString();

        appointment = {
          id: uid("appointment"),
          slotId: picked?.slot?.id || `slot-${selectedDoctor.id}-${fallbackStart}`,
          doctorId: selectedDoctor.id,
          patientId,
          bookedByUserId: payload?.userId || state.patients.byId[patientId]?.userId || null,
          visitType: "chatbot_intake",
          bookingStatus: "scheduled",
          rescheduleHistory: [],
          token: payload?.submission?.queueToken ? String(payload.submission.queueToken) : buildToken(selectedDoctor.id),
          startAt: picked?.slot?.startAt || fallbackStart,
          endAt: picked?.slot?.endAt || fallbackEnd
        };
        upsertAppointment(state, appointment);
      }

      const interview = buildInterviewFromChatMessages(
        appointment.id,
        payload?.messages || [],
        payload?.language || "en"
      );
      upsertInterview(state, interview);

      const chiefComplaint =
        String(payload?.submission?.chat?.summary || "").split("|")[0]?.replace(/^Chief Complaint:\s*/i, "").trim()
        || interview.extractedFindings[0]
        || "Chatbot symptom intake";

      const existingEncounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
      const baseDraft = existingEncounter?.apciDraft || emptyEncounterDraft(chiefComplaint);
      const subjectiveText = interview.transcript.map((entry) => `${entry.role}: ${entry.text}`).join("\n");
      const chatbotMetadata = buildChatbotMetadata(payload?.submission?.chat) || existingEncounter?.chatbotMetadata || null;

      const encounter = {
        ...(existingEncounter || {}),
        id: `encounter-${appointment.id}`,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        interviewId: interview.id,
        status: "ai_ready",
        apciDraft: {
          ...baseDraft,
          id: baseDraft.id || `draft-${appointment.id}`,
          appointmentId: appointment.id,
          soap: {
            ...(baseDraft.soap || {}),
            chiefComplaint,
            subjective: subjectiveText || baseDraft.soap?.subjective || "Interview captured via chatbot.",
            objective: baseDraft.soap?.objective || "Initial chatbot triage completed; in-clinic vitals pending.",
            assessment: payload?.submission?.chat?.summary || baseDraft.soap?.assessment || "AI triage summary available for doctor review.",
            plan: baseDraft.soap?.plan || "Doctor review required before final plan."
          },
          alerts: payload?.submission?.chat?.redFlags?.length
            ? payload.submission.chat.redFlags
            : baseDraft.alerts || [],
          confidenceMap: {
            ...(baseDraft.confidenceMap || {}),
            ...((payload?.submission?.cdss?.confidenceScores && typeof payload.submission.cdss.confidenceScores === "object")
              ? payload.submission.cdss.confidenceScores
              : {})
          }
        },
        alerts: payload?.submission?.chat?.redFlags?.length
          ? payload.submission.chat.redFlags
          : existingEncounter?.alerts || [],
        confidenceMap: {
          ...(existingEncounter?.confidenceMap || {}),
          ...((payload?.submission?.cdss?.confidenceScores && typeof payload.submission.cdss.confidenceScores === "object")
            ? payload.submission.cdss.confidenceScores
            : {})
        },
        chatbotMetadata,
        updatedAt: new Date().toISOString()
      };
      upsertEncounter(state, encounter);

      state.appointments.byId[appointment.id] = {
        ...state.appointments.byId[appointment.id],
        doctorId: selectedDoctor.id,
        bookingStatus: state.appointments.byId[appointment.id]?.bookingStatus || "scheduled"
      };

      upsertEmrSyncEntity(state, {
        id: `emr-${appointment.id}`,
        appointmentId: appointment.id,
        localPatientId: patientId,
        localDoctorId: selectedDoctor.id,
        patientId: payload?.submission?.patientId || null,
        encounterId: payload?.submission?.encounterId || null,
        queueToken: payload?.submission?.queueToken ?? null,
        bookingSyncedAt: state.emrSync?.byId?.[`emr-${appointment.id}`]?.bookingSyncedAt || null,
        interviewSyncedAt: new Date().toISOString(),
        approvalSyncedAt: state.emrSync?.byId?.[`emr-${appointment.id}`]?.approvalSyncedAt || null,
        lastError: null
      });

      state.ui.lastViewedAppointmentId = appointment.id;
      syncDoctorDaySchedules(state, selectedDoctor.id, state.meta.today, 30);
      return state;
    });

    try {
      const appointmentId = snapshot.ui.lastViewedAppointmentId;
      const appointment = appointmentId ? snapshot.appointments.byId[appointmentId] : null;
      if (!appointment) {
        return snapshot;
      }

      let dbSync = getDbSyncRecord(snapshot, appointmentId);
      let dbEncounterId = dbSync?.encounterId || null;

      if (!dbEncounterId) {
        const dbEncounter = await createEncounter(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: "ai_ready",
            chiefComplaint: snapshot.encounters.byId[`encounter-${appointmentId}`]?.apciDraft?.soap?.chiefComplaint || "Chatbot symptom intake",
            metadata: {
              source: "chatbot_submission"
            }
          })
        );
        dbEncounterId = dbEncounter.id;
      }

      const interviewPayload = buildDbInterviewSyncPayload(snapshot, appointmentId, {
        encounterId: dbEncounterId,
        status: "completed",
        completedAt: new Date().toISOString(),
        metadata: {
          source: "chatbot_submission"
        }
      });

      const dbInterview = dbSync?.interviewId
        ? await updateInterview(dbSync.interviewId, interviewPayload)
        : await createInterview(interviewPayload);

      await upsertEncounterSnapshot(
        buildDbEncounterSyncPayload(snapshot, appointmentId, {
          encounterId: dbEncounterId,
          status: "ai_ready",
          aiPrechart: snapshot.encounters.byId[`encounter-${appointmentId}`]?.apciDraft || null,
          metadata: {
            source: "chatbot_submission"
          }
        })
      );

      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };

        upsertDbSyncEntity(state, {
          ...existing,
          encounterId: dbEncounterId,
          interviewId: dbInterview.id,
          bookingSyncedAt: existing.bookingSyncedAt || new Date().toISOString(),
          interviewSyncedAt: new Date().toISOString(),
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Chatbot submission saved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const appointmentId = state.ui.lastViewedAppointmentId || null;
        if (!appointmentId) {
          return state;
        }

        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };

        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async updatePrecheckQuestions(appointmentId, editedQuestions) {
    await wait(120);
    let snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const questionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId) || createPrecheckQuestionnaire(state, appointment);
      upsertPrecheckQuestionnaireEntity(state, {
        ...questionnaire,
        editedQuestions: editedQuestions.map((question, index) => ({
          id: question.id || `precheck-${appointmentId}-${index + 1}`,
          question: question.question,
          type: question.type || "text",
          options: question.options || [],
          required: question.required !== false,
          category: question.category || "general"
        })),
        status: "doctor_editing",
        updatedAt: new Date().toISOString()
      });

      state.encounters.byId[`encounter-${appointmentId}`] = {
        ...state.encounters.byId[`encounter-${appointmentId}`],
        precheckQuestionnaireId: questionnaire.id,
        precheckStatus: "doctor_editing"
      };

      return state;
    });

    try {
      const questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
      const dbSync = getDbSyncRecord(snapshot, appointmentId);

      if (questionnaire && dbSync?.encounterId) {
        const dbQuestionnaire = await upsertDbPrecheckQuestionnaire(
          buildDbPrecheckSyncPayload(snapshot, appointmentId, questionnaire, {
            status: "doctor_editing",
            metadata: {
              source: "doctor_precheck_edit"
            }
          })
        );

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };

          upsertDbSyncEntity(state, {
            ...existing,
            precheckQuestionnaireId: dbQuestionnaire.id,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Pre-check edits saved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async regeneratePrecheckQuestions(appointmentId) {
    await wait(120);
    let nextSnapshot = await ensureAiPrecheckQuestionnaire(appointmentId, {
      forceRegenerate: true,
      status: "sent_to_patient",
      notifyPatient: true,
      notificationTitle: "Updated pre-check questions",
      notificationMessage: "AI has updated your pre-check questions. Please complete them before appointment."
    });

    try {
      const questionnaire = getPrecheckQuestionnaireByAppointment(nextSnapshot, appointmentId);
      const dbSync = getDbSyncRecord(nextSnapshot, appointmentId);
      const notification = listCollection(nextSnapshot.notifications)
        .filter((item) => item.type === "precheck_sent" && resolveNotificationAppointmentId(item) === appointmentId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;

      if (questionnaire && dbSync?.encounterId) {
        const dbQuestionnaire = await upsertDbPrecheckQuestionnaire(
          buildDbPrecheckSyncPayload(nextSnapshot, appointmentId, questionnaire, {
            status: "sent_to_patient",
            metadata: {
              source: "precheck_regenerated"
            }
          })
        );

        if (notification) {
          await createDbNotification(
            buildDbNotificationSyncPayload(nextSnapshot, notification, {
              encounterId: dbSync.encounterId,
              questionnaireId: dbQuestionnaire.id
            })
          );
        }

        nextSnapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };

          upsertDbSyncEntity(state, {
            ...existing,
            precheckQuestionnaireId: dbQuestionnaire.id,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Regenerated pre-check saved locally; DB sync skipped.", error);
      nextSnapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return nextSnapshot;
  },

  async ensurePrecheckQuestionnaire(appointmentId, options = {}) {
    await wait(60);
    return ensureAiPrecheckQuestionnaire(appointmentId, {
      forceRegenerate: options?.forceRegenerate === true,
      status: options?.status || "sent_to_patient",
      notifyPatient: false
    });
  },

  async startAdaptivePrecheckSession(appointmentId) {
    await wait(80);
    let snapshot = await ensureAiPrecheckQuestionnaire(appointmentId, {
      status: "sent_to_patient",
      notifyPatient: false
    });

    let questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
    if (!questionnaire) {
      throw new Error("Pre-check questionnaire not found.");
    }

    if (!shouldUseAdaptivePrecheck(questionnaire)) {
      return snapshot;
    }

    if (getCurrentAdaptivePrecheckQuestion(questionnaire) || questionnaire?.metadata?.adaptiveComplete) {
      return snapshot;
    }

    const appointment = snapshot.appointments.byId[appointmentId];
    const patient = snapshot.patients.byId[appointment.patientId] || {};
    const doctor = snapshot.doctors.byId[appointment.doctorId] || {};
    const turnInput = buildAdaptivePrecheckTurnInput(snapshot, appointment, patient, doctor, questionnaire);
    const turn = await generateAdaptivePrecheckTurn(
      turnInput.encounterId,
      turnInput.appointmentContext,
      turnInput.sessionState
    );

    if (turn.isComplete) {
      return updateState((state) => {
        const currentQuestionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
        if (!currentQuestionnaire) {
          throw new Error("Pre-check questionnaire not found.");
        }

        upsertPrecheckQuestionnaireEntity(state, {
          ...currentQuestionnaire,
          metadata: buildDiseaseSpecificPrecheckMetadata(currentQuestionnaire.aiQuestions || [], currentQuestionnaire.metadata, {
            targetQuestionCount: turn.targetQuestionCount,
            chiefComplaint: turnInput.appointmentContext.chiefComplaint,
            adaptiveComplete: true
          }),
          updatedAt: new Date().toISOString()
        });
        return state;
      });
    }

    snapshot = updateState((state) => {
      const currentQuestionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
      if (!currentQuestionnaire) {
        throw new Error("Pre-check questionnaire not found.");
      }

      const nextQuestions = appendAdaptivePrecheckQuestion(currentQuestionnaire, appointmentId, turn.question);
      upsertPrecheckQuestionnaireEntity(state, {
        ...currentQuestionnaire,
        aiQuestions: nextQuestions,
        metadata: buildDiseaseSpecificPrecheckMetadata(nextQuestions, currentQuestionnaire.metadata, {
          targetQuestionCount: turn.targetQuestionCount,
          chiefComplaint: turnInput.appointmentContext.chiefComplaint,
          adaptiveComplete: false
        }),
        updatedAt: new Date().toISOString()
      });
      return state;
    });

    return snapshot;
  },

  async answerAdaptivePrecheckQuestion(appointmentId, payload = {}) {
    await wait(80);
    const questionId = String(payload?.questionId || "").trim();
    const answer = String(payload?.answer || "").trim();
    const rawAnswer = String(payload?.rawAnswer || payload?.answer || "").trim();

    if (!questionId || !answer) {
      throw new Error("Missing adaptive pre-check answer.");
    }

    let snapshot = updateState((state) => {
      const questionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
      if (!questionnaire) {
        throw new Error("Pre-check questionnaire not found.");
      }
      const rawPatientResponses = {
        ...normalizeRawPrecheckResponsesMap(questionnaire?.metadata?.rawPatientResponses),
        [questionId]: rawAnswer || answer
      };

      upsertPrecheckQuestionnaireEntity(state, {
        ...questionnaire,
        patientResponses: {
          ...(questionnaire.patientResponses || {}),
          [questionId]: answer
        },
        metadata: {
          ...buildDiseaseSpecificPrecheckMetadata(questionnaire.aiQuestions || [], questionnaire.metadata, {
            targetQuestionCount: getAdaptivePrecheckTargetQuestionCount(questionnaire),
            chiefComplaint: questionnaire?.metadata?.chiefComplaint,
            adaptiveComplete: false
          }),
          rawPatientResponses
        },
        updatedAt: new Date().toISOString()
      });
      return state;
    });

    let questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
    if (!questionnaire || !shouldUseAdaptivePrecheck(questionnaire)) {
      return snapshot;
    }

    if (getCurrentAdaptivePrecheckQuestion(questionnaire)) {
      return snapshot;
    }

    const answeredCount = countAnsweredPrecheckResponses(questionnaire);
    const targetQuestionCount = getAdaptivePrecheckTargetQuestionCount(questionnaire);
    const reachedTarget =
      (answeredCount >= targetQuestionCount && answeredCount >= DISEASE_SPECIFIC_PRECHECK_MIN_QUESTIONS)
      || answeredCount >= DISEASE_SPECIFIC_PRECHECK_MAX_QUESTIONS;

    if (reachedTarget) {
      return updateState((state) => {
        const currentQuestionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
        if (!currentQuestionnaire) {
          throw new Error("Pre-check questionnaire not found.");
        }

        upsertPrecheckQuestionnaireEntity(state, {
          ...currentQuestionnaire,
          metadata: buildDiseaseSpecificPrecheckMetadata(currentQuestionnaire.aiQuestions || [], currentQuestionnaire.metadata, {
            targetQuestionCount,
            chiefComplaint: currentQuestionnaire?.metadata?.chiefComplaint,
            adaptiveComplete: true
          }),
          updatedAt: new Date().toISOString()
        });
        return state;
      });
    }

    const appointment = snapshot.appointments.byId[appointmentId];
    const patient = snapshot.patients.byId[appointment.patientId] || {};
    const doctor = snapshot.doctors.byId[appointment.doctorId] || {};
    const turnInput = buildAdaptivePrecheckTurnInput(snapshot, appointment, patient, doctor, questionnaire);
    const turn = await generateAdaptivePrecheckTurn(
      turnInput.encounterId,
      turnInput.appointmentContext,
      turnInput.sessionState
    );

    if (turn.isComplete) {
      return updateState((state) => {
        const currentQuestionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
        if (!currentQuestionnaire) {
          throw new Error("Pre-check questionnaire not found.");
        }

        upsertPrecheckQuestionnaireEntity(state, {
          ...currentQuestionnaire,
          metadata: buildDiseaseSpecificPrecheckMetadata(currentQuestionnaire.aiQuestions || [], currentQuestionnaire.metadata, {
            targetQuestionCount: turn.targetQuestionCount,
            chiefComplaint: turnInput.appointmentContext.chiefComplaint,
            adaptiveComplete: true
          }),
          updatedAt: new Date().toISOString()
        });
        return state;
      });
    }

    snapshot = updateState((state) => {
      const currentQuestionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
      if (!currentQuestionnaire) {
        throw new Error("Pre-check questionnaire not found.");
      }

      const nextQuestions = appendAdaptivePrecheckQuestion(currentQuestionnaire, appointmentId, turn.question);
      upsertPrecheckQuestionnaireEntity(state, {
        ...currentQuestionnaire,
        aiQuestions: nextQuestions,
        metadata: buildDiseaseSpecificPrecheckMetadata(nextQuestions, currentQuestionnaire.metadata, {
          targetQuestionCount: turn.targetQuestionCount,
          chiefComplaint: turnInput.appointmentContext.chiefComplaint,
          adaptiveComplete: false
        }),
        updatedAt: new Date().toISOString()
      });
      return state;
    });

    return snapshot;
  },

  async sendPrecheckToPatient(appointmentId) {
    await wait(120);
    let snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const questionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId) || createPrecheckQuestionnaire(state, appointment);
      const isAdaptivePrecheck = questionnaire?.metadata?.generationMode === DISEASE_SPECIFIC_PRECHECK_MODE;
      const nextQuestions = questionnaire.editedQuestions?.length ? questionnaire.editedQuestions : questionnaire.aiQuestions;
      if (!nextQuestions.length && !isAdaptivePrecheck) {
        throw new Error("No pre-check questions available to send.");
      }
      const updated = {
        ...questionnaire,
        editedQuestions: isAdaptivePrecheck ? (questionnaire.editedQuestions || []) : nextQuestions,
        status: "sent_to_patient",
        doctorConfirmedAt: new Date().toISOString(),
        sentToPatientAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      upsertPrecheckQuestionnaireEntity(state, updated);
      state.encounters.byId[`encounter-${appointmentId}`] = {
        ...state.encounters.byId[`encounter-${appointmentId}`],
        precheckQuestionnaireId: updated.id,
        precheckStatus: "sent_to_patient"
      };

      upsertNotificationEntity(
        state,
        createDemoNotification({
          userId: appointment.patientId,
          type: "precheck_sent",
          title: "Attend your pre-check",
          message: "Your doctor has sent pre-check-up questions. Please answer them before your appointment.",
          encounterId: `encounter-${appointmentId}`,
          questionnaireId: updated.id
        })
      );

      return state;
    });

    try {
      const questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      const notification = listCollection(snapshot.notifications)
        .filter((item) => item.type === "precheck_sent" && resolveNotificationAppointmentId(item) === appointmentId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;

      if (questionnaire && dbSync?.encounterId) {
        const dbQuestionnaire = await upsertDbPrecheckQuestionnaire(
          buildDbPrecheckSyncPayload(snapshot, appointmentId, questionnaire, {
            status: "sent_to_patient",
            metadata: {
              source: "precheck_sent"
            }
          })
        );

        if (notification) {
          await createDbNotification(
            buildDbNotificationSyncPayload(snapshot, notification, {
              encounterId: dbSync.encounterId,
              questionnaireId: dbQuestionnaire.id
            })
          );
        }

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };

          upsertDbSyncEntity(state, {
            ...existing,
            precheckQuestionnaireId: dbQuestionnaire.id,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Pre-check sent locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async submitPrecheckResponses(appointmentId, patientResponses) {
    await wait(140);
    let snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const patient = state.patients.byId[appointment.patientId];
      const questionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
      if (!questionnaire) {
        throw new Error("Pre-check questionnaire not found.");
      }

      const submissionPayload = normalizePrecheckSubmissionPayload(patientResponses);
      const responseMap = submissionPayload.patientResponses;
      const rawPatientResponses = {
        ...normalizeRawPrecheckResponsesMap(questionnaire?.metadata?.rawPatientResponses),
        ...normalizeRawPrecheckResponsesMap(submissionPayload.metadata?.rawPatientResponses)
      };
      const precheckMetadata = buildPrecheckSessionMetadata(state, appointment, {
        ...(submissionPayload.metadata || {}),
        ...(Object.keys(rawPatientResponses).length ? { rawPatientResponses } : {})
      });
      const questions = questionnaire.editedQuestions?.length ? questionnaire.editedQuestions : questionnaire.aiQuestions;
      const precheckSummary = questions.reduce((acc, question) => {
        acc[question.question] = responseMap?.[question.id] || "Not answered";
        return acc;
      }, {});

      const updatedQuestionnaire = {
        ...questionnaire,
        patientResponses: responseMap,
        patientCompletedAt: new Date().toISOString(),
        status: "completed",
        precheckSummary,
        metadata: {
          ...(questionnaire?.metadata || {}),
          ...precheckMetadata
        },
        updatedAt: new Date().toISOString()
      };

      upsertPrecheckQuestionnaireEntity(state, updatedQuestionnaire);

      const encounter = state.encounters.byId[`encounter-${appointmentId}`] || null;
      const baseDraft = encounter?.apciDraft || emptyEncounterDraft("Pre-check completed");
      const derivedAnswers = deriveAnswersFromPrecheckQuestionnaire(updatedQuestionnaire);
      const interview = buildInterviewFromPrecheckQuestionnaire(
        appointmentId,
        updatedQuestionnaire,
        derivedAnswers.language || "en"
      );
      const generatedDraft = buildDraftFromAnswers(
        appointment,
        patient,
        derivedAnswers,
        baseDraft?.id || `draft-${appointmentId}`
      );
      const subjectiveSummary = Object.entries(precheckSummary)
        .map(([question, answer]) => `${question}: ${answer}`)
        .join("\n");
      const nextDraft = {
        ...generatedDraft,
        id: generatedDraft.id || baseDraft.id || `draft-${appointmentId}`,
        appointmentId,
        soap: {
          ...(baseDraft.soap || {}),
          ...(generatedDraft.soap || {}),
          subjective: subjectiveSummary || generatedDraft.soap?.subjective || baseDraft.soap?.subjective || ""
        },
        vitals: {
          ...(baseDraft.vitals || {}),
          ...(generatedDraft.vitals || {})
        },
        diagnoses: generatedDraft.diagnoses?.length ? generatedDraft.diagnoses : baseDraft.diagnoses || [],
        medicationSuggestions: generatedDraft.medicationSuggestions?.length
          ? generatedDraft.medicationSuggestions
          : baseDraft.medicationSuggestions || [],
        alerts: dedupeList([...(generatedDraft.alerts || []), ...(baseDraft.alerts || [])]),
        confidenceMap: {
          ...(baseDraft.confidenceMap || {}),
          ...(generatedDraft.confidenceMap || {})
        },
        differentials: dedupeList([...(generatedDraft.differentials || []), ...(baseDraft.differentials || [])])
      };

      upsertInterview(state, interview);
      state.encounters.byId[`encounter-${appointmentId}`] = {
        ...(encounter || {}),
        id: `encounter-${appointmentId}`,
        appointmentId,
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        status: "ai_ready",
        interviewId: interview.id,
        precheckQuestionnaireId: updatedQuestionnaire.id,
        precheckStatus: "completed",
        precheckSummary,
        interviewSummary: subjectiveSummary,
        apciDraft: nextDraft,
        alerts: nextDraft.alerts,
        confidenceMap: nextDraft.confidenceMap,
        metadata: {
          ...(encounter?.metadata || {}),
          ...precheckMetadata
        },
        updatedAt: new Date().toISOString()
      };
      state.ui.lastViewedAppointmentId = appointmentId;
      return state;
    });

    snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      const questionnaire = getPrecheckQuestionnaireByAppointment(state, appointmentId);
      const doctor = state.doctors.byId[appointment.doctorId];
      upsertNotificationEntity(
        state,
        createDemoNotification({
          userId: doctor.userId,
          type: "precheck_completed",
          title: "Pre-check answers received",
          message: `${state.patients.byId[appointment.patientId]?.fullName || "Patient"} completed the pre-check questionnaire.`,
          encounterId: `encounter-${appointmentId}`,
          questionnaireId: questionnaire?.id || null
        })
      );
      return state;
    });

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const patient = snapshot.patients.byId[appointment.patientId];
      const doctor = snapshot.doctors.byId[appointment.doctorId];
      const questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
      const answers = deriveAnswersFromPrecheckQuestionnaire(questionnaire);
      const emrSync = getEmrSyncRecord(snapshot, appointmentId);
      const emrResponse = await syncInterviewToGunaEmr({ appointment, patient, doctor, answers, emrSync });

      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: patient.id,
          localDoctorId: doctor.id,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };

        upsertEmrSyncEntity(state, {
          ...existing,
          patientId: emrResponse?.patientId || existing.patientId,
          encounterId: emrResponse?.encounterId || existing.encounterId,
          queueToken: emrResponse?.queueToken ?? existing.queueToken,
          interviewSyncedAt: new Date().toISOString(),
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Pre-check saved locally; EMR sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: state.appointments.byId[appointmentId]?.patientId || null,
          localDoctorId: state.appointments.byId[appointmentId]?.doctorId || null,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertEmrSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const questionnaire = getPrecheckQuestionnaireByAppointment(snapshot, appointmentId);
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      const notification = listCollection(snapshot.notifications)
        .filter((item) => item.type === "precheck_completed" && resolveNotificationAppointmentId(item) === appointmentId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;
      const interviewPayload = buildDbInterviewSyncPayload(snapshot, appointmentId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        metadata: {
          source: "patient_precheck"
        }
      });

      if (dbSync?.interviewId) {
        await updateInterview(dbSync.interviewId, interviewPayload);

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: null,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            interviewSyncedAt: new Date().toISOString(),
            lastError: null
          });
          return state;
        });
      } else if (dbSync?.encounterId) {
        const dbInterview = await createInterview(interviewPayload);

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            interviewId: dbInterview.id,
            interviewSyncedAt: new Date().toISOString(),
            lastError: null
          });
          return state;
        });
      }

      if (questionnaire && dbSync?.encounterId) {
        const dbQuestionnaire = await upsertDbPrecheckQuestionnaire(
          buildDbPrecheckSyncPayload(snapshot, appointmentId, questionnaire, {
            status: "completed",
            metadata: {
              source: "patient_precheck"
            }
          })
        );

        if (notification) {
          await createDbNotification(
            buildDbNotificationSyncPayload(snapshot, notification, {
              encounterId: dbSync.encounterId,
              questionnaireId: dbQuestionnaire.id
            })
          );
        }

        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: "ai_ready",
            aiPrechart: snapshot.encounters.byId[`encounter-${appointmentId}`]?.apciDraft || null,
            metadata: {
              source: "patient_precheck"
            }
          })
        );

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            precheckQuestionnaireId: dbQuestionnaire.id,
            interviewSyncedAt: new Date().toISOString(),
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Pre-check stored locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async markNotificationAsRead(notificationId) {
    await wait(60);
    return updateState((state) => {
      const notification = state.notifications.byId[notificationId];
      if (!notification) {
        return state;
      }

      state.notifications.byId[notificationId] = {
        ...notification,
        is_read: true,
        read_at: new Date().toISOString()
      };
      return state;
    });
  },

  async saveDoctorReview(appointmentId, payload) {
    await wait();
    let snapshot = updateState((state) => {
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

      if (encounter.prescriptionId && state.prescriptions.byId[encounter.prescriptionId]) {
        const existing = state.prescriptions.byId[encounter.prescriptionId];
        state.prescriptions.byId[encounter.prescriptionId] = {
          ...existing,
          medicines: payload.draft.medicationSuggestions.map((item) => ({
            name: item.name,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.rationale
          })),
          warnings: payload.draft.alerts,
          issuedAt: new Date().toISOString()
        };
      }

      createOrUpdateLabReport(state, appointmentId, payload.labReport || {}, "draft");
      return state;
    });

    try {
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      if (dbSync?.encounterId) {
        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: "in_consult",
            aiPrechart: payload.draft,
            doctorNotes: {
              note: payload.note || "",
              editedFields: payload.editedFields || [],
              reviewedAt: new Date().toISOString(),
              approved: false
            },
            metadata: {
              source: "doctor_review_draft"
            }
          })
        );

        const labReport = listCollection(snapshot.labReports)
          .filter((item) => item.appointmentId === appointmentId)
          .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;

        const dbLabReport = labReport
          ? await upsertDbLabReport(
            buildDbLabReportSyncPayload(snapshot, appointmentId, labReport, {
              status: "draft",
              metadata: {
                source: "doctor_review_draft"
              }
            })
          )
          : null;

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };

          upsertDbSyncEntity(state, {
            ...existing,
            labReportId: dbLabReport?.id || existing.labReportId || null,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Doctor review saved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async upsertLabReport(appointmentId, payload) {
    await wait();
    let snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      createOrUpdateLabReport(state, appointmentId, payload || {}, payload?.status || "draft");
      return state;
    });

    try {
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      const labReport = listCollection(snapshot.labReports)
        .filter((item) => item.appointmentId === appointmentId)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;

      if (dbSync?.encounterId && labReport) {
        const dbLabReport = await upsertDbLabReport(
          buildDbLabReportSyncPayload(snapshot, appointmentId, labReport, {
            status: labReport.status || payload?.status || "draft",
            metadata: {
              source: "manual_lab_report_update"
            }
          })
        );

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            labReportId: dbLabReport.id,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Lab report saved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async saveNurseVitals(appointmentId, payload) {
    await wait(90);
    let snapshot = updateState((state) => {
      const appointment = state.appointments.byId[appointmentId];
      if (!appointment) {
        throw new Error("Appointment not found.");
      }

      const encounterId = `encounter-${appointmentId}`;
      const encounter = state.encounters.byId[encounterId];
      if (!encounter) {
        throw new Error("Encounter not found.");
      }

      const currentDraft = encounter.apciDraft || emptyEncounterDraft("Vitals captured by nursing");
      const currentVitals = currentDraft.vitals || {};
      const updatedAt = new Date().toISOString();
      const nextVitals = {
        ...currentVitals,
        temperature: payload?.temperature ?? currentVitals.temperature ?? "",
        pulse: payload?.pulse ?? currentVitals.pulse ?? "",
        bloodPressure: payload?.bloodPressure ?? currentVitals.bloodPressure ?? "",
        spo2: payload?.spo2 ?? currentVitals.spo2 ?? "",
        painScore: payload?.painScore ?? currentVitals.painScore ?? "",
        updatedAt,
        updatedBy: "nurse"
      };

      state.encounters.byId[encounterId] = {
        ...encounter,
        status: encounter.status === "awaiting_interview" ? "ai_ready" : encounter.status,
        apciDraft: {
          ...currentDraft,
          vitals: nextVitals
        },
        updatedAt
      };

      state.appointments.byId[appointmentId] = {
        ...appointment,
        bookingStatus: appointment.bookingStatus === "scheduled" ? "checked_in" : appointment.bookingStatus
      };

      return state;
    });

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const patient = snapshot.patients.byId[appointment.patientId];
      const emrSync = getEmrSyncRecord(snapshot, appointmentId);
      const vitals = snapshot.encounters.byId[`encounter-${appointmentId}`]?.apciDraft?.vitals || {};
      const emrResponse = await syncNurseVitalsToGunaEmr({
        appointment,
        patient,
        vitals,
        emrSync
      });

      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: patient.id,
          localDoctorId: appointment.doctorId,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          vitalsSyncedAt: null,
          lastError: null
        };

        upsertEmrSyncEntity(state, {
          ...existing,
          patientId: emrResponse?.patientId || existing.patientId,
          encounterId: emrResponse?.encounterId || existing.encounterId,
          vitalsSyncedAt: new Date().toISOString(),
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Nurse vitals saved locally; EMR sync skipped.", error);
      snapshot = updateState((state) => {
        const appointment = state.appointments.byId[appointmentId];
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: appointment?.patientId || null,
          localDoctorId: appointment?.doctorId || null,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          vitalsSyncedAt: null,
          lastError: null
        };
        upsertEmrSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    try {
      const dbSync = getDbSyncRecord(snapshot, appointmentId);
      if (dbSync?.encounterId) {
        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: snapshot.encounters.byId[`encounter-${appointmentId}`]?.status || "ai_ready",
            vitals: snapshot.encounters.byId[`encounter-${appointmentId}`]?.apciDraft?.vitals || null,
            checkInTime:
              snapshot.appointments.byId[appointmentId]?.bookingStatus === "checked_in"
                ? new Date().toISOString()
                : null,
            metadata: {
              source: "nurse_vitals"
            }
          })
        );

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Nurse vitals saved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  },

  async approveEncounter(appointmentId, payload) {
    await wait(220);
    let snapshot = updateState((state) => {
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

      createOrUpdateLabReport(state, appointmentId, payload.labReport || {}, "final");

      const patient = state.patients.byId[appointment.patientId];
      const doctor = state.doctors.byId[appointment.doctorId];
      const orderedTests = extractOrderedTestsFromDraft(payload.draft);
      const patientTestNote = extractPatientTestNoteFromDraft(payload.draft);
      const hasPortalTests = orderedTests.length > 0 || patientTestNote.length > 0;

      upsertTestOrderEntity(state, {
        id: `tests-${appointmentId}`,
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        doctorName: doctor?.fullName || "Your doctor",
        tests: orderedTests,
        patientNote: patientTestNote || null,
        orderedAt: new Date().toISOString(),
        status: hasPortalTests ? "ordered" : "none"
      });

      upsertNotificationEntity(
        state,
        createDemoNotification({
          userId: patient.userId,
          type: "prescription_approved",
          title: "Prescription published",
          message: `Your doctor approved and published your prescription from this visit. Open Prescriptions to view or download.`,
          encounterId: encounter.id,
          prescriptionId: prescription.id,
          appointmentId
        })
      );

      if (hasPortalTests) {
        const detail =
          orderedTests.length > 0
            ? orderedTests.join(", ")
            : patientTestNote.slice(0, 120) + (patientTestNote.length > 120 ? "…" : "");
        upsertNotificationEntity(
          state,
          createDemoNotification({
            userId: patient.userId,
            type: "tests_ordered",
            title: "Tests ordered",
            message: `${doctor?.fullName || "Your doctor"} suggested: ${detail}. Open Tests for the full list.`,
            encounterId: encounter.id,
            appointmentId,
            testOrderId: `tests-${appointmentId}`
          })
        );
      }

      state.ui.lastViewedAppointmentId = appointmentId;
      return state;
    });

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const patient = snapshot.patients.byId[appointment.patientId];
      const doctor = snapshot.doctors.byId[appointment.doctorId];
      const emrSync = getEmrSyncRecord(snapshot, appointmentId);
      const emrResults = await syncDoctorApprovalToGunaEmr({
        appointment,
        patient,
        doctor,
        draft: payload.draft,
        note: payload.note,
        followUpNote: payload.followUpNote,
        emrSync
      });

      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: patient.id,
          localDoctorId: doctor.id,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };

        const doctorValue = emrResults?.doctorResult?.status === "fulfilled" ? emrResults.doctorResult.value : null;
        const vitalsValue = emrResults?.vitalsResult?.status === "fulfilled" ? emrResults.vitalsResult.value : null;

        upsertEmrSyncEntity(state, {
          ...existing,
          patientId: doctorValue?.patientId || vitalsValue?.patientId || existing.patientId,
          encounterId: doctorValue?.encounterId || vitalsValue?.encounterId || existing.encounterId,
          approvalSyncedAt: new Date().toISOString(),
          lastError: null
        });
        return state;
      });
    } catch (error) {
      console.warn("[NIRA] Encounter approved locally; EMR sync skipped.", error);

      snapshot = updateState((state) => {
        const existing = state.emrSync.byId[`emr-${appointmentId}`] || {
          id: `emr-${appointmentId}`,
          appointmentId,
          localPatientId: state.appointments.byId[appointmentId]?.patientId || null,
          localDoctorId: state.appointments.byId[appointmentId]?.doctorId || null,
          patientId: null,
          encounterId: null,
          queueToken: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertEmrSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    try {
      const appointment = snapshot.appointments.byId[appointmentId];
      const doctor = snapshot.doctors.byId[appointment.doctorId];
      const dbSync = getDbSyncRecord(snapshot, appointmentId);

      if (dbSync?.encounterId) {
        const encounter = snapshot.encounters.byId[`encounter-${appointmentId}`];
        const prescription = encounter?.prescriptionId
          ? snapshot.prescriptions.byId[encounter.prescriptionId] || null
          : null;
        const labReport = listCollection(snapshot.labReports)
          .filter((item) => item.appointmentId === appointmentId)
          .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;
        const testOrder = snapshot.testOrders.byId[`tests-${appointmentId}`] || null;
        const rxNotification = listCollection(snapshot.notifications)
          .filter((item) => item.type === "prescription_approved" && resolveNotificationAppointmentId(item) === appointmentId)
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;
        const testsNotification = listCollection(snapshot.notifications)
          .filter((item) => item.type === "tests_ordered" && resolveNotificationAppointmentId(item) === appointmentId)
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0] || null;

        await upsertEncounterSnapshot(
          buildDbEncounterSyncPayload(snapshot, appointmentId, {
            status: "approved",
            completedTime: encounter?.approvedAt || new Date().toISOString(),
            aiPrechart: payload.draft,
            doctorNotes: {
              note: payload.note || "",
              editedFields: payload.editedFields || [],
              reviewedAt: encounter?.doctorReview?.reviewedAt || new Date().toISOString(),
              approved: true,
              followUpNote: payload.followUpNote || ""
            },
            metadata: {
              source: "doctor_approval"
            }
          })
        );

        const dbPrescription = await createPrescription({
          prescriptionId: prescription?.id || `rx-${appointmentId}`,
          appointmentId,
          encounterId: dbSync.encounterId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          clinicId: doctor.clinic || "NIRA Pilot Clinic",
          medications: buildDbMedicationPayload(payload.draft),
          diagnosis: buildDbDiagnosisPayload(payload.draft),
          notes: payload.note || payload.followUpNote || "",
          status: "active",
          approvedAt: new Date().toISOString(),
          metadata: {
            followUpNote: payload.followUpNote || "",
            source: "doctor_approval"
          }
        });

        try {
          await approvePrescription(dbPrescription.id, appointment.doctorId);
        } catch (approvalError) {
          console.warn("[NIRA] Prescription created in DB; approval workflow call skipped.", approvalError);
        }

        const dbLabReport = labReport
          ? await upsertDbLabReport(
            buildDbLabReportSyncPayload(snapshot, appointmentId, labReport, {
              status: "final",
              metadata: {
                source: "doctor_approval"
              }
            })
          )
          : null;

        const dbTestOrder = testOrder
          ? await upsertDbTestOrder(
            buildDbTestOrderSyncPayload(snapshot, appointmentId, testOrder, {
              metadata: {
                source: "doctor_approval"
              }
            })
          )
          : null;

        if (rxNotification) {
          await createDbNotification(
            buildDbNotificationSyncPayload(snapshot, rxNotification, {
              encounterId: dbSync.encounterId,
              prescriptionId: dbPrescription.id
            })
          );
        }

        if (testsNotification && dbTestOrder) {
          await createDbNotification(
            buildDbNotificationSyncPayload(snapshot, testsNotification, {
              encounterId: dbSync.encounterId,
              metadata: {
                remoteTestOrderId: dbTestOrder.id
              }
            })
          );
        }

        snapshot = updateState((state) => {
          const existing = state.dbSync.byId[`db-${appointmentId}`] || {
            id: `db-${appointmentId}`,
            appointmentId,
            encounterId: dbSync.encounterId,
            interviewId: null,
            prescriptionId: null,
            bookingSyncedAt: null,
            interviewSyncedAt: null,
            approvalSyncedAt: null,
            lastError: null
          };
          upsertDbSyncEntity(state, {
            ...existing,
            prescriptionId: dbPrescription.id,
            labReportId: dbLabReport?.id || existing.labReportId || null,
            testOrderId: dbTestOrder?.id || existing.testOrderId || null,
            approvalSyncedAt: new Date().toISOString(),
            lastError: null
          });
          return state;
        });
      }
    } catch (error) {
      console.warn("[NIRA] Encounter approved locally; DB sync skipped.", error);
      snapshot = updateState((state) => {
        const existing = state.dbSync.byId[`db-${appointmentId}`] || {
          id: `db-${appointmentId}`,
          appointmentId,
          encounterId: null,
          interviewId: null,
          prescriptionId: null,
          bookingSyncedAt: null,
          interviewSyncedAt: null,
          approvalSyncedAt: null,
          lastError: null
        };
        upsertDbSyncEntity(state, {
          ...existing,
          lastError: String(error?.message || error)
        });
        return state;
      });
    }

    return snapshot;
  }
};
