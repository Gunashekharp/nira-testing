import { addDays, getTodayDayKey } from "../../lib/schedule";
import { getNextAvailableSlot, getScheduleLabel, listCollection } from "../../services/stateHelpers";

export const PATIENT_APPOINTMENT_BUCKETS = ["all", "upcoming", "action", "review", "completed", "cancelled"];

export function getRoleHomePath(role) {
  if (role === "patient") return "/patient";
  if (role === "doctor") return "/doctor";
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

  const collectionKey = user.role === "patient" ? "patients" : user.role === "doctor" ? "doctors" : "admins";
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

  return {
    appointment,
    patient,
    doctor,
    encounter,
    interview,
    draft: encounter?.apciDraft || null,
    review: encounter?.doctorReview || null,
    prescription
  };
}

function getPatientJourneyBucket(appointment, encounter, prescription) {
  if (appointment.bookingStatus === "cancelled") {
    return "cancelled";
  }

  if (appointment.bookingStatus === "completed" || encounter?.status === "approved" || prescription) {
    return "completed";
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

  if (bucket === "action") {
    return "Interview pending";
  }

  if (bucket === "review") {
    return encounterStatus === "in_consult" ? "Doctor reviewing" : "Submitted to doctor";
  }

  return "Upcoming visit";
}

function getInterviewStatus(appointment, interview, encounter) {
  if (!interview || interview.completionStatus === "pending") {
    return {
      key: "pending",
      label: "Not started / pending",
      description: "Complete the AI interview before the doctor reviews your visit."
    };
  }

  if (encounter?.status === "approved" || appointment.bookingStatus === "completed") {
    return {
      key: "reviewed",
      label: "Reviewed / completed",
      description: "The doctor has already used your AI intake and finished the visit."
    };
  }

  return {
    key: "submitted",
    label: "Submitted to doctor",
    description: "Your AI interview is complete and waiting in the doctor workspace."
  };
}

function buildPatientNextAction(appointmentItem) {
  if (appointmentItem.canStartInterview) {
    return {
      label: "Start AI interview",
      description: "Finish the pre-visit intake so the doctor receives your draft before the consultation.",
      to: `/patient/interview/${appointmentItem.id}`
    };
  }

  if (appointmentItem.canViewInterview) {
    return {
      label: "View interview summary",
      description: "Check the AI interview summary and current doctor review status.",
      to: `/patient/appointments/${appointmentItem.id}?bucket=${appointmentItem.journeyBucket}#interview-summary`
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
      to: "/patient/booking"
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
  const prescription =
    encounter?.prescriptionId
      ? state.prescriptions.byId[encounter.prescriptionId]
      : listCollection(state.prescriptions).find((item) => item.appointmentId === appointment.id) || null;
  const journeyBucket = getPatientJourneyBucket(appointment, encounter, prescription);
  const interviewStatus = getInterviewStatus(appointment, interview, encounter);

  const appointmentItem = {
    ...appointment,
    doctor,
    encounter,
    encounterStatus: encounter?.status || "awaiting_interview",
    interview,
    interviewStatus: interview?.completionStatus || "pending",
    interviewState: interviewStatus,
    prescription,
    prescriptionId: prescription?.id || null,
    journeyBucket,
    journeyLabel: getPatientJourneyLabel(journeyBucket, encounter?.status),
    canCancel: !["completed", "cancelled"].includes(appointment.bookingStatus),
    canStartInterview: encounter?.status === "awaiting_interview",
    canViewInterview: !!interview?.transcript?.length && ["ai_ready", "in_consult", "approved"].includes(encounter?.status),
    canViewPrescription: !!prescription
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
        completed: [],
        cancelled: []
      },
      bucketCounts: {
        all: 0,
        upcoming: 0,
        action: 0,
        review: 0,
        completed: 0,
        cancelled: 0
      },
      nextAppointment: null,
      pendingInterview: null,
      prescriptions: [],
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
    completed: appointments.filter((appointment) => appointment.journeyBucket === "completed"),
    cancelled: appointments.filter((appointment) => appointment.journeyBucket === "cancelled")
  };

  const bucketCounts = {
    all: appointmentsByBucket.all.length,
    upcoming: appointmentsByBucket.upcoming.length,
    action: appointmentsByBucket.action.length,
    review: appointmentsByBucket.review.length,
    completed: appointmentsByBucket.completed.length,
    cancelled: appointmentsByBucket.cancelled.length
  };

  const nextAppointment =
    appointmentsByBucket.upcoming[0] ||
    appointmentsByBucket.action[0] ||
    appointmentsByBucket.review[0] ||
    appointments.find((appointment) => appointment.bookingStatus !== "cancelled") ||
    null;
  const pendingInterview = appointmentsByBucket.action[0] || null;
  const prescriptions = listCollection(state.prescriptions)
    .filter((prescription) => prescription.patientId === patient.id)
    .sort((left, right) => new Date(right.issuedAt) - new Date(left.issuedAt));
  const nextRecommendedAction =
    appointmentsByBucket.action[0]?.nextAction ||
    appointmentsByBucket.review[0]?.nextAction ||
    appointmentsByBucket.upcoming[0]?.nextAction ||
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
      return {
        ...appointment,
        patient: state.patients.byId[appointment.patientId],
        interview: state.interviews.byId[`interview-${appointment.id}`],
        encounter,
        draft: encounter?.apciDraft || null,
        review: encounter?.doctorReview || null,
        queueStatus: encounter?.status || "awaiting_interview"
      };
    });

  return {
    doctor,
    appointments,
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
  const appointments = listCollection(state.appointments).sort(
    (left, right) => new Date(left.startAt) - new Date(right.startAt)
  );

  return {
    admin: getCurrentProfile(state),
    doctors,
    patients: listCollection(state.patients),
    appointments,
    pendingDoctors: doctors.filter((doctor) => doctor.status === "pending_approval"),
    counts: {
      doctors: doctors.length,
      pendingDoctors: doctors.filter((doctor) => doctor.status === "pending_approval").length,
      patients: state.patients.allIds.length,
      appointments: appointments.length
    }
  };
}
