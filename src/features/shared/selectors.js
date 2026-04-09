import { addDays, getTodayDayKey } from "../../lib/schedule";
import {
  DOCTOR_LAB_FILTERS,
  PATIENT_LAB_BUCKETS as PATIENT_LAB_BUCKET_KEYS,
  getDoctorLabStatusLabel,
  getLabOrderTone,
  getLabProgress,
  getPatientLabBucket,
  getPatientLabStatusLabel,
  isEditableLabOrder
} from "../../services/labHelpers";
import { getNextAvailableSlot, getScheduleLabel, listCollection } from "../../services/stateHelpers";

export const PATIENT_APPOINTMENT_BUCKETS = ["all", "upcoming", "action", "review", "completed", "cancelled"];
export const LAB_ORDER_BUCKETS = DOCTOR_LAB_FILTERS;
export const PATIENT_LAB_BUCKETS = PATIENT_LAB_BUCKET_KEYS;

export function getRoleHomePath(role) {
  if (role === "patient") return "/patient";
  if (role === "doctor") return "/doctor";
  if (role === "admin") return "/admin";
  if (role === "lab") return "/lab";
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

  if (user.role === "patient") return state.patients.byId[user.profileId] || null;
  if (user.role === "doctor") return state.doctors.byId[user.profileId] || null;
  if (user.role === "lab") return state.labs.byId[user.profileId] || null;
  return state.admins.byId[user.profileId] || null;
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

function getPrescriptionByAppointmentId(state, appointmentId, encounter) {
  if (encounter?.prescriptionId) {
    return state.prescriptions.byId[encounter.prescriptionId] || null;
  }

  return listCollection(state.prescriptions).find((item) => item.appointmentId === appointmentId) || null;
}

function getLabOrdersForAppointment(state, appointmentId) {
  return listCollection(state.labOrders)
    .filter((order) => order.appointmentId === appointmentId)
    .sort((left, right) => new Date(right.orderedAt || 0) - new Date(left.orderedAt || 0));
}

function getLabReportForOrder(state, order) {
  if (!order?.reportId) {
    return null;
  }

  return state.labReports.byId[order.reportId] || null;
}

function buildLabOrderBundle(state, order) {
  if (!order) {
    return null;
  }

  const report = getLabReportForOrder(state, order);
  const appointment = state.appointments.byId[order.appointmentId] || null;
  const patient = state.patients.byId[order.patientId] || null;
  const doctor = state.doctors.byId[order.doctorId] || null;
  const assignedLabUser =
    listCollection(state.users).find((user) => user.id === order.assignedLabUserId && user.role === "lab") || null;
  const assignedLabProfile = assignedLabUser ? state.labs.byId[assignedLabUser.profileId] || null : null;
  const tests = order.selectedTestIds.map((testId) => state.labCatalog.byId[testId]).filter(Boolean);

  return {
    ...order,
    appointment,
    patient,
    doctor,
    tests,
    report,
    assignedLabProfile,
    doctorStatusLabel: getDoctorLabStatusLabel(order.status),
    patientStatusLabel: getPatientLabStatusLabel(order.status),
    patientBucket: getPatientLabBucket(order.status),
    tone: getLabOrderTone(order.status),
    progress: getLabProgress(order.status),
    isEditable: isEditableLabOrder(order)
  };
}

export function getLabOrderBundle(state, labOrderId) {
  return buildLabOrderBundle(state, state.labOrders.byId[labOrderId] || null);
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
  const prescription = getPrescriptionByAppointmentId(state, appointmentId, encounter);
  const labOrders = getLabOrdersForAppointment(state, appointmentId).map((order) => buildLabOrderBundle(state, order));
  const latestCompletedLabOrder = labOrders.find((order) => order.report) || null;

  return {
    appointment,
    patient,
    doctor,
    encounter,
    interview,
    draft: encounter?.apciDraft || null,
    review: encounter?.doctorReview || null,
    prescription,
    labOrders,
    editableLabOrder: labOrders.find((order) => order.isEditable) || null,
    latestLabOrder: labOrders[0] || null,
    latestCompletedLabOrder,
    latestLabReport: latestCompletedLabOrder?.report || null
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

function getInterviewState(appointment, interview, encounter) {
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

  if (appointmentItem.canViewPrescription) {
    return {
      label: "View prescription",
      description: "Your doctor has approved the visit and the prescription is ready.",
      to: `/patient/prescriptions/${appointmentItem.prescriptionId}`
    };
  }

  if (appointmentItem.canViewLabReport) {
    return {
      label: "View lab report",
      description: "A completed lab report is ready to open and download.",
      to: `/patient/lab-reports/${appointmentItem.latestCompletedLabOrder.id}`
    };
  }

  if (appointmentItem.canViewInterview) {
    return {
      label: "View interview summary",
      description: "Check the AI interview summary and current doctor review status.",
      to: `/patient/appointments/${appointmentItem.id}?bucket=${appointmentItem.journeyBucket}#interview-summary`
    };
  }

  if (appointmentItem.bookingStatus === "cancelled") {
    return {
      label: "Book another appointment",
      description: "This visit is cancelled. You can rebook quickly with the same doctor.",
      to: `/patient/booking?doctorId=${appointmentItem.doctorId}`
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
  const prescription = getPrescriptionByAppointmentId(state, appointment.id, encounter);
  const labOrders = getLabOrdersForAppointment(state, appointment.id).map((order) => buildLabOrderBundle(state, order));
  const latestLabOrder = labOrders[0] || null;
  const latestCompletedLabOrder = labOrders.find((order) => order.report) || null;
  const latestLabReport = latestCompletedLabOrder?.report || null;
  const journeyBucket = getPatientJourneyBucket(appointment, encounter, prescription);
  const interviewState = getInterviewState(appointment, interview, encounter);

  const appointmentItem = {
    ...appointment,
    doctor,
    encounter,
    encounterStatus: encounter?.status || "awaiting_interview",
    interview,
    interviewStatus: interview?.completionStatus || "pending",
    interviewState,
    prescription,
    prescriptionId: prescription?.id || null,
    labOrders,
    latestLabOrder,
    latestCompletedLabOrder,
    latestLabStatus: latestLabOrder?.patientStatusLabel || "No lab request",
    latestLabReport,
    journeyBucket,
    journeyLabel: getPatientJourneyLabel(journeyBucket, encounter?.status),
    canCancel: !["completed", "cancelled"].includes(appointment.bookingStatus),
    canStartInterview: encounter?.status === "awaiting_interview",
    canViewInterview: !!interview?.transcript?.length && ["ai_ready", "in_consult", "approved"].includes(encounter?.status),
    canViewPrescription: !!prescription,
    canViewLabReport: !!latestCompletedLabOrder?.report
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
      labOrders: [],
      labReports: [],
      labCounts: {
        total: 0,
        yetToVisit: 0,
        sampleGiven: 0,
        completed: 0,
        cancelled: 0
      },
      labBuckets: {
        total: [],
        yet_to_visit: [],
        sample_given: [],
        completed: [],
        cancelled: []
      },
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
  const labOrders = listCollection(state.labOrders)
    .filter((order) => order.patientId === patient.id)
    .sort((left, right) => new Date(right.orderedAt || 0) - new Date(left.orderedAt || 0))
    .map((order) => buildLabOrderBundle(state, order));
  const activeLabOrders = labOrders.filter((order) => order.status !== "cancelled");
  const labBuckets = {
    total: activeLabOrders,
    yet_to_visit: activeLabOrders.filter((order) => order.patientBucket === "yet_to_visit"),
    sample_given: activeLabOrders.filter((order) => order.patientBucket === "sample_given"),
    completed: activeLabOrders.filter((order) => order.patientBucket === "completed"),
    cancelled: labOrders.filter((order) => order.status === "cancelled")
  };
  const labReports = listCollection(state.labReports)
    .filter((report) => report.patientId === patient.id)
    .sort((left, right) => new Date(right.completedAt || 0) - new Date(left.completedAt || 0));
  const labCounts = {
    total: labBuckets.total.length,
    yetToVisit: labBuckets.yet_to_visit.length,
    sampleGiven: labBuckets.sample_given.length,
    completed: labBuckets.completed.length,
    cancelled: labBuckets.cancelled.length
  };
  const completedLabOrder = labBuckets.completed[0] || null;
  const nextRecommendedAction =
    appointmentsByBucket.action[0]?.nextAction ||
    appointmentsByBucket.review[0]?.nextAction ||
    appointmentsByBucket.upcoming[0]?.nextAction ||
    appointmentsByBucket.completed[0]?.nextAction ||
    (completedLabOrder
      ? {
          label: "Open lab reports",
          description: "Completed lab reports are ready in the patient portal.",
          to: "/patient/lab-reports?bucket=completed"
        }
      : {
          label: "Book appointment",
          description: "Choose a doctor and a live slot to start the next visit.",
          to: "/patient/booking"
        });

  return {
    patient,
    appointments,
    appointmentsByBucket,
    bucketCounts,
    nextAppointment,
    pendingInterview,
    prescriptions,
    labOrders,
    labReports,
    labCounts,
    labBuckets,
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
      },
      labOrders: [],
      labCounts: {
        total: 0,
        ordered: 0,
        sampleReceived: 0,
        processing: 0,
        completed: 0,
        cancelled: 0
      }
    };
  }

  const appointments = listCollection(state.appointments)
    .filter((appointment) => appointment.doctorId === doctor.id && appointment.bookingStatus !== "cancelled")
    .sort((left, right) => new Date(left.startAt) - new Date(right.startAt))
    .map((appointment) => {
      const encounter = state.encounters.byId[`encounter-${appointment.id}`];
      const labOrders = getLabOrdersForAppointment(state, appointment.id).map((order) => buildLabOrderBundle(state, order));

      return {
        ...appointment,
        patient: state.patients.byId[appointment.patientId],
        interview: state.interviews.byId[`interview-${appointment.id}`],
        encounter,
        draft: encounter?.apciDraft || null,
        review: encounter?.doctorReview || null,
        queueStatus: encounter?.status || "awaiting_interview",
        labOrders,
        latestLabOrder: labOrders[0] || null,
        latestLabReport: labOrders.find((order) => order.report)?.report || null
      };
    });

  const labOrders = listCollection(state.labOrders)
    .filter((order) => order.doctorId === doctor.id)
    .sort((left, right) => new Date(right.orderedAt || 0) - new Date(left.orderedAt || 0))
    .map((order) => buildLabOrderBundle(state, order));

  return {
    doctor,
    appointments,
    queueCounts: {
      total: appointments.length,
      aiReady: appointments.filter((item) => item.queueStatus === "ai_ready").length,
      inConsult: appointments.filter((item) => item.queueStatus === "in_consult").length,
      approved: appointments.filter((item) => item.queueStatus === "approved").length
    },
    labOrders,
    labCounts: {
      total: labOrders.filter((order) => order.status !== "cancelled").length,
      ordered: labOrders.filter((order) => order.status === "ordered").length,
      sampleReceived: labOrders.filter((order) => order.status === "sample_received").length,
      processing: labOrders.filter((order) => order.status === "processing").length,
      completed: labOrders.filter((order) => order.status === "completed").length,
      cancelled: labOrders.filter((order) => order.status === "cancelled").length
    }
  };
}

export function getAdminWorkspace(state) {
  const doctors = listCollection(state.doctors);
  const appointments = listCollection(state.appointments).sort(
    (left, right) => new Date(left.startAt) - new Date(right.startAt)
  );
  const patients = listCollection(state.patients)
    .map((patient) => {
      const user = state.users.byId[patient.userId];
      const patientAppointments = appointments.filter((appointment) => appointment.patientId === patient.id);
      const patientLabOrders = listCollection(state.labOrders).filter((order) => order.patientId === patient.id);

      return {
        ...patient,
        userStatus: user?.status || "active",
        appointmentCount: patientAppointments.length,
        activeAppointmentCount: patientAppointments.filter((appointment) => appointment.bookingStatus !== "cancelled").length,
        labOrderCount: patientLabOrders.filter((order) => order.status !== "cancelled").length,
        completedLabReportCount: patientLabOrders.filter((order) => order.status === "completed").length
      };
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));

  return {
    admin: getCurrentProfile(state),
    doctors,
    patients,
    appointments,
    pendingDoctors: doctors.filter((doctor) => doctor.status === "pending_approval"),
    counts: {
      doctors: doctors.length,
      pendingDoctors: doctors.filter((doctor) => doctor.status === "pending_approval").length,
      patients: patients.length,
      appointments: appointments.length,
      labOrders: listCollection(state.labOrders).filter((order) => order.status !== "cancelled").length
    }
  };
}

export function getLabWorkspace(state) {
  const lab = getCurrentProfile(state);
  if (!lab) {
    return {
      lab: null,
      orders: [],
      ordersByBucket: {
        all: [],
        ordered: [],
        sample_received: [],
        processing: [],
        completed: [],
        cancelled: []
      },
      counts: {
        total: 0,
        ordered: 0,
        sampleReceived: 0,
        processing: 0,
        completed: 0,
        cancelled: 0
      }
    };
  }

  const orders = listCollection(state.labOrders)
    .sort((left, right) => new Date(right.orderedAt || 0) - new Date(left.orderedAt || 0))
    .map((order) => buildLabOrderBundle(state, order));

  return {
    lab,
    orders,
    ordersByBucket: {
      all: orders,
      ordered: orders.filter((order) => order.status === "ordered"),
      sample_received: orders.filter((order) => order.status === "sample_received"),
      processing: orders.filter((order) => order.status === "processing"),
      completed: orders.filter((order) => order.status === "completed"),
      cancelled: orders.filter((order) => order.status === "cancelled")
    },
    counts: {
      total: orders.filter((order) => order.status !== "cancelled").length,
      ordered: orders.filter((order) => order.status === "ordered").length,
      sampleReceived: orders.filter((order) => order.status === "sample_received").length,
      processing: orders.filter((order) => order.status === "processing").length,
      completed: orders.filter((order) => order.status === "completed").length,
      cancelled: orders.filter((order) => order.status === "cancelled").length
    }
  };
}
