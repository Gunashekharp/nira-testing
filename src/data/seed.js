import "./contracts";
import { toIsoDateTime, addDays, getTodayDayKey } from "../lib/schedule";
import { emptyEncounterDraft } from "../services/clinicalHelpers";
import {
  createDayRule,
  createWeeklyRules,
  indexCollection,
  syncAllDoctorDaySchedules,
  upsertEntity
} from "../services/stateHelpers";

function nowIso() {
  return new Date().toISOString();
}

function createUser(id, role, profileId, values) {
  return {
    id,
    role,
    status: values.status || "active",
    phone: values.phone || "",
    email: values.email || "",
    password: values.password,
    profileId,
    createdAt: values.createdAt || nowIso(),
    lastLoginAt: null
  };
}

function createPatient(id, userId, values) {
  return {
    id,
    userId,
    fullName: values.fullName,
    preferredLanguage: values.preferredLanguage || "en",
    age: values.age ?? null,
    gender: values.gender || "",
    city: values.city || "",
    phone: values.phone || "",
    email: values.email || "",
    abhaNumber: values.abhaNumber || "",
    emergencyContactName: values.emergencyContactName || "",
    emergencyContactPhone: values.emergencyContactPhone || "",
    notes: values.notes || ""
  };
}

function createDoctor(id, userId, values) {
  return {
    id,
    userId,
    fullName: values.fullName,
    specialty: values.specialty,
    clinic: values.clinic || "NIRA Pilot Clinic",
    licenseNumber: values.licenseNumber,
    status: values.status || "active",
    acceptingAppointments: values.acceptingAppointments ?? values.status === "active",
    slotDurationMinutes: values.slotDurationMinutes || 15,
    phone: values.phone || "",
    email: values.email || "",
    bio: values.bio || "",
    gender: values.gender || ""
  };
}

function createAdmin(id, userId, values) {
  return {
    id,
    userId,
    fullName: values.fullName,
    clinicName: values.clinicName || "NIRA Pilot Clinic",
    phone: values.phone || "",
    email: values.email || ""
  };
}

function createTemplate(doctorId, slotDurationMinutes, weeklyRules) {
  return {
    id: doctorId,
    doctorId,
    defaultSlotDurationMinutes: slotDurationMinutes,
    weeklyRules
  };
}

function createInterview(appointmentId, language, transcript, extractedFindings, completionStatus = "complete") {
  return {
    id: `interview-${appointmentId}`,
    appointmentId,
    language,
    transcript,
    extractedFindings,
    completionStatus
  };
}

function createEncounter(id, appointmentId, doctorId, patientId, interviewId, status, draft, review = null, prescriptionId = null) {
  return {
    id,
    appointmentId,
    doctorId,
    patientId,
    interviewId,
    status,
    apciDraft: draft,
    doctorReview:
      review || {
        draftId: draft.id,
        editedFields: [],
        note: "",
        reviewedAt: null,
        approved: false
      },
    finalClinicalNote: "",
    alerts: draft.alerts,
    confidenceMap: draft.confidenceMap,
    prescriptionId,
    approvedAt: null
  };
}

function baseState() {
  return {
    meta: {
      version: "v2",
      lastSyncedAt: nowIso(),
      today: getTodayDayKey()
    },
    session: {
      userId: null,
      role: null,
      isAuthenticated: false,
      activeProfileId: null,
      identifier: ""
    },
    users: indexCollection([]),
    patients: indexCollection([]),
    doctors: indexCollection([]),
    admins: indexCollection([]),
    appointments: indexCollection([]),
    interviews: indexCollection([]),
    encounters: indexCollection([]),
    prescriptions: indexCollection([]),
    scheduleTemplates: indexCollection([]),
    scheduleOverrides: indexCollection([]),
    daySchedules: indexCollection([]),
    ui: {
      lastViewedAppointmentId: null
    }
  };
}

function addAppointmentBundle(state, bundle) {
  upsertEntity(state.appointments, bundle.appointment);
  upsertEntity(state.interviews, bundle.interview);
  upsertEntity(state.encounters, bundle.encounter);
  if (bundle.prescription) {
    upsertEntity(state.prescriptions, bundle.prescription);
  }
}

function createAppointmentBundle(values) {
  const prescriptionId = values.prescription ? `rx-${values.id}` : null;
  const encounterDraft = values.draft || emptyEncounterDraft(values.headline);

  const encounter = createEncounter(
    `encounter-${values.id}`,
    values.id,
    values.doctorId,
    values.patientId,
    `interview-${values.id}`,
    values.encounterStatus,
    encounterDraft,
    values.review || null,
    prescriptionId
  );

  if (values.review?.approved) {
    encounter.approvedAt = values.review.reviewedAt;
    encounter.finalClinicalNote = values.review.note || values.headline;
  }

  return {
    appointment: {
      id: values.id,
      slotId: values.slotId,
      doctorId: values.doctorId,
      patientId: values.patientId,
      bookedByUserId: values.bookedByUserId,
      visitType: values.visitType,
      bookingStatus: values.bookingStatus,
      rescheduleHistory: [],
      token: values.token,
      startAt: values.startAt,
      endAt: values.endAt
    },
    interview: createInterview(
      values.id,
      values.language,
      values.transcript,
      values.extractedFindings,
      values.interviewStatus
    ),
    encounter,
    prescription: values.prescription
      ? {
          id: prescriptionId,
          appointmentId: values.id,
          patientId: values.patientId,
          doctorId: values.doctorId,
          medicines: values.prescription.medicines,
          warnings: values.prescription.warnings,
          followUpNote: values.prescription.followUpNote,
          issuedAt: values.prescription.issuedAt
        }
      : null
  };
}

export function createSeedState() {
  const state = baseState();
  const today = state.meta.today;
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  const adminUser = createUser("user-admin-primary", "admin", "admin-primary", {
    phone: "+91 90000 10000",
    email: "admin@nira.local",
    password: "Admin@123"
  });
  const adminProfile = createAdmin("admin-primary", adminUser.id, {
    fullName: "Clinic Administrator",
    clinicName: "NIRA Pilot Clinic",
    phone: adminUser.phone,
    email: adminUser.email
  });

  const doctorUsers = [
    createUser("user-doc-mehra", "doctor", "doctor-mehra", {
      phone: "+91 91000 10001",
      email: "nisha.mehra@nira.local",
      password: "Doctor@123",
      status: "active"
    }),
    createUser("user-doc-raman", "doctor", "doctor-raman", {
      phone: "+91 91000 10002",
      email: "arjun.raman@nira.local",
      password: "Doctor@123",
      status: "active"
    }),
    createUser("user-doc-khan", "doctor", "doctor-khan", {
      phone: "+91 91000 10003",
      email: "sana.khan@nira.local",
      password: "Doctor@123",
      status: "active"
    }),
    createUser("user-doc-ali", "doctor", "doctor-ali", {
      phone: "+91 91000 10004",
      email: "farah.ali@nira.local",
      password: "Doctor@123",
      status: "pending_approval"
    })
  ];

  const doctors = [
    createDoctor("doctor-mehra", doctorUsers[0].id, {
      fullName: "Dr. Nisha Mehra",
      specialty: "Internal Medicine",
      clinic: "NIRA Pilot Clinic",
      licenseNumber: "KMC-INT-22871",
      status: "active",
      acceptingAppointments: true,
      slotDurationMinutes: 15,
      phone: doctorUsers[0].phone,
      email: doctorUsers[0].email,
      bio: "Internal medicine specialist for OPD triage and follow-up care."
    }),
    createDoctor("doctor-raman", doctorUsers[1].id, {
      fullName: "Dr. Arjun Raman",
      specialty: "Family Medicine",
      clinic: "NIRA Pilot Clinic",
      licenseNumber: "KMC-FAM-17302",
      status: "active",
      acceptingAppointments: true,
      slotDurationMinutes: 20,
      phone: doctorUsers[1].phone,
      email: doctorUsers[1].email,
      bio: "Family physician focusing on hypertension, diabetes, and continuity care."
    }),
    createDoctor("doctor-khan", doctorUsers[2].id, {
      fullName: "Dr. Sana Khan",
      specialty: "General Practice",
      clinic: "NIRA Pilot Clinic",
      licenseNumber: "KMC-GP-19544",
      status: "active",
      acceptingAppointments: true,
      slotDurationMinutes: 15,
      phone: doctorUsers[2].phone,
      email: doctorUsers[2].email,
      bio: "General practitioner for acute OPD visits and patient education."
    }),
    createDoctor("doctor-ali", doctorUsers[3].id, {
      fullName: "Dr. Farah Ali",
      specialty: "General Medicine",
      clinic: "NIRA Pilot Clinic",
      licenseNumber: "KMC-GM-28419",
      status: "pending_approval",
      acceptingAppointments: false,
      slotDurationMinutes: 15,
      phone: doctorUsers[3].phone,
      email: doctorUsers[3].email,
      bio: "Recently self-registered doctor waiting for approval."
    })
  ];

  const patientUsers = [
    createUser("user-patient-aasha", "patient", "patient-aasha", {
      phone: "+91 98765 43210",
      email: "aasha@nira.local",
      password: "Patient@123"
    }),
    createUser("user-patient-rohan", "patient", "patient-rohan", {
      phone: "+91 99887 56432",
      email: "rohan@nira.local",
      password: "Patient@123"
    }),
    createUser("user-patient-meena", "patient", "patient-meena", {
      phone: "+91 91230 44322",
      email: "meena@nira.local",
      password: "Patient@123"
    }),
    createUser("user-patient-pranav", "patient", "patient-pranav", {
      phone: "+91 98444 21009",
      email: "pranav@nira.local",
      password: "Patient@123"
    }),
    createUser("user-patient-imran", "patient", "patient-imran", {
      phone: "+91 97654 31209",
      email: "imran@nira.local",
      password: "Patient@123"
    }),
    createUser("user-patient-anika", "patient", "patient-anika", {
      phone: "+91 98112 14567",
      email: "anika@nira.local",
      password: "Patient@123"
    })
  ];

  const patients = [
    createPatient("patient-aasha", patientUsers[0].id, {
      fullName: "Aasha Verma",
      preferredLanguage: "hi",
      age: 32,
      gender: "Female",
      city: "Bengaluru",
      phone: patientUsers[0].phone,
      email: patientUsers[0].email,
      abhaNumber: "91-4578-2234-1102",
      emergencyContactName: "Ravi Verma",
      emergencyContactPhone: "+91 98765 43211",
      notes: "Acute gastritis history"
    }),
    createPatient("patient-rohan", patientUsers[1].id, {
      fullName: "Rohan Iyer",
      preferredLanguage: "en",
      age: 41,
      gender: "Male",
      city: "Bengaluru",
      phone: patientUsers[1].phone,
      email: patientUsers[1].email,
      abhaNumber: "91-4480-9234-4581",
      emergencyContactName: "Lakshmi Iyer",
      emergencyContactPhone: "+91 99887 56433",
      notes: "Hypertension follow-up"
    }),
    createPatient("patient-meena", patientUsers[2].id, {
      fullName: "Meena Joshi",
      preferredLanguage: "hi",
      age: 36,
      gender: "Female",
      city: "Bengaluru",
      phone: patientUsers[2].phone,
      email: patientUsers[2].email,
      abhaNumber: "91-5501-7610-8872"
    }),
    createPatient("patient-pranav", patientUsers[3].id, {
      fullName: "Pranav Sen",
      preferredLanguage: "en",
      age: 34,
      gender: "Male",
      city: "Bengaluru",
      phone: patientUsers[3].phone,
      email: patientUsers[3].email,
      abhaNumber: "91-3355-9012-3334"
    }),
    createPatient("patient-imran", patientUsers[4].id, {
      fullName: "Imran Sheikh",
      preferredLanguage: "en",
      age: 55,
      gender: "Male",
      city: "Bengaluru",
      phone: patientUsers[4].phone,
      email: patientUsers[4].email,
      abhaNumber: "91-3124-1876-9990"
    }),
    createPatient("patient-anika", patientUsers[5].id, {
      fullName: "Anika Das",
      preferredLanguage: "en",
      age: 8,
      gender: "Female",
      city: "Bengaluru",
      phone: patientUsers[5].phone,
      email: patientUsers[5].email
    })
  ];

  const templates = [
    createTemplate(
      "doctor-mehra",
      15,
      createWeeklyRules({
        monday: createDayRule(true, "09:00", "17:00", [{ startTime: "13:00", endTime: "14:00" }]),
        tuesday: createDayRule(true, "09:00", "17:00", [{ startTime: "13:00", endTime: "14:00" }]),
        wednesday: createDayRule(true, "09:00", "17:00", [{ startTime: "13:00", endTime: "14:00" }]),
        thursday: createDayRule(true, "09:00", "17:00", [{ startTime: "13:00", endTime: "14:00" }]),
        friday: createDayRule(true, "09:00", "17:00", [{ startTime: "13:00", endTime: "14:00" }]),
        saturday: createDayRule(true, "09:00", "12:00", [])
      })
    ),
    createTemplate(
      "doctor-raman",
      20,
      createWeeklyRules({
        monday: createDayRule(true, "10:00", "18:00", [{ startTime: "14:00", endTime: "15:00" }]),
        tuesday: createDayRule(true, "10:00", "18:00", [{ startTime: "14:00", endTime: "15:00" }]),
        wednesday: createDayRule(true, "10:00", "18:00", [{ startTime: "14:00", endTime: "15:00" }]),
        thursday: createDayRule(true, "10:00", "18:00", [{ startTime: "14:00", endTime: "15:00" }]),
        friday: createDayRule(true, "10:00", "18:00", [{ startTime: "14:00", endTime: "15:00" }]),
        saturday: createDayRule(true, "10:00", "13:00", [])
      })
    ),
    createTemplate(
      "doctor-khan",
      15,
      createWeeklyRules({
        monday: createDayRule(true, "11:00", "19:00", [{ startTime: "15:00", endTime: "16:00" }]),
        tuesday: createDayRule(true, "11:00", "19:00", [{ startTime: "15:00", endTime: "16:00" }]),
        wednesday: createDayRule(true, "11:00", "19:00", [{ startTime: "15:00", endTime: "16:00" }]),
        thursday: createDayRule(true, "11:00", "19:00", [{ startTime: "15:00", endTime: "16:00" }]),
        friday: createDayRule(true, "11:00", "19:00", [{ startTime: "15:00", endTime: "16:00" }]),
        saturday: createDayRule(true, "10:00", "13:00", [])
      })
    ),
    createTemplate(
      "doctor-ali",
      15,
      createWeeklyRules({
        monday: createDayRule(true, "10:00", "14:00", []),
        tuesday: createDayRule(true, "10:00", "14:00", []),
        wednesday: createDayRule(true, "10:00", "14:00", []),
        thursday: createDayRule(true, "10:00", "14:00", []),
        friday: createDayRule(true, "10:00", "14:00", []),
        saturday: createDayRule(false, "10:00", "14:00", [])
      })
    )
  ];

  state.users = indexCollection([adminUser, ...doctorUsers, ...patientUsers]);
  state.admins = indexCollection([adminProfile]);
  state.doctors = indexCollection(doctors);
  state.patients = indexCollection(patients);
  state.scheduleTemplates = indexCollection(templates);
  state.scheduleOverrides = indexCollection([
    {
      id: `override-doctor-mehra-${addDays(today, 2)}`,
      doctorId: "doctor-mehra",
      date: addDays(today, 2),
      mode: "custom",
      closedReason: "",
      customRule: createDayRule(true, "10:00", "16:00", [{ startTime: "13:00", endTime: "13:30" }]),
      slotStatuses: {
        [`slot-doctor-mehra-${addDays(today, 2)}-10:45`]: "unavailable"
      }
    },
    {
      id: `override-doctor-khan-${tomorrow}`,
      doctorId: "doctor-khan",
      date: tomorrow,
      mode: "closed",
      closedReason: "Doctor on leave",
      customRule: null,
      slotStatuses: {}
    }
  ]);

  addAppointmentBundle(
    state,
    createAppointmentBundle({
      id: "appointment-aasha",
      slotId: `slot-doctor-mehra-${today}-09:15`,
      doctorId: "doctor-mehra",
      patientId: "patient-aasha",
      bookedByUserId: patientUsers[0].id,
      visitType: "booked",
      bookingStatus: "scheduled",
      token: "A12",
      startAt: toIsoDateTime(today, "09:15"),
      endAt: toIsoDateTime(today, "09:30"),
      encounterStatus: "ai_ready",
      language: "hi",
      interviewStatus: "complete",
      transcript: [
        { role: "ai", text: "नमस्ते, आज किस परेशानी के लिए आए हैं?" },
        { role: "patient", text: "पिछले दो दिन से पेट में जलन और उलझन है।" },
        { role: "ai", text: "क्या खाना खाने के बाद बढ़ता है?" },
        { role: "patient", text: "हाँ, खासकर मसालेदार खाना खाने के बाद।" }
      ],
      extractedFindings: ["Epigastric burning", "Post-meal worsening", "Nausea"],
      draft: {
        ...emptyEncounterDraft("Burning abdominal discomfort for 2 days"),
        id: "draft-appointment-aasha",
        appointmentId: "appointment-aasha",
        soap: {
          chiefComplaint: "Burning abdominal discomfort for 2 days",
          subjective: "Patient reports epigastric burning with nausea, worse after spicy meals. No vomiting or melena.",
          objective: "Appears mildly uncomfortable. Vitals are stable.",
          assessment: "Likely acute gastritis; reflux flare remains possible.",
          plan: "Hydration advice, acid suppression, avoid trigger foods, review response in 5 days."
        },
        vitals: {
          temperature: "98.4 F",
          pulse: "84 bpm",
          bloodPressure: "118/76 mmHg",
          spo2: "99%"
        },
        diagnoses: [
          { label: "Acute gastritis", code: "K29.00", confidence: 0.92 },
          { label: "Gastro-esophageal reflux disease", code: "K21.9", confidence: 0.64 }
        ],
        confidenceMap: { subjective: 0.93, objective: 0.74, assessment: 0.88, plan: 0.82 },
        alerts: ["Check NSAID use before approving acid-suppressing therapy."],
        medicationSuggestions: [
          {
            name: "Pantoprazole",
            dosage: "40 mg",
            frequency: "Once daily before breakfast",
            duration: "5 days",
            rationale: "Reduce gastric acid irritation"
          },
          {
            name: "Antacid suspension",
            dosage: "10 mL",
            frequency: "After meals as needed",
            duration: "3 days",
            rationale: "Rapid relief of burning"
          }
        ],
        differentials: ["GERD", "Acute dyspepsia", "Peptic irritation"]
      }
    })
  );

  addAppointmentBundle(
    state,
    createAppointmentBundle({
      id: "appointment-rohan",
      slotId: `slot-doctor-raman-${today}-10:00`,
      doctorId: "doctor-raman",
      patientId: "patient-rohan",
      bookedByUserId: patientUsers[1].id,
      visitType: "booked",
      bookingStatus: "completed",
      token: "B03",
      startAt: toIsoDateTime(today, "10:00"),
      endAt: toIsoDateTime(today, "10:20"),
      encounterStatus: "approved",
      language: "en",
      interviewStatus: "complete",
      transcript: [
        { role: "ai", text: "How have your blood pressure readings been this week?" },
        { role: "patient", text: "Mostly around 150 over 92 and I felt a mild headache yesterday." }
      ],
      extractedFindings: ["Home BP elevated", "Mild headache", "Partial medication adherence"],
      draft: {
        ...emptyEncounterDraft("Hypertension follow-up with elevated home readings"),
        id: "draft-appointment-rohan",
        appointmentId: "appointment-rohan",
        soap: {
          chiefComplaint: "Hypertension follow-up with elevated home readings",
          subjective: "Elevated home BP for 1 week; mild headache; no chest pain or dyspnea.",
          objective: "Known hypertension history. In-clinic BP elevated.",
          assessment: "Suboptimal BP control, likely requiring regimen adjustment.",
          plan: "Continue home monitoring, optimize antihypertensive therapy, reduce salt intake."
        },
        vitals: {
          temperature: "98.2 F",
          pulse: "78 bpm",
          bloodPressure: "152/94 mmHg",
          spo2: "98%"
        },
        diagnoses: [{ label: "Essential hypertension", code: "I10", confidence: 0.95 }],
        confidenceMap: { subjective: 0.9, objective: 0.86, assessment: 0.89, plan: 0.91 },
        alerts: ["Counsel about dizziness when titrating antihypertensives."],
        medicationSuggestions: [
          {
            name: "Telmisartan",
            dosage: "40 mg",
            frequency: "Once daily after breakfast",
            duration: "30 days",
            rationale: "Maintain BP control"
          }
        ],
        differentials: ["White coat effect", "Essential hypertension"]
      },
      review: {
        draftId: "draft-appointment-rohan",
        editedFields: ["plan"],
        note: "Patient missed 2 doses last week. Reinforced adherence and salt restriction.",
        reviewedAt: toIsoDateTime(today, "10:30"),
        approved: true
      },
      prescription: {
        medicines: [
          {
            name: "Telmisartan",
            dosage: "40 mg",
            frequency: "Once daily after breakfast",
            duration: "30 days",
            instructions: "Continue daily and record BP every evening."
          }
        ],
        warnings: ["Return sooner for chest pain, severe headache, or breathlessness."],
        followUpNote: "Review BP log after 2 weeks.",
        issuedAt: toIsoDateTime(today, "10:31")
      }
    })
  );

  addAppointmentBundle(
    state,
    createAppointmentBundle({
      id: "appointment-meena",
      slotId: `slot-doctor-khan-${tomorrow}-11:15`,
      doctorId: "doctor-khan",
      patientId: "patient-meena",
      bookedByUserId: patientUsers[2].id,
      visitType: "booked",
      bookingStatus: "scheduled",
      token: "C18",
      startAt: toIsoDateTime(tomorrow, "11:15"),
      endAt: toIsoDateTime(tomorrow, "11:30"),
      encounterStatus: "awaiting_interview",
      language: "hi",
      interviewStatus: "pending",
      transcript: [],
      extractedFindings: [],
      draft: {
        ...emptyEncounterDraft("Pending symptom interview"),
        id: "draft-appointment-meena",
        appointmentId: "appointment-meena"
      }
    })
  );

  addAppointmentBundle(
    state,
    createAppointmentBundle({
      id: "appointment-pranav",
      slotId: `slot-doctor-mehra-${dayAfter}-10:00`,
      doctorId: "doctor-mehra",
      patientId: "patient-pranav",
      bookedByUserId: patientUsers[3].id,
      visitType: "booked",
      bookingStatus: "scheduled",
      token: "A28",
      startAt: toIsoDateTime(dayAfter, "10:00"),
      endAt: toIsoDateTime(dayAfter, "10:15"),
      encounterStatus: "ai_ready",
      language: "en",
      interviewStatus: "complete",
      transcript: [
        { role: "ai", text: "Tell me what has been most difficult this week." },
        { role: "patient", text: "I feel tired all day and my sleep has been poor for ten days." }
      ],
      extractedFindings: ["Fatigue", "Poor sleep", "Ten days duration"],
      draft: {
        ...emptyEncounterDraft("Fatigue and poor energy"),
        id: "draft-appointment-pranav",
        appointmentId: "appointment-pranav",
        soap: {
          chiefComplaint: "Fatigue and poor energy",
          subjective: "Patient reports persistent fatigue with poor sleep quality and no acute distress symptoms.",
          objective: "Further vitals and exam needed to rule out metabolic or sleep-related causes.",
          assessment: "Fatigue workup required; sleep disturbance and chronic disease review remain likely contributors.",
          plan: "Review medications, order clinician workup if needed, and document sleep hygiene advice."
        },
        vitals: {
          temperature: "98.6 F",
          pulse: "82 bpm",
          bloodPressure: "124/80 mmHg",
          spo2: "99%"
        },
        diagnoses: [
          { label: "Fatigue, unspecified", code: "R53.83", confidence: 0.74 },
          { label: "Sleep disturbance", code: "G47.9", confidence: 0.58 }
        ],
        confidenceMap: { subjective: 0.84, objective: 0.52, assessment: 0.71, plan: 0.73 },
        alerts: ["Check chronic disease medications before prescribing stimulants or sedatives."],
        medicationSuggestions: [
          {
            name: "Supportive care",
            dosage: "As advised",
            frequency: "Daily",
            duration: "5 days",
            rationale: "Placeholder until clinician completes assessment"
          }
        ],
        differentials: ["Sleep deprivation", "Metabolic fatigue", "Diabetes-related fatigue"]
      }
    })
  );

  addAppointmentBundle(
    state,
    createAppointmentBundle({
      id: "appointment-imran",
      slotId: `slot-doctor-raman-${tomorrow}-10:20`,
      doctorId: "doctor-raman",
      patientId: "patient-imran",
      bookedByUserId: adminUser.id,
      visitType: "booked",
      bookingStatus: "checked_in",
      token: "B11",
      startAt: toIsoDateTime(tomorrow, "10:20"),
      endAt: toIsoDateTime(tomorrow, "10:40"),
      encounterStatus: "in_consult",
      language: "en",
      interviewStatus: "complete",
      transcript: [
        { role: "ai", text: "What is the main concern today?" },
        { role: "patient", text: "Feeling tired despite taking diabetes medicines regularly." }
      ],
      extractedFindings: ["Fatigue", "Type 2 diabetes follow-up", "Needs vitals review"],
      draft: {
        ...emptyEncounterDraft("Fatigue and diabetes follow-up"),
        id: "draft-appointment-imran",
        appointmentId: "appointment-imran",
        soap: {
          chiefComplaint: "Fatigue and diabetes follow-up",
          subjective: "Patient reports fatigue despite continuing diabetes medicines and hydration.",
          objective: "Patient in room. Awaiting examination and blood sugar review.",
          assessment: "Needs clinician assessment for glycemic control and fatigue workup.",
          plan: "Review current medication adherence, vitals, and sleep routine."
        },
        vitals: {
          temperature: "98.6 F",
          pulse: "84 bpm",
          bloodPressure: "130/84 mmHg",
          spo2: "98%"
        },
        diagnoses: [{ label: "Type 2 diabetes follow-up", code: "E11.9", confidence: 0.69 }],
        confidenceMap: { subjective: 0.84, objective: 0.56, assessment: 0.71, plan: 0.7 },
        alerts: ["Check chronic disease medication adherence before approving changes."],
        medicationSuggestions: [
          {
            name: "Continue current diabetes medicines",
            dosage: "As prescribed",
            frequency: "Daily",
            duration: "Until review",
            rationale: "Hold changes until examination"
          }
        ],
        differentials: ["Sleep-related fatigue", "Diabetes-related fatigue"]
      },
      review: {
        draftId: "draft-appointment-imran",
        editedFields: ["objective"],
        note: "Patient in room. Awaiting examination.",
        reviewedAt: toIsoDateTime(tomorrow, "10:25"),
        approved: false
      }
    })
  );

  syncAllDoctorDaySchedules(state, today, 30);
  state.ui.lastViewedAppointmentId = "appointment-aasha";

  return state;
}

export function createFirstAdminSeedState() {
  const state = createSeedState();

  delete state.users.byId["user-admin-primary"];
  state.users.allIds = state.users.allIds.filter((id) => id !== "user-admin-primary");
  delete state.admins.byId["admin-primary"];
  state.admins.allIds = [];
  state.session = {
    userId: null,
    role: null,
    isAuthenticated: false,
    activeProfileId: null,
    identifier: ""
  };

  return state;
}
