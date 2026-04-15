import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AIChatBox } from "../features/shared/AIChatBox";
import { demoStore } from "../services/demoStore";

const bridgeMocks = vi.hoisted(() => ({
  chatWithContextGunaEmr: vi.fn(),
  fetchSymptomChatMemory: vi.fn().mockResolvedValue({ memory: {} }),
  submitSymptomChatToEmr: vi.fn()
}));

const demoDataMock = vi.hoisted(() => ({
  current: {
    state: null,
    session: null,
    actions: {
      booking: {
        syncChatbotSubmission: vi.fn(),
        rescheduleAppointment: vi.fn(),
        bookAppointment: vi.fn(),
        ensurePrecheckQuestionnaire: vi.fn(),
        startAdaptivePrecheckSession: vi.fn(),
        answerAdaptivePrecheckQuestion: vi.fn(),
        submitPrecheckResponses: vi.fn()
      }
    }
  }
}));

vi.mock("../app/DemoDataProvider", () => ({
  useDemoData: () => demoDataMock.current
}));

vi.mock("../services/gunaEmrBridge", () => ({
  chatWithContextGunaEmr: bridgeMocks.chatWithContextGunaEmr,
  fetchSymptomChatMemory: bridgeMocks.fetchSymptomChatMemory,
  submitSymptomChatToEmr: bridgeMocks.submitSymptomChatToEmr
}));

vi.mock("../hooks/useSupabaseRealtime", () => ({
  useRealtimeTable: () => ({ data: [] })
}));

const CURRENT_PRECHECK_VERSION = "adaptive-symptom-ai-v2";

function buildDiseaseSpecificQuestions() {
  return [
    {
      id: "ai-precheck-1",
      question: "How many days have you had constipation, and has it been getting worse, better, or staying the same?",
      type: "text",
      required: true,
      category: "timeline"
    },
    {
      id: "ai-precheck-2",
      question: "How often are you passing stools right now compared with your usual pattern?",
      type: "text",
      required: true,
      category: "bowel_pattern"
    },
    {
      id: "ai-precheck-3",
      question: "Are you straining a lot, passing hard stools, or feeling that the bowel movement is incomplete?",
      type: "text",
      required: true,
      category: "bowel_pattern"
    },
    {
      id: "ai-precheck-4",
      question: "Do you have bloating, abdominal pain, vomiting, or blood/black stools?",
      type: "text",
      required: true,
      category: "red_flags"
    },
    {
      id: "ai-precheck-5",
      question: "Has your appetite, fluid intake, or fiber intake changed recently?",
      type: "text",
      required: true,
      category: "triggers"
    },
    {
      id: "ai-precheck-6",
      question: "Have you started any medicines that can worsen constipation, such as pain tablets, iron, calcium, or antacids?",
      type: "text",
      required: true,
      category: "medications"
    },
    {
      id: "ai-precheck-7",
      question: "Have you had similar constipation episodes before, or any history of piles, thyroid issues, or bowel problems?",
      type: "text",
      required: true,
      category: "history"
    }
  ];
}

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

test("chatbot shows the assistant reply returned by the model", async () => {
  const user = userEvent.setup();

  demoStore.reset();
  await demoStore.login({
    role: "patient",
    identifier: "+91 98765 43210",
    password: "Patient@123"
  });
  const state = await demoStore.getState();

  demoDataMock.current = {
    state,
    session: state.session,
    actions: {
      booking: {
        syncChatbotSubmission: demoDataMock.current.actions.booking.syncChatbotSubmission,
        rescheduleAppointment: demoDataMock.current.actions.booking.rescheduleAppointment,
        bookAppointment: demoDataMock.current.actions.booking.bookAppointment,
        ensurePrecheckQuestionnaire: demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire,
        startAdaptivePrecheckSession: demoDataMock.current.actions.booking.startAdaptivePrecheckSession,
        answerAdaptivePrecheckQuestion: demoDataMock.current.actions.booking.answerAdaptivePrecheckQuestion,
        submitPrecheckResponses: demoDataMock.current.actions.booking.submitPrecheckResponses
      }
    }
  };

  bridgeMocks.chatWithContextGunaEmr.mockResolvedValue({
    reply: "I can help with that. When did the symptom start?",
    summary: "Chief Complaint: follow-up question",
    detectedFocus: "General",
    readyForSubmission: false,
    triageLevel: "routine",
    escalationBand: "green",
    redFlags: [],
    suggestedVitals: ["temperature"],
    adherenceTips: [],
    ddiWarnings: [],
    fallbackChannels: { whatsapp: false, sms: false, reason: "" },
    usedFallback: false,
    model: "claude-haiku-4-5"
  });

  render(
    <MemoryRouter initialEntries={["/patient"]}>
      <AIChatBox />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: /open ai chat/i }));
  const input = screen.getByLabelText(/type your message/i);
  await user.type(input, "Thanks");
  await user.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByText(/when did the symptom start\?/i)).toBeInTheDocument();
  expect(screen.queryByText(/clinical snapshot/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/chief complaint: follow-up question/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/detected focus:\s*general/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/escalation green/i)).not.toBeInTheDocument();

  expect(bridgeMocks.chatWithContextGunaEmr).toHaveBeenCalledTimes(1);
  expect(bridgeMocks.chatWithContextGunaEmr).toHaveBeenCalledWith(
    expect.objectContaining({
      language: "en",
      role: "patient",
      contextKey: expect.stringMatching(/^patient:/),
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: "Thanks"
        })
      ])
    })
  );
});

test("chatbot keeps AI reply for doctor availability prompt in symptom stage", async () => {
  const user = userEvent.setup();

  demoStore.reset();
  await demoStore.login({
    role: "patient",
    identifier: "+91 98765 43210",
    password: "Patient@123"
  });
  const state = await demoStore.getState();

  demoDataMock.current = {
    state,
    session: state.session,
    actions: {
      booking: {
        syncChatbotSubmission: demoDataMock.current.actions.booking.syncChatbotSubmission,
        rescheduleAppointment: demoDataMock.current.actions.booking.rescheduleAppointment,
        bookAppointment: demoDataMock.current.actions.booking.bookAppointment,
        ensurePrecheckQuestionnaire: demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire,
        startAdaptivePrecheckSession: demoDataMock.current.actions.booking.startAdaptivePrecheckSession,
        answerAdaptivePrecheckQuestion: demoDataMock.current.actions.booking.answerAdaptivePrecheckQuestion,
        submitPrecheckResponses: demoDataMock.current.actions.booking.submitPrecheckResponses
      }
    }
  };

  bridgeMocks.chatWithContextGunaEmr.mockResolvedValue({
    reply: "I can help with doctor availability. First tell me your main symptom and how long you've had it.",
    summary: "Clinical intake in progress.",
    detectedFocus: "General",
    readyForSubmission: false,
    appointmentBookingOffered: false,
    triageLevel: "routine",
    escalationBand: "green",
    redFlags: [],
    suggestedVitals: [],
    adherenceTips: [],
    ddiWarnings: [],
    fallbackChannels: { whatsapp: false, sms: false, reason: "" },
    usedFallback: false,
    model: "claude-haiku-4-5"
  });

  render(
    <MemoryRouter initialEntries={["/patient"]}>
      <AIChatBox />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: /open ai chat/i }));
  const input = screen.getByLabelText(/type your message/i);
  await user.type(input, "wats doctor avaialbility");
  await user.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByText(/i can help with doctor availability/i)).toBeInTheDocument();
  expect(screen.queryByText(/step 2 of 4: choose a doctor/i)).not.toBeInTheDocument();
});

test("chatbot triage hands off to doctor selection and finalizes booking on the same intake appointment", async () => {
  const user = userEvent.setup();

  demoStore.reset();
  await demoStore.login({
    role: "patient",
    identifier: "+91 98765 43210",
    password: "Patient@123"
  });
  const state = await demoStore.getState();
  const patient = Object.values(state.patients.byId).find((item) => item.userId === state.session.userId);
  const doctor = state.doctors.byId["doctor-mehra"];
  const schedule = Object.values(state.daySchedules.byId).find(
    (item) => item.doctorId === doctor.id && item.slots?.some((slot) => slot.status === "available")
  );
  const slot = schedule?.slots?.find((item) => item.status === "available");
  const triageAppointmentId = "appointment-chatbot-flow";

  expect(patient).toBeTruthy();
  expect(schedule).toBeTruthy();
  expect(slot).toBeTruthy();

  const bookedSnapshot = {
    ...state,
    ui: {
      ...state.ui,
      lastViewedAppointmentId: triageAppointmentId
    },
    appointments: {
      ...state.appointments,
      allIds: state.appointments.allIds.includes(triageAppointmentId)
        ? state.appointments.allIds
        : [...state.appointments.allIds, triageAppointmentId],
      byId: {
        ...state.appointments.byId,
        [triageAppointmentId]: {
          id: triageAppointmentId,
          slotId: slot.id,
          doctorId: doctor.id,
          patientId: patient.id,
          bookedByUserId: state.session.userId,
          visitType: "booked",
          bookingStatus: "scheduled",
          rescheduleHistory: [],
          token: "A42",
          startAt: slot.startAt,
          endAt: slot.endAt
        }
      }
    }
  };

  bridgeMocks.chatWithContextGunaEmr.mockResolvedValue({
    reply: "I have enough information to summarize this for your doctor.",
    summary: "Chief Complaint: fever with body ache | Duration: 4 days",
    detectedFocus: "General",
    readyForSubmission: true,
    triageLevel: "routine",
    escalationBand: "green",
    redFlags: [],
    suggestedVitals: [],
    adherenceTips: [],
    ddiWarnings: [],
    fallbackChannels: { whatsapp: false, sms: false, reason: "" },
    usedFallback: false,
    model: "claude-haiku-4-5"
  });
  bridgeMocks.submitSymptomChatToEmr.mockResolvedValue({
    success: true,
    queueToken: 42,
    chat: {
      summary: "Chief Complaint: fever with body ache | Duration: 4 days",
      triageLevel: "routine",
      escalationBand: "green"
    }
  });
  demoDataMock.current.actions.booking.syncChatbotSubmission.mockResolvedValue({
    ui: { lastViewedAppointmentId: triageAppointmentId }
  });
  demoDataMock.current.actions.booking.rescheduleAppointment.mockResolvedValue(bookedSnapshot);

  demoDataMock.current = {
    state,
    session: state.session,
    actions: {
      booking: {
        syncChatbotSubmission: demoDataMock.current.actions.booking.syncChatbotSubmission,
        rescheduleAppointment: demoDataMock.current.actions.booking.rescheduleAppointment,
        bookAppointment: demoDataMock.current.actions.booking.bookAppointment,
        ensurePrecheckQuestionnaire: demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire,
        startAdaptivePrecheckSession: demoDataMock.current.actions.booking.startAdaptivePrecheckSession,
        answerAdaptivePrecheckQuestion: demoDataMock.current.actions.booking.answerAdaptivePrecheckQuestion,
        submitPrecheckResponses: demoDataMock.current.actions.booking.submitPrecheckResponses
      }
    }
  };

  render(
    <MemoryRouter initialEntries={["/patient"]}>
      <AIChatBox />
    </MemoryRouter>
  );

  await user.click(await screen.findByRole("button", { name: /open ai chat/i }));
  await user.type(screen.getByLabelText(/type your message/i), "I have fever for 4 days with body aches.");
  await user.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByText(/your triage has been converted to emr/i)).toBeInTheDocument();
  expect(await screen.findByText(/suggested doctor:/i)).toBeInTheDocument();

  await user.type(screen.getByLabelText(/type your message/i), "any other doctor");
  await user.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByText(/all available doctors are listed below/i)).toBeInTheDocument();
  expect(bridgeMocks.chatWithContextGunaEmr).toHaveBeenCalledTimes(1);

  const doctorButton = screen.getAllByRole("button").find((button) => button.textContent?.includes(doctor.fullName));
  expect(doctorButton).toBeTruthy();
  await user.click(doctorButton);

  const slotButtons = screen
    .getAllByRole("button")
    .filter((button) => /\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/i.test(button.textContent || ""));
  expect(slotButtons.length).toBeGreaterThan(0);
  await user.click(slotButtons[0]);
  await user.click(screen.getByRole("button", { name: /book appointment/i }));

  expect(demoDataMock.current.actions.booking.rescheduleAppointment).toHaveBeenCalledWith(
    triageAppointmentId,
    expect.objectContaining({
      doctorId: doctor.id,
      finalizeChatbotBooking: true,
      visitType: "booked"
    })
  );
  expect(await screen.findByText(/done \u2014 i booked/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /open appointment/i })).toBeInTheDocument();
});

test("pre-check opens in a dedicated chat session without loading symptom memory", async () => {
  demoStore.reset();
  await demoStore.login({
    role: "patient",
    identifier: "+91 98765 43210",
    password: "Patient@123"
  });
  const state = await demoStore.getState();
  const appointment = Object.values(state.appointments.byId)[0];
  const doctor = state.doctors.byId[appointment.doctorId];
  const questionnaireId = `precheck-${appointment.id}`;
  const diseaseQuestions = buildDiseaseSpecificQuestions();
  const stateWithPrecheck = {
    ...state,
    precheckQuestionnaires: {
      ...state.precheckQuestionnaires,
      allIds: [...(state.precheckQuestionnaires?.allIds || []), questionnaireId],
      byId: {
        ...(state.precheckQuestionnaires?.byId || {}),
        [questionnaireId]: {
          id: questionnaireId,
          appointmentId: appointment.id,
          encounterId: `encounter-${appointment.id}`,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: "sent_to_patient",
          aiQuestions: diseaseQuestions,
          editedQuestions: [],
          patientResponses: {},
          metadata: {
            generationMode: "adaptive_disease_specific_ai",
            generationVersion: CURRENT_PRECHECK_VERSION,
            questionCount: diseaseQuestions.length,
            diseaseSpecific: true,
            adaptive: true,
            targetQuestionCount: diseaseQuestions.length
          }
        }
      }
    }
  };
  demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire.mockResolvedValue(stateWithPrecheck);
  demoDataMock.current.actions.booking.startAdaptivePrecheckSession.mockResolvedValue(stateWithPrecheck);

  demoDataMock.current = {
    state: stateWithPrecheck,
    session: state.session,
    actions: {
      booking: {
        syncChatbotSubmission: demoDataMock.current.actions.booking.syncChatbotSubmission,
        rescheduleAppointment: demoDataMock.current.actions.booking.rescheduleAppointment,
        bookAppointment: demoDataMock.current.actions.booking.bookAppointment,
        ensurePrecheckQuestionnaire: demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire,
        startAdaptivePrecheckSession: demoDataMock.current.actions.booking.startAdaptivePrecheckSession,
        answerAdaptivePrecheckQuestion: demoDataMock.current.actions.booking.answerAdaptivePrecheckQuestion,
        submitPrecheckResponses: demoDataMock.current.actions.booking.submitPrecheckResponses
      }
    }
  };

  render(
    <MemoryRouter initialEntries={["/patient"]}>
      <AIChatBox />
    </MemoryRouter>
  );

  fireEvent(
    window,
    new CustomEvent("nira:open-precheck", {
      detail: {
        appointmentId: appointment.id,
        doctorName: doctor.fullName,
        specialty: doctor.specialty,
        startAt: appointment.startAt,
        launchSource: "patient_dashboard"
      }
    })
  );

  expect(await screen.findByText(/welcome to your pre-appointment check/i)).toBeInTheDocument();
  expect(await screen.findByText(/how many days have you had constipation/i)).toBeInTheDocument();
  expect(screen.getAllByText(/nira pre-check/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/pre-check questionnaire/i)).toBeInTheDocument();
  expect(bridgeMocks.fetchSymptomChatMemory).not.toHaveBeenCalled();
  expect(demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire).toHaveBeenCalledWith(
    appointment.id,
    expect.objectContaining({
      status: "sent_to_patient"
    })
  );
  expect(demoDataMock.current.actions.booking.startAdaptivePrecheckSession).toHaveBeenCalledWith(appointment.id);
});

test("pre-check refreshes an outdated generic questionnaire before showing it to the patient", async () => {
  demoStore.reset();
  await demoStore.login({
    role: "patient",
    identifier: "+91 98765 43210",
    password: "Patient@123"
  });
  const state = await demoStore.getState();
  const appointment = Object.values(state.appointments.byId)[0];
  const doctor = state.doctors.byId[appointment.doctorId];
  const questionnaireId = `precheck-${appointment.id}`;
  const refreshedQuestions = buildDiseaseSpecificQuestions();
  const staleState = {
    ...state,
    precheckQuestionnaires: {
      ...state.precheckQuestionnaires,
      allIds: [...(state.precheckQuestionnaires?.allIds || []), questionnaireId],
      byId: {
        ...(state.precheckQuestionnaires?.byId || {}),
        [questionnaireId]: {
          id: questionnaireId,
          appointmentId: appointment.id,
          encounterId: `encounter-${appointment.id}`,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: "sent_to_patient",
          aiQuestions: [
            {
              id: "legacy-q1",
              question: "What is your main concern right now?",
              type: "text",
              required: true,
              category: "general"
            }
          ],
          editedQuestions: [],
          patientResponses: {}
        }
      }
    }
  };
  const refreshedState = {
    ...staleState,
    precheckQuestionnaires: {
      ...staleState.precheckQuestionnaires,
      byId: {
        ...(staleState.precheckQuestionnaires?.byId || {}),
        [questionnaireId]: {
          ...staleState.precheckQuestionnaires.byId[questionnaireId],
          aiQuestions: refreshedQuestions,
          metadata: {
            generationMode: "adaptive_disease_specific_ai",
            generationVersion: CURRENT_PRECHECK_VERSION,
            questionCount: refreshedQuestions.length,
            diseaseSpecific: true,
            adaptive: true,
            targetQuestionCount: refreshedQuestions.length
          }
        }
      }
    }
  };
  demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire.mockResolvedValue(refreshedState);
  demoDataMock.current.actions.booking.startAdaptivePrecheckSession.mockResolvedValue(refreshedState);

  demoDataMock.current = {
    state: staleState,
    session: state.session,
    actions: {
      booking: {
        syncChatbotSubmission: demoDataMock.current.actions.booking.syncChatbotSubmission,
        rescheduleAppointment: demoDataMock.current.actions.booking.rescheduleAppointment,
        bookAppointment: demoDataMock.current.actions.booking.bookAppointment,
        ensurePrecheckQuestionnaire: demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire,
        startAdaptivePrecheckSession: demoDataMock.current.actions.booking.startAdaptivePrecheckSession,
        answerAdaptivePrecheckQuestion: demoDataMock.current.actions.booking.answerAdaptivePrecheckQuestion,
        submitPrecheckResponses: demoDataMock.current.actions.booking.submitPrecheckResponses
      }
    }
  };

  render(
    <MemoryRouter initialEntries={["/patient"]}>
      <AIChatBox />
    </MemoryRouter>
  );

  fireEvent(
    window,
    new CustomEvent("nira:open-precheck", {
      detail: {
        appointmentId: appointment.id,
        doctorName: doctor.fullName,
        specialty: doctor.specialty,
        startAt: appointment.startAt,
        launchSource: "patient_dashboard"
      }
    })
  );

  expect(await screen.findByText(/how many days have you had constipation/i)).toBeInTheDocument();
  expect(screen.queryByText(/^What is your main concern right now\?$/i)).not.toBeInTheDocument();
  expect(demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire).toHaveBeenCalledWith(
    appointment.id,
    expect.objectContaining({
      status: "sent_to_patient"
    })
  );
  expect(demoDataMock.current.actions.booking.startAdaptivePrecheckSession).toHaveBeenCalledWith(appointment.id);
});

test("completed pre-check auto-closes and reopens in generic chat mode", async () => {
  const user = userEvent.setup();

  demoStore.reset();
  await demoStore.login({
    role: "patient",
    identifier: "+91 98765 43210",
    password: "Patient@123"
  });
  const state = await demoStore.getState();
  const appointment = Object.values(state.appointments.byId)[0];
  const doctor = state.doctors.byId[appointment.doctorId];
  const questionnaireId = `precheck-${appointment.id}`;
  const staticQuestion = {
    id: "edited-q1",
    question: "What is your main concern for this appointment?",
    type: "text",
    required: true,
    category: "symptoms"
  };
  const stateWithPrecheck = {
    ...state,
    precheckQuestionnaires: {
      ...state.precheckQuestionnaires,
      allIds: [...(state.precheckQuestionnaires?.allIds || []), questionnaireId],
      byId: {
        ...(state.precheckQuestionnaires?.byId || {}),
        [questionnaireId]: {
          id: questionnaireId,
          appointmentId: appointment.id,
          encounterId: `encounter-${appointment.id}`,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: "sent_to_patient",
          aiQuestions: [],
          editedQuestions: [staticQuestion],
          patientResponses: {},
          metadata: {
            chiefComplaint: "Constipation for 3 days"
          }
        }
      }
    }
  };

  demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire.mockResolvedValue(stateWithPrecheck);
  demoDataMock.current.actions.booking.submitPrecheckResponses.mockResolvedValue(stateWithPrecheck);

  demoDataMock.current = {
    state: stateWithPrecheck,
    session: state.session,
    actions: {
      booking: {
        syncChatbotSubmission: demoDataMock.current.actions.booking.syncChatbotSubmission,
        rescheduleAppointment: demoDataMock.current.actions.booking.rescheduleAppointment,
        bookAppointment: demoDataMock.current.actions.booking.bookAppointment,
        ensurePrecheckQuestionnaire: demoDataMock.current.actions.booking.ensurePrecheckQuestionnaire,
        startAdaptivePrecheckSession: demoDataMock.current.actions.booking.startAdaptivePrecheckSession,
        answerAdaptivePrecheckQuestion: demoDataMock.current.actions.booking.answerAdaptivePrecheckQuestion,
        submitPrecheckResponses: demoDataMock.current.actions.booking.submitPrecheckResponses
      }
    }
  };

  render(
    <MemoryRouter initialEntries={["/patient"]}>
      <AIChatBox />
    </MemoryRouter>
  );

  fireEvent(
    window,
    new CustomEvent("nira:open-precheck", {
      detail: {
        appointmentId: appointment.id,
        doctorName: doctor.fullName,
        specialty: doctor.specialty,
        startAt: appointment.startAt,
        launchSource: "patient_dashboard"
      }
    })
  );

  expect(await screen.findByText(/what is your main concern for this appointment/i)).toBeInTheDocument();

  await user.type(screen.getByLabelText(/type your message/i), "Constipation for 3 days");
  await user.click(screen.getByRole("button", { name: /send message/i }));

  expect(demoDataMock.current.actions.booking.submitPrecheckResponses).toHaveBeenCalledWith(
    appointment.id,
    expect.objectContaining({
      patientResponses: {
        "edited-q1": "Constipation for 3 days"
      },
      metadata: expect.objectContaining({
        submittedFrom: "patient_dashboard",
        rawPatientResponses: {
          "edited-q1": "Constipation for 3 days"
        }
      })
    })
  );
  expect(await screen.findByText(/all done!/i)).toBeInTheDocument();

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1300));
  });

  await user.click(await screen.findByRole("button", { name: /open ai chat/i }));

  expect(await screen.findByText(/tell me your symptoms or ask for help with booking an appointment/i)).toBeInTheDocument();
  expect(screen.queryByText(/nira pre-check/i)).not.toBeInTheDocument();
}, 10000);