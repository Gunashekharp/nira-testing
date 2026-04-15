import { supabase, supabaseConfigured } from "../lib/supabase";

const appStateSnapshotKey = (import.meta.env.VITE_SUPABASE_STATE_SNAPSHOT_KEY || "").trim();

export const appStateSnapshotConfigured = Boolean(supabaseConfigured && appStateSnapshotKey);

function normalizeDbUserStatus(role) {
  if (role === "doctor") {
    return "pending";
  }

  return "active";
}

async function createAuthUser({ email, password, fullName, role, phone }) {
  if (!supabaseConfigured || !email || !password) {
    return null;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        phone: phone || null
      }
    }
  });

  if (error) throw error;
  return data.user || null;
}

async function createUserProfile(payload) {
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function requireSupabaseConfigured() {
  if (!supabaseConfigured) {
    throw new Error("Supabase not configured");
  }
}

async function invokeCareSync(action, payload = {}) {
  requireSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke("care-sync", {
    body: {
      action,
      ...payload
    }
  });
  if (error) throw error;
  return data;
}

export async function fetchAppStateSnapshot() {
  if (!appStateSnapshotConfigured) {
    return null;
  }

  const payload = await invokeCareSync("get_app_state_snapshot", {
    snapshotKey: appStateSnapshotKey
  });

  return payload?.state || null;
}

export async function persistAppStateSnapshot(state) {
  if (!appStateSnapshotConfigured) {
    return {
      synced: false,
      skipped: true,
      reason: supabaseConfigured ? "snapshot_key_not_configured" : "supabase_not_configured"
    };
  }

  const payload = await invokeCareSync("upsert_app_state_snapshot", {
    snapshotKey: appStateSnapshotKey,
    state
  });

  return {
    synced: true,
    skipped: false,
    snapshotKey: payload?.snapshotKey || appStateSnapshotKey,
    updatedAt: payload?.updatedAt || null
  };
}

function normalizeInterviewStatus(status = "") {
  const value = String(status || "").toLowerCase();
  if (["complete", "completed"].includes(value)) return "completed";
  if (["abandoned", "cancelled", "closed"].includes(value)) return "abandoned";
  return value || "in-progress";
}

export async function syncSignupToDatabase({
  role,
  fullName,
  email,
  password,
  phone,
  specialty,
  licenseNumber,
  gender,
  city,
  age,
  abhaNumber,
  emergencyContactName,
  emergencyContactPhone,
  preferredLanguage
}) {
  if (!supabaseConfigured) {
    return { synced: false, skipped: true, reason: "supabase_not_configured" };
  }

  if (!email || !password) {
    return { synced: false, skipped: true, reason: "missing_email_or_password" };
  }

  const user = await createAuthUser({ email, password, fullName, role, phone });

  if (!user?.id) {
    return { synced: false, skipped: true, reason: "no_auth_user" };
  }

  await createUserProfile({
    id: user.id,
    clinic_id: null,
    role,
    full_name: fullName,
    phone: phone || null,
    email,
    specialty: role === "doctor" ? specialty || null : null,
    license_number: role === "doctor" ? licenseNumber || null : null,
    gender: gender || null,
    status: normalizeDbUserStatus(role)
  });

  if (role === "patient") {
    const { error } = await supabase.from("patients").insert({
      user_id: user.id,
      clinic_id: null,
      phone: phone || null,
      email,
      abha: abhaNumber || null,
      age: age ? Number(age) : null,
      gender: gender || null,
      city: city || null,
      emergency_contact_name: emergencyContactName || null,
      emergency_contact_phone: emergencyContactPhone || null,
      preferred_language: preferredLanguage || "en"
    });

    if (error) throw error;
  }

  return { synced: true, skipped: false, userId: user.id };
}

// ── Encounters ──────────────────────────────────────────────

export async function createEncounter({
  patientId,
  doctorId,
  clinicId,
  scheduledTime,
  type,
  chiefComplaint,
  appointmentId,
  tokenNumber = null,
  status = "planned",
  metadata = {}
}) {
  return invokeCareSync("upsert_encounter", {
    patientId,
    doctorId,
    clinicId,
    scheduledTime,
    type,
    chiefComplaint,
    appointmentId,
    tokenNumber,
    status,
    metadata
  });
}

export async function upsertEncounterSnapshot(payload) {
  return invokeCareSync("upsert_encounter", payload);
}

export async function updateEncounterStatus(encounterId, status, extra = {}) {
  return invokeCareSync("upsert_encounter", {
    encounterId,
    status,
    ...extra
  });
}

export async function getEncounterWithDetails(encounterId) {
  const { data, error } = await supabase
    .from("encounters")
    .select("*, patients(*), user_profiles!encounters_doctor_id_fkey(full_name, specialty)")
    .eq("id", encounterId)
    .single();
  if (error) throw error;
  return data;
}

// ── Prescriptions ───────────────────────────────────────────

export async function createPrescription({
  prescriptionId,
  appointmentId,
  encounterId,
  patientId,
  doctorId,
  clinicId,
  medications,
  diagnosis,
  notes,
  status = "draft",
  approvedAt = null,
  metadata = {}
}) {
  return invokeCareSync("upsert_prescription", {
    prescriptionId,
    appointmentId,
    encounterId,
    patientId,
    doctorId,
    clinicId,
    medications,
    diagnosis,
    notes,
    status,
    approvedAt,
    metadata
  });
}

export async function approvePrescription(prescriptionId, doctorId) {
  return invokeCareSync("approve_prescription", {
    prescriptionId,
    doctorId
  });
}

// ── Patients ────────────────────────────────────────────────

export async function getPatientByUserId(userId) {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function upsertPatient(patient) {
  const { data, error } = await supabase
    .from("patients")
    .upsert(patient, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Interview Sessions ──────────────────────────────────────

export async function createInterview({
  interviewId,
  appointmentId,
  encounterId,
  patientId,
  language,
  status = "in-progress",
  transcript = [],
  aiSummary = null,
  completedAt = null,
  metadata = {}
}) {
  return invokeCareSync("upsert_interview", {
    interviewId,
    appointmentId,
    encounterId,
    patientId,
    language,
    status: normalizeInterviewStatus(status),
    transcript,
    aiSummary,
    completedAt,
    metadata
  });
}

export async function updateInterview(interviewId, updates) {
  const normalizedStatus = normalizeInterviewStatus(
    updates?.status || updates?.completion_status || updates?.completionStatus
  );
  const completedAt =
    updates?.completed_at
    || updates?.completedAt
    || (normalizedStatus === "completed" ? new Date().toISOString() : null);

  return invokeCareSync("upsert_interview", {
    interviewId,
    appointmentId: updates?.appointmentId,
    encounterId: updates?.encounterId,
    patientId: updates?.patientId,
    language: updates?.language,
    status: normalizedStatus,
    transcript: updates?.transcript,
    aiSummary: updates?.ai_summary ?? updates?.aiSummary ?? null,
    completedAt,
    metadata: updates?.metadata || {}
  });
}

// ── User Profiles ───────────────────────────────────────────

export async function getDoctorsByClinic(clinicId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("role", "doctor")
    .eq("status", "active");
  if (error) throw error;
  return data;
}

export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Pre-Check Questionnaires ────────────────────────────────

export async function createPrecheckQuestionnaire({
  questionnaireId,
  appointmentId,
  encounterId,
  patientId,
  doctorId,
  clinicId,
  aiQuestions,
  editedQuestions = [],
  patientResponses = {},
  status = "ai_generated",
  doctorConfirmedAt = null,
  sentToPatientAt = null,
  patientCompletedAt = null,
  metadata = {}
}) {
  return invokeCareSync("upsert_precheck", {
    questionnaireId,
    appointmentId,
    encounterId,
    patientId,
    doctorId,
    clinicId,
    aiQuestions,
    editedQuestions,
    patientResponses,
    status,
    doctorConfirmedAt,
    sentToPatientAt,
    patientCompletedAt,
    metadata
  });
}

export async function getPrecheckQuestionnaire(questionnaireId) {
  const { data, error } = await supabase
    .from("pre_check_questionnaires")
    .select("*")
    .eq("id", questionnaireId)
    .single();
  if (error) throw error;
  return data;
}

export async function getPrecheckByEncounter(encounterId) {
  const { data, error } = await supabase
    .from("pre_check_questionnaires")
    .select("*")
    .eq("encounter_id", encounterId)
    .single();
  if (error) throw error;
  return data;
}

export async function updatePrecheckQuestions(questionnaireId, editedQuestions) {
  return invokeCareSync("upsert_precheck", {
    questionnaireId,
    editedQuestions,
    status: "doctor_editing"
  });
}

export async function confirmPrecheckQuestions(questionnaireId) {
  return invokeCareSync("upsert_precheck", {
    questionnaireId,
    status: "sent_to_patient",
    doctorConfirmedAt: new Date().toISOString(),
    sentToPatientAt: new Date().toISOString()
  });
}

export async function submitPrecheckResponses(questionnaireId, patientResponses) {
  return invokeCareSync("upsert_precheck", {
    questionnaireId,
    patientResponses,
    status: "completed",
    patientCompletedAt: new Date().toISOString()
  });
}

// ── Notifications ───────────────────────────────────────────

export async function createNotification({
  notificationId,
  userId,
  type,
  title,
  message,
  encounterId,
  questionnaireId,
  prescriptionId,
  appointmentId = null,
  metadata = {}
}) {
  return invokeCareSync("upsert_notification", {
    notificationId,
    userId,
    type,
    title,
    message,
    encounterId,
    questionnaireId,
    prescriptionId,
    appointmentId,
    metadata
  });
}

export async function upsertLabReport({
  reportId,
  appointmentId,
  encounterId,
  patientId,
  doctorId,
  clinicId,
  title,
  category,
  findings,
  resultSummary,
  status = "draft",
  metadata = {}
}) {
  return invokeCareSync("upsert_lab_report", {
    reportId,
    appointmentId,
    encounterId,
    patientId,
    doctorId,
    clinicId,
    title,
    category,
    findings,
    resultSummary,
    status,
    metadata
  });
}

export async function upsertTestOrder({
  orderId,
  appointmentId,
  encounterId,
  patientId,
  doctorId,
  clinicId,
  doctorName,
  tests,
  patientNote,
  status = "ordered",
  orderedAt = null,
  metadata = {}
}) {
  return invokeCareSync("upsert_test_order", {
    orderId,
    appointmentId,
    encounterId,
    patientId,
    doctorId,
    clinicId,
    doctorName,
    tests,
    patientNote,
    status,
    orderedAt,
    metadata
  });
}

export async function getUserNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function markNotificationAsRead(notificationId) {
  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
