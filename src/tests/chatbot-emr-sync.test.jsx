import { expect, test, vi, afterEach, beforeEach } from "vitest";
import { STORAGE_KEY, demoStore } from "../services/demoStore";
import { getAppointmentBundle, getDoctorWorkspace, getPatientWorkspace } from "../features/shared/selectors";
import { fetchSymptomChatMemory } from "../services/gunaEmrBridge";

const precheckQuestionMocks = vi.hoisted(() => ({
  generateAdaptivePrecheckTurn: vi.fn(),
  generatePrecheckQuestions: vi.fn().mockResolvedValue([
    {
      id: "ai-precheck-1",
      question: "What symptoms are bothering you most right now?",
      type: "text",
      required: true,
      category: "symptoms"
    },
    {
      id: "ai-precheck-2",
      question: "When did this start?",
      type: "text",
      required: true,
      category: "timeline"
    },
    {
      id: "ai-precheck-3",
      question: "How severe is it right now from 1 to 10?",
      type: "rating",
      required: true,
      category: "severity"
    },
    {
      id: "ai-precheck-4",
      question: "What medicines or home remedies are you taking right now?",
      type: "text",
      required: true,
      category: "medications"
    }
  ])
}));

vi.mock("../services/precheckQuestions", () => ({
  generateAdaptivePrecheckTurn: precheckQuestionMocks.generateAdaptivePrecheckTurn,
  generatePrecheckQuestions: precheckQuestionMocks.generatePrecheckQuestions
}));

function buildAdaptivePrecheckSequence() {
  return [
    {
      id: "adaptive-precheck-1",
      question: "What symptoms are bothering you most right now?",
      type: "text",
      required: true,
      category: "symptoms"
    },
    {
      id: "adaptive-precheck-2",
      question: "When did this start?",
      type: "text",
      required: true,
      category: "timeline"
    },
    {
      id: "adaptive-precheck-3",
      question: "How severe is it right now from 1 to 10?",
      type: "rating",
      required: true,
      category: "severity"
    },
    {
      id: "adaptive-precheck-4",
      question: "Do you have fever, breathing difficulty, vomiting, chest pain, or black stools?",
      type: "text",
      required: true,
      category: "red_flags"
    },
    {
      id: "adaptive-precheck-5",
      question: "What makes it better or worse?",
      type: "text",
      required: true,
      category: "triggers"
    },
    {
      id: "adaptive-precheck-6",
      question: "What medicines or home remedies are you taking right now?",
      type: "text",
      required: true,
      category: "medications"
    },
    {
      id: "adaptive-precheck-7",
      question: "Any allergies or past bad reactions to medicines?",
      type: "text",
      required: true,
      category: "allergies"
    }
  ];
}

function getQuestionnaireByAppointment(snapshot, appointmentId) {
  return Object.values(snapshot.precheckQuestionnaires?.byId || {}).find((item) => item.appointmentId === appointmentId) || null;
}

function countAnsweredResponses(questionnaire) {
  return Object.values(questionnaire?.patientResponses || {}).filter((value) => String(value || "").trim()).length;
}

function buildAnswerForQuestion(question, index) {
  const questionText = String(question.question || "").toLowerCase();

  if (/how long|when did.*start|duration|since when/.test(questionText)) {
    return "2 days";
  }

  if (/severity|scale of 1|1 to 10|pain score/.test(questionText)) {
    return "6";
  }

  if (/allerg/.test(questionText)) {
    return "No known allergies";
  }

  if (/medicine|medication|supplement|home remed/.test(questionText)) {
    return "Paracetamol";
  }

  if (index === 0) {
    return "Fever with body ache";
  }

  return "No breathing difficulty";
}

async function completeAdaptivePrecheckSession(appointmentId) {
  let snapshot = await demoStore.startAdaptivePrecheckSession(appointmentId);

  while (true) {
    const questionnaire = getQuestionnaireByAppointment(snapshot, appointmentId);
    const questions = questionnaire?.editedQuestions?.length ? questionnaire.editedQuestions : questionnaire?.aiQuestions || [];
    const answeredCount = countAnsweredResponses(questionnaire);
    const currentQuestion = questions[answeredCount] || null;

    if (!currentQuestion) {
      return questionnaire;
    }

    snapshot = await demoStore.answerAdaptivePrecheckQuestion(appointmentId, {
      questionId: currentQuestion.id,
      answer: buildAnswerForQuestion(currentQuestion, answeredCount)
    });
  }
}

beforeEach(() => {
  const adaptiveSequence = buildAdaptivePrecheckSequence();
  precheckQuestionMocks.generatePrecheckQuestions.mockResolvedValue([
    {
      id: "ai-precheck-1",
      question: "What symptoms are bothering you most right now?",
      type: "text",
      required: true,
      category: "symptoms"
    },
    {
      id: "ai-precheck-2",
      question: "When did this start?",
      type: "text",
      required: true,
      category: "timeline"
    },
    {
      id: "ai-precheck-3",
      question: "How severe is it right now from 1 to 10?",
      type: "rating",
      required: true,
      category: "severity"
    },
    {
      id: "ai-precheck-4",
      question: "What medicines or home remedies are you taking right now?",
      type: "text",
      required: true,
      category: "medications"
    }
  ]);
  precheckQuestionMocks.generateAdaptivePrecheckTurn.mockImplementation(async (_encounterId, _context, sessionState = {}) => {
    const askedCount = Array.isArray(sessionState?.askedQuestions) ? sessionState.askedQuestions.length : 0;
    const nextQuestion = adaptiveSequence[askedCount] || null;

    if (!nextQuestion) {
      return {
        question: null,
        isComplete: true,
        targetQuestionCount: adaptiveSequence.length
      };
    }

    return {
      question: { ...nextQuestion },
      isComplete: false,
      targetQuestionCount: adaptiveSequence.length
    };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

test("chatbot submission is saved into EMR sync state and visible in doctor workspace", async () => {
  const seed = demoStore.reset();
  const patient = Object.values(seed.patients.byId).find((item) => item.fullName === "Aasha Verma");

  expect(patient).toBeTruthy();

  const payload = {
    patientId: patient.id,
    userId: patient.userId,
    language: "en",
    messages: [
      { role: "user", content: "I have stomach pain and burning since yesterday." },
      { role: "assistant", content: "Noted. Any vomiting or black stools?" },
      { role: "user", content: "No vomiting, no black stools." }
    ],
    submission: {
      success: true,
      patientId: "fhir-patient-101",
      encounterId: "fhir-enc-555",
      queueToken: 42,
      chat: {
        summary: "Chief Complaint: stomach pain with burning | Duration: since yesterday",
        detectedFocus: "GI",
        triageLevel: "urgent",
        escalationBand: "yellow",
        suggestedVitals: ["temperature", "SpO2"],
        redFlags: []
      },
      cdss: {
        confidenceScores: {
          subjective: 0.89,
          assessment: 0.78
        }
      }
    }
  };

  await demoStore.syncChatbotSubmission(payload);
  const snapshot = await demoStore.getState();

  const appointmentId = snapshot.ui.lastViewedAppointmentId;
  expect(appointmentId).toBeTruthy();

  const bundle = getAppointmentBundle(snapshot, appointmentId);
  expect(bundle).toBeTruthy();
  expect(bundle.encounter?.status).toBe("ai_ready");
  expect(bundle.encounter?.chatbotMetadata).toEqual({
    clinicalSnapshot: "Chief Complaint: stomach pain with burning | Duration: since yesterday",
    detectedFocus: "GI",
    triageLevel: "urgent",
    escalationBand: "yellow",
    redFlags: [],
    suggestedVitals: ["temperature", "SpO2"]
  });
  expect(bundle.interview?.completionStatus).toBe("complete");
  expect(bundle.interview?.transcript?.length).toBeGreaterThan(0);
  expect(bundle.interview?.transcript?.map((entry) => entry.role)).toEqual(["patient", "ai", "patient"]);
  expect(String(bundle.interview?.transcript?.[1]?.text || "")).toMatch(/Noted\./i);
  expect(String(bundle.draft?.soap?.subjective || "")).toMatch(/stomach pain/i);

  const emrSync = snapshot.emrSync.byId[`emr-${appointmentId}`];
  expect(emrSync).toBeTruthy();
  expect(emrSync.patientId).toBe("fhir-patient-101");
  expect(emrSync.encounterId).toBe("fhir-enc-555");
  expect(emrSync.queueToken).toBe(42);
  expect(emrSync.interviewSyncedAt).toBeTruthy();

  const doctorUser = Object.values(snapshot.users.byId).find((item) => item.profileId === bundle.appointment.doctorId);
  const doctorViewState = {
    ...snapshot,
    session: {
      userId: doctorUser?.id || null,
      role: "doctor",
      isAuthenticated: true,
      activeProfileId: doctorUser?.profileId || null,
      identifier: doctorUser?.email || ""
    }
  };

  const doctorWorkspace = getDoctorWorkspace(doctorViewState);
  const doctorQueueItem = doctorWorkspace.appointments.find((item) => item.id === appointmentId);
  expect(doctorQueueItem).toBeTruthy();
  expect(doctorQueueItem.queueStatus).toBe("ai_ready");
  expect(String(doctorQueueItem.draft?.soap?.subjective || "")).toMatch(/stomach pain/i);
});

test("pre-check responses are saved into doctor workspace intake state", async () => {
  const seed = demoStore.reset();
  const patient = Object.values(seed.patients.byId).find((item) => item.fullName === "Aasha Verma");
  const schedule = Object.values(seed.daySchedules.byId).find(
    (item) => item.doctorId === "doctor-mehra" && item.slots?.some((slot) => slot.status === "available")
  );
  const slot = schedule?.slots?.find((item) => item.status === "available");

  expect(patient).toBeTruthy();
  expect(schedule).toBeTruthy();
  expect(slot).toBeTruthy();

  await demoStore.bookAppointment({
    doctorId: schedule.doctorId,
    patientId: patient.id,
    bookedByUserId: patient.userId,
    date: schedule.date,
    slotId: slot.id,
    language: "en",
    visitType: "booked"
  });

  const bookedSnapshot = await demoStore.getState();
  const appointmentId = bookedSnapshot.ui.lastViewedAppointmentId;
  const questionnaire = await completeAdaptivePrecheckSession(appointmentId);

  expect(questionnaire).toBeTruthy();
  expect((questionnaire?.aiQuestions || []).length).toBeGreaterThanOrEqual(7);

  await demoStore.submitPrecheckResponses(appointmentId, questionnaire.patientResponses);
  const snapshot = await demoStore.getState();
  const bundle = getAppointmentBundle(snapshot, appointmentId);

  expect(bundle).toBeTruthy();
  expect(bundle.precheckQuestionnaire?.status).toBe("completed");
  expect(bundle.encounter?.status).toBe("ai_ready");
  expect(bundle.interview?.completionStatus).toBe("complete");
  expect(bundle.interview?.transcript?.length).toBeGreaterThan(0);
  expect(String(bundle.draft?.soap?.subjective || "")).toMatch(/fever with body ache|2 days|no known allergies/i);
  expect(bundle.precheckQuestionnaire?.metadata).toEqual(expect.objectContaining({
    source: "patient_precheck",
    workflow: "patient_precheck",
    sessionType: "precheck_chat",
    chatContextKey: expect.stringContaining(`:precheck:${appointmentId}`)
  }));
  expect(bundle.interview?.metadata).toEqual(expect.objectContaining({
    source: "patient_precheck",
    workflow: "patient_precheck",
    sessionType: "precheck_chat",
    chatContextKey: expect.stringContaining(`:precheck:${appointmentId}`)
  }));
  expect(bundle.encounter?.metadata).toEqual(expect.objectContaining({
    source: "patient_precheck",
    workflow: "patient_precheck",
    sessionType: "precheck_chat",
    chatContextKey: expect.stringContaining(`:precheck:${appointmentId}`)
  }));

  const doctorUser = Object.values(snapshot.users.byId).find((item) => item.profileId === bundle.appointment.doctorId);
  const doctorViewState = {
    ...snapshot,
    session: {
      userId: doctorUser?.id || null,
      role: "doctor",
      isAuthenticated: true,
      activeProfileId: doctorUser?.profileId || null,
      identifier: doctorUser?.email || ""
    }
  };

  const doctorWorkspace = getDoctorWorkspace(doctorViewState);
  const doctorQueueItem = doctorWorkspace.appointments.find((item) => item.id === appointmentId);

  expect(doctorQueueItem).toBeTruthy();
  expect(doctorQueueItem.patientName).toBe(bundle.patient.fullName);
  expect(doctorQueueItem.queueStatus).toBe("ai_ready");
  expect(doctorQueueItem.interview?.completionStatus).toBe("complete");
  expect(String(doctorQueueItem.chiefComplaint || "")).toMatch(/fever with body ache|2 days/i);
});

test("submitPrecheckResponses preserves verbatim patient wording for doctor review", async () => {
  const seed = demoStore.reset();
  const appointmentId = Object.values(seed.appointments.byId)[0]?.id;
  const appointment = appointmentId ? seed.appointments.byId[appointmentId] : null;
  const questionnaireId = appointmentId ? `precheck-${appointmentId}` : null;

  expect(appointmentId).toBeTruthy();
  expect(appointment).toBeTruthy();

  const seededState = {
    ...seed,
    precheckQuestionnaires: {
      ...seed.precheckQuestionnaires,
      allIds: [...(seed.precheckQuestionnaires?.allIds || []), questionnaireId],
      byId: {
        ...(seed.precheckQuestionnaires?.byId || {}),
        [questionnaireId]: {
          id: questionnaireId,
          appointmentId,
          encounterId: `encounter-${appointmentId}`,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: "sent_to_patient",
          aiQuestions: [
            {
              id: "verbatim-q1",
              question: "Have you taken any medicine for this problem?",
              type: "yesno",
              required: true,
              category: "medications"
            }
          ],
          editedQuestions: [],
          patientResponses: {},
          metadata: {
            generationMode: "adaptive_disease_specific_ai",
            generationVersion: "adaptive-symptom-ai-v2",
            questionCount: 1,
            diseaseSpecific: true,
            adaptive: true,
            targetQuestionCount: 7,
            chiefComplaint: "Fever"
          }
        }
      }
    }
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seededState));

  await demoStore.submitPrecheckResponses(appointmentId, {
    patientResponses: {
      "verbatim-q1": "yes"
    },
    metadata: {
      rawPatientResponses: {
        "verbatim-q1": "Yes, I took Crocin last night after dinner."
      }
    }
  });

  const snapshot = await demoStore.getState();
  const bundle = getAppointmentBundle(snapshot, appointmentId);

  expect(bundle?.precheckQuestionnaire?.patientResponses).toEqual({
    "verbatim-q1": "yes"
  });
  expect(bundle?.precheckQuestionnaire?.metadata?.rawPatientResponses).toEqual({
    "verbatim-q1": "Yes, I took Crocin last night after dinner."
  });
  expect(bundle?.interview?.transcript).toEqual([
    { role: "ai", text: "Have you taken any medicine for this problem?" },
    { role: "patient", text: "Yes, I took Crocin last night after dinner." }
  ]);
  expect(bundle?.interview?.extractedFindings).toContain(
    "Have you taken any medicine for this problem?: Yes, I took Crocin last night after dinner."
  );
});

test("startAdaptivePrecheckSession refreshes a stale symptom-specific opener when no complaint is known", async () => {
  const seed = demoStore.reset();
  const appointmentId = Object.values(seed.appointments.byId)[0].id;
  const appointment = seed.appointments.byId[appointmentId];
  const questionnaireId = `precheck-${appointmentId}`;

  const staleState = {
    ...seed,
    precheckQuestionnaires: {
      ...seed.precheckQuestionnaires,
      allIds: [...(seed.precheckQuestionnaires?.allIds || []), questionnaireId],
      byId: {
        ...(seed.precheckQuestionnaires?.byId || {}),
        [questionnaireId]: {
          id: questionnaireId,
          appointmentId,
          encounterId: `encounter-${appointmentId}`,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: "sent_to_patient",
          aiQuestions: [
            {
              id: "legacy-q1",
              question: "Are you experiencing any stomach pain, discomfort, or burning sensation right now or in the past few days?",
              type: "yesno",
              required: true,
              category: "symptoms"
            }
          ],
          editedQuestions: [],
          patientResponses: {},
          metadata: {
            generationMode: "adaptive_disease_specific_ai",
            generationVersion: "adaptive-symptom-ai-v2",
            questionCount: 1,
            diseaseSpecific: true,
            adaptive: true,
            targetQuestionCount: 8,
            chiefComplaint: ""
          }
        }
      }
    }
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(staleState));

  const snapshot = await demoStore.startAdaptivePrecheckSession(appointmentId);
  const questionnaire = getQuestionnaireByAppointment(snapshot, appointmentId);

  expect(questionnaire?.aiQuestions?.[0]?.question).toBe("What symptoms are bothering you most right now?");
  expect(precheckQuestionMocks.generateAdaptivePrecheckTurn).toHaveBeenCalledTimes(1);
});

test("doctor approval publishes prescription, tests, and lab report to both portals", async () => {
  const seed = demoStore.reset();
  const patient = Object.values(seed.patients.byId).find((item) => item.fullName === "Aasha Verma");
  const schedule = Object.values(seed.daySchedules.byId).find(
    (item) => item.doctorId === "doctor-mehra" && item.slots?.some((slot) => slot.status === "available")
  );
  const slot = schedule?.slots?.find((item) => item.status === "available");

  expect(patient).toBeTruthy();
  expect(schedule).toBeTruthy();
  expect(slot).toBeTruthy();

  await demoStore.bookAppointment({
    doctorId: schedule.doctorId,
    patientId: patient.id,
    bookedByUserId: patient.userId,
    date: schedule.date,
    slotId: slot.id,
    language: "en",
    visitType: "booked"
  });

  const bookedSnapshot = await demoStore.getState();
  const appointmentId = bookedSnapshot.ui.lastViewedAppointmentId;
  const questionnaire = await completeAdaptivePrecheckSession(appointmentId);

  await demoStore.submitPrecheckResponses(appointmentId, questionnaire.patientResponses);
  const precheckSnapshot = await demoStore.getState();
  const bundleBeforeApproval = getAppointmentBundle(precheckSnapshot, appointmentId);
  const nextDraft = {
    ...bundleBeforeApproval.draft,
    soap: {
      ...bundleBeforeApproval.draft.soap,
      assessment: "Probable viral febrile illness with dehydration risk.",
      plan: "Hydration, supportive care, and diagnostic workup."
    },
    diagnoses: [
      { label: "Viral febrile illness", confidence: 0.86 }
    ],
    medicationSuggestions: [
      {
        name: "Paracetamol",
        dosage: "500 mg",
        frequency: "Three times a day",
        duration: "3 days",
        rationale: "Reduce fever and body ache"
      }
    ],
    unifiedEmr: {
      investigations: {
        selected: ["CBC", "CRP"],
        patientNote: "Please complete these tests today and bring the reports tomorrow."
      }
    },
    alerts: ["Watch hydration status"]
  };

  await demoStore.saveDoctorReview(appointmentId, {
    draft: nextDraft,
    editedFields: ["soap.assessment", "unifiedEmr.investigations"],
    note: "Ordering labs before final antibiotic decision.",
    labReport: {
      title: "Fever workup",
      category: "Infectious disease",
      findings: "CBC and CRP requested.",
      resultSummary: "Awaiting diagnostic results."
    }
  });

  await demoStore.approveEncounter(appointmentId, {
    draft: nextDraft,
    editedFields: ["soap.assessment", "unifiedEmr.investigations"],
    note: "Ordering labs before final antibiotic decision.",
    followUpNote: "Return with lab reports in 24 hours.",
    labReport: {
      title: "Fever workup",
      category: "Infectious disease",
      findings: "CBC and CRP ordered.",
      resultSummary: "Supportive treatment started while waiting for results."
    }
  });

  const snapshot = await demoStore.getState();
  const bundle = getAppointmentBundle(snapshot, appointmentId);

  expect(bundle.encounter?.status).toBe("approved");
  expect(bundle.prescription).toBeTruthy();
  expect(bundle.prescription?.medicines?.map((item) => item.name)).toContain("Paracetamol");
  expect(bundle.labReport?.status).toBe("final");
  expect(bundle.labReport?.title).toBe("Fever workup");

  const doctorUser = Object.values(snapshot.users.byId).find((item) => item.profileId === bundle.appointment.doctorId);
  const doctorViewState = {
    ...snapshot,
    session: {
      userId: doctorUser?.id || null,
      role: "doctor",
      isAuthenticated: true,
      activeProfileId: doctorUser?.profileId || null,
      identifier: doctorUser?.email || ""
    }
  };

  const doctorWorkspace = getDoctorWorkspace(doctorViewState);
  const doctorQueueItem = doctorWorkspace.appointments.find((item) => item.id === appointmentId);
  const doctorBundle = getAppointmentBundle(doctorViewState, appointmentId);
  expect(doctorBundle?.prescription?.id).toBe(bundle.prescription?.id);
  expect(doctorQueueItem?.labReport?.status).toBe("final");

  const patientViewState = {
    ...snapshot,
    session: {
      userId: patient.userId,
      role: "patient",
      isAuthenticated: true,
      activeProfileId: patient.id,
      identifier: patient.email || patient.phone || ""
    }
  };
  const patientWorkspace = getPatientWorkspace(patientViewState);
  const patientTests = patientWorkspace.testOrders.find((item) => item.appointmentId === appointmentId);
  const patientRx = patientWorkspace.prescriptions.find((item) => item.appointmentId === appointmentId);
  const patientLab = patientWorkspace.labReports.find((item) => item.appointmentId === appointmentId);

  expect(patientRx).toBeTruthy();
  expect(patientTests?.tests).toEqual(expect.arrayContaining(["CBC", "CRP"]));
  expect(patientTests?.patientNote).toMatch(/complete these tests today/i);
  expect(patientLab?.status).toBe("final");
  expect(patientWorkspace.appointmentsByBucket.completed.some((item) => item.id === appointmentId)).toBe(true);
});

test("chatbot memory retrieval calls EMR endpoint and returns stored memory payload", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      contextKey: "patient:u1",
      memory: {
        summary: "Past history includes acidity and episodic gastritis."
      }
    })
  });

  vi.stubGlobal("fetch", fetchMock);

  const result = await fetchSymptomChatMemory({
    contextKey: "patient:u1",
    userId: "u1",
    role: "patient",
    patientPhone: "+91 9876543210"
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const calledUrl = String(fetchMock.mock.calls[0][0]);
  expect(calledUrl).toContain("/api/convert/symptom-chat/memory");
  expect(calledUrl).toContain("contextKey=patient%3Au1");
  expect(calledUrl).toContain("userId=u1");
  expect(calledUrl).toContain("role=patient");

  expect(result?.memory?.summary).toMatch(/gastritis/i);
});
