import { stableObjectId } from "../lib/identity.mjs";
import { hashPassword } from "../lib/password.mjs";
import {
  addDays,
  buildSlotSummary,
  createSlotsForWindows,
  formatTime,
  getDayKey,
  getWeekdayKey
} from "../lib/schedule.mjs";

const CLINIC_ID = "nira-pilot-clinic";

const doctorSeeds = [
  {
    slug: "nisha-mehra",
    fullName: "Dr. Nisha Mehra",
    specialty: "Internal Medicine",
    licenseNumber: "KMC-INT-22871",
    experienceYears: 12,
    consultationMode: "opd",
    slotDurationMinutes: 15,
    bufferMinutes: 0,
    bio: "Internal medicine specialist for OPD triage and follow-up care.",
    email: "nisha.mehra@nira.local",
    acceptingAppointments: true,
    status: "active",
    weeklyRules: {
      monday: enabledDay(["09:00-13:00", "14:00-17:00"]),
      tuesday: enabledDay(["09:00-13:00", "14:00-17:00"]),
      wednesday: enabledDay(["09:00-13:00", "14:00-17:00"]),
      thursday: enabledDay(["09:00-13:00", "14:00-17:00"]),
      friday: enabledDay(["09:00-13:00", "14:00-17:00"]),
      saturday: enabledDay(["09:00-12:00"]),
      sunday: disabledDay()
    },
    topLevelBreaks: [{ label: "Lunch", startTime: "13:00", endTime: "14:00" }],
    overrides: {
      2: { type: "blocked_slots", startTimes: ["09:00", "09:15", "09:30"], reason: "Morning rounds" }
    }
  },
  {
    slug: "arjun-raman",
    fullName: "Dr. Arjun Raman",
    specialty: "Family Medicine",
    licenseNumber: "KMC-FAM-17302",
    experienceYears: 9,
    consultationMode: "hybrid",
    slotDurationMinutes: 20,
    bufferMinutes: 0,
    bio: "Family physician focusing on hypertension, diabetes, and continuity care.",
    email: "arjun.raman@nira.local",
    acceptingAppointments: true,
    status: "active",
    weeklyRules: {
      monday: enabledDay(["10:00-14:00", "15:00-18:00"]),
      tuesday: enabledDay(["10:00-14:00", "15:00-18:00"]),
      wednesday: enabledDay(["10:00-14:00", "15:00-18:00"]),
      thursday: enabledDay(["10:00-14:00", "15:00-18:00"]),
      friday: enabledDay(["10:00-14:00", "15:00-18:00"]),
      saturday: enabledDay(["10:00-13:00"]),
      sunday: disabledDay()
    },
    topLevelBreaks: [{ label: "Lunch", startTime: "14:00", endTime: "15:00" }],
    overrides: {}
  },
  {
    slug: "sana-khan",
    fullName: "Dr. Sana Khan",
    specialty: "General Practice",
    licenseNumber: "KMC-GP-19544",
    experienceYears: 7,
    consultationMode: "opd",
    slotDurationMinutes: 15,
    bufferMinutes: 0,
    bio: "General practitioner for acute OPD visits and patient education.",
    email: "sana.khan@nira.local",
    acceptingAppointments: true,
    status: "active",
    weeklyRules: {
      monday: enabledDay(["11:00-15:00", "16:00-19:00"]),
      tuesday: enabledDay(["11:00-15:00", "16:00-19:00"]),
      wednesday: enabledDay(["11:00-15:00", "16:00-19:00"]),
      thursday: enabledDay(["11:00-15:00", "16:00-19:00"]),
      friday: enabledDay(["11:00-15:00", "16:00-19:00"]),
      saturday: enabledDay(["10:00-13:00"]),
      sunday: disabledDay()
    },
    topLevelBreaks: [{ label: "Tea break", startTime: "15:00", endTime: "16:00" }],
    overrides: {
      3: { type: "closed", reason: "Doctor on leave" }
    }
  },
  {
    slug: "farah-ali",
    fullName: "Dr. Farah Ali",
    specialty: "General Medicine",
    licenseNumber: "KMC-GM-28419",
    experienceYears: 5,
    consultationMode: "opd",
    slotDurationMinutes: 15,
    bufferMinutes: 0,
    bio: "General medicine consultant for first-line OPD care and follow-up visits.",
    email: "farah.ali@nira.local",
    acceptingAppointments: true,
    status: "active",
    weeklyRules: {
      monday: enabledDay(["10:00-14:00"]),
      tuesday: enabledDay(["10:00-14:00"]),
      wednesday: enabledDay(["10:00-14:00"]),
      thursday: enabledDay(["10:00-14:00"]),
      friday: enabledDay(["10:00-14:00"]),
      saturday: disabledDay(),
      sunday: disabledDay()
    },
    topLevelBreaks: [],
    overrides: {}
  }
];

const patientSeeds = [
  patientSeed("aasha-verma", "Aasha Verma", 32, "Female", "+91 98765 43210", "Bengaluru", "hi", true, "91-4578-2234-1102", "Acute gastritis"),
  patientSeed("rohan-iyer", "Rohan Iyer", 41, "Male", "+91 99887 56432", "Bengaluru", "en", true, "91-4480-9234-4581", "Hypertension follow-up"),
  patientSeed("anika-das", "Anika Das", 8, "Female", "+91 98112 14567", "Bengaluru", "en", false, null, "Viral URI"),
  patientSeed("imran-sheikh", "Imran Sheikh", 55, "Male", "+91 97654 31209", "Bengaluru", "en", true, "91-3124-1876-9990", "Type 2 diabetes"),
  patientSeed("meena-joshi", "Meena Joshi", 36, "Female", "+91 91230 44322", "Bengaluru", "hi", true, "91-5501-7610-8872", "Dermatitis"),
  patientSeed("pranav-sen", "Pranav Sen", 34, "Male", "+91 98444 21009", "Bengaluru", "en", true, "91-3355-9012-3334", "Fatigue workup"),
  patientSeed("priya-nair", "Priya Nair", 29, "Female", "+91 98711 22559", "Bengaluru", "en", true, "91-7744-5521-8890", "Seasonal fever follow-up")
];

const appointmentSeeds = [
  {
    slug: "aasha-gastritis",
    numberSuffix: "001",
    doctorSlug: "nisha-mehra",
    patientSlug: "aasha-verma",
    dayOffset: 0,
    startTime: "09:15",
    visitType: "walk_in",
    source: "patient_portal",
    bookingStatus: "scheduled",
    encounterStatus: "ai_ready",
    notes: "Patient completed APCI interview in Hindi.",
    interview: {
      language: "hi",
      completionStatus: "complete",
      transcript: [
        { role: "ai", text: "नमस्ते, आज किस परेशानी के लिए आए हैं?" },
        { role: "patient", text: "पिछले दो दिन से पेट में जलन और उलझन है।" },
        { role: "ai", text: "क्या खाना खाने के बाद बढ़ता है?" },
        { role: "patient", text: "हाँ, खासकर मसालेदार खाना खाने के बाद।" }
      ],
      extractedFindings: ["Epigastric burning", "Post-meal worsening", "Nausea"]
    },
    apciDraft: gastritisDraft(),
    doctorReview: emptyReview(),
    finalClinicalNote: null,
    approvedAt: null
  },
  {
    slug: "rohan-hypertension",
    numberSuffix: "002",
    doctorSlug: "arjun-raman",
    patientSlug: "rohan-iyer",
    dayOffset: 0,
    startTime: "10:00",
    visitType: "booked",
    source: "patient_portal",
    bookingStatus: "completed",
    encounterStatus: "approved",
    notes: "Completed hypertension follow-up.",
    interview: {
      language: "en",
      completionStatus: "complete",
      transcript: [
        { role: "ai", text: "How have your blood pressure readings been this week?" },
        { role: "patient", text: "Mostly around 150 over 92 and I felt a mild headache yesterday." }
      ],
      extractedFindings: ["Home BP elevated", "Mild headache", "Partial medication adherence"]
    },
    apciDraft: hypertensionDraft(),
    doctorReview: {
      editedFields: ["plan"],
      note: "Patient missed 2 doses last week. Reinforced adherence and salt restriction.",
      reviewedAtOffsetMinutes: 25,
      approved: true
    },
    finalClinicalNote: "Essential hypertension reviewed. Continued telmisartan and reinforced adherence.",
    approvedAtMinutes: 30,
    prescription: approvedHypertensionPrescription()
  },
  {
    slug: "vikram-knee-pain",
    numberSuffix: "003",
    doctorSlug: "arjun-raman",
    patientSlug: "imran-sheikh",
    dayOffset: 1,
    startTime: "10:20",
    visitType: "booked",
    source: "admin_panel",
    bookingStatus: "checked_in",
    encounterStatus: "in_consult",
    notes: "Walked in early for diabetes fatigue review.",
    interview: {
      language: "en",
      completionStatus: "complete",
      transcript: [
        { role: "ai", text: "What is the main concern today?" },
        { role: "patient", text: "Feeling tired despite taking diabetes medicines regularly." }
      ],
      extractedFindings: ["Fatigue", "Type 2 diabetes follow-up", "Needs vitals review"]
    },
    apciDraft: fatigueDraft(),
    doctorReview: {
      editedFields: ["objective"],
      note: "Patient in room. Awaiting examination.",
      reviewedAtOffsetMinutes: 5,
      approved: false
    },
    finalClinicalNote: null,
    approvedAt: null
  },
  {
    slug: "meena-rash",
    numberSuffix: "004",
    doctorSlug: "sana-khan",
    patientSlug: "meena-joshi",
    dayOffset: 1,
    startTime: "11:15",
    visitType: "booked",
    source: "patient_portal",
    bookingStatus: "scheduled",
    encounterStatus: "awaiting_interview",
    notes: "Patient booked but has not started interview yet.",
    interview: {
      language: "hi",
      completionStatus: "pending",
      transcript: [],
      extractedFindings: []
    },
    apciDraft: emptyDraft("Pending symptom interview"),
    doctorReview: emptyReview(),
    finalClinicalNote: null,
    approvedAt: null
  },
  {
    slug: "pranav-fatigue",
    numberSuffix: "005",
    doctorSlug: "nisha-mehra",
    patientSlug: "pranav-sen",
    dayOffset: 2,
    startTime: "10:00",
    visitType: "booked",
    source: "patient_portal",
    bookingStatus: "scheduled",
    encounterStatus: "ai_ready",
    notes: "Sleep-related fatigue follow-up.",
    interview: {
      language: "en",
      completionStatus: "complete",
      transcript: [
        { role: "ai", text: "Tell me what has been most difficult this week." },
        { role: "patient", text: "I feel tired all day and my sleep has been poor for ten days." }
      ],
      extractedFindings: ["Fatigue", "Poor sleep", "Ten days duration"]
    },
    apciDraft: fatigueDraft(),
    doctorReview: emptyReview(),
    finalClinicalNote: null,
    approvedAt: null
  },
  {
    slug: "priya-general-medicine",
    numberSuffix: "006",
    doctorSlug: "farah-ali",
    patientSlug: "priya-nair",
    dayOffset: 0,
    startTime: "10:00",
    visitType: "booked",
    source: "patient_portal",
    bookingStatus: "scheduled",
    encounterStatus: "awaiting_interview",
    notes: "New patient booked with Dr. Farah; interview pending.",
    interview: {
      language: "en",
      completionStatus: "pending",
      transcript: [],
      extractedFindings: []
    },
    apciDraft: emptyDraft("Pending symptom interview"),
    doctorReview: emptyReview(),
    finalClinicalNote: null,
    approvedAt: null
  },
  {
    slug: "anika-farah-followup",
    numberSuffix: "007",
    doctorSlug: "farah-ali",
    patientSlug: "anika-das",
    dayOffset: 1,
    startTime: "10:15",
    visitType: "booked",
    source: "patient_portal",
    bookingStatus: "scheduled",
    encounterStatus: "ai_ready",
    notes: "Pre-check finished; waiting for Dr. Farah consultation.",
    interview: {
      language: "en",
      completionStatus: "complete",
      transcript: [
        { role: "ai", text: "What symptoms are worrying you most today?" },
        { role: "patient", text: "Low-grade fever with sore throat since yesterday." }
      ],
      extractedFindings: ["Low-grade fever", "Sore throat", "Since yesterday"]
    },
    apciDraft: {
      ...emptyDraft("Fever with sore throat"),
      soap: {
        chiefComplaint: "Fever with sore throat",
        subjective: "Low-grade fever and throat pain for one day, no breathing difficulty.",
        objective: "No red-flag symptoms reported in interview; vitals to be confirmed in clinic.",
        assessment: "Likely viral upper respiratory infection; clinician review needed.",
        plan: "Hydration, symptomatic care guidance, and in-person examination by doctor."
      },
      diagnoses: [{ label: "Acute upper respiratory infection", code: "J06.9", confidence: 0.72 }],
      confidenceMap: {
        subjective: 0.83,
        objective: 0.52,
        assessment: 0.71,
        plan: 0.76
      },
      alerts: ["Rule out bacterial infection if fever persists beyond 48-72 hours."],
      medicationSuggestions: []
    },
    doctorReview: emptyReview(),
    finalClinicalNote: null,
    approvedAt: null
  }
];

export function buildSeedPayload(options = {}) {
  const todayKey = options.todayKey || getDayKey();
  const now = new Date();
  const clinic = buildClinic(now);
  const admin = buildAdmin(now);
  const doctors = doctorSeeds.map((seed) => buildDoctor(seed, now));
  const patients = patientSeeds.map((seed) => buildPatient(seed, now));

  const activeDoctors = doctors.filter((doctor) => doctor.user.status === "active");
  const schedules = buildDoctorDaySchedules(activeDoctors, todayKey, now);
  const appointmentPayload = buildAppointmentsAndEncounters({
    activeDoctors,
    patients,
    admin,
    schedules,
    todayKey,
    now
  });

  return {
    clinic,
    admin,
    doctors,
    patients,
    availabilityTemplates: doctors.map((doctor) => doctor.availabilityTemplate),
    daySchedules: [...appointmentPayload.scheduleMap.values()],
    appointments: appointmentPayload.appointments,
    encounters: appointmentPayload.encounters,
    prescriptions: appointmentPayload.prescriptions,
    auditLogs: buildAuditLogs({
      admin,
      doctors,
      appointments: appointmentPayload.appointments,
      encounters: appointmentPayload.encounters,
      prescriptions: appointmentPayload.prescriptions,
      now
    }),
    credentials: [
      { role: "admin", login: admin.user.email, password: "Admin@123" },
      ...doctors.map((doctor) => ({
        role: doctor.user.role,
        login: doctor.user.email,
        password: "Doctor@123",
        status: doctor.user.status
      })),
      ...patients.map((patient) => ({
        role: patient.user.role,
        login: patient.user.phone,
        password: "Patient@123"
      }))
    ]
  };
}

function buildClinic(now) {
  return {
    _id: stableObjectId("clinic:nira-pilot"),
    clinicId: CLINIC_ID,
    name: "NIRA Pilot Clinic",
    timezone: "Asia/Kolkata",
    address: {
      line1: "12 Residency Medical Plaza",
      line2: "2nd Floor",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      country: "India"
    },
    contact: {
      phone: "+91 80444 77889",
      email: "hello@nira.local"
    },
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

function buildAdmin(now) {
  const userId = stableObjectId("user:admin:clinic");
  const profileId = stableObjectId("profile:admin:clinic");

  return {
    user: {
      _id: userId,
      clinicId: CLINIC_ID,
      role: "admin",
      status: "active",
      phone: null,
      email: "admin@nira.local",
      passwordHash: hashPassword("Admin@123"),
      profileId,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    },
    profile: {
      _id: profileId,
      clinicId: CLINIC_ID,
      userId,
      fullName: "Clinic Administrator",
      phone: "+91 90000 10000",
      email: "admin@nira.local",
      permissions: ["doctor_manage", "patient_manage", "appointment_manage", "schedule_manage"],
      createdAt: now,
      updatedAt: now
    }
  };
}

function buildDoctor(seed, now) {
  const userId = stableObjectId(`user:doctor:${seed.slug}`);
  const profileId = stableObjectId(`profile:doctor:${seed.slug}`);
  const templateId = stableObjectId(`availability-template:${seed.slug}`);

  return {
    seed,
    user: {
      _id: userId,
      clinicId: CLINIC_ID,
      role: "doctor",
      status: seed.status,
      phone: null,
      email: seed.email,
      passwordHash: hashPassword("Doctor@123"),
      profileId,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    },
    profile: {
      _id: profileId,
      clinicId: CLINIC_ID,
      userId,
      fullName: seed.fullName,
      specialty: seed.specialty,
      licenseNumber: seed.licenseNumber,
      experienceYears: seed.experienceYears,
      acceptingAppointments: seed.acceptingAppointments,
      status: seed.status,
      consultationMode: seed.consultationMode,
      slotDurationMinutes: seed.slotDurationMinutes,
      bufferMinutes: seed.bufferMinutes,
      bio: seed.bio,
      createdAt: now,
      updatedAt: now
    },
    availabilityTemplate: {
      _id: templateId,
      clinicId: CLINIC_ID,
      doctorId: profileId,
      weeklyRules: seed.weeklyRules,
      defaultSlotDurationMinutes: seed.slotDurationMinutes,
      breaks: seed.topLevelBreaks,
      effectiveFrom: now,
      updatedBy: stableObjectId("user:admin:clinic"),
      updatedAt: now
    }
  };
}

function buildPatient(seed, now) {
  const userId = stableObjectId(`user:patient:${seed.slug}`);
  const profileId = stableObjectId(`profile:patient:${seed.slug}`);

  return {
    seed,
    user: {
      _id: userId,
      clinicId: CLINIC_ID,
      role: "patient",
      status: "active",
      phone: seed.phone,
      email: null,
      passwordHash: hashPassword("Patient@123"),
      profileId,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now
    },
    profile: {
      _id: profileId,
      clinicId: CLINIC_ID,
      userId,
      fullName: seed.fullName,
      gender: seed.gender,
      age: seed.age,
      dob: null,
      phone: seed.phone,
      city: seed.city,
      preferredLanguage: seed.preferredLanguage,
      abha: {
        linked: seed.abhaLinked,
        number: seed.abhaNumber
      },
      emergencyContact: {
        name: `${seed.fullName.split(" ")[0]} Emergency`,
        phone: seed.phone
      },
      lastVisitSummary: {
        lastVisitDate: new Date("2026-03-18T10:30:00+05:30"),
        lastDiagnosis: seed.lastDiagnosis
      },
      createdAt: now,
      updatedAt: now
    }
  };
}

function buildDoctorDaySchedules(activeDoctors, todayKey, now) {
  const scheduleMap = new Map();

  for (const doctor of activeDoctors) {
    for (let offset = 0; offset < 30; offset += 1) {
      const dayKey = addDays(todayKey, offset);
      const weekdayKey = getWeekdayKey(dayKey);
      const dayRule = doctor.seed.weeklyRules[weekdayKey];
      const scheduleId = stableObjectId(`schedule:${doctor.seed.slug}:${dayKey}`);

      let slots = dayRule.enabled
        ? createSlotsForWindows(
            dayKey,
            dayRule.windows,
            doctor.profile.slotDurationMinutes,
            doctor.profile.bufferMinutes
          )
        : [];

      let isClosed = !dayRule.enabled;
      let generatedFromTemplate = true;
      let overrideReason = isClosed ? "Non-working day" : null;

      const override = doctor.seed.overrides[offset];
      if (override) {
        generatedFromTemplate = false;

        if (override.type === "closed") {
          isClosed = true;
          overrideReason = override.reason;
          slots = slots.map((slot) => ({
            ...slot,
            status: "unavailable",
            closedReason: override.reason
          }));
        }

        if (override.type === "blocked_slots") {
          overrideReason = override.reason;
          slots = slots.map((slot) =>
            override.startTimes.includes(formatTime(slot.startAt))
              ? { ...slot, status: "unavailable", closedReason: override.reason }
              : slot
          );
        }
      }

      scheduleMap.set(`${doctor.seed.slug}:${dayKey}`, {
        _id: scheduleId,
        clinicId: CLINIC_ID,
        doctorId: doctor.profile._id,
        date: dayKey,
        isClosed,
        slotSummary: buildSlotSummary(slots),
        generatedFromTemplate,
        overrideReason,
        slots,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  return scheduleMap;
}

function buildAppointmentsAndEncounters({ activeDoctors, patients, admin, schedules, todayKey, now }) {
  const doctorBySlug = new Map(activeDoctors.map((doctor) => [doctor.seed.slug, doctor]));
  const patientBySlug = new Map(patients.map((patient) => [patient.seed.slug, patient]));
  const appointments = [];
  const encounters = [];
  const prescriptions = [];

  for (const seed of appointmentSeeds) {
    const doctor = doctorBySlug.get(seed.doctorSlug);
    const patient = patientBySlug.get(seed.patientSlug);
    const dayKey = addDays(todayKey, seed.dayOffset);
    const schedule = schedules.get(`${seed.doctorSlug}:${dayKey}`);
    const slot = schedule?.slots.find((candidate) => formatTime(candidate.startAt) === seed.startTime);

    if (!doctor || !patient || !schedule || !slot) {
      throw new Error(`Unable to resolve booking seed for ${seed.slug}`);
    }

    const appointmentId = stableObjectId(`appointment:${seed.slug}`);
    const encounterId = stableObjectId(`encounter:${seed.slug}`);
    const prescriptionId = seed.prescription ? stableObjectId(`prescription:${seed.slug}`) : null;
    const bookedAt = new Date(slot.startAt.getTime() - 30 * 60 * 1000);

    slot.status = "booked";
    slot.appointmentId = appointmentId;
    slot.patientId = patient.profile._id;
    slot.bookedAt = bookedAt;
    slot.closedReason = null;
    schedule.slotSummary = buildSlotSummary(schedule.slots);
    schedule.updatedAt = now;

    appointments.push({
      _id: appointmentId,
      clinicId: CLINIC_ID,
      appointmentNumber: `APT-${dayKey.replaceAll("-", "")}-${seed.numberSuffix}`,
      slotId: slot.slotId,
      doctorId: doctor.profile._id,
      patientId: patient.profile._id,
      doctorSnapshot: {
        fullName: doctor.profile.fullName,
        specialty: doctor.profile.specialty
      },
      patientSnapshot: {
        fullName: patient.profile.fullName,
        phone: patient.profile.phone
      },
      date: dayKey,
      startAt: slot.startAt,
      endAt: slot.endAt,
      visitType: seed.visitType,
      bookingStatus: seed.bookingStatus,
      source: seed.source,
      encounterId,
      notes: seed.notes,
      createdByUserId: seed.source === "admin_panel" ? admin.user._id : patient.user._id,
      createdAt: bookedAt,
      updatedAt: now
    });

    encounters.push({
      _id: encounterId,
      clinicId: CLINIC_ID,
      appointmentId,
      doctorId: doctor.profile._id,
      patientId: patient.profile._id,
      status: seed.encounterStatus,
      interview: seed.interview,
      apciDraft: seed.apciDraft,
      doctorReview: resolveDoctorReview(seed.doctorReview, slot.startAt),
      finalClinicalNote: seed.finalClinicalNote,
      diagnoses: seed.apciDraft.diagnoses,
      confidenceMap: seed.apciDraft.confidenceMap,
      alerts: seed.apciDraft.alerts,
      prescriptionId,
      approvedAt:
        seed.approvedAtMinutes !== undefined
          ? new Date(slot.startAt.getTime() + seed.approvedAtMinutes * 60 * 1000)
          : null,
      updatedAt: now
    });

    if (seed.prescription) {
      prescriptions.push({
        _id: prescriptionId,
        clinicId: CLINIC_ID,
        appointmentId,
        encounterId,
        doctorId: doctor.profile._id,
        patientId: patient.profile._id,
        medications: seed.prescription.medications,
        warnings: seed.prescription.warnings,
        followUpNote: seed.prescription.followUpNote,
        portalSummary: seed.prescription.portalSummary,
        pdfMeta: {
          fileName: `${seed.slug}.pdf`,
          storagePath: `generated/prescriptions/${seed.slug}.pdf`,
          mimeType: "application/pdf",
          generatedAt: new Date(slot.startAt.getTime() + 31 * 60 * 1000)
        },
        issuedAt: new Date(slot.startAt.getTime() + 31 * 60 * 1000),
        updatedAt: now
      });
    }
  }

  return {
    scheduleMap: schedules,
    appointments,
    encounters,
    prescriptions
  };
}

function buildAuditLogs({ admin, doctors, appointments, encounters, prescriptions, now }) {
  const logs = [
    {
      _id: stableObjectId("audit:doctor-created:nisha"),
      clinicId: CLINIC_ID,
      actorUserId: admin.user._id,
      actorRole: "admin",
      entityType: "doctor_profile",
      entityId: doctors[0].profile._id,
      action: "doctor_created",
      beforeSummary: null,
      afterSummary: { doctor: doctors[0].profile.fullName, status: doctors[0].profile.status },
      meta: { seedKey: "doctor_created_nisha" },
      createdAt: now
    },
    {
      _id: stableObjectId("audit:doctor-pending:farah"),
      clinicId: CLINIC_ID,
      actorUserId: doctors[3].user._id,
      actorRole: "doctor",
      entityType: "user",
      entityId: doctors[3].user._id,
      action: "doctor_signup_submitted",
      beforeSummary: null,
      afterSummary: { email: doctors[3].user.email, status: doctors[3].user.status },
      meta: { seedKey: "doctor_pending_farah" },
      createdAt: now
    },
    {
      _id: stableObjectId("audit:appointment-booked:aasha"),
      clinicId: CLINIC_ID,
      actorUserId: stableObjectId("user:patient:aasha-verma"),
      actorRole: "patient",
      entityType: "appointment",
      entityId: appointments[0]._id,
      action: "appointment_booked",
      beforeSummary: null,
      afterSummary: { appointmentNumber: appointments[0].appointmentNumber, slotId: appointments[0].slotId },
      meta: { seedKey: "appointment_booked_aasha" },
      createdAt: appointments[0].createdAt
    },
    {
      _id: stableObjectId("audit:encounter-approved:rohan"),
      clinicId: CLINIC_ID,
      actorUserId: stableObjectId("user:doctor:arjun-raman"),
      actorRole: "doctor",
      entityType: "encounter",
      entityId: encounters[1]._id,
      action: "encounter_approved",
      beforeSummary: { status: "in_consult" },
      afterSummary: { status: encounters[1].status, prescriptionId: prescriptions[0]._id },
      meta: { seedKey: "encounter_approved_rohan" },
      createdAt: encounters[1].approvedAt
    }
  ];

  return logs;
}

function resolveDoctorReview(review, startAt) {
  return {
    editedFields: review.editedFields,
    note: review.note,
    reviewedAt:
      review.reviewedAtOffsetMinutes !== undefined
        ? new Date(startAt.getTime() + review.reviewedAtOffsetMinutes * 60 * 1000)
        : null,
    approved: review.approved
  };
}

function patientSeed(slug, fullName, age, gender, phone, city, preferredLanguage, abhaLinked, abhaNumber, lastDiagnosis) {
  return {
    slug,
    fullName,
    age,
    gender,
    phone,
    city,
    preferredLanguage,
    abhaLinked,
    abhaNumber,
    lastDiagnosis
  };
}

function enabledDay(ranges) {
  return {
    enabled: true,
    windows: ranges.map((range) => {
      const [startTime, endTime] = range.split("-");
      return { startTime, endTime };
    }),
    breaks: []
  };
}

function disabledDay() {
  return {
    enabled: false,
    windows: [],
    breaks: []
  };
}

function emptyReview() {
  return {
    editedFields: [],
    note: null,
    reviewedAtOffsetMinutes: undefined,
    approved: false
  };
}

function emptyDraft(chiefComplaint) {
  return {
    soap: {
      chiefComplaint,
      subjective: "Interview not completed yet.",
      objective: "Vitals and examination pending.",
      assessment: "-",
      plan: "Prompt patient to complete AI interview before consultation."
    },
    vitals: {
      temperature: "Pending",
      pulse: "Pending",
      bloodPressure: "Pending",
      spo2: "Pending"
    },
    diagnoses: [{ label: "Interview pending", code: "R69", confidence: 0.2 }],
    confidenceMap: {
      subjective: 0.1,
      objective: 0.1,
      assessment: 0.1,
      plan: 0.15
    },
    alerts: ["Interview incomplete. Doctor should gather history directly."],
    medicationSuggestions: [],
    differentials: ["Needs clinician review"]
  };
}

function gastritisDraft() {
  return {
    soap: {
      chiefComplaint: "Burning abdominal discomfort for 2 days",
      subjective:
        "Patient reports epigastric burning with nausea, worse after spicy meals. No vomiting or melena.",
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
    confidenceMap: {
      subjective: 0.93,
      objective: 0.74,
      assessment: 0.88,
      plan: 0.82
    },
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
  };
}

function hypertensionDraft() {
  return {
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
    confidenceMap: {
      subjective: 0.9,
      objective: 0.86,
      assessment: 0.89,
      plan: 0.91
    },
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
  };
}

function fatigueDraft() {
  return {
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
    confidenceMap: {
      subjective: 0.84,
      objective: 0.52,
      assessment: 0.71,
      plan: 0.73
    },
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
  };
}

function approvedHypertensionPrescription() {
  return {
    medications: [
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
    portalSummary: {
      headline: "Blood pressure medicine updated",
      plainLanguageInstructions: "Take the tablet once daily after breakfast and keep a BP log."
    }
  };
}
