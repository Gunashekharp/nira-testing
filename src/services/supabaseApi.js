import { supabase, supabaseConfigured } from "../lib/supabase";

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

export async function createEncounter({ patientId, doctorId, clinicId, scheduledTime, type, chiefComplaint }) {
  // Use Edge Function for full EMR integration
  const { data, error } = await supabase.functions.invoke("booking-to-emr", {
    body: { patientId, doctorId, clinicId, scheduledTime, type, chiefComplaint },
  });
  if (error) throw error;
  return data;
}

export async function updateEncounterStatus(encounterId, status) {
  const { data, error } = await supabase
    .from("encounters")
    .update({ status })
    .eq("id", encounterId)
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function createPrescription({ encounterId, patientId, doctorId, clinicId, medications, diagnosis, notes }) {
  const { data, error } = await supabase
    .from("medication_requests")
    .insert({ encounter_id: encounterId, patient_id: patientId, doctor_id: doctorId, clinic_id: clinicId, medications, diagnosis, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function approvePrescription(prescriptionId, doctorId) {
  const { data, error } = await supabase.functions.invoke("rx-approval", {
    body: { prescriptionId, action: "approve", doctorId },
  });
  if (error) throw error;
  return data;
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

export async function createInterview({ encounterId, patientId, language }) {
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({ encounter_id: encounterId, patient_id: patientId, language })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateInterview(interviewId, updates) {
  const { data, error } = await supabase
    .from("interview_sessions")
    .update(updates)
    .eq("id", interviewId)
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function createPrecheckQuestionnaire({ encounterId, patientId, doctorId, clinicId, aiQuestions }) {
  const { data, error } = await supabase
    .from("pre_check_questionnaires")
    .insert({
      encounter_id: encounterId,
      patient_id: patientId,
      doctor_id: doctorId,
      clinic_id: clinicId,
      ai_questions: aiQuestions,
      status: "ai_generated"
    })
    .select()
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
    .from("pre_check_questionnaires")
    .update({
      edited_questions: editedQuestions,
      status: "doctor_editing"
    })
    .eq("id", questionnaireId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function confirmPrecheckQuestions(questionnaireId) {
  const { data, error } = await supabase
    .from("pre_check_questionnaires")
    .update({
      status: "sent_to_patient",
      doctor_confirmed_at: new Date().toISOString(),
      sent_to_patient_at: new Date().toISOString()
    })
    .eq("id", questionnaireId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitPrecheckResponses(questionnaireId, patientResponses) {
  const { data, error } = await supabase
    .from("pre_check_questionnaires")
    .update({
      patient_responses: patientResponses,
      status: "completed",
      patient_completed_at: new Date().toISOString()
    })
    .eq("id", questionnaireId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Notifications ───────────────────────────────────────────

export async function createNotification({ userId, type, title, message, encounterId, questionnaireId, prescriptionId }) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      encounter_id: encounterId,
      questionnaire_id: questionnaireId,
      prescription_id: prescriptionId
    })
    .select()
    .single();
  if (error) throw error;
  return data;
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
