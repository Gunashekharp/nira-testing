import { addDays, getTodayDayKey } from "../../lib/schedule";
import { getNextAvailableSlot, getScheduleLabel, listCollection } from "../../services/stateHelpers";

export const PATIENT_APPOINTMENT_BUCKETS = ["all", "upcoming", "action", "review", "missed", "completed", "cancelled"];

function buildPatientBookingPath(doctorId, rescheduleAppointmentId = "") {
  const searchParams = new URLSearchParams();

  if (doctorId) {
    searchParams.set("doctorId", doctorId);
  }

  if (rescheduleAppointmentId) {
    searchParams.set("rescheduleAppointmentId", rescheduleAppointmentId);
  }

  const query = searchParams.toString();
  return query ? `/patient/booking?${query}` : "/patient/booking";
}

export function getRoleHomePath(role) {
  if (role === "patient") return "/patient";
  if (role === "doctor") return "/doctor";
  if (role === "nurse") return "/nurse";
  if (role === "admin") return "/admin";
  return "/auth";
}

export function hasAdminAccount(state) {
  return state.admins.allIds.length > 0;
}

export function getCurrentUser(state) {
  return state?.session?.userId ? state.users.byId[state.session.userId] : null;
}

export function getCurrentProfile(state) {
  const user = getCurrentUser(state);
  if (!user) {
    return null;
  }

  const collectionKey =
    user.role === "patient"
      ? "patients"
      : user.role === "doctor"
        ? "doctors"
        : user.role === "nurse"
          ? "nurses"
          : "admins";
  return state[collectionKey].byId[user.profileId] || null;
}

export function getDoctorSchedules(state, doctorId, days = 14, startDayKey = state.meta.today || getTodayDayKey()) {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(startDayKey, index);
    return state.daySchedules.byId[`schedule-${doctorId}-${date}`] || null;
  }).filter(Boolean);
}

export function getScheduleByDate(state, doctorId, date) {
  return state.daySchedules.byId[`schedule-${doctorId}-${date}`] || null;
}

export function getBookableDoctors(state) {
  return state.doctors.allIds
    .map((doctorId) => state.doctors.byId[doctorId])
    .filter((doctor) => doctor.status === "active" && doctor.acceptingAppointments)
    .map((doctor) => {
      const schedules = getDoctorSchedules(state, doctor.id, 14);
      const nextSchedule = schedules.find((schedule) => schedule.slotSummary.available > 0) || schedules[0] || null;
      const nextAvailableSlot = nextSchedule ? getNextAvailableSlot(nextSchedule) : null;

      return {
        ...doctor,
        nextSchedule,
        nextAvailableSlot,
        availabilityLabel: nextSchedule ? getScheduleLabel(nextSchedule) : "No schedule"
      };
    });
}

export function getAppointmentBundle(state, appointmentId) {
  const appointment = state.appointments.byId[appointmentId];
  if (!appointment) {
    return null;
  }

  const encounter = state.encounters.byId[`encounter-${appointmentId}`];
  const patient = state.patients.byId[appointment.patientId];
  const doctor = state.doctors.byId[appointment.doctorId];
  const interview = state.interviews.byId[`interview-${appointmentId}`];
  const prescription = encounter?.prescriptionId
    ? state.prescriptions.byId[encounter.prescriptionId]
    : listCollection(state.prescriptions).find((item) => item.appointmentId === appointmentId) || null;
  const labReport = listCollection(state.labReports)
    .filter((item) => item.appointmentId === appointmentId)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;
  const precheckQuestionnaire = listCollection(state.precheckQuestionnaires).find((item) => item.appointmentId === appointmentId) || null;
  const emrSync = state.emrSync?.byId?.[`emr-${appointmentId}`] || null;
  const dbSync = state.dbSync?.byId?.[`db-${appointmentId}`] || null;

  return {
    appointment,
    patient,
    doctor,
    encounter,
    interview,
    draft: encounter?.apciDraft || null,
    review: encounter?.doctorReview || null,
    prescription,
    labReport,
    precheckQuestionnaire,
    emrSync,
    dbSync
  };
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

function hasAppointmentEnded(appointment, reference = new Date(), defaultDurationMinutes = 15) {
  const endAtMs = getAppointmentEndAtMs(appointment, defaultDurationMinutes);
  return Number.isFinite(endAtMs) && endAtMs < reference.getTime();
}

function isMissedPatientAppointment(appointment, encounter, doctor, reference = new Date()) {
  if (!appointment || ["completed", "cancelled"].includes(appointment.bookingStatus)) {
    return false;
  }

  if (!["scheduled", "rescheduled"].includes(appointment.bookingStatus)) {
    return false;
  }

  if (encounter?.status === "approved") {
    return false;
  }

  return hasAppointmentEnded(appointment, reference, doctor?.slotDurationMinutes);
}

function getPatientJourneyBucket(appointment, encounter, prescription, doctor) {
  if (appointment.bookingStatus === "cancelled") {
    return "cancelled";
  }

  if (appointment.bookingStatus === "completed" || encounter?.status === "approved" || prescription) {
    return "completed";
  }

  if (isMissedPatientAppointment(appointment, encounter, doctor)) {
    return "missed";
  }

  if (encounter?.status === "awaiting_interview") {
    return "action";
  }

  if (["ai_ready", "in_consult"].includes(encounter?.status)) {
    return "review";
  }

  return "upcoming";
}

function getPatientJourneyLabel(bucket, encounterStatus) {
  if (bucket === "cancelled") {
    return "Cancelled";
  }

  if (bucket === "completed") {
    return "Prescription approved";
  }

  if (bucket === "missed") {
    return "Missed appointment";
  }

  if (bucket === "action") {
    return "Pre-check pending";
  }

  if (bucket === "review") {
    return encounterStatus === "in_consult" ? "Doctor reviewing" : "Submitted to doctor";
  }

  return "Upcoming visit";
}

function getInterviewStatus(appointment, encounter, precheckQuestionnaire) {
  if (precheckQuestionnaire?.status === "sent_to_patient") {
    return {
      key: "pending",
      label: "Pre-check pending",
      description: "Complete the pre-check before the doctor reviews your visit."
    };
  }

  if (precheckQuestionnaire?.status === "completed") {
    return {
      key: "submitted",
      label: "Submitted to doctor",
      description: "Your pre-check is complete and waiting in the doctor workspace."
    };
  }

  if (encounter?.status === "approved" || appointment.bookingStatus === "completed") {
    return {
      key: "reviewed",
      label: "Reviewed / completed",
      description: "The doctor has already used your pre-check summary and finished the visit."
    };
  }

  return {
    key: "none",
    label: "No pre-check",
    description: "No pre-check is available for this appointment yet."
  };
}

function buildPatientNextAction(appointmentItem) {
  if (appointmentItem.precheckQuestionnaire?.status === "sent_to_patient") {
    return {
      label: "Complete pre-check in chat",
      description: "Open your appointment details, then complete the doctor pre-check inside the chatbot.",
      to: `/patient/appointments/${appointmentItem.id}?bucket=${appointmentItem.journeyBucket}`
    };
  }

  if (appointmentItem.precheckQuestionnaire?.status === "completed") {
    return {
      label: "Pre-check completed",
      description: "Your answers are now synced and visible in the doctor workspace.",
      to: `/patient/appointments/${appointmentItem.id}?bucket=${appointmentItem.journeyBucket}`
    };
  }

  if (appointmentItem.canViewInterview) {
    return {
      label: "View pre-check summary",
      description: "Check the pre-check summary and current doctor review status.",
      to: `/patient/appointments/${appointmentItem.id}?bucket=${appointmentItem.journeyBucket}`
    };
  }

  if (appointmentItem.canViewPrescription) {
    return {
      label: "View prescription",
      description: "Your doctor has approved the visit and the prescription is ready.",
      to: `/patient/prescriptions/${appointmentItem.prescriptionId}`
    };
  }

  if (appointmentItem.bookingStatus === "cancelled") {
    return {
      label: "Book another appointment",
      description: "This visit is cancelled. You can book a new slot whenever you are ready.",
      to: buildPatientBookingPath(appointmentItem.doctorId)
    };
  }

  if (appointmentItem.journeyBucket === "missed") {
    return {
      label: "Reschedule appointment",
      description: "This slot has already passed. Choose a fresh time with the same doctor to continue care without losing track.",
      to: buildPatientBookingPath(appointmentItem.doctorId, appointmentItem.id)
    };
  }

  return {
    label: "View appointment details",
    description: "See booking information, care progress, and the next expected step.",
    to: `/patient/appointments/${appointmentItem.id}?bucket=${appointmentItem.journeyBucket}`
  };
}

function buildPatientAppointmentItem(state, appointment) {
  const encounter = state.encounters.byId[`encounter-${appointment.id}`] || null;
  const interview = state.interviews.byId[`interview-${appointment.id}`] || null;
  const doctor = state.doctors.byId[appointment.doctorId] || null;
  const precheckQuestionnaire = listCollection(state.precheckQuestionnaires).find((item) => item.appointmentId === appointment.id) || null;
  const prescription =
    encounter?.prescriptionId
      ? state.prescriptions.byId[encounter.prescriptionId]
      : listCollection(state.prescriptions).find((item) => item.appointmentId === appointment.id) || null;
  const testOrderCollection = state.testOrders || { allIds: [], byId: {} };
  const testOrder = testOrderCollection.byId[`tests-${appointment.id}`] || null;
  const hasTests = testOrder && ((testOrder.tests?.length || 0) > 0 || String(testOrder.patientNote || "").trim().length > 0);
  const journeyBucket = getPatientJourneyBucket(appointment, encounter, prescription, doctor);
  const interviewStatus = getInterviewStatus(appointment, encounter, precheckQuestionnaire);

  const appointmentItem = {
    ...appointment,
    doctor,
    encounter,
    encounterStatus: encounter?.status || "awaiting_interview",
    interview,
    interviewStatus: interview?.completionStatus || "pending",
    interviewState: interviewStatus,
    precheckQuestionnaire,
    prescription,
    prescriptionId: prescription?.id || null,
    testOrder: hasTests ? testOrder : null,
    journeyBucket,
    journeyLabel: getPatientJourneyLabel(journeyBucket, encounter?.status),
    canCancel:
      !["completed", "cancelled"].includes(appointment.bookingStatus) &&
      !hasAppointmentEnded(appointment, new Date(), doctor?.slotDurationMinutes),
    canStartInterview: precheckQuestionnaire?.status === "sent_to_patient",
    canViewInterview: precheckQuestionnaire?.status === "completed" || interview?.completionStatus === "complete",
    canViewPrescription: !!prescription,
    canViewTests: !!hasTests
  };

  return {
    ...appointmentItem,
    nextAction: buildPatientNextAction(appointmentItem)
  };
}

export function getPatientAppointmentById(state, appointmentId) {
  const appointment = state.appointments.byId[appointmentId];
  if (!appointment) {
    return null;
  }

  return buildPatientAppointmentItem(state, appointment);
}

export function getPatientReschedulePath(appointment) {
  return buildPatientBookingPath(appointment?.doctorId, appointment?.id);
}

export function getPatientWorkspace(state) {
  const patient = getCurrentProfile(state);
  if (!patient) {
    return {
      patient: null,
      appointments: [],
      appointmentsByBucket: {
        all: [],
        upcoming: [],
        action: [],
        review: [],
        missed: [],
        completed: [],
        cancelled: []
      },
      bucketCounts: {
        all: 0,
        upcoming: 0,
        action: 0,
        review: 0,
        missed: 0,
        completed: 0,
        cancelled: 0
      },
      nextAppointment: null,
      pendingInterview: null,
      prescriptions: [],
      testOrders: [],
      notifications: [],
      unreadNotificationCount: 0,
      pendingPrecheckQuestionnaire: null,
      nextRecommendedAction: {
        label: "Book appointment",
        description: "Start by choosing a doctor and a live available slot.",
        to: "/patient/booking"
      }
    };
  }

  const appointments = listCollection(state.appointments)
    .filter((appointment) => appointment.patientId === patient.id)
    .sort((left, right) => new Date(left.startAt) - new Date(right.startAt))
    .map((appointment) => buildPatientAppointmentItem(state, appointment));

  const appointmentsByBucket = {
    all: appointments,
    upcoming: appointments.filter((appointment) => appointment.journeyBucket === "upcoming"),
    action: appointments.filter((appointment) => appointment.journeyBucket === "action"),
    review: appointments.filter((appointment) => appointment.journeyBucket === "review"),
    missed: appointments.filter((appointment) => appointment.journeyBucket === "missed"),
    completed: appointments.filter((appointment) => appointment.journeyBucket === "completed"),
    cancelled: appointments.filter((appointment) => appointment.journeyBucket === "cancelled")
  };

  const bucketCounts = {
    all: appointmentsByBucket.all.length,
    upcoming: appointmentsByBucket.upcoming.length,
    action: appointmentsByBucket.action.length,
    review: appointmentsByBucket.review.length,
    missed: appointmentsByBucket.missed.length,
    completed: appointmentsByBucket.completed.length,
    cancelled: appointmentsByBucket.cancelled.length
  };

  const nextAppointment =
    appointmentsByBucket.upcoming[0] ||
    appointmentsByBucket.action[0] ||
    appointmentsByBucket.review[0] ||
    appointmentsByBucket.completed[0] ||
    null;
  const pendingInterview = appointmentsByBucket.action[0] || null;
  const prescriptions = listCollection(state.prescriptions)
    .filter((prescription) => prescription.patientId === patient.id)
    .sort((left, right) => new Date(right.issuedAt) - new Date(left.issuedAt));
  const labReports = listCollection(state.labReports)
    .filter((report) => report.patientId === patient.id)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  const testOrders = listCollection(state.testOrders || { allIds: [], byId: {} })
    .filter((order) => {
      if (order.patientId !== patient.id) return false;
      const hasTests = (order.tests?.length ?? 0) > 0;
      const hasNote = String(order.patientNote || "").trim().length > 0;
      return hasTests || hasNote;
    })
    .sort((left, right) => new Date(right.orderedAt || 0) - new Date(left.orderedAt || 0));
  const notifications = listCollection(state.notifications)
    .filter((notification) => notification.userId === patient.userId)
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
  const unreadNotificationCount = notifications.filter((notification) => !notification.is_read).length;
  const pendingPrecheckQuestionnaire = listCollection(state.precheckQuestionnaires)
    .filter((questionnaire) => questionnaire.patientId === patient.id)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
    .find((questionnaire) => questionnaire.status === "sent_to_patient") || null;
  const nextRecommendedAction =
    appointmentsByBucket.action[0]?.nextAction ||
    appointmentsByBucket.review[0]?.nextAction ||
    appointmentsByBucket.upcoming[0]?.nextAction ||
    appointmentsByBucket.missed[0]?.nextAction ||
    appointmentsByBucket.completed[0]?.nextAction || {
      label: "Book appointment",
      description: "Choose a doctor and a live slot to start the next visit.",
      to: "/patient/booking"
    };

  return {
    patient,
    appointments,
    appointmentsByBucket,
    bucketCounts,
    nextAppointment,
    pendingInterview,
    prescriptions,
    labReports,
    testOrders,
    notifications,
    unreadNotificationCount,
    pendingPrecheckQuestionnaire,
    nextRecommendedAction
  };
}

export function getDoctorWorkspace(state) {
  const doctor = getCurrentProfile(state);
  if (!doctor) {
    return {
      doctor: null,
      appointments: [],
      queueCounts: {
        total: 0,
        aiReady: 0,
        inConsult: 0,
        approved: 0
      }
    };
  }

  const appointments = listCollection(state.appointments)
    .filter((appointment) => appointment.doctorId === doctor.id && appointment.bookingStatus !== "cancelled")
    .sort((left, right) => new Date(left.startAt) - new Date(right.startAt))
    .map((appointment) => {
      const encounter = state.encounters.byId[`encounter-${appointment.id}`];
      const labReport = listCollection(state.labReports)
        .filter((report) => report.appointmentId === appointment.id)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0] || null;
      const emrSync = state.emrSync?.byId?.[`emr-${appointment.id}`] || null;
      const dbSync = state.dbSync?.byId?.[`db-${appointment.id}`] || null;
      return {
        ...appointment,
        patient: state.patients.byId[appointment.patientId],
        interview: state.interviews.byId[`interview-${appointment.id}`],
        encounter,
        labReport,
        emrSync,
        dbSync,
        draft: encounter?.apciDraft || null,
        review: encounter?.doctorReview || null,
        queueStatus: encounter?.status || "awaiting_interview"
      };
    });

  const labReports = listCollection(state.labReports)
    .filter((report) => report.doctorId === doctor.id)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  return {
    doctor,
    appointments,
    labReports,
    queueCounts: {
      total: appointments.length,
      aiReady: appointments.filter((item) => item.queueStatus === "ai_ready").length,
      inConsult: appointments.filter((item) => item.queueStatus === "in_consult").length,
      approved: appointments.filter((item) => item.queueStatus === "approved").length
    }
  };
}

export function getAdminWorkspace(state) {
  const doctors = listCollection(state.doctors);
  const admins = listCollection(state.admins);
  const appointments = listCollection(state.appointments).sort(
    (left, right) => new Date(left.startAt) - new Date(right.startAt)
  );

  return {
    admin: getCurrentProfile(state),
    admins,
    doctors,
    patients: listCollection(state.patients),
    appointments,
    pendingDoctors: doctors.filter((doctor) => doctor.status === "pending_approval"),
    counts: {
      admins: admins.length,
      doctors: doctors.length,
      pendingDoctors: doctors.filter((doctor) => doctor.status === "pending_approval").length,
      patients: state.patients.allIds.length,
      appointments: appointments.length
    }
  };
}
