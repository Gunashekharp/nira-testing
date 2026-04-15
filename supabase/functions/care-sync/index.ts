import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function asText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asUuid(value: unknown) {
  const text = asText(value);
  return text && UUID_RE.test(text) ? text : null;
}

function asNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asPlainObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function cleanRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}

function normalizeEncounterStatus(status: unknown) {
  switch (String(status || "").toLowerCase()) {
    case "awaiting_interview":
    case "planned":
      return "planned";
    case "checked_in":
    case "arrived":
      return "arrived";
    case "in_consult":
    case "in-progress":
      return "in-progress";
    case "ai_ready":
    case "draft":
      return "draft";
    case "approved":
    case "final":
      return "final";
    case "closed":
    case "cancelled":
      return "cancelled";
    default:
      return "planned";
  }
}

function normalizeInterviewStatus(status: unknown) {
  switch (String(status || "").toLowerCase()) {
    case "complete":
    case "completed":
      return "completed";
    case "abandoned":
    case "cancelled":
    case "closed":
      return "abandoned";
    default:
      return "in-progress";
  }
}

function normalizePrescriptionStatus(status: unknown) {
  switch (String(status || "").toLowerCase()) {
    case "active":
    case "approved":
      return "active";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "draft";
  }
}

function normalizeNotificationType(type: unknown) {
  const value = String(type || "").toLowerCase();
  const allowed = new Set([
    "appointment_booked",
    "precheck_questions_ready",
    "precheck_sent",
    "precheck_completed",
    "appointment_reminder",
    "appointment_missed",
    "prescription_approved",
    "tests_ordered",
    "lab_report_ready",
    "emr_updated",
  ]);
  return allowed.has(value) ? value : "emr_updated";
}

async function updateById(
  supabase: ReturnType<typeof createClient>,
  table: string,
  id: string,
  record: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from(table)
    .update(cleanRecord(record))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function upsertByExternalKey(
  supabase: ReturnType<typeof createClient>,
  table: string,
  conflictKey: string,
  record: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from(table)
    .upsert(cleanRecord(record), { onConflict: conflictKey })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function syncEncounter(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const appointmentKey = asText(payload.appointmentId);
  const encounterId = asUuid(payload.encounterId);
  const metadata = {
    ...asObject(payload.metadata),
    localStatus: String(payload.localStatus || payload.status || ""),
    bookingStatus: String(payload.bookingStatus || ""),
  };

  const record = {
    patient_id: asUuid(payload.patientId),
    doctor_id: asUuid(payload.doctorId),
    clinic_id: asUuid(payload.clinicId),
    status: normalizeEncounterStatus(payload.status),
    type: asText(payload.type) || "opd",
    scheduled_time: asText(payload.scheduledTime),
    check_in_time: asText(payload.checkInTime),
    completed_time: asText(payload.completedTime),
    chief_complaint: asText(payload.chiefComplaint),
    ai_prechart: payload.aiPrechart ?? undefined,
    doctor_notes: payload.doctorNotes ?? undefined,
    vitals: payload.vitals ?? undefined,
    token_number: asNumber(payload.tokenNumber),
    priority: asNumber(payload.priority),
    external_appointment_key: appointmentKey,
    external_patient_key: asText(payload.patientId),
    external_doctor_key: asText(payload.doctorId),
    external_clinic_key: asText(payload.clinicId),
    metadata,
  };

  if (encounterId) {
    return updateById(supabase, "encounters", encounterId, record);
  }

  if (!appointmentKey) {
    throw new Error("appointmentId or encounterId is required for encounter sync");
  }

  return upsertByExternalKey(supabase, "encounters", "external_appointment_key", record);
}

async function syncInterview(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const interviewId = asUuid(payload.interviewId);
  const externalInterviewKey = asText(payload.interviewId);
  const externalAppointmentKey = asText(payload.appointmentId);
  const record = {
    encounter_id: asUuid(payload.encounterId),
    patient_id: asUuid(payload.patientId),
    language: asText(payload.language) || "en",
    status: normalizeInterviewStatus(payload.status),
    transcript: asArray(payload.transcript),
    ai_summary: payload.aiSummary ?? null,
    completed_at: asText(payload.completedAt),
    external_interview_key: interviewId ? undefined : externalInterviewKey,
    external_appointment_key: externalAppointmentKey,
    external_patient_key: asText(payload.patientId),
    metadata: asObject(payload.metadata),
  };

  if (interviewId) {
    return updateById(supabase, "interview_sessions", interviewId, record);
  }

  if (externalAppointmentKey) {
    return upsertByExternalKey(
      supabase,
      "interview_sessions",
      "external_appointment_key",
      record
    );
  }

  if (externalInterviewKey) {
    return upsertByExternalKey(
      supabase,
      "interview_sessions",
      "external_interview_key",
      record
    );
  }

  throw new Error("appointmentId or interviewId is required for interview sync");
}

async function syncPrecheck(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const questionnaireId = asUuid(payload.questionnaireId);
  const externalQuestionnaireKey = asText(payload.questionnaireId);
  const record = {
    encounter_id: asUuid(payload.encounterId),
    patient_id: asUuid(payload.patientId),
    doctor_id: asUuid(payload.doctorId),
    clinic_id: asUuid(payload.clinicId),
    ai_questions: payload.aiQuestions ?? undefined,
    edited_questions: payload.editedQuestions ?? undefined,
    patient_responses: payload.patientResponses ?? undefined,
    status: asText(payload.status) || "ai_generated",
    doctor_confirmed_at: asText(payload.doctorConfirmedAt),
    sent_to_patient_at: asText(payload.sentToPatientAt),
    patient_completed_at: asText(payload.patientCompletedAt),
    external_questionnaire_key: questionnaireId ? undefined : externalQuestionnaireKey,
    external_appointment_key: asText(payload.appointmentId),
    external_patient_key: asText(payload.patientId),
    external_doctor_key: asText(payload.doctorId),
    external_clinic_key: asText(payload.clinicId),
    metadata: asObject(payload.metadata),
  };

  if (questionnaireId) {
    return updateById(supabase, "pre_check_questionnaires", questionnaireId, record);
  }

  if (!externalQuestionnaireKey) {
    throw new Error("questionnaireId is required for pre-check sync");
  }

  return upsertByExternalKey(
    supabase,
    "pre_check_questionnaires",
    "external_questionnaire_key",
    record
  );
}

async function syncPrescription(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const prescriptionId = asUuid(payload.prescriptionId);
  const externalPrescriptionKey = asText(payload.prescriptionId);
  const record = {
    encounter_id: asUuid(payload.encounterId),
    patient_id: asUuid(payload.patientId),
    doctor_id: asUuid(payload.doctorId),
    clinic_id: asUuid(payload.clinicId),
    status: normalizePrescriptionStatus(payload.status),
    medications: asArray(payload.medications),
    diagnosis: asText(payload.diagnosis),
    notes: asText(payload.notes),
    approved_at: asText(payload.approvedAt),
    external_prescription_key: prescriptionId ? undefined : externalPrescriptionKey,
    external_appointment_key: asText(payload.appointmentId),
    external_patient_key: asText(payload.patientId),
    external_doctor_key: asText(payload.doctorId),
    external_clinic_key: asText(payload.clinicId),
    metadata: asObject(payload.metadata),
  };

  if (prescriptionId) {
    return updateById(supabase, "medication_requests", prescriptionId, record);
  }

  if (!externalPrescriptionKey) {
    throw new Error("prescriptionId is required for prescription sync");
  }

  return upsertByExternalKey(
    supabase,
    "medication_requests",
    "external_prescription_key",
    record
  );
}

async function approvePrescriptionRecord(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const prescriptionId = asUuid(payload.prescriptionId) || asText(payload.prescriptionId);
  if (!prescriptionId) {
    throw new Error("prescriptionId is required for prescription approval");
  }

  let prescription;

  if (UUID_RE.test(prescriptionId)) {
    prescription = await updateById(supabase, "medication_requests", prescriptionId, {
      status: "active",
      approved_at: new Date().toISOString(),
      metadata: {
        approvedBy: asText(payload.doctorId),
      },
    });
  } else {
    prescription = await upsertByExternalKey(
      supabase,
      "medication_requests",
      "external_prescription_key",
      {
        external_prescription_key: prescriptionId,
        status: "active",
        approved_at: new Date().toISOString(),
        metadata: {
          approvedBy: asText(payload.doctorId),
        },
      }
    );
  }

  const encounterId = asUuid((prescription as Record<string, unknown>)?.encounter_id);
  if (encounterId) {
    await updateById(supabase, "encounters", encounterId, {
      status: "final",
      completed_time: new Date().toISOString(),
      metadata: {
        approvedPrescription: prescriptionId,
      },
    });
  }

  return prescription;
}

async function syncLabReport(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const reportKey = asText(payload.reportId);
  if (!reportKey) {
    throw new Error("reportId is required for lab report sync");
  }

  return upsertByExternalKey(supabase, "lab_reports", "external_report_key", {
    encounter_id: asUuid(payload.encounterId),
    patient_id: asUuid(payload.patientId),
    doctor_id: asUuid(payload.doctorId),
    clinic_id: asUuid(payload.clinicId),
    external_report_key: reportKey,
    external_appointment_key: asText(payload.appointmentId),
    external_patient_key: asText(payload.patientId),
    external_doctor_key: asText(payload.doctorId),
    external_clinic_key: asText(payload.clinicId),
    title: asText(payload.title) || "Clinical lab summary",
    category: asText(payload.category),
    findings: asText(payload.findings),
    result_summary: asText(payload.resultSummary),
    status: asText(payload.status) || "draft",
    metadata: asObject(payload.metadata),
  });
}

async function syncTestOrder(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const orderKey = asText(payload.orderId);
  if (!orderKey) {
    throw new Error("orderId is required for test order sync");
  }

  return upsertByExternalKey(supabase, "test_orders", "external_order_key", {
    encounter_id: asUuid(payload.encounterId),
    patient_id: asUuid(payload.patientId),
    doctor_id: asUuid(payload.doctorId),
    clinic_id: asUuid(payload.clinicId),
    external_order_key: orderKey,
    external_appointment_key: asText(payload.appointmentId),
    external_patient_key: asText(payload.patientId),
    external_doctor_key: asText(payload.doctorId),
    external_clinic_key: asText(payload.clinicId),
    doctor_name: asText(payload.doctorName),
    tests: asArray(payload.tests),
    patient_note: asText(payload.patientNote),
    status: asText(payload.status) || "ordered",
    ordered_at: asText(payload.orderedAt) || new Date().toISOString(),
    metadata: asObject(payload.metadata),
  });
}

async function syncNotification(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const notificationKey = asText(payload.notificationId);
  if (!notificationKey) {
    throw new Error("notificationId is required for notification sync");
  }

  return upsertByExternalKey(supabase, "notifications", "external_notification_key", {
    user_id: asUuid(payload.userId),
    type: normalizeNotificationType(payload.type),
    title: asText(payload.title) || "NIRA update",
    message: asText(payload.message),
    encounter_id: asUuid(payload.encounterId),
    questionnaire_id: asUuid(payload.questionnaireId),
    prescription_id: asUuid(payload.prescriptionId),
    external_notification_key: notificationKey,
    external_user_key: asText(payload.userId),
    external_appointment_key: asText(payload.appointmentId),
    metadata: asObject(payload.metadata),
  });
}

async function getAppStateSnapshot(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const snapshotKey = asText(payload.snapshotKey);
  if (!snapshotKey) {
    throw new Error("snapshotKey is required for app state snapshot reads");
  }

  const { data, error } = await supabase
    .from("app_state_snapshots")
    .select("snapshot_key, state, updated_at")
    .eq("snapshot_key", snapshotKey)
    .maybeSingle();

  if (error) throw error;

  return {
    snapshotKey,
    state: data?.state ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

async function upsertAppStateSnapshot(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  const snapshotKey = asText(payload.snapshotKey);
  if (!snapshotKey) {
    throw new Error("snapshotKey is required for app state snapshot writes");
  }

  const state = asPlainObject(payload.state);
  if (!state) {
    throw new Error("state object is required for app state snapshot writes");
  }

  const { data, error } = await supabase
    .from("app_state_snapshots")
    .upsert(
      {
        snapshot_key: snapshotKey,
        state,
      },
      { onConflict: "snapshot_key" }
    )
    .select("snapshot_key, state, updated_at")
    .single();

  if (error) throw error;

  return {
    snapshotKey: data.snapshot_key,
    state: data.state,
    updatedAt: data.updated_at,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body?.action || "").toLowerCase();

    let result;
    switch (action) {
      case "upsert_encounter":
        result = await syncEncounter(supabase, body);
        break;
      case "upsert_interview":
        result = await syncInterview(supabase, body);
        break;
      case "upsert_precheck":
        result = await syncPrecheck(supabase, body);
        break;
      case "upsert_prescription":
        result = await syncPrescription(supabase, body);
        break;
      case "approve_prescription":
        result = await approvePrescriptionRecord(supabase, body);
        break;
      case "upsert_lab_report":
        result = await syncLabReport(supabase, body);
        break;
      case "upsert_test_order":
        result = await syncTestOrder(supabase, body);
        break;
      case "upsert_notification":
        result = await syncNotification(supabase, body);
        break;
      case "get_app_state_snapshot":
        result = await getAppStateSnapshot(supabase, body);
        break;
      case "upsert_app_state_snapshot":
        result = await upsertAppStateSnapshot(supabase, body);
        break;
      default:
        return jsonResponse(400, { error: `Unsupported care-sync action: ${action}` });
    }

    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : "Care sync failed",
    });
  }
});
