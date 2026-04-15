import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CalendarClock, CalendarDays, CheckCircle2, MessageCircle, Mic, Send, Sparkles, User, Volume2, X } from "lucide-react";
import { useDemoData } from "../../app/DemoDataProvider";
import chatbotMarkSrc from "../../assets/nira-chatbot-mark.png";
import { formatDate, formatTime } from "../../lib/format";
import { cn } from "../../lib/utils";
import {
  chatWithContextGunaEmr,
  fetchSymptomChatMemory,
  submitSymptomChatToEmr,
} from "../../services/gunaEmrBridge";
import { getBookableDoctors, getDoctorSchedules, getPatientWorkspace, getScheduleByDate } from "./selectors";
import { useRealtimeTable } from "../../hooks/useSupabaseRealtime";

const BOOKING_INTENT_REGEX = /\b(book|schedule|appointment|slot|doctor visit|consult|availability|available)\b/i;
const LOGIN_HELP_INTENT_REGEX = /\b(login|log in|signin|sign in|signup|sign up|register|account|password)\b/i;
const CONTACT_HELP_INTENT_REGEX = /\b(contact|support|helpdesk|helpline|call|email|reach)\b/i;
const PRECHECK_INTENT_REGEX = /\b(pre[\s-]?check|questionnaire|doctor questions|questions from doctor)\b/i;
const EMERGENCY_INTENT_REGEX = /\b(chest pain|shortness of breath|can't breathe|unable to breathe|stroke|face droop|slurred speech|severe bleeding|faint|unconscious)\b/i;
const SYMPTOM_SIGNAL_REGEX = /\b(fever|cough|cold|pain|ache|headache|migraine|vomit|vomiting|nausea|diarrhea|diarrhoea|constipation|bloating|gas|acidity|acid reflux|heartburn|breath|breathless|rash|dizzy|dizziness|fatigue|weakness|stomach|abdomen|abdominal|chest|bp|pressure|sore throat|infection|burning urine|urinary|urine|back pain|joint pain|allergy|itching)\b/i;
const NON_CLINICAL_CHAT_REGEX = /^\s*(hi|hello|hey|ok|okay|thanks|thank you|help)\s*[.!?]*\s*$/i;
const ALL_DOCTORS_INTENT_REGEX = /\b(any other doctor|another doctor|different doctor|show all doctors|show me all doctors|other doctor)\b/i;
const DEFAULT_ADAPTIVE_PRECHECK_TARGET = 8;
const PRECHECK_AUTOCLOSE_DELAY_MS = 1200;

const BOOKING_STEPS = [
  { key: "symptoms", label: "Symptoms", description: "Tell me what's bothering you." },
  { key: "doctor", label: "Doctor", description: "Choose the best matching doctor." },
  { key: "slot", label: "Slot", description: "Pick an available time." },
  { key: "confirm", label: "Confirm", description: "Review and book." },
];

const CHATBOT_MARK_DIM = { xs: 14, sm: 18, md: 22, lg: 30, xl: 38 };

function NiraChatbotMark({ size = "md", onDark = false, className }) {
  const dim = CHATBOT_MARK_DIM[size] ?? CHATBOT_MARK_DIM.md;
  return (
    <img
      src={chatbotMarkSrc}
      alt=""
      width={dim}
      height={dim}
      className={cn(
        "nira-chatbot-mark shrink-0 select-none object-contain",
        onDark && "nira-chatbot-mark--on-dark",
        className,
      )}
      draggable={false}
      decoding="async"
    />
  );
}

export function AIChatBox() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, session, actions } = useDemoData();
  const {
    appointments,
    patient,
    pendingPrecheckAppointments,
    nextAppointment: wsNextAppointment,
  } = getPatientWorkspace(state || {});
  const language = "en";
  const isAuthenticated = !!session?.isAuthenticated;
  const role = session?.role || null;
  const patientMode = isAuthenticated && role === "patient";
  const guestMode = !isAuthenticated;
  const showClinicianIntakeMeta = ["doctor", "admin", "nurse"].includes(role || "");
  const hiddenByRole = ["doctor", "admin", "nurse"].includes(role || "");
  const hiddenByPath = ["/doctor", "/admin", "/nurse"].some((prefix) => location.pathname.startsWith(prefix));
  const avoidsPatientFloatingBook = location.pathname.startsWith("/patient/appointments");
  const shouldHideChat = hiddenByRole || hiddenByPath || (!guestMode && !patientMode);
  const initialMessage = useMemo(
    () => ({
      role: "ai",
      text: guestMode
        ? "Hi! I can help with login, signup, or contact support. Tell me what you need and I’ll guide you step by step."
        : "Hi! I'm the chatbot. Share your main symptom, when it started, and what makes it better or worse. I’ll ask one focused follow-up question at a time and save your answers for your doctor.",
      time: new Date(),
    }),
    [guestMode]
  );
  const defaultContextKey = `${session?.role || "unknown"}:${session?.userId || "anonymous"}`;
  const bookableDoctors = useMemo(() => getBookableDoctors(state || {}), [state]);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [intakeSubmitted, setIntakeSubmitted] = useState(false);
  const [precheckFlow, setPrecheckFlow] = useState(createEmptyPrecheckFlow);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [bookingFlow, setBookingFlow] = useState(createEmptyBookingFlow);
  const [triageAppointmentId, setTriageAppointmentId] = useState("");
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const inPrecheckSession = patientMode && Boolean(precheckFlow.appointmentId);
  const appointmentLookup = useMemo(
    () => new Map(appointments.map((appointment) => [appointment.id, appointment])),
    [appointments]
  );
  const defaultPrecheckAppointment = pendingPrecheckAppointments[0] || wsNextAppointment || null;
  const precheckContextKey = useMemo(
    () => buildPrecheckSessionContextKey(defaultContextKey, precheckFlow.appointmentId),
    [defaultContextKey, precheckFlow.appointmentId]
  );
  const activeContextKey = inPrecheckSession ? precheckContextKey : defaultContextKey;
  const { data: realtimeEvents } = useRealtimeTable("chat_events", {
    column: "context_key",
    value: activeContextKey,
  });

  const rankedDoctors = useMemo(
    () => rankDoctorsForSymptoms(bookableDoctors, bookingFlow.symptoms || input || ""),
    [bookableDoctors, bookingFlow.symptoms, input]
  );
  const selectedDoctor = bookableDoctors.find((doctor) => doctor.id === bookingFlow.doctorId) || null;
  const suggestedDoctorForBooking = rankedDoctors[0] || null;
  const triageLinkedAppointment = triageAppointmentId
    ? state?.appointments?.byId?.[triageAppointmentId] || null
    : null;
  const selectedDoctorSchedules = useMemo(
    () => (selectedDoctor ? getDoctorSchedules(state || {}, selectedDoctor.id, 14) : []),
    [state, selectedDoctor?.id]
  );
  const reservedSlotDate =
    triageLinkedAppointment && selectedDoctor && triageLinkedAppointment.doctorId === selectedDoctor.id
      ? String(triageLinkedAppointment.startAt || "").slice(0, 10)
      : "";
  const selectedDate = bookingFlow.slotDate || reservedSlotDate || selectedDoctorSchedules.find((schedule) => schedule.slotSummary.available > 0)?.date || state?.meta?.today || "";
  const selectedSchedule = selectedDoctor ? getScheduleByDate(state || {}, selectedDoctor.id, selectedDate) : null;
  const reservedTriageSlot = useMemo(() => {
    if (!triageLinkedAppointment || !selectedDoctor || triageLinkedAppointment.doctorId !== selectedDoctor.id) {
      return null;
    }

    if (!selectedDate || String(triageLinkedAppointment.startAt || "").slice(0, 10) !== selectedDate) {
      return null;
    }

    const existingSlot = selectedSchedule?.slots?.find((slot) => slot.id === triageLinkedAppointment.slotId) || null;
    if (existingSlot) {
      return {
        ...existingSlot,
        status: existingSlot.status === "available" ? "available" : "reserved",
      };
    }

    if (!triageLinkedAppointment.startAt || !triageLinkedAppointment.endAt) {
      return null;
    }

    return {
      id: triageLinkedAppointment.slotId || `reserved-${triageAppointmentId}`,
      startAt: triageLinkedAppointment.startAt,
      endAt: triageLinkedAppointment.endAt,
      status: "reserved",
    };
  }, [triageLinkedAppointment, selectedDoctor?.id, selectedDate, selectedSchedule, triageAppointmentId]);
  const availableDates = useMemo(() => {
    const visibleDates = selectedDoctorSchedules.filter((schedule) => schedule.slotSummary.available > 0);
    if (!reservedSlotDate || visibleDates.some((schedule) => schedule.date === reservedSlotDate)) {
      return visibleDates;
    }

    const reservedSchedule = selectedDoctorSchedules.find((schedule) => schedule.date === reservedSlotDate) || null;
    return reservedSchedule ? [reservedSchedule, ...visibleDates] : visibleDates;
  }, [selectedDoctorSchedules, reservedSlotDate]);
  const availableSlots = useMemo(() => {
    const visibleSlots = (selectedSchedule?.slots || []).filter((slot) => slot.status === "available");
    if (!reservedTriageSlot || visibleSlots.some((slot) => slot.id === reservedTriageSlot.id)) {
      return visibleSlots;
    }

    return [{ ...reservedTriageSlot, status: "reserved" }, ...visibleSlots];
  }, [selectedSchedule, reservedTriageSlot]);
  const bookingStageIndex = BOOKING_STEPS.findIndex((step) => step.key === bookingFlow.stage);
  const activePrecheckQuestion = precheckFlow.phase === "dynamic"
    ? precheckFlow.dynamicQuestions[precheckFlow.currentDynamicIndex] || null
    : null;
  const precheckSessionClosedForInput =
    inPrecheckSession && (precheckFlow.completed || precheckFlow.phase === "unavailable");
  const quickPrompts = useMemo(() => {
    if (guestMode) {
      return [
        { label: "Login help", value: "I need help logging in." },
        { label: "Signup help", value: "I want to create an account." },
        { label: "Contact support", value: "I need contact support details." }
      ];
    }

    if (patientMode) {
      return [
        { label: "Main concern", value: "My main concern is..." },
        { label: "When it started", value: "It started about..." },
        { label: "What changes it", value: "It gets worse when..." }
      ];
    }

    return [];
  }, [guestMode, patientMode]);
  const patientBrandLabel = "Chatbot";
  const patientHeaderTitle = inPrecheckSession ? "NIRA Pre-Check" : patientBrandLabel;
  const patientHeaderDescription = inPrecheckSession
    ? "Answer a few simple questions so your doctor can review them before the visit."
    : "Tell me your symptoms or ask for help with booking an appointment.";

  useEffect(() => {
    setMessages([initialMessage]);
    setInput("");
    setOpen(false);
    setTyping(false);
    setIntakeSubmitted(false);
    setBookingFlow(createEmptyBookingFlow());
    setTriageAppointmentId("");
    setPrecheckFlow(createEmptyPrecheckFlow());
  }, [initialMessage]);

  function resolvePrecheckAppointment(context = {}) {
    const appointmentId = context.appointmentId || defaultPrecheckAppointment?.id || null;
    if (!appointmentId) {
      return null;
    }

    return appointmentLookup.get(appointmentId) || null;
  }

  function startPrecheckFlow(context = {}) {
    const targetAppointment = resolvePrecheckAppointment(context);
    const appointmentId = context.appointmentId || targetAppointment?.id || null;
    const doctorName = context.doctorName || targetAppointment?.doctor?.fullName || "your doctor";
    const specialty = context.specialty || targetAppointment?.doctor?.specialty || "General Practice";
    const startAt = context.startAt || targetAppointment?.startAt;
    const questionnaireId =
      context.questionnaireId
      || targetAppointment?.precheckQuestionnaire?.id
      || getQuestionnaireByAppointmentId(state, appointmentId)?.id
      || null;

    if (!appointmentId) {
      return;
    }

    setMessages([]);
    setBookingFlow(createEmptyBookingFlow());
    setIntakeSubmitted(false);
    setTriageAppointmentId("");

    const apptCtx = {
      appointmentId,
      doctorName,
      specialty,
      startAt,
      patientId: patient?.id,
      encounterId: appointmentId ? `encounter-${appointmentId}` : null,
      launchSource: context.launchSource || "patient_chatbot",
    };

    setPrecheckFlow({
      ...createEmptyPrecheckFlow(),
      active: true,
      phase: "preparing",
      appointmentId,
      questionnaireId,
      appointmentContext: apptCtx,
      sessionContextKey: buildPrecheckSessionContextKey(defaultContextKey, appointmentId),
    });

    const timeStr = startAt ? ` on ${formatDate(startAt)} at ${formatTime(startAt)}` : "";

    setMessages([
      {
        role: "ai",
        text: `Welcome to your Pre-Appointment Check!\n\nThis quick questionnaire helps ${doctorName} (${specialty}) understand your condition before your visit${timeStr}. Your answers are shared securely with your care team.\n\nI'll ask one question at a time and adjust the next question based on your answers.`,
        time: new Date(),
        meta: "precheck-intro",
      }
    ]);
    setTyping(true);
    void preparePrecheckSession(apptCtx, questionnaireId);
  }

  async function submitCompletedPrecheck(finalResponses, finalRawResponses = precheckFlow.rawResponses || {}) {
    if (precheckFlow.appointmentId) {
      await actions.booking.submitPrecheckResponses(precheckFlow.appointmentId, {
        patientResponses: finalResponses,
        metadata: {
          source: "patient_precheck",
          workflow: "patient_precheck",
          sessionType: "precheck_chat",
          chatContextKey: precheckFlow.sessionContextKey || buildPrecheckSessionContextKey(defaultContextKey, precheckFlow.appointmentId),
          submittedFrom: precheckFlow.appointmentContext?.launchSource || "patient_chatbot",
          rawPatientResponses: finalRawResponses,
        },
      });
    }

    setPrecheckFlow((curr) => ({
      ...curr,
      active: false,
      responses: finalResponses,
      rawResponses: finalRawResponses,
      completed: true,
      submitting: false,
      phase: "complete",
    }));
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: `All done! Your pre-check answers have been submitted and shared with ${precheckFlow.appointmentContext?.doctorName || "your doctor"}. They'll review your responses before the appointment.\n\nThank you for preparing \u2014 this helps ensure a smoother consultation.`,
        time: new Date(),
        meta: `precheck-complete-${precheckFlow.questionnaireId}`,
      },
    ]);
  }

  async function preparePrecheckSession(apptCtx, initialQuestionnaireId = null) {
    try {
      let workingSnapshot = state;
      let questionnaire = getQuestionnaireByAppointmentId(workingSnapshot, apptCtx.appointmentId);

      if (actions?.booking?.ensurePrecheckQuestionnaire) {
        workingSnapshot = await actions.booking.ensurePrecheckQuestionnaire(apptCtx.appointmentId, {
          status: "sent_to_patient"
        });
        questionnaire = getQuestionnaireByAppointmentId(workingSnapshot, apptCtx.appointmentId) || questionnaire;
      }

      const useStaticQuestions = Array.isArray(questionnaire?.editedQuestions) && questionnaire.editedQuestions.length > 0;

      if (!useStaticQuestions && actions?.booking?.startAdaptivePrecheckSession) {
        workingSnapshot = await actions.booking.startAdaptivePrecheckSession(apptCtx.appointmentId);
        questionnaire = getQuestionnaireByAppointmentId(workingSnapshot, apptCtx.appointmentId) || questionnaire;
      }

      const activeQuestions = getQuestionnaireQuestions(questionnaire);
      const answeredCount = countAnsweredPrecheckResponses(questionnaire);
      const targetQuestionCount = getAdaptiveTargetQuestionCount(questionnaire, activeQuestions.length || DEFAULT_ADAPTIVE_PRECHECK_TARGET);
      const currentQuestion = activeQuestions[answeredCount] || null;

      if (!currentQuestion) {
        throw new Error("No AI pre-check questions available.");
      }

      setPrecheckFlow((curr) => ({
        ...curr,
        adaptive: !useStaticQuestions,
        phase: "dynamic",
        questionnaireId: questionnaire?.id || initialQuestionnaireId || curr.questionnaireId,
        dynamicQuestions: activeQuestions,
        currentDynamicIndex: answeredCount,
        responses: questionnaire?.patientResponses || {},
        rawResponses: questionnaire?.metadata?.rawPatientResponses || questionnaire?.patientResponses || {},
        targetQuestionCount,
      }));
      setMessages((prev) => {
        const introMessages = prev.filter((message) => message.meta === "precheck-intro");
        return [
          ...introMessages,
          ...buildPrecheckConversationMessages(questionnaire, targetQuestionCount)
        ];
      });
    } catch {
      setPrecheckFlow((curr) => ({
        ...curr,
        phase: "unavailable",
        dynamicQuestions: [],
        currentDynamicIndex: 0,
      }));
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I couldn't prepare your AI pre-check questions right now. Please try again shortly.",
          time: new Date(),
          meta: "precheck-unavailable",
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function processPrecheckAnswer(answerText, existingUserMessage = null) {
    const trimmed = String(answerText || "").trim();
    if (!trimmed) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Please share your answer to continue.", time: new Date() },
      ]);
      return;
    }

    const userMessage = existingUserMessage || { role: "user", text: trimmed, time: new Date() };
    if (!existingUserMessage) {
      setMessages((prev) => [...prev, userMessage]);
    }

    const { phase, dynamicQuestions, currentDynamicIndex } = precheckFlow;

    if (phase === "dynamic") {
      const currentQuestion = dynamicQuestions[currentDynamicIndex];
      if (!currentQuestion) return;

      const validation = normalizePrecheckAnswer(currentQuestion, trimmed);
      if (!validation.isValid) {
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: validation.message || "Please share a valid answer for this question.", time: new Date() },
        ]);
        return;
      }

      const nextResponses = { ...precheckFlow.responses, [currentQuestion.id]: validation.value };
      const nextRawResponses = { ...precheckFlow.rawResponses, [currentQuestion.id]: trimmed };
      setPrecheckFlow((curr) => ({
        ...curr,
        responses: nextResponses,
        rawResponses: nextRawResponses,
        submitting: true,
        phase: "submitting"
      }));
      setTyping(true);

      try {
        if (precheckFlow.adaptive && actions?.booking?.answerAdaptivePrecheckQuestion && precheckFlow.appointmentId) {
          const nextSnapshot = await actions.booking.answerAdaptivePrecheckQuestion(precheckFlow.appointmentId, {
            questionId: currentQuestion.id,
            answer: validation.value,
            rawAnswer: trimmed
          });
          const updatedQuestionnaire = getQuestionnaireByAppointmentId(nextSnapshot, precheckFlow.appointmentId);
          const updatedQuestions = getQuestionnaireQuestions(updatedQuestionnaire);
          const updatedResponses = updatedQuestionnaire?.patientResponses || nextResponses;
          const updatedRawResponses = updatedQuestionnaire?.metadata?.rawPatientResponses || nextRawResponses;
          const answeredCount = countAnsweredPrecheckResponses(updatedQuestionnaire);
          const targetQuestionCount = getAdaptiveTargetQuestionCount(
            updatedQuestionnaire,
            precheckFlow.targetQuestionCount || updatedQuestions.length || DEFAULT_ADAPTIVE_PRECHECK_TARGET
          );
          const nextQuestion = updatedQuestions[answeredCount] || null;

          if (nextQuestion) {
            setPrecheckFlow((curr) => ({
              ...curr,
              adaptive: true,
              responses: updatedResponses,
              rawResponses: updatedRawResponses,
              dynamicQuestions: updatedQuestions,
              currentDynamicIndex: answeredCount,
              targetQuestionCount,
              submitting: false,
              phase: "dynamic",
            }));
            setMessages((prev) => [
              ...prev,
              {
                role: "ai",
                text: buildDynamicQuestionPrompt(nextQuestion, answeredCount + 1, targetQuestionCount),
                time: new Date(),
              },
            ]);
            return;
          }

          await submitCompletedPrecheck(updatedResponses, updatedRawResponses);
          return;
        }

        const nextIndex = currentDynamicIndex + 1;
        const totalQuestions = precheckFlow.targetQuestionCount || dynamicQuestions.length;
        if (nextIndex < dynamicQuestions.length) {
          const nextQuestion = dynamicQuestions[nextIndex];
          setPrecheckFlow((curr) => ({
            ...curr,
            responses: nextResponses,
            rawResponses: nextRawResponses,
            currentDynamicIndex: nextIndex,
            submitting: false,
            phase: "dynamic",
          }));
          setMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: buildDynamicQuestionPrompt(nextQuestion, nextIndex + 1, totalQuestions),
              time: new Date(),
            },
          ]);
          return;
        }

        await submitCompletedPrecheck(nextResponses, nextRawResponses);
      } catch {
        setPrecheckFlow((curr) => ({ ...curr, submitting: false, phase: "dynamic" }));
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "I couldn't submit your pre-check right now. Please try once again.", time: new Date() },
        ]);
      } finally {
        setTyping(false);
      }
    }
  }

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typing]);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus?.();
    }, 150);

    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!patientMode) return;
    if (!open) return;
    if (inPrecheckSession) return;

    let cancelled = false;
    fetchSymptomChatMemory({
      contextKey: defaultContextKey,
      userId: session?.userId,
      role: session?.role,
      patientPhone: patient?.phone,
    })
      .then((result) => {
        if (cancelled) return;
        if (result?.memory?.summary) {
          setMessages((prev) => {
            const alreadyInjected = prev.some((item) => item.meta === "memory");
            if (alreadyInjected) return prev;

            return [
              ...prev,
              {
                role: "ai",
                text: `Continuing from your previous clinical context: ${result.memory.summary}`,
                time: new Date(),
                meta: "memory",
              },
            ];
          });
        }
      })
      .catch(() => {
        // no-op
      });

    return () => {
      cancelled = true;
    };
  }, [open, defaultContextKey, session?.userId, session?.role, patient?.phone, language, patientMode, inPrecheckSession]);

  useEffect(() => {
    if (!patientMode) return;
    if (inPrecheckSession) return;
    if (!realtimeEvents?.length) return;

    const latest = realtimeEvents[0];
    if (!latest?.message) return;

    setMessages((prev) => {
      const duplicate = prev.find((item) => item.meta === `event-${latest.id}`);
      if (duplicate) return prev;

      return [
        ...prev,
        {
          role: "ai",
          text: `Realtime update: ${latest.message}`,
          time: new Date(),
          triageLevel: latest.triage_level || "routine",
          escalationBand: latest.escalation_band || "green",
          meta: `event-${latest.id}`,
        },
      ];
    });
  }, [realtimeEvents, patientMode, inPrecheckSession]);

  const showBookingStrip =
    patientMode &&
    !inPrecheckSession &&
    bookingFlow.stage !== "symptoms";

  useEffect(() => {
    function handleOpenPrecheck(event) {
      const detail = event.detail || {};
      setOpen(true);
      startPrecheckFlow(detail);
    }

    window.addEventListener("nira:open-precheck", handleOpenPrecheck);
    return () => window.removeEventListener("nira:open-precheck", handleOpenPrecheck);
  }, [pendingPrecheckAppointments, wsNextAppointment, patient]);

  function speak(text) {
    if (!window?.speechSynthesis || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (precheckSessionClosedForInput) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setInput(text.trim());
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  async function handleBookingStageInput(text) {
    const lower = text.toLowerCase();

    if (bookingFlow.stage === "doctor") {
      const matchedDoctor = findDoctorFromText(rankedDoctors, text) || findDoctorFromText(bookableDoctors, text);
      if (matchedDoctor) {
        chooseDoctor(matchedDoctor);
        return true;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: ALL_DOCTORS_INTENT_REGEX.test(lower)
            ? "All available doctors are listed below. Pick the doctor you want, and I'll show the available appointment slots next."
            : "Choose a doctor from the list below. If you want a different doctor, all available doctors are already shown there.",
          time: new Date(),
        },
      ]);
      return true;
    }

    if (bookingFlow.stage === "slot") {
      if (/\b(change|different|another)\b.*\bdoctor\b/i.test(lower)) {
        restartGuidedBooking();
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "No problem. I've taken you back to the doctor list so you can choose someone else.",
            time: new Date(),
          },
        ]);
        return true;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Choose one of the available slots above for ${selectedDoctor?.fullName || "your selected doctor"}, and I'll confirm the booking next.`,
          time: new Date(),
        },
      ]);
      return true;
    }

    if (bookingFlow.stage === "confirm") {
      if (/\b(confirm|book|yes|go ahead|continue)\b/i.test(lower)) {
        await confirmBooking();
        return true;
      }

      if (/\b(slot|time|date)\b/i.test(lower)) {
        setBookingFlow((current) => ({
          ...current,
          stage: "slot",
          slotId: "",
        }));
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "Sure. Pick a different slot above and I'll update the booking summary.",
            time: new Date(),
          },
        ]);
        return true;
      }

      if (/\bdoctor\b/i.test(lower)) {
        restartGuidedBooking();
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "Sure. I've reopened the doctor list so you can choose a different doctor.",
            time: new Date(),
          },
        ]);
        return true;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Review the booking summary below, then tap Book appointment when you're ready.",
          time: new Date(),
        },
      ]);
      return true;
    }

    return false;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || typing || precheckSessionClosedForInput) return;

    const userMessage = { role: "user", text, time: new Date() };
    const nextMessages = [...messages, userMessage];
    setInput("");
    setMessages(nextMessages);

    if (patientMode && precheckFlow.active && !precheckFlow.completed && !precheckFlow.submitting) {
      await processPrecheckAnswer(text, userMessage);
      return;
    }

    if (
      patientMode &&
      PRECHECK_INTENT_REGEX.test(text) &&
      !precheckFlow.active &&
      defaultPrecheckAppointment
    ) {
      startPrecheckFlow({
        appointmentId: defaultPrecheckAppointment.id,
        doctorName: defaultPrecheckAppointment.doctor?.fullName,
        specialty: defaultPrecheckAppointment.doctor?.specialty,
        startAt: defaultPrecheckAppointment.startAt,
      });
      return;
    }

    if (patientMode && !inPrecheckSession && bookingFlow.stage !== "symptoms") {
      const handled = await handleBookingStageInput(text);
      if (handled) {
        return;
      }
    }

    if (guestMode) {
      const helpReply = buildGuestSupportReply(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: helpReply,
          time: new Date(),
        },
      ]);
      return;
    }

    setTyping(true);

    try {
      const response = await chatWithContextGunaEmr({
        messages: nextMessages.map((message) => ({
          role: message.role === "ai" ? "assistant" : "user",
          content: message.text,
        })),
        patientPhone: patient?.phone || patient?.emergencyContactPhone || "",
        userId: session?.userId,
        role: session?.role,
        language,
        contextKey: defaultContextKey,
      });

      const guidedUpdate = patientMode
        ? buildGuidedBookingUpdate({
            latestText: text,
            bookingFlow,
            doctors: bookableDoctors,
          })
        : {};

      const allowGuidedBookingInSymptoms =
        bookingFlow.stage === "symptoms" &&
        (response.readyForSubmission || response.appointmentBookingOffered);

      if (guidedUpdate.flow && patientMode && (bookingFlow.stage !== "symptoms" || allowGuidedBookingInSymptoms)) {
        setBookingFlow(guidedUpdate.flow);
      }

      let replyText = response.reply || "I can help summarize this for the doctor and guide the next step.";
      if (guidedUpdate.replyText && (bookingFlow.stage !== "symptoms" || allowGuidedBookingInSymptoms)) {
        replyText = guidedUpdate.replyText;
      }

      if (response.triageLevel === "emergency") {
        replyText = `${replyText}\n\nPlease do not wait for an online booking if you feel unsafe right now.`;
      }

      const aiMessage = {
        role: "ai",
        text: replyText,
        time: new Date(),
        summary: response.summary,
        detectedFocus: response.detectedFocus,
        triageLevel: response.triageLevel,
        escalationBand: response.escalationBand,
        ddiWarnings: response.ddiWarnings,
        adherenceTips: response.adherenceTips,
        fallbackChannels: response.fallbackChannels,
      };
      const conversationMessages = [
        ...nextMessages,
        {
          role: "ai",
          text: replyText,
          time: aiMessage.time,
        },
      ];

      setMessages((prev) => [
        ...prev,
        aiMessage,
      ]);

      if (patientMode && response.readyForSubmission && !intakeSubmitted) {
        let syncSnapshot = null;
        const submission = await submitSymptomChatToEmr({
          messages: conversationMessages.map((message) => ({
            role: message.role === "ai" ? "assistant" : "user",
            content: message.text,
          })),
          patientPhone: patient?.phone || patient?.emergencyContactPhone || "",
          patientName: patient?.fullName,
          userId: session?.userId,
          role: session?.role,
          language,
          contextKey: defaultContextKey,
        });

        if (submission?.success) {
          try {
            syncSnapshot = await actions.booking.syncChatbotSubmission({
              patientId: patient?.id,
              userId: session?.userId,
              language,
              messages: conversationMessages.map((message) => ({
                role: message.role === "ai" ? "assistant" : "user",
                content: message.text,
              })),
              submission,
            });
          } catch (syncError) {
            console.warn("[NIRA] Chatbot submission synced to EMR but local doctor workspace sync failed.", syncError);
          }

          const bookingSymptoms = response.summary || bookingFlow.symptoms || text;
          const recommendedDoctor = rankDoctorsForSymptoms(bookableDoctors, bookingSymptoms)[0] || null;
          setIntakeSubmitted(true);
          setTriageAppointmentId(syncSnapshot?.ui?.lastViewedAppointmentId || "");
          setBookingFlow({
            stage: bookableDoctors.length ? "doctor" : "symptoms",
            symptoms: bookingSymptoms,
            doctorId: "",
            slotDate: "",
            slotId: "",
          });
          setMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: buildPostTriageBookingReply(recommendedDoctor),
              time: new Date(),
              summary: submission.chat?.summary,
              triageLevel: submission.chat?.triageLevel,
              escalationBand: submission.chat?.escalationBand,
            },
          ]);
        }
      }
    } catch (error) {
      console.warn("[NIRA] Live chat unavailable, falling back to local response.", error);

      const offline = buildOfflineFallbackReply({ latestText: text });
      const guidedUpdate = patientMode
        ? buildGuidedBookingUpdate({
            latestText: text,
            bookingFlow,
            doctors: bookableDoctors,
            offlineMode: true,
          })
        : {};

      if (guidedUpdate.flow && patientMode) {
        setBookingFlow(guidedUpdate.flow);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: guidedUpdate.replyText || offline.text,
          time: new Date(),
          summary: offline.summary,
          triageLevel: offline.triageLevel,
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function resetBookingFlow() {
    setBookingFlow(createEmptyBookingFlow());
    setIntakeSubmitted(false);
    setTriageAppointmentId("");
  }

  function restartGuidedBooking() {
    setBookingFlow((current) => ({
      stage: intakeSubmitted || triageAppointmentId ? "doctor" : "symptoms",
      symptoms: current.symptoms,
      doctorId: "",
      slotDate: "",
      slotId: "",
    }));
  }

  function resetCompletedPrecheckSession() {
    setMessages([initialMessage]);
    setInput("");
    setTyping(false);
    resetBookingFlow();
    setPrecheckFlow(createEmptyPrecheckFlow());
  }

  function closeChatPanel() {
    if (precheckFlow.completed || precheckFlow.phase === "unavailable") {
      resetCompletedPrecheckSession();
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open || !precheckFlow.completed) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setMessages([initialMessage]);
      setInput("");
      setTyping(false);
      setIntakeSubmitted(false);
      setBookingFlow(createEmptyBookingFlow());
      setTriageAppointmentId("");
      setPrecheckFlow(createEmptyPrecheckFlow());
      setOpen(false);
    }, PRECHECK_AUTOCLOSE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [open, precheckFlow.completed, initialMessage]);

  function toggleChatPanel() {
    if (open) {
      closeChatPanel();
      return;
    }
    setOpen(true);
  }

  function chooseDoctor(doctor) {
    const nextSchedule = getDoctorSchedules(state || {}, doctor.id, 14).find((schedule) => schedule.slotSummary.available > 0) || doctor.nextSchedule || null;
    const nextSlot = nextSchedule?.slots.find((slot) => slot.status === "available") || null;
    const reservedDateForDoctor =
      triageLinkedAppointment && triageLinkedAppointment.doctorId === doctor.id
        ? String(triageLinkedAppointment.startAt || "").slice(0, 10)
        : "";
    const reservedSlotIdForDoctor =
      triageLinkedAppointment && triageLinkedAppointment.doctorId === doctor.id
        ? triageLinkedAppointment.slotId || ""
        : "";

    setBookingFlow({
      stage: "slot",
      symptoms: bookingFlow.symptoms,
      doctorId: doctor.id,
      slotDate: reservedDateForDoctor || nextSchedule?.date || state?.meta?.today || "",
      slotId: reservedSlotIdForDoctor || nextSlot?.id || "",
    });

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: `Great choice. I'm showing the available appointment slots for ${doctor.fullName} next.`,
        time: new Date(),
      },
    ]);
  }

  function chooseSlot(date, slotId) {
    setBookingFlow((current) => ({
      ...current,
      stage: "confirm",
      slotDate: date,
      slotId,
    }));

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "Perfect \u2014 review the summary below, then confirm to book the appointment.",
        time: new Date(),
      },
    ]);
  }

  async function confirmBooking() {
    if (!selectedDoctor || !bookingFlow.slotId || !selectedSchedule || session?.role !== "patient" || !patient) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Please sign in as a patient before confirming an appointment.",
          time: new Date(),
        },
      ]);
      return;
    }

    const slot = selectedSchedule.slots.find((entry) => entry.id === bookingFlow.slotId)
      || (reservedTriageSlot?.id === bookingFlow.slotId ? reservedTriageSlot : null);
    if (!slot) {
      return;
    }

    setTyping(true);

    try {
      let snapshot;
      let appointmentId = triageAppointmentId;

      if (triageAppointmentId && actions?.booking?.rescheduleAppointment) {
        snapshot = await actions.booking.rescheduleAppointment(triageAppointmentId, {
          doctorId: selectedDoctor.id,
          slotId: slot.id,
          date: selectedSchedule.date,
          visitType: "booked",
          finalizeChatbotBooking: true,
        });
      } else {
        snapshot = await actions.booking.bookAppointment({
          patientId: patient.id,
          doctorId: selectedDoctor.id,
          slotId: slot.id,
          date: selectedSchedule.date,
          bookedByUserId: session.userId,
          visitType: "booked",
          language: "en",
        });

        appointmentId = snapshot.ui.lastViewedAppointmentId;
      }

      const appointment = snapshot.appointments.byId[appointmentId];
      const doctor = snapshot.doctors.byId[appointment.doctorId];

      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `Done \u2014 I booked ${doctor.fullName} on ${formatDate(appointment.startAt)} at ${formatTime(appointment.startAt)}. Token ${appointment.token}.`,
          time: new Date(),
          appointment: {
            appointment,
            doctor,
          },
        },
      ]);

      resetBookingFlow();
    } finally {
      setTyping(false);
    }
  }

  if (shouldHideChat) {
    return null;
  }

  return (
    <>
      <motion.button
        onClick={toggleChatPanel}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        title={open ? "Close AI chat" : "Open AI chat"}
        className={cn(
          "fixed z-50 transition-all",
          avoidsPatientFloatingBook ? "bottom-24 right-4 sm:right-5" : "bottom-6 right-6",
          patientMode
            ? "flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-brand-sky/15 bg-white/95 text-brand-midnight shadow-[0_22px_46px_-26px_rgba(41,53,93,0.32)] backdrop-blur-xl"
            : "flex h-14 w-14 items-center justify-center rounded-full",
          patientMode
            ? open
              ? "ring-1 ring-brand-sky/20 shadow-[0_24px_50px_-26px_rgba(41,53,93,0.34)]"
              : "hover:-translate-y-0.5 hover:border-brand-sky/25 hover:shadow-[0_26px_52px_-26px_rgba(41,53,93,0.36)]"
            : open
              ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/25 hover:shadow-xl"
              : "bg-gradient-to-br from-brand-tide to-brand-sky shadow-lg shadow-brand-sky/30 hover:shadow-xl hover:shadow-brand-sky/40"
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        {!open && !patientMode && (
          <motion.span
            className="absolute inset-0 rounded-full bg-brand-sky/30"
            animate={{ scale: [1, 1.6, 1.6], opacity: [0.5, 0, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span
          className={cn(
            "relative",
            patientMode
              ? "flex items-center justify-center"
              : ""
          )}
        >
          {open ? (
            <X className={cn("h-5 w-5", patientMode ? "text-brand-midnight" : "text-white")} />
          ) : patientMode ? (
            <NiraChatbotMark size="xl" className="h-10 w-10" />
          ) : (
            <MessageCircle className="h-5 w-5 text-white" />
          )}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden",
              patientMode
                ? "nira-chat-shell-patient h-[min(88vh,780px)] w-[min(calc(100vw-0.75rem),500px)]"
                : "h-[min(84vh,700px)] w-[min(calc(100vw-1rem),460px)] rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,252,255,0.98))] shadow-[0_28px_80px_rgba(11,21,44,0.22),0_0_0_1px_rgba(255,255,255,0.65)] backdrop-blur-2xl",
              avoidsPatientFloatingBook
                ? "bottom-40 right-2 sm:right-5"
                : "bottom-20 right-2 sm:bottom-24 sm:right-6"
            )}
          >
            {patientMode ? (
              <div className="relative px-3 pb-3 pt-3 sm:px-4">
                <div className="relative nira-chat-soft-panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-sky/25 bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(224,247,248,0.98))] p-1 shadow-[0_8px_22px_-12px_rgba(0,138,142,0.45)] ring-1 ring-brand-sky/10">
                      <NiraChatbotMark size="xl" className="h-[2.125rem] w-[2.125rem]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mt-2 text-lg font-semibold tracking-tight text-brand-midnight">{patientHeaderTitle}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{patientHeaderDescription}</p>
                      {inPrecheckSession && precheckFlow.appointmentContext?.doctorName ? (
                        <div className="mt-2 text-xs font-medium text-slate-500">
                          For {precheckFlow.appointmentContext.doctorName}
                          {precheckFlow.appointmentContext.startAt ? ` on ${formatDate(precheckFlow.appointmentContext.startAt)} at ${formatTime(precheckFlow.appointmentContext.startAt)}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeChatPanel}
                      className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-brand-midnight"
                      aria-label="Close chat"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative flex items-center gap-3 bg-gradient-to-r from-brand-midnight via-brand-tide to-brand-sky px-5 py-4 shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_70%)]" />
              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/20 p-1 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)] ring-1 ring-white/35 backdrop-blur-sm">
                <NiraChatbotMark size="lg" onDark className="h-8 w-8" />
              </div>
              <div className="relative flex-1 min-w-0">
                <div className="text-sm font-bold tracking-wide text-white">{patientHeaderTitle}</div>
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {inPrecheckSession ? "Pre-appointment chatbot" : guestMode ? "Support chatbot" : "Clinical chatbot \u00B7 Online"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold tracking-wide text-white/85">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/15">
                    {guestMode ? "Support mode" : inPrecheckSession ? "Dedicated pre-check" : "AI intake"}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/15">
                    {patientMode ? "Saved to EMR" : "Login • Signup • Contact"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChatPanel}
                className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
              </div>
            )}

            {inPrecheckSession ? (
              <div className={cn("px-3 pb-3 sm:px-4", patientMode ? "" : "border-b border-brand-sky/20 bg-gradient-to-r from-brand-sky/5 to-brand-mint/5 px-4 py-3")}>
                <div className={cn(patientMode ? "nira-chat-soft-panel px-4 py-3" : "")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className={cn("h-4 w-4", patientMode ? "text-brand-tide" : "text-brand-tide")} />
                      <span className={cn("text-sm font-semibold", patientMode ? "text-brand-midnight" : "text-brand-midnight")}>Pre-Check Questionnaire</span>
                    </div>
                    <span className={cn("text-xs font-medium", patientMode ? "text-muted" : "text-muted")}>
                      {getPrecheckProgressLabel(precheckFlow)}
                    </span>
                  </div>
                  <div className={cn("mt-3 h-1.5 overflow-hidden rounded-full", patientMode ? "bg-slate-100" : "bg-slate-100")}>
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        patientMode
                          ? "bg-gradient-to-r from-brand-tide to-brand-sky"
                          : "bg-gradient-to-r from-brand-tide to-brand-sky"
                      )}
                      style={{ width: `${getPrecheckProgressPercent(precheckFlow)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : showBookingStrip ? (
              <div className={cn("px-3 pb-3 sm:px-4", patientMode ? "" : "border-b border-slate-100 bg-white/90 px-4 py-3")}>
                <div className={cn(patientMode ? "nira-chat-soft-panel px-4 py-3" : "")}>
                  {patientMode ? (
                    <div className="mb-3 text-sm font-medium text-slate-600">
                      Step {Math.max(bookingStageIndex + 1, 1)} of {BOOKING_STEPS.length}: {BOOKING_STEPS[Math.max(bookingStageIndex, 0)]?.label || BOOKING_STEPS[0].label}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1.5">
                  {BOOKING_STEPS.map((step, index) => {
                    const active = index === bookingStageIndex || (bookingStageIndex === -1 && index === 0);
                    const done = bookingStageIndex > index;

                    return (
                      <div key={step.key} className="flex flex-1 items-center gap-1.5">
                        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                              active
                                ? patientMode
                                  ? "bg-brand-tide text-white shadow-sm shadow-brand-sky/20"
                                  : "bg-gradient-to-br from-brand-tide to-brand-sky text-white shadow-sm shadow-brand-sky/25"
                                : done
                                  ? patientMode ? "bg-emerald-500 text-white" : "bg-emerald-500 text-white"
                                  : patientMode ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-400"
                            )}
                          >
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                          </div>
                          <div className={cn("text-[10px] font-semibold text-center leading-tight", active ? (patientMode ? "text-brand-tide" : "text-brand-tide") : done ? (patientMode ? "text-emerald-600" : "text-emerald-600") : patientMode ? "text-slate-400" : "text-slate-400")}>
                            {step.label}
                          </div>
                        </div>
                        {index < BOOKING_STEPS.length - 1 && (
                          <div className={cn("h-px w-full flex-1 min-w-2", done ? (patientMode ? "bg-emerald-300" : "bg-emerald-300") : patientMode ? "bg-slate-200" : "bg-slate-200")} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            ) : null}

            <div
              className={cn(
                "flex-1 space-y-3 overflow-y-auto",
                patientMode
                  ? "nira-chat-scroll-patient px-3 pb-3 pt-1 sm:px-4"
                  : "bg-gradient-to-b from-slate-50/50 to-white p-3 sm:p-4"
              )}
              role="log"
              aria-live="polite"
              aria-label="AI chat messages"
            >

            {patientMode && !inPrecheckSession && bookingFlow.stage === "symptoms" ? (
                <div className={cn(patientMode ? "nira-chat-hero-card" : "rounded-[1.5rem] border border-brand-sky/15 bg-[linear-gradient(135deg,rgba(224,247,248,0.9),rgba(255,255,255,0.96))] p-4 shadow-sm ring-1 ring-black/[0.03]")}>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl",
                      patientMode
                        ? "border border-brand-sky/10 bg-brand-mint text-brand-tide"
                        : "bg-white shadow-sm ring-1 ring-brand-sky/15"
                    )}>
                      <Sparkles className={cn("h-5 w-5", patientMode ? "text-brand-tide" : "text-brand-tide")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-semibold", patientMode ? "text-brand-midnight" : "text-brand-midnight")}>Quick start</div>
                      <p className={cn("mt-1 text-xs leading-5", patientMode ? "text-muted" : "text-muted")}>
                        Pick one to begin, or type your symptoms in your own words.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() => setInput(prompt.value)}
                        className={cn(
                          "text-xs font-semibold transition-all",
                          patientMode
                            ? "rounded-full border border-brand-sky/15 bg-white px-3 py-2 text-brand-midnight shadow-sm hover:-translate-y-0.5 hover:border-brand-sky/30 hover:bg-brand-mint/40"
                            : "rounded-full border border-brand-tide/10 bg-white px-3 py-1.5 text-ink shadow-sm hover:-translate-y-0.5 hover:border-brand-sky hover:bg-brand-mint/40 hover:shadow-md"
                        )}
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {patientMode && precheckFlow.active && precheckFlow.phase === "dynamic" && activePrecheckQuestion?.options?.length ? (
                <div className={cn(patientMode ? "nira-chat-soft-panel p-3" : "rounded-2xl border border-brand-tide/10 bg-white p-3 shadow-sm ring-1 ring-black/[0.03]")}>
                  <div className={cn("text-xs font-semibold", patientMode ? "text-brand-tide" : "text-brand-tide")}>Quick answers</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activePrecheckQuestion.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={precheckFlow.submitting}
                        onClick={() => processPrecheckAnswer(option)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60",
                          patientMode
                            ? "border border-brand-sky/15 bg-white text-brand-midnight hover:-translate-y-0.5 hover:border-brand-sky/30 hover:bg-brand-mint/30"
                            : "border border-slate-200 bg-white text-ink shadow-sm hover:border-brand-sky hover:bg-brand-mint/30 hover:shadow-md hover:-translate-y-0.5"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {patientMode && precheckFlow.active && precheckFlow.phase === "dynamic" && activePrecheckQuestion?.type === "yesno" ? (
                <div className={cn(patientMode ? "nira-chat-soft-panel p-3" : "rounded-2xl border border-brand-tide/10 bg-white p-3 shadow-sm ring-1 ring-black/[0.03]")}>
                  <div className={cn("text-xs font-semibold", patientMode ? "text-brand-tide" : "text-brand-tide")}>Quick answers</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Yes", "No"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={precheckFlow.submitting}
                        onClick={() => processPrecheckAnswer(option.toLowerCase())}
                        className={cn(
                          "rounded-full px-4 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60",
                          patientMode
                            ? "border border-brand-sky/15 bg-white text-brand-midnight hover:-translate-y-0.5 hover:border-brand-sky/30 hover:bg-brand-mint/30"
                            : "border border-slate-200 bg-white text-ink shadow-sm hover:border-brand-sky hover:bg-brand-mint/30 hover:shadow-md hover:-translate-y-0.5"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((message, index) => (
                <motion.div
                  key={`${message.role}-${index}-${message.time?.toString?.() || index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  {message.role === "ai" && (
                    <div className={cn(
                      "flex flex-shrink-0 items-center justify-center",
                      patientMode
                        ? "mt-1 h-9 w-9 rounded-[1rem] border border-brand-sky/20 bg-gradient-to-br from-brand-mint via-white to-brand-mint/70 p-1 shadow-sm ring-1 ring-white/90"
                        : "h-7 w-7 rounded-full border border-brand-sky/30 bg-white p-0.5 shadow-md shadow-brand-tide/20 ring-1 ring-white"
                    )}>
                      <NiraChatbotMark
                        size={patientMode ? "md" : "sm"}
                        className={patientMode ? "h-7 w-7" : "h-6 w-6"}
                      />
                    </div>
                  )}
                  <div className="max-w-[86%]">
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:px-4",
                        message.role === "user"
                          ? patientMode
                            ? "nira-chat-bubble-user rounded-br-[0.65rem]"
                            : "rounded-br-md bg-gradient-to-r from-brand-midnight to-brand-tide/90 text-white shadow-sm"
                          : patientMode
                            ? "nira-chat-bubble-ai rounded-bl-[0.65rem]"
                            : "rounded-bl-md bg-white text-ink shadow-sm ring-1 ring-black/[0.04]"
                      )}
                    >
                      {message.text.split("\n").map((line, lineIndex, lines) => (
                        <span key={`${index}-${lineIndex}`}>
                          {line}
                          {lineIndex < lines.length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                    {message.role === "ai" ? (
                      <button
                        type="button"
                        onClick={() => speak(message.text)}
                        className={cn(
                          "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition",
                          patientMode
                            ? "border border-slate-200 bg-white text-slate-500 hover:border-brand-sky/20 hover:bg-brand-mint/40 hover:text-brand-tide"
                            : "border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm hover:border-brand-sky/30 hover:bg-brand-mint/30 hover:text-brand-tide"
                        )}
                      >
                        <Volume2 className="h-3 w-3" />
                        Listen
                      </button>
                    ) : null}
                    {showClinicianIntakeMeta && message.summary ? (
                      <div className={cn(
                        "mt-2 rounded-[1.1rem] px-3 py-2.5 text-xs leading-5",
                        patientMode
                          ? "border border-brand-sky/10 bg-brand-mint/40 text-muted"
                          : "border border-brand-sky/15 bg-[linear-gradient(135deg,rgba(224,247,248,0.92),rgba(255,255,255,0.96))] text-muted shadow-sm"
                      )}>
                        <div className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide", patientMode ? "text-brand-tide" : "text-brand-tide")}>
                          <Sparkles className="h-3.5 w-3.5" />
                          Clinical snapshot
                        </div>
                        <div className={cn("mt-1.5 text-sm leading-5", patientMode ? "text-ink" : "text-ink")}>{message.summary}</div>
                      </div>
                    ) : null}
                    {showClinicianIntakeMeta && message.detectedFocus ? (
                      <div className={cn(
                        "mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        patientMode
                          ? "bg-brand-mint/60 text-brand-midnight ring-1 ring-brand-sky/20"
                          : "bg-brand-mint/60 text-brand-midnight ring-1 ring-brand-sky/20"
                      )}>
                        Detected focus: {message.detectedFocus}
                      </div>
                    ) : null}
                    {showClinicianIntakeMeta && message.escalationBand ? (
                      <div
                        className={cn(
                          "mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          message.escalationBand === "red"
                            ? patientMode ? "bg-red-100 text-red-700" : "bg-red-100 text-red-700"
                            : message.escalationBand === "yellow"
                              ? patientMode ? "bg-amber-100 text-amber-700" : "bg-amber-100 text-amber-700"
                              : patientMode ? "bg-emerald-100 text-emerald-700" : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        Escalation {message.escalationBand.toUpperCase()}
                      </div>
                    ) : null}
                    {Array.isArray(message.ddiWarnings) && message.ddiWarnings.length > 0 ? (
                      <div className={cn(
                        "mt-2 rounded-2xl p-3 text-xs",
                        patientMode
                          ? "border border-amber-200 bg-amber-50 text-amber-900 shadow-soft"
                          : "border border-amber-200 bg-amber-50 text-amber-900 shadow-soft"
                      )}>
                        <div className="font-semibold">Drug interaction warnings</div>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {message.ddiWarnings.map((item, itemIndex) => (
                            <li key={`${item.medications.join("-")}-${itemIndex}`}>
                              <span className="font-semibold">{item.severity.toUpperCase()}:</span> {item.warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {Array.isArray(message.adherenceTips) && message.adherenceTips.length > 0 ? (
                      <div className={cn(
                        "mt-2 rounded-2xl p-3 text-xs",
                        patientMode
                          ? "border border-cyan-200 bg-cyan-50 text-cyan-900 shadow-soft"
                          : "border border-cyan-200 bg-cyan-50 text-cyan-900 shadow-soft"
                      )}>
                        <div className="font-semibold">Medication adherence</div>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {message.adherenceTips.map((tip, tipIndex) => (
                            <li key={`${tipIndex}-${tip}`}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {message.fallbackChannels?.reason ? (
                      <div className={cn(
                        "mt-2 rounded-2xl px-3 py-2 text-[11px]",
                        patientMode
                          ? "border border-slate-200 bg-slate-50 text-slate-700"
                          : "border border-slate-200 bg-slate-50 text-slate-700"
                      )}>
                        Fallback: {message.fallbackChannels.reason}
                      </div>
                    ) : null}
                    {message.appointment ? (
                      <div className={cn(
                        "mt-2 rounded-2xl p-3 text-xs",
                        patientMode
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-soft"
                          : "border border-emerald-200 bg-emerald-50 text-emerald-900 shadow-soft"
                      )}>
                        <div className="flex items-center gap-2 font-semibold">
                          <CalendarClock className="h-4 w-4" />
                          Appointment booked
                        </div>
                        <div className="mt-2">
                          {message.appointment.doctor.fullName} on {formatDate(message.appointment.appointment.startAt)} at {formatTime(message.appointment.appointment.startAt)}
                        </div>
                        <div className="mt-1">Token {message.appointment.appointment.token}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/patient/appointments/${message.appointment.appointment.id}?bucket=action`)}
                          className={cn(
                            "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition",
                            patientMode
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                        >
                          Open appointment
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {message.role === "user" && (
                    <div className={cn(
                      "flex flex-shrink-0 items-center justify-center",
                      patientMode
                        ? "mt-1 h-9 w-9 rounded-[1rem] border border-brand-sky/10 bg-white"
                        : "h-7 w-7 rounded-full bg-brand-midnight/10 ring-1 ring-brand-midnight/5"
                    )}>
                      <User className={cn(patientMode ? "h-4 w-4 text-brand-tide" : "h-3.5 w-3.5 text-brand-midnight")} />
                    </div>
                  )}
                </motion.div>
              ))}

              {patientMode && !inPrecheckSession && bookingFlow.stage === "doctor" ? (
                <div className="nira-chat-soft-panel space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <User className="h-4 w-4 text-brand-tide" />
                        Step 2 \u2014 Available doctors
                      </div>
                      <p className="mt-1 text-xs text-muted">Match based on your symptoms: {bookingFlow.symptoms || "not captured yet"}</p>
                    </div>
                    <button type="button" onClick={restartGuidedBooking} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-brand-sky/20 hover:bg-brand-mint/30 hover:text-brand-midnight">
                      Restart booking
                    </button>
                  </div>

                  {suggestedDoctorForBooking ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
                      Suggested doctor: <span className="font-semibold">{suggestedDoctorForBooking.fullName}</span>
                      {suggestedDoctorForBooking.specialty ? ` (${suggestedDoctorForBooking.specialty})` : ""}. If you want another doctor, pick any option below.
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    {rankedDoctors.map((doctor) => {
                      const slots = doctor.nextSchedule?.slots.filter((slot) => slot.status === "available").slice(0, 3) || [];
                      const isRecommended = suggestedDoctorForBooking?.id === doctor.id;
                      return (
                        <button
                          key={doctor.id}
                          type="button"
                          onClick={() => chooseDoctor(doctor)}
                          className={cn(
                            "rounded-[1.35rem] border p-3.5 text-left transition hover:-translate-y-0.5",
                            isRecommended
                              ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                              : "border-slate-200 bg-white hover:border-brand-sky/25 hover:bg-brand-mint/20"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-ink">{doctor.fullName}</div>
                              <div className="text-xs text-muted">{doctor.specialty || "General Practice"}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {isRecommended ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  Recommended
                                </span>
                              ) : null}
                              <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">
                                {doctor.nextAvailableSlot ? `${formatDate(doctor.nextAvailableSlot.startAt)} \u00B7 ${formatTime(doctor.nextAvailableSlot.startAt)}` : "No slots"}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {slots.length ? (
                              slots.map((slot) => (
                                <span key={slot.id} className="rounded-full bg-brand-sky px-2.5 py-1 text-[11px] font-semibold text-white">
                                  {formatTime(slot.startAt)}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted">Live slots loading...</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {patientMode && !inPrecheckSession && bookingFlow.stage === "slot" && selectedDoctor ? (
                <div className="nira-chat-soft-panel space-y-3 p-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <CalendarDays className="h-4 w-4 text-brand-tide" />
                      Step 3 \u2014 Pick a slot for {selectedDoctor.fullName}
                    </div>
                    <p className="mt-1 text-xs text-muted">Choose a date first, then tap a live available time.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableDates.map(({ date, slotSummary }) => (
                      <button
                        key={date}
                        type="button"
                        onClick={() =>
                          setBookingFlow((current) => ({
                            ...current,
                            slotDate: date,
                            slotId: "",
                          }))
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                          bookingFlow.slotDate === date
                            ? "border-brand-sky bg-brand-mint text-ink"
                            : "border-line bg-white text-muted hover:bg-surface-2"
                        )}
                      >
                        {formatDate(`${date}T00:00:00+05:30`)} ({reservedSlotDate === date && slotSummary.available === 0 ? "Reserved" : slotSummary.available})
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => chooseSlot(selectedSchedule.date, slot.id)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                          bookingFlow.slotId === slot.id
                            ? "border-brand-sky bg-brand-sky text-white"
                            : slot.status === "reserved"
                              ? "border-emerald-200 bg-emerald-50 text-ink hover:-translate-y-0.5"
                            : "border-cyan-200 bg-cyan-50 text-ink hover:-translate-y-0.5"
                        )}
                      >
                        <div>
                          {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
                        </div>
                        <div className="mt-1 text-[11px] font-normal opacity-80">
                          {slot.status === "reserved" ? "Reserved for your triage" : "Tap to continue"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {patientMode && !inPrecheckSession && bookingFlow.stage === "confirm" && selectedDoctor && bookingFlow.slotId && selectedSchedule ? (
                <div className="nira-chat-soft-panel p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    Step 4 \u2014 Confirm booking
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-emerald-900">
                    <div>
                      <span className="font-semibold">Symptoms:</span> {bookingFlow.symptoms || "Not shared"}
                    </div>
                    <div>
                      <span className="font-semibold">Doctor:</span> {selectedDoctor.fullName}
                    </div>
                    <div>
                      <span className="font-semibold">Slot:</span> {formatDate(`${selectedSchedule.date}T00:00:00+05:30`)} at {formatTime((selectedSchedule.slots.find((slot) => slot.id === bookingFlow.slotId) || selectedSchedule.slots[0]).startAt)}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={confirmBooking}
                      disabled={typing}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Book appointment
                    </button>
                    <button
                      type="button"
                      onClick={restartGuidedBooking}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                    >
                      Change doctor or slot
                    </button>
                  </div>
                </div>
              ) : null}

              {typing && (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex items-center justify-center",
                    patientMode
                      ? "h-9 w-9 rounded-[1rem] border border-brand-sky/20 bg-gradient-to-br from-brand-mint via-white to-brand-mint/70 p-1 shadow-sm ring-1 ring-white/90"
                      : "h-7 w-7 rounded-full border border-brand-sky/30 bg-white p-0.5 shadow-md shadow-brand-tide/20 ring-1 ring-white"
                  )}>
                    <NiraChatbotMark
                      size={patientMode ? "md" : "sm"}
                      className={patientMode ? "h-7 w-7" : "h-6 w-6"}
                    />
                  </div>
                  <div className={cn(
                    "rounded-2xl rounded-bl-md px-4 py-3",
                    patientMode
                      ? "nira-chat-bubble-ai"
                      : "bg-white shadow-sm ring-1 ring-black/[0.04]"
                  )}>
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-tide/60" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-sky/60" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-brand-tide/60" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className={cn(
              patientMode
                ? "border-t border-slate-200/80 bg-white/95 px-3 pb-3 pt-3 backdrop-blur-xl sm:px-4 sm:pb-4"
                : "border-t border-slate-100 bg-white/90 p-3 backdrop-blur-sm"
            )}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend();
                }}
                className={cn("flex items-center gap-2", patientMode ? "nira-chat-composer" : "")}
              >
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={guestMode || precheckSessionClosedForInput}
                  aria-label="Voice input"
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-all",
                    isListening
                      ? patientMode
                        ? "animate-pulse border-brand-sky/30 bg-brand-mint text-brand-tide shadow-sm shadow-brand-sky/20"
                        : "border-brand-sky bg-brand-sky/10 text-brand-sky shadow-sm shadow-brand-sky/20"
                      : patientMode
                        ? "border-slate-200 bg-white text-slate-500 hover:border-brand-sky/25 hover:bg-brand-mint/30 hover:text-brand-tide"
                        : "border-slate-200 bg-white text-slate-500 hover:border-brand-sky/40 hover:bg-brand-mint/30 hover:text-brand-tide",
                    guestMode || precheckSessionClosedForInput ? "cursor-not-allowed opacity-50" : ""
                  )}
                  title="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  aria-label="Type your message"
                  placeholder={
                    precheckSessionClosedForInput
                      ? precheckFlow.phase === "unavailable"
                        ? "AI pre-check unavailable. Close and try again."
                        : "Pre-check submitted. Close to return to the chatbot."
                      : precheckFlow.active && !precheckFlow.completed
                      ? precheckFlow.phase === "preparing"
                        ? "Preparing AI questions..."
                        : "Type your answer..."
                      : guestMode
                      ? "Ask about login, signup, or support..."
                      : bookingFlow.stage === "symptoms"
                      ? "Describe your symptoms..."
                      : bookingFlow.stage === "doctor"
                        ? "Choose a doctor or ask for another one..."
                        : bookingFlow.stage === "slot"
                          ? "Choose a slot above..."
                          : "Review and confirm..."
                  }
                  disabled={precheckFlow.phase === "preparing" || precheckSessionClosedForInput}
                  className={cn(
                    "flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all disabled:cursor-not-allowed",
                    patientMode
                      ? "border border-slate-200 bg-white text-ink placeholder:text-slate-400 focus:border-brand-tide/50 focus:ring-2 focus:ring-brand-tide/10 disabled:bg-slate-50"
                      : "border border-slate-200 bg-white text-ink placeholder:text-slate-400 focus:border-brand-tide/50 focus:ring-2 focus:ring-brand-tide/10 disabled:bg-slate-50"
                  )}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing || precheckFlow.submitting || precheckFlow.phase === "preparing" || precheckSessionClosedForInput}
                  aria-label="Send message"
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all disabled:opacity-40 disabled:shadow-none",
                    patientMode
                      ? "bg-gradient-to-r from-brand-tide to-brand-sky shadow-sm hover:shadow-md hover:shadow-brand-sky/25"
                      : "bg-gradient-to-r from-brand-tide to-brand-sky shadow-sm hover:shadow-md hover:shadow-brand-sky/25"
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function buildGuestSupportReply(latestText) {
  const lower = latestText.toLowerCase();

  if (LOGIN_HELP_INTENT_REGEX.test(lower)) {
    return "To login: open the Auth page, choose Patient or Hospital, then select Doctor, Nurse, or Admin inside Hospital. Enter your registered credentials to continue.";
  }

  if (CONTACT_HELP_INTENT_REGEX.test(lower)) {
    return "For support, please contact your clinic front desk or NIRA support team. If access is blocked, share your role, registered phone/email, and clinic name so admin can help quickly.";
  }

  if (BOOKING_INTENT_REGEX.test(lower)) {
    return "Booking is available only after patient login. Please sign in first, then I can guide symptoms, doctor selection, live slots, and confirmation.";
  }

  return "Before login, I can help only with login/signup steps and support contact guidance. Once you log in as a patient, I can assist with booking appointments.";
}

function createEmptyBookingFlow() {
  return {
    stage: "symptoms",
    symptoms: "",
    doctorId: "",
    slotDate: "",
    slotId: "",
  };
}

function buildPostTriageBookingReply(suggestedDoctor) {
  if (!suggestedDoctor) {
    return "Your triage has been converted to EMR.\n\nChoose a doctor below, and I'll show the available appointment slots next.";
  }

  return `Your triage has been converted to EMR.\n\nBased on what you shared, I suggest ${suggestedDoctor.fullName}${suggestedDoctor.specialty ? ` (${suggestedDoctor.specialty})` : ""}. If you want another doctor, choose from the full list below and I'll show the available appointment slots next.`;
}

function createEmptyPrecheckFlow() {
  return {
    active: false,
    phase: null,
    appointmentId: null,
    questionnaireId: null,
    appointmentContext: null,
    dynamicQuestions: [],
    currentDynamicIndex: 0,
    responses: {},
    rawResponses: {},
    adaptive: true,
    targetQuestionCount: DEFAULT_ADAPTIVE_PRECHECK_TARGET,
    completed: false,
    submitting: false,
    sessionContextKey: "",
  };
}

function buildPrecheckSessionContextKey(baseContextKey, appointmentId) {
  if (!appointmentId) {
    return baseContextKey;
  }

  return `${baseContextKey}:precheck:${appointmentId}`;
}

function buildGuidedBookingUpdate({ latestText, bookingFlow, doctors, offlineMode = false }) {
  const lower = latestText.toLowerCase();
  const bookingIntent = BOOKING_INTENT_REGEX.test(lower);
  const hasSymptoms = isLikelySymptomInput(latestText, bookingIntent);

  if (EMERGENCY_INTENT_REGEX.test(lower)) {
    return {
      replyText: "Your symptoms may indicate an emergency. Please call emergency services now or go to the nearest emergency department immediately.",
      flow: {
        stage: "symptoms",
        symptoms: "",
        doctorId: "",
        slotDate: "",
        slotId: "",
      },
    };
  }

  if (bookingFlow.stage === "symptoms") {
    if (hasSymptoms) {
      return {
        replyText: `Thanks \u2014 I noted: "${latestText}". Step 2 of 4: choose a doctor from the cards below, then I'll show the live slots.`,
        flow: {
          stage: "doctor",
          symptoms: latestText,
          doctorId: "",
          slotDate: "",
          slotId: "",
        },
      };
    }

    if (bookingIntent) {
      return {
        replyText: offlineMode
          ? "I can help with booking, but first share the reason for your visit or main concern. Then I’ll show doctors and available slots."
          : "I can help with booking, but first share the reason for your visit or main concern. After that I’ll show doctors and live slots.",
      };
    }
  }

  if (bookingFlow.stage === "doctor") {
    return {
      replyText: "Great \u2014 choose one of the doctors below and I'll move to the available slots next.",
    };
  }

  if (bookingFlow.stage === "slot" && bookingFlow.doctorId) {
    return {
      replyText: `Nice. Step 3 is ready \u2014 choose a slot for ${doctors.find((doctor) => doctor.id === bookingFlow.doctorId)?.fullName || "your selected doctor"} and then confirm.`,
    };
  }

  if (bookingFlow.stage === "confirm") {
    return {
      replyText: "Review the summary and tap Book appointment when you're ready.",
    };
  }

  return {};
}

function isLikelySymptomInput(latestText, bookingIntent) {
  const text = latestText.trim();
  const lower = text.toLowerCase();

  if (!text || NON_CLINICAL_CHAT_REGEX.test(text)) return false;
  if (SYMPTOM_SIGNAL_REGEX.test(lower)) return true;

  const hasTimeline = /\b(today|yesterday|since|for|day|days|week|weeks|month|months|hour|hours)\b/i.test(lower);
  const hasSeverity = /\b(mild|moderate|severe|worse|better|improving|persistent)\b/i.test(lower);

  if (hasTimeline || hasSeverity) return true;

  return false;
}

function rankDoctorsForSymptoms(doctors, symptomsText) {
  const lower = symptomsText.toLowerCase();

  return [...doctors].sort((left, right) => {
    const leftScore = scoreDoctorForSymptoms(left, lower);
    const rightScore = scoreDoctorForSymptoms(right, lower);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftTime = left.nextAvailableSlot ? new Date(left.nextAvailableSlot.startAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.nextAvailableSlot ? new Date(right.nextAvailableSlot.startAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
}

function findDoctorFromText(doctors, latestText) {
  const lower = String(latestText || "").toLowerCase().trim();
  if (!lower || lower.length < 3) {
    return null;
  }

  return doctors.find((doctor) => {
    const fullName = String(doctor.fullName || "").toLowerCase();
    const normalizedName = fullName.replace(/^dr\.?\s*/, "");
    const specialty = String(doctor.specialty || "").toLowerCase();

    if (fullName.includes(lower) || normalizedName.includes(lower) || lower.includes(normalizedName)) {
      return true;
    }

    if (specialty && specialty.length > 3 && lower.includes(specialty)) {
      return true;
    }

    return normalizedName
      .split(/\s+/)
      .filter((part) => part.length > 2)
      .some((part) => lower.includes(part));
  }) || null;
}

function scoreDoctorForSymptoms(doctor, lowerSymptoms) {
  let score = 0;
  const normalizedName = doctor.fullName.toLowerCase().replace(/^dr\.?\s*/, "");
  const specialty = (doctor.specialty || "").toLowerCase();

  if (normalizedName.split(/\s+/).some((token) => token && lowerSymptoms.includes(token))) {
    score += 4;
  }

  const specialtyMatchers = [
    { pattern: /\b(chest pain|palpitations|heart|bp|pressure)\b/i, specialty: "internal medicine" },
    { pattern: /\b(fever|cough|cold|infection|weakness|sore throat)\b/i, specialty: "general medicine" },
    { pattern: /\b(family doctor|family medicine)\b/i, specialty: "family medicine" },
    { pattern: /\b(checkup|general doctor|general practice|routine)\b/i, specialty: "general practice" },
  ];

  specialtyMatchers.forEach((rule) => {
    if (rule.pattern.test(lowerSymptoms) && specialty.includes(rule.specialty)) {
      score += 3;
    }
  });

  if (doctor.nextAvailableSlot) {
    score += 1;
  }

  return score;
}

function buildOfflineFallbackReply({ latestText }) {
  const lower = latestText.toLowerCase();

  if (EMERGENCY_INTENT_REGEX.test(lower)) {
    return {
      text: "Your symptoms may indicate an emergency. Please call emergency services now or go to the nearest emergency department immediately.",
      summary: "",
      triageLevel: "emergency",
    };
  }

  if (BOOKING_INTENT_REGEX.test(lower)) {
    return {
      text: "I can help with booking, but first share your symptoms or reason for visit. Then I'll show doctors and available slots.",
      summary: "",
      triageLevel: "routine",
    };
  }

  return {
    text: "I’m ready to help. Tell me your main concern, when it started, and whether it feels better or worse at different times.",
    summary: "",
    triageLevel: "routine",
  };
}

function normalizePrecheckAnswer(question, answerText) {
  const type = String(question?.type || "text").toLowerCase();
  const options = Array.isArray(question?.options) ? question.options : [];
  const required = question?.required !== false;
  const questionText = String(question?.question || "").toLowerCase();
  const raw = String(answerText || "").trim();
  const lower = raw.toLowerCase();

  const isSkip = lower === "skip" || lower === "na" || lower === "n/a";
  if (!raw) {
    if (required) {
      return { isValid: false, message: "This question is required. Please share your answer." };
    }
    return { isValid: true, value: "Skipped" };
  }

  if (isSkip) {
    if (required) {
      return { isValid: false, message: "This question is required, so please answer it instead of skipping." };
    }
    return { isValid: true, value: "Skipped" };
  }

  if (type === "yesno") {
    const hasYes = /\b(yes|yep|yeah|y)\b/i.test(raw);
    const hasNo = /\b(no|nope|nah|n)\b/i.test(raw);
    if (hasYes && !hasNo) return { isValid: true, value: "yes" };
    if (hasNo && !hasYes) return { isValid: true, value: "no" };
    return { isValid: false, message: "Please answer with yes or no." };
  }

  if (type === "multiple_choice" && options.length > 0) {
    const matched = options.find((option) => String(option).toLowerCase() === lower);
    if (!matched) {
      return { isValid: false, message: `Please choose one of: ${options.join(", ")}.` };
    }
    return { isValid: true, value: matched };
  }

  if (type === "rating") {
    const numericMatch = raw.match(/\b([1-9]|10)(?:\s*\/\s*10)?\b/);
    const numeric = numericMatch ? Number(numericMatch[1]) : Number(raw);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 10) {
      return { isValid: false, message: "Please enter a number between 1 and 10." };
    }
    return { isValid: true, value: String(Math.round(numeric)) };
  }

  if (type === "text" && /when did.*start|how long|duration|since when/.test(questionText)) {
    if (/^\d+$/.test(raw) || !/\b(today|yesterday|tonight|since|hour|hours|day|days|week|weeks|month|months|year|years)\b/i.test(raw)) {
      return {
        isValid: false,
        message: "Please include the time unit, for example '3 days' or 'since yesterday'."
      };
    }
  }

  return { isValid: true, value: raw };
}

function getQuestionnaireByAppointmentId(state, appointmentId) {
  if (!appointmentId) {
    return null;
  }

  return Object.values(state?.precheckQuestionnaires?.byId || {}).find(
    (questionnaire) => questionnaire?.appointmentId === appointmentId
  ) || null;
}

function getQuestionnaireQuestions(questionnaire) {
  return questionnaire?.editedQuestions?.length
    ? questionnaire.editedQuestions
    : questionnaire?.aiQuestions || [];
}

function countAnsweredPrecheckResponses(questionnaire) {
  const responses = questionnaire?.patientResponses || {};
  return Object.values(responses).filter((value) => String(value || "").trim()).length;
}

function getAdaptiveTargetQuestionCount(questionnaire, fallback = DEFAULT_ADAPTIVE_PRECHECK_TARGET) {
  const numeric = Number(questionnaire?.metadata?.targetQuestionCount);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(1, Math.round(numeric));
}

function buildPrecheckConversationMessages(questionnaire, totalQuestions) {
  const questions = getQuestionnaireQuestions(questionnaire);
  const responses = questionnaire?.patientResponses || {};
  const rawResponses = questionnaire?.metadata?.rawPatientResponses || {};
  const messages = [];

  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    const answer = String(rawResponses?.[question.id] || responses?.[question.id] || "").trim();

    messages.push({
      role: "ai",
      text: buildDynamicQuestionPrompt(question, index + 1, totalQuestions),
      time: new Date(),
      meta: `precheck-q-${question.id}`,
    });

    if (!answer) {
      break;
    }

    messages.push({
      role: "user",
      text: answer,
      time: new Date(),
      meta: `precheck-a-${question.id}`,
    });
  }

  return messages;
}

function buildDynamicQuestionPrompt(question, questionNumber, totalQuestions) {
  return question?.question || `Question ${questionNumber}`;
}

function getPrecheckProgressLabel(flow) {
  const total = Math.max(flow.targetQuestionCount || 0, flow.dynamicQuestions?.length || 0);
  if (flow.phase === "preparing") return "Preparing adaptive questions...";
  if (flow.phase === "dynamic") return `Question ${flow.currentDynamicIndex + 1} of ${total}`;
  if (flow.phase === "submitting") return "Submitting...";
  if (flow.phase === "unavailable") return "AI questionnaire unavailable";
  if (flow.phase === "complete" || flow.completed) return "Complete!";
  return "";
}

function getPrecheckProgressPercent(flow) {
  const total = Math.max(flow.targetQuestionCount || 0, flow.dynamicQuestions?.length || 0);
  if (flow.phase === "preparing") return 8;
  if (flow.phase === "dynamic" && total > 0) return Math.round(((flow.currentDynamicIndex + 1) / total) * 100);
  if (flow.phase === "submitting" || flow.phase === "complete" || flow.completed) return 100;
  return 0;
}
